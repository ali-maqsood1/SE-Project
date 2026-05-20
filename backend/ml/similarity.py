# ─────────────────────────────────────────────────────────────────────────────
# ml/similarity.py — Batch Semantic Similarity Engine
#
# KEY UPGRADE vs v1 (2-file version):
#
#   v1 (slow):  for each pair → encode A, encode B, compute matrix
#               20 students = 190 pairs = encode same text up to 19 times each
#
#   v2 (fast):  encode ALL N assignments ONCE upfront
#               build a global sentence embedding matrix
#               compute all N×(N-1)/2 pairs from that single matrix
#               20 students: ~90 sec instead of ~47 min
#
# Algorithm:
#   1. Collect all sentences across all assignments
#   2. Encode them in one batched model call
#   3. Slice embeddings per assignment
#   4. For each pair: cosine_similarity(slice_i, slice_j) in-memory — instant
# ─────────────────────────────────────────────────────────────────────────────

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from itertools import combinations

from ml.models import get_embedding_model
from utils.preprocessor import preprocess_text, split_into_paragraphs

SIMILARITY_THRESHOLD = 0.75   # paragraph flagging cutoff (SRS default)
MIN_SCORE_FOR_PAIRS  = 0.50   # minimum score to include in top sentence pairs
TOP_N_OVERALL        = 10     # top-N sentence scores for overall similarity
PARA_TOP_N           = 3      # top-N sentence scores for paragraph similarity
PARA_TOP_PAIRS       = 3      # sentence pairs returned per flagged paragraph


def encode_all_assignments(
    texts: list[str],
) -> tuple[list[list[str]], np.ndarray, list[tuple[int, int]]]:
    """
    Encode all assignment sentences in a single batched model call.

    Returns:
        sentences_per_doc  — list of raw sentence lists, one per assignment
        all_embeddings     — stacked embedding matrix [total_sentences, 384]
        slice_indices      — list of (start, end) index pairs into all_embeddings
    """
    model = get_embedding_model()

    sentences_per_doc: list[list[str]] = []
    cleaned_per_doc: list[list[str]] = []
    for t in texts:
        raw_sents, cleaned_sents = preprocess_text(t)
        sentences_per_doc.append(raw_sents)
        cleaned_per_doc.append(cleaned_sents)

    # Flatten all sentences into one list for a single encode() call
    all_sentences: list[str] = []
    slice_indices: list[tuple[int, int]] = []

    for sents in cleaned_per_doc:
        start = len(all_sentences)
        all_sentences.extend(sents)
        slice_indices.append((start, len(all_sentences)))

    if not all_sentences:
        return sentences_per_doc, np.array([]), slice_indices

    # ONE batched encoding call — the core performance win
    print(f"  Encoding {len(all_sentences)} sentences from {len(texts)} assignments...")
    all_embeddings = model.encode(
        all_sentences,
        convert_to_numpy=True,
        show_progress_bar=False,
        batch_size=64,          # process 64 sentences at a time
    )
    print(f"  ✅ Encoding complete — shape {all_embeddings.shape}")

    return sentences_per_doc, all_embeddings, slice_indices


