# ─────────────────────────────────────────────────────────────────────────────
# ml/ai_detector.py — Batch AI Detection Engine
#
# KEY UPGRADE vs v1:
#   v1: detect_ai_content(text) — called once per assignment, sequentially
#   v2: detect_all(texts)       — runs all N assignments in parallel via
#                                  ThreadPoolExecutor (I/O-bound model inference)
#
# Model upgrade: PirateXX/AI-Content-Detector
#   Trained on GPT-3.5 / GPT-4 output (vs old model trained on GPT-2)
#   ~82% accuracy on modern AI text vs ~60% for the old detector
#
# Token limit unchanged: 512 tokens hard limit → truncate to 400 words
# ─────────────────────────────────────────────────────────────────────────────

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

from ml.models import get_ai_detector

HIGH_RISK_THRESHOLD     = 0.61
MODERATE_RISK_THRESHOLD = 0.31
MIN_WORDS               = 30
TRUNCATION_WORDS        = 400
MAX_PARALLEL_WORKERS    = 4    # safe for CPU inference; increase for GPU

HF_API_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN")
HF_MODEL_ID = os.getenv("HUGGINGFACE_AI_MODEL", "PirateXX/AI-Content-Detector")
HF_API_URL = os.getenv(
    "HUGGINGFACE_API_URL",
    f"https://api-inference.huggingface.co/models/{HF_MODEL_ID}",
)
USE_REMOTE_AI = bool(HF_API_TOKEN)
REMOTE_MAX_WORKERS = int(os.getenv("AI_REMOTE_WORKERS", "2"))


def detect_single(text: str) -> dict:
    """
    Detect AI probability for a single text.
    Called in parallel by detect_all().
    """
    if not text or not text.strip():
        return _skip("No text provided")

    words = text.split()
    if len(words) < MIN_WORDS:
        return _skip(f"Too short ({len(words)} words; min {MIN_WORDS})")

    truncated  = " ".join(words[:TRUNCATION_WORDS])
    if USE_REMOTE_AI:
        return _detect_remote(truncated, len(words))

    detector   = get_ai_detector()
    result     = detector(truncated)[0]
    label      = result["label"]
    confidence = result["score"]

    # PirateXX/AI-Content-Detector:
    # LABEL_1 = AI-generated, LABEL_0 = Human-written (same convention as old model)
    ai_prob = confidence if label == "LABEL_1" else 1.0 - confidence

    return _build_result(ai_prob, len(words))


def detect_all(texts: list[str]) -> list[dict]:
    """
    Run AI detection on all N assignments in parallel.

    Uses ThreadPoolExecutor — model inference releases the GIL during
    the heavy numpy/torch ops, so threads genuinely run concurrently on CPU.

    For N=30: sequential ≈ 30 × 3s = 90s
               parallel  ≈ ceil(30/4) × 3s = 24s
    """
    n = len(texts)
    worker_count = REMOTE_MAX_WORKERS if USE_REMOTE_AI else MAX_PARALLEL_WORKERS
    print(f"\n🤖 AI detection: {n} assignments (parallel workers={worker_count})")

    results = [None] * n   # pre-allocate to maintain order

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        # Submit all jobs, track original index
        future_to_idx = {
            executor.submit(detect_single, text): i
            for i, text in enumerate(texts)
        }
        done = 0
        for future in as_completed(future_to_idx):
            i = future_to_idx[future]
            try:
                results[i] = future.result()
            except Exception as e:
                results[i] = _skip(f"Detection error: {str(e)}")
            done += 1
            if done % 5 == 0 or done == n:
                print(f"  AI detection: {done}/{n} complete")

    print("  ✅ AI detection complete")
    return results


# ── Helpers ──────────────────────────────────────────────────────────────────

def _risk(p: float) -> str:
    if p >= HIGH_RISK_THRESHOLD:     return "high"
    if p >= MODERATE_RISK_THRESHOLD: return "moderate"
    return "low"


def _skip(reason: str) -> dict:
    return {
        "ai_probability":     None,
        "ai_probability_pct": None,
        "risk_level":         "unknown",
        "skipped":            True,
        "skip_reason":        reason,
        "words_analyzed":     0,
        "total_words":        0,
        "truncated":          False,
    }


def _build_result(ai_prob: float, total_words: int) -> dict:
    return {
        "ai_probability":     round(ai_prob, 4),
        "ai_probability_pct": round(ai_prob * 100, 1),
        "risk_level":         _risk(ai_prob),
        "skipped":            False,
        "skip_reason":        None,
        "words_analyzed":     min(total_words, TRUNCATION_WORDS),
        "total_words":        total_words,
        "truncated":          total_words > TRUNCATION_WORDS,
    }


def _extract_label_score(payload: object) -> tuple[str, float]:
    if isinstance(payload, dict):
        if "error" in payload:
            raise RuntimeError(payload.get("error"))
        if "label" in payload and "score" in payload:
            return payload["label"], float(payload["score"])

    if isinstance(payload, list) and payload:
        data = payload
        if isinstance(payload[0], list):
            data = payload[0]
        best = max(data, key=lambda x: x.get("score", 0.0))
        return best["label"], float(best["score"])

    raise RuntimeError("Unexpected AI detector response")


def _detect_remote(text: str, total_words: int) -> dict:
    if not HF_API_TOKEN:
        return _skip("Remote AI detector not configured")

    headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
    payload = {"inputs": text}

    try:
        resp = requests.post(HF_API_URL, headers=headers, json=payload, timeout=30)
        if resp.status_code != 200:
            return _skip(f"Remote AI error: HTTP {resp.status_code}")
        data = resp.json()
        label, confidence = _extract_label_score(data)
    except Exception as exc:
        return _skip(f"Remote AI error: {exc}")

    ai_prob = confidence if label == "LABEL_1" else 1.0 - confidence
    return _build_result(ai_prob, total_words)
