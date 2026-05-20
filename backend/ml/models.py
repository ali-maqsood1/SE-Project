# ─────────────────────────────────────────────────────────────────────────────
# ml/models.py — ML Processing Layer
#
# Model upgrades vs v1:
#   AI Detector: roberta-base-openai-detector (GPT-2 era, 2019)
#             → PirateXX/AI-Content-Detector  (GPT-3.5/4 era, ~82% accuracy)
#
# Loaded ONCE at startup via FastAPI lifespan. Never loaded per-request.
# ─────────────────────────────────────────────────────────────────────────────

import os
from sentence_transformers import SentenceTransformer
import torch

embedding_model: SentenceTransformer = None
ai_detector = None


def load_models():
    global embedding_model, ai_detector

    device    = 0 if torch.cuda.is_available() else -1
    dev_name  = "GPU ⚡" if torch.cuda.is_available() else "CPU"
    print(f"🔧 Device: {dev_name}")

    # ── Semantic similarity model (unchanged — already best-in-class for speed/accuracy)
    print("⏳ Loading all-MiniLM-L6-v2 ...")
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    print("✅ Sentence Transformer ready")

    # ── AI detection model (UPGRADED from GPT-2 detector to GPT-3.5/4 detector)
    # PirateXX/AI-Content-Detector is fine-tuned on modern LLM output
    # LABEL_1 = AI-generated  |  LABEL_0 = Human-written
    if os.getenv("HUGGINGFACE_API_TOKEN"):
        ai_detector = None
        print("✅ AI Content Detector set to remote (Hugging Face Inference API)")
        print("\n🚀 Core models loaded — server accepting requests\n")
        return

    print("⏳ Loading PirateXX/AI-Content-Detector ...")
    from transformers import pipeline

    ai_detector = pipeline(
        "text-classification",
        model="PirateXX/AI-Content-Detector",
        device=device,
        truncation=True,
        max_length=512,
    )
    print("✅ AI Content Detector (upgraded) ready")
    print("\n🚀 All models loaded — server accepting requests\n")


def get_embedding_model() -> SentenceTransformer:
    if embedding_model is None:
        raise RuntimeError("Call load_models() before using models.")
    return embedding_model


def get_ai_detector():
    if ai_detector is None:
        raise RuntimeError("Call load_models() before using models.")
    return ai_detector