def compute_pair_similarity(
    idx_a: int,
    idx_b: int,
    sentences_per_doc: list[list[str]],
    all_embeddings: np.ndarray,
    slice_indices: list[tuple[int, int]],
    texts: list[str],
    threshold: float = SIMILARITY_THRESHOLD,
) -> dict:
    """
    Compute similarity between one pair of assignments.
    Uses pre-computed embeddings — no model calls here.

    This function is called N×(N-1)/2 times but is pure NumPy — very fast.
    """
    # Slice pre-computed embeddings for this pair
    sa, ea = slice_indices[idx_a]
    sb, eb = slice_indices[idx_b]

    sents_a = sentences_per_doc[idx_a]
    sents_b = sentences_per_doc[idx_b]

    if not sents_a or not sents_b:
        return _empty_pair_result(idx_a, idx_b)

    emb_a = all_embeddings[sa:ea]
    emb_b = all_embeddings[sb:eb]

    # Full pairwise cosine similarity matrix — pure NumPy, instant
    sim_matrix = cosine_similarity(emb_a, emb_b)

    # Greedy top sentence pairs (each sentence used at most once)
    flat_indices = np.argsort(sim_matrix.ravel())[::-1]
    top_pairs = []
    used_a, used_b = set(), set()

    for flat_idx in flat_indices[:100]:
        i, j = divmod(int(flat_idx), sim_matrix.shape[1])
        if i not in used_a and j not in used_b:
            score = float(sim_matrix[i, j])
            if score > MIN_SCORE_FOR_PAIRS:
                top_pairs.append({
                    "sentence_a": sents_a[i],
                    "sentence_b": sents_b[j],
                    "score":      round(score, 4),
                    "score_pct":  round(score * 100, 1),
                })
                used_a.add(i)
                used_b.add(j)
        if len(top_pairs) >= 6:
            break

    # Overall score = mean of top-N sentence-pair cosine scores
    max_pairs = min(TOP_N_OVERALL, len(sents_a), len(sents_b))
    if max_pairs <= 0:
        overall = 0.0
    else:
        flat_scores = np.sort(sim_matrix.ravel())[::-1][:max_pairs]
        overall = float(np.mean(flat_scores)) if flat_scores.size else 0.0

    # Paragraph-level comparison (also uses pre-encoded sentences, re-aggregated)
    flagged_paragraphs = _compare_paragraphs(
        texts[idx_a], texts[idx_b], threshold
    )

    return {
        "assignment_a_index": idx_a,
        "assignment_b_index": idx_b,
        "overall_score":      round(overall, 4),
        "overall_score_pct":  round(overall * 100, 1),
        "risk_level":         _risk(overall),
        "flagged_paragraphs": flagged_paragraphs,
        "top_sentence_pairs": top_pairs,
        "threshold_used":     threshold,
    }


def compute_all_pairs(
    texts: list[str],
    names: list[str],
    threshold: float = SIMILARITY_THRESHOLD,
) -> dict:
    """
    Main entry point: compute similarity for ALL pairs in a batch.

    Args:
        texts:  list of plain text strings, one per assignment
        names:  display names (filenames or "Assignment N")
        threshold: paragraph flagging cutoff

    Returns:
        {
            pairs:         list of per-pair similarity results (sorted high→low)
            summary_matrix: NxN grid of overall_score_pct values (for the UI heatmap)
            high_risk_pairs: filtered list of pairs above threshold
        }
    """
    n = len(texts)
    print(f"\n📊 Batch similarity: {n} assignments → {n*(n-1)//2} pairs")

    # STEP 1: Encode all assignments once
    sentences_per_doc, all_embeddings, slice_indices = encode_all_assignments(texts)

    # STEP 2: Compute all pairs (fast — pure NumPy after encoding)
    pair_results = []
    for idx_a, idx_b in combinations(range(n), 2):
        result = compute_pair_similarity(
            idx_a, idx_b,
            sentences_per_doc, all_embeddings, slice_indices,
            texts, threshold,
        )
        # Attach names for easy frontend rendering
        result["name_a"] = names[idx_a]
        result["name_b"] = names[idx_b]
        pair_results.append(result)

    # Sort by score descending (most suspicious first)
    pair_results.sort(key=lambda x: x["overall_score"], reverse=True)

    # STEP 3: Build NxN summary matrix for heatmap
    matrix = [[0.0] * n for _ in range(n)]
    for r in pair_results:
        i, j = r["assignment_a_index"], r["assignment_b_index"]
        matrix[i][j] = r["overall_score_pct"]
        matrix[j][i] = r["overall_score_pct"]   # symmetric
    # Diagonal = 100% (self-similarity)
    for i in range(n):
        matrix[i][i] = 100.0

    high_risk = [r for r in pair_results if r["risk_level"] == "high"]
    moderate  = [r for r in pair_results if r["risk_level"] == "moderate"]

    return {
        "pair_count":       len(pair_results),
        "assignment_count": n,
        "pairs":            pair_results,
        "summary_matrix":   matrix,
        "names":            names,
        "high_risk_count":  len(high_risk),
        "moderate_risk_count": len(moderate),
        "threshold_used":   threshold,
    }


