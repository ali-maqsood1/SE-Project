# utils/file_extractor.py — Data Layer: File Text Extraction
import re
import fitz  # PyMuPDF

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError(f"'{filename}' exceeds 10MB limit ({len(file_bytes)/1024/1024:.1f}MB)")

    name = filename.lower()
    if name.endswith(".pdf"):
        return _sanitize_text(_from_pdf(file_bytes, filename))
    elif name.endswith(".txt"):
        return _sanitize_text(_from_txt(file_bytes, filename))
    else:
        raise ValueError(f"Unsupported format: '{filename}'. Upload PDF or TXT.")


def _from_pdf(data: bytes, name: str) -> str:
    try:
        parts = []
        with fitz.open(stream=data, filetype="pdf") as doc:
            if doc.page_count == 0:
                raise ValueError(f"'{name}' has no pages.")
            for page in doc:
                parts.append(page.get_text())
        text = "\n\n".join(parts).strip()
        if not text:
            raise ValueError(f"No text extracted from '{name}'. May be a scanned PDF — paste text directly instead.")
        return text
    except fitz.FileDataError:
        raise ValueError(f"'{name}' is corrupt or not a valid PDF.")


def _from_txt(data: bytes, name: str) -> str:
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            return data.decode(enc).strip()
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Could not decode '{name}'. Ensure it is a UTF-8 text file.")


def _sanitize_text(text: str) -> str:
    """Remove control characters to prevent malicious payloads in inputs."""
    if not text:
        return ""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
    return text.strip()
