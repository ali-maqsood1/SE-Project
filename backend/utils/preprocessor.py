# utils/preprocessor.py — Data Layer: NLP Preprocessing
import re


_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9\s]")


def split_sentences(text: str) -> list[str]:
    """Split raw text into sentences without altering punctuation/case."""
    if not text:
        return []
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    sentences = _SENTENCE_SPLIT_RE.split(text)
    return [s.strip() for s in sentences if s.strip()]


def normalize_text(text: str) -> str:
    """Lowercase and strip punctuation/special characters for model input."""
    if not text:
        return ""
    text = text.lower()
    text = _NON_ALNUM_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def preprocess_text(text: str, min_words: int = 5) -> tuple[list[str], list[str]]:
    """Split text into sentences and return (raw, cleaned) lists."""
    raw_sentences = split_sentences(text)
    cleaned_sentences: list[str] = []
    filtered_raw: list[str] = []
    for raw in raw_sentences:
        cleaned = normalize_text(raw)
        if len(cleaned.split()) >= min_words:
            filtered_raw.append(raw)
            cleaned_sentences.append(cleaned)
    return filtered_raw, cleaned_sentences


def split_into_paragraphs(text: str, chunk_size: int = 5) -> list[str]:
    """
    Split on double newlines (primary) or group into N-sentence chunks (fallback).
    Fallback handles single-block text with no paragraph breaks.
    """
    if not text:
        return []
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 50]
    if len(paragraphs) < 2:
        sents = split_sentences(text)
        paragraphs = [
            " ".join(sents[i: i + chunk_size])
            for i in range(0, len(sents), chunk_size)
        ]
        paragraphs = [p for p in paragraphs if p.strip()]
    return paragraphs if paragraphs else [text]
