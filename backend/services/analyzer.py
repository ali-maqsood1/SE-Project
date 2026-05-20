# ─────────────────────────────────────────────────────────────────────────────
# services/analyzer.py — Application Layer: Batch Analysis Orchestrator
#
# Orchestrates the full pipeline for N assignments:
#   1. Extract text from all uploaded files / pasted inputs
#   2. Validate all inputs
#   3. encode_all_assignments() — one batched model call
#   4. compute_all_pairs()      — N×(N-1)/2 comparisons from cached embeddings
#   5. detect_all()             — parallel AI detection on all N texts
#   6. Build structured JSON response
# ─────────────────────────────────────────────────────────────────────────────

import time
from fastapi import UploadFile

from utils.file_extractor import extract_text_from_bytes
from ml.similarity import compute_all_pairs
from ml.ai_detector import detect_all

MIN_WORDS        = 20
MAX_ASSIGNMENTS  = 30


async def run_batch_analysis(
    files: list[UploadFile],
    texts: list[str],
    names: list[str],
    threshold: float = 0.75,
) -> dict:
    """
    Run full batch analysis on N assignments.

    Args:
        files:  list of UploadFile objects (may be empty/None entries)
        texts:  list of pasted text strings (parallel to files)
        names:  list of display names
        threshold: similarity flagging cutoff

    Returns: structured JSON response consumed by Next.js frontend
    """
    t_start = time.time()

    # ── Step 1: Resolve all inputs ────────────────────────────────────────────
    resolved_texts: list[str] = []
    resolved_names: list[str] = []

    for i, (file, text, name) in enumerate(zip(files, texts, names)):
        label = f"Assignment {i+1}"

        if file and file.filename:
            raw = await file.read()
            content = extract_text_from_bytes(raw, file.filename)
            resolved_texts.append(content)
            resolved_names.append(file.filename)
        elif text and text.strip():
            resolved_texts.append(text.strip())
            resolved_names.append(name or label)
        else:
            # Skip empty slots silently
            continue

    # ── Step 2: Validate ──────────────────────────────────────────────────────
    n = len(resolved_texts)

    if n < 2:
        raise ValueError("At least 2 assignments are required for comparison.")
    if n > MAX_ASSIGNMENTS:
        raise ValueError(f"Maximum {MAX_ASSIGNMENTS} assignments per batch (submitted {n}).")

    skipped_short = []
    valid_texts, valid_names = [], []
    for text, name in zip(resolved_texts, resolved_names):
        if len(text.split()) < MIN_WORDS:
            skipped_short.append(name)
        else:
            valid_texts.append(text)
            valid_names.append(name)

    if len(valid_texts) < 2:
        raise ValueError(
            f"At least 2 assignments must have ≥{MIN_WORDS} words. "
            f"Too short: {', '.join(skipped_short)}"
        )

    print(f"\n{'='*60}")
    print(f"Batch analysis: {len(valid_texts)} assignments")
    print(f"{'='*60}")

    # ── Step 3 + 4: Similarity (encodes once, compares all pairs) ─────────────
    t_sim = time.time()
    similarity_result = compute_all_pairs(valid_texts, valid_names, threshold)
    print(f"  Similarity done in {time.time()-t_sim:.1f}s")

    # ── Step 5: AI detection (parallel across all assignments) ────────────────
    t_ai = time.time()
    ai_results = detect_all(valid_texts)
    print(f"  AI detection done in {time.time()-t_ai:.1f}s")

    total_time = round(time.time() - t_start, 1)
    print(f"Total batch time: {total_time}s\n")

    # ── Step 6: Build response ────────────────────────────────────────────────
    assignments_meta = [
        {
            "index":      i,
            "name":       valid_names[i],
            "word_count": len(valid_texts[i].split()),
            "ai":         ai_results[i],
        }
        for i in range(len(valid_texts))
    ]

    return {
        "success":           True,
        "assignment_count":  len(valid_texts),
        "pair_count":        similarity_result["pair_count"],
        "processing_time_s": total_time,
        "skipped":           skipped_short,
        "assignments":       assignments_meta,
        "similarity":        similarity_result,
        "overall_stats":     _compute_stats(similarity_result, ai_results),
    }


def _compute_stats(sim: dict, ai: list[dict]) -> dict:
    """Aggregate statistics across all assignments and pairs."""
    pairs = sim["pairs"]
    scores = [p["overall_score_pct"] for p in pairs]

    ai_probs = [
        a["ai_probability_pct"]
        for a in ai
        if not a["skipped"] and a["ai_probability_pct"] is not None
    ]

    return {
        "highest_similarity_pct": max(scores) if scores else 0,
        "average_similarity_pct": round(sum(scores) / len(scores), 1) if scores else 0,
        "high_risk_pairs":        sim["high_risk_count"],
        "moderate_risk_pairs":    sim["moderate_risk_count"],
        "highest_ai_pct":         max(ai_probs) if ai_probs else None,
        "average_ai_pct":         round(sum(ai_probs) / len(ai_probs), 1) if ai_probs else None,
        "flagged_for_review":     sim["high_risk_count"] + len([
            a for a in ai if not a["skipped"] and (a["ai_probability_pct"] or 0) >= 61
        ]),
    }