# ── Paragraph comparison (aggregate sentence-level similarity)
def _encode_paragraph_sentences(
    paragraphs: list[str],
    model,
) -> tuple[list[list[str]], np.ndarray, list[tuple[int, int]]]:
    raw_sents_per_para: list[list[str]] = []
    all_cleaned: list[str] = []
    slice_indices: list[tuple[int, int]] = []

    for para in paragraphs:
        raw_sents, cleaned_sents = preprocess_text(para)
        raw_sents_per_para.append(raw_sents)
        start = len(all_cleaned)
        all_cleaned.extend(cleaned_sents)
        slice_indices.append((start, len(all_cleaned)))

    if not all_cleaned:
        return raw_sents_per_para, np.array([]), slice_indices

    embeddings = model.encode(
        all_cleaned,
        convert_to_numpy=True,
        show_progress_bar=False,
        batch_size=64,
    )
    return raw_sents_per_para, embeddings, slice_indices


def _top_sentence_pairs_from_matrix(
    sim_matrix: np.ndarray,
    sents_a: list[str],
    sents_b: list[str],
    limit: int,
) -> list[dict]:
    if sim_matrix.size == 0:
        return []
    flat_indices = np.argsort(sim_matrix.ravel())[::-1]
    top_pairs = []
    used_a, used_b = set(), set()

    for flat_idx in flat_indices:
        i, j = divmod(int(flat_idx), sim_matrix.shape[1])
        if i in used_a or j in used_b:
            continue
        score = float(sim_matrix[i, j])
        if score < MIN_SCORE_FOR_PAIRS:
            break
        top_pairs.append({
            "sentence_a": sents_a[i],
            "sentence_b": sents_b[j],
            "score":      round(score, 4),
            "score_pct":  round(score * 100, 1),
        })
        used_a.add(i)
        used_b.add(j)
        if len(top_pairs) >= limit:
            break

    return top_pairs


def _compare_paragraphs(text_a: str, text_b: str, threshold: float) -> list[dict]:
    model = get_embedding_model()
    paras_a = split_into_paragraphs(text_a)
    paras_b = split_into_paragraphs(text_b)
    if not paras_a or not paras_b:
        return []

    raw_a, emb_a, slices_a = _encode_paragraph_sentences(paras_a, model)
    raw_b, emb_b, slices_b = _encode_paragraph_sentences(paras_b, model)
    if emb_a.size == 0 or emb_b.size == 0:
        return []

    results = []
    for i in range(len(paras_a)):
        sa, ea = slices_a[i]
        if sa == ea:
            continue
        for j in range(len(paras_b)):
            sb, eb = slices_b[j]
            if sb == eb:
                continue

            sim = cosine_similarity(emb_a[sa:ea], emb_b[sb:eb])
            top_scores = np.sort(sim.ravel())[::-1][:PARA_TOP_N]
            score = float(np.mean(top_scores)) if top_scores.size else 0.0
            if score >= threshold:
                results.append({
                    "para_a_index": i + 1,
                    "para_b_index": j + 1,
                    "para_a_text":  paras_a[i][:280],
                    "para_b_text":  paras_b[j][:280],
                    "score":        round(score, 4),
                    "score_pct":    round(score * 100, 1),
                    "top_sentence_pairs": _top_sentence_pairs_from_matrix(
                        sim, raw_a[i], raw_b[j], PARA_TOP_PAIRS
                    ),
                })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:5]


def _risk(score: float) -> str:
    if score >= 0.75: return "high"
    if score >= 0.40: return "moderate"
    return "low"


def _empty_pair_result(idx_a: int, idx_b: int) -> dict:
    return {
        "assignment_a_index": idx_a,
        "assignment_b_index": idx_b,
        "overall_score":      0.0,
        "overall_score_pct":  0.0,
        "risk_level":         "low",
        "flagged_paragraphs": [],
        "top_sentence_pairs": [],
        "threshold_used":     SIMILARITY_THRESHOLD,
    }
