# IntegrityGuard AI

IntegrityGuard AI is a web-based academic integrity analyzer that detects semantic plagiarism and estimates AI-generated content probability for student submissions.

## Features

- Batch upload up to 30 PDF/TXT assignments
- Pairwise semantic similarity matrix and ranked pairs
- Paragraph-level evidence and top sentence pairs
- AI probability scoring with risk labels and inconclusive note (31-60%)
- Report exports: HTML view, TXT, JSON, and PDF

## Tech Stack

- Backend: FastAPI, SentenceTransformers, Transformers, PyMuPDF
- Frontend: Next.js (App Router), React, Tailwind CSS

## Repo Structure

- backend/ - FastAPI API and ML pipeline
- frontend/ - Next.js UI
- render.yaml - Render backend deployment config

## Prerequisites

- Python 3.11
- Node.js 18+ (or 20+)

## Local Setup

### Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Environment Variables

### Backend

- HUGGINGFACE_API_TOKEN: Use Hugging Face Inference API for AI detection (reduces memory)
- HUGGINGFACE_AI_MODEL: Optional, default PirateXX/AI-Content-Detector
- HUGGINGFACE_API_URL: Optional custom endpoint
- AI_REMOTE_WORKERS: Optional, limits concurrent remote requests (default 2)

### Frontend

- NEXT_PUBLIC_API_URL: Backend base URL (default http://localhost:8000)

## Deployment Notes

- Render backend uses render.yaml. Set PYTHON_VERSION=3.11.x.
- If memory is limited, set HUGGINGFACE_API_TOKEN to avoid local AI detector load.
- Vercel frontend: set NEXT_PUBLIC_API_URL to the Render backend URL.

## Reports

- View report opens an HTML report in a new tab.
- Download TXT/JSON/PDF exports for submission or archiving.

## Disclaimer

All scores are probabilistic indicators to assist human review and are not definitive verdicts.
