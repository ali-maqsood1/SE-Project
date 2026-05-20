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

from concurrent.futures import ThreadPoolExecutor, as_completed
from ml.models import get_ai_detector

HIGH_RISK_THRESHOLD     = 0.61
MODERATE_RISK_THRESHOLD = 0.31
MIN_WORDS               = 30
TRUNCATION_WORDS        = 400
MAX_PARALLEL_WORKERS    = 4    # safe for CPU inference; increase for GPU


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
    detector   = get_ai_detector()
    result     = detector(truncated)[0]
    label      = result["label"]
    confidence = result["score"]

    # PirateXX/AI-Content-Detector:
    # LABEL_1 = AI-generated, LABEL_0 = Human-written (same convention as old model)
    ai_prob = confidence if label == "LABEL_1" else 1.0 - confidence

    return {
        "ai_probability":     round(ai_prob, 4),
        "ai_probability_pct": round(ai_prob * 100, 1),
        "risk_level":         _risk(ai_prob),
        "skipped":            False,
        "skip_reason":        None,
        "words_analyzed":     min(len(words), TRUNCATION_WORDS),
        "total_words":        len(words),
        "truncated":          len(words) > TRUNCATION_WORDS,
    }


def detect_all(texts: list[str]) -> list[dict]:
    """
    Run AI detection on all N assignments in parallel.

    Uses ThreadPoolExecutor — model inference releases the GIL during
    the heavy numpy/torch ops, so threads genuinely run concurrently on CPU.

    For N=30: sequential ≈ 30 × 3s = 90s
               parallel  ≈ ceil(30/4) × 3s = 24s
    """
    n = len(texts)
    print(f"\n🤖 AI detection: {n} assignments (parallel workers={MAX_PARALLEL_WORKERS})")

    results = [None] * n   # pre-allocate to maintain order

    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_WORKERS) as executor:
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
