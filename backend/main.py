# ─────────────────────────────────────────────────────────────────────────────
# main.py — FastAPI Application (Presentation Layer)
#
# Endpoints:
#   GET  /              → health check
#   GET  /health        → health check (for Render)
#   POST /api/analyze   → batch analysis (2-30 assignments)
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Annotated
import json
import uvicorn

from ml.models import load_models
from services.analyzer import run_batch_analysis


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("⏳ Loading ML models at startup ...")
    load_models()
    yield
    print("Server shutdown")


app = FastAPI(
    title="AI Academic Integrity Analyzer API",
    description="Batch semantic plagiarism detection + AI-generated content analysis",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        # Add your production Vercel URL here after deployment
        # "https://your-app.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "service": "AI Academic Integrity Analyzer", "version": "2.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/analyze")
async def analyze(
    # Up to 30 file slots
    files: Annotated[list[UploadFile], File()] = [],
    # JSON-encoded list of pasted texts (parallel to files)
    texts_json: str = Form(default="[]"),
    # JSON-encoded list of display names
    names_json:  str = Form(default="[]"),
    # Similarity threshold (0.0-1.0)
    threshold:   float = Form(default=0.75),
):
    """
    Batch analysis endpoint. Accepts up to 30 assignments.

    The frontend sends:
      - files[]     multipart file uploads
      - texts_json  JSON array of pasted texts (parallel to files)
      - names_json  JSON array of display names
    - threshold   float (default 0.75)
    """
    try:
        texts = json.loads(texts_json)
        names = json.loads(names_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Invalid JSON in texts_json or names_json")

    # Pad shorter lists so zip() works correctly
    max_len = max(len(files), len(texts), len(names))
    files   = list(files)   + [None] * (max_len - len(files))
    texts   = list(texts)   + [""]   * (max_len - len(texts))
    names   = list(names)   + [""]   * (max_len - len(names))

    if max_len == 0:
        raise HTTPException(status_code=422, detail="No assignments submitted.")
    if threshold < 0.5 or threshold > 0.95:
        raise HTTPException(status_code=422, detail="Threshold must be between 0.50 and 0.95")

    try:
        result = await run_batch_analysis(
            files=files,
            texts=texts,
            names=names,
            threshold=threshold,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
