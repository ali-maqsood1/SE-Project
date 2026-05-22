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
import requests
import numpy as np

embedding_model = None
ai_detector = None


class RemoteEmbeddingModel:
    def __init__(self, api_token: str, model_id: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.api_token = api_token
        self.model_id = model_id
        self.api_url = f"https://api-inference.huggingface.co/models/{model_id}"

    def encode(self, sentences: list[str], **kwargs) -> np.ndarray:
        if not sentences:
            return np.array([], dtype=np.float32)

        headers = {"Authorization": f"Bearer {self.api_token}"}
        batch_size = kwargs.get("batch_size", 64)
        all_embeddings = []

        for i in range(0, len(sentences), batch_size):
            batch = sentences[i : i + batch_size]
            payload = {
                "inputs": batch,
                "options": {"wait_for_model": True}
            }

            import time
            retries = 3
            for attempt in range(retries):
                try:
                    resp = requests.post(self.api_url, headers=headers, json=payload, timeout=30)
                    if resp.status_code == 200:
                        data = resp.json()
                        if isinstance(data, list):
                            arr = np.array(data, dtype=np.float32)
                            # Handle different response shapes from Hugging Face Inference API:
                            # 3D: (batch_size, sequence_length, embedding_dim) -> mean-pool sequence dimension
                            if arr.ndim == 3:
                                arr = np.mean(arr, axis=1)
                            # 1D: (embedding_dim) -> reshape to (1, embedding_dim)
                            elif arr.ndim == 1:
                                arr = arr.reshape(1, -1)
                            all_embeddings.extend(arr.tolist())
                            break
                        else:
                            raise ValueError(f"Unexpected response format: {data}")
                    elif resp.status_code == 503 and attempt < retries - 1:
                        print("⏳ Hugging Face embedding model is loading, waiting 10s...")
                        time.sleep(10)
                    else:
                        resp.raise_for_status()
                except Exception as e:
                    if attempt == retries - 1:
                        raise RuntimeError(f"Failed to encode sentences remotely: {e}")
                    time.sleep(2)

        return np.array(all_embeddings, dtype=np.float32)


def load_models():
    global embedding_model, ai_detector

    token = os.getenv("HUGGINGFACE_API_TOKEN")
    if token:
        # Load remote versions
        embedding_model = RemoteEmbeddingModel(token)
        ai_detector = "remote"
        print("✅ Sentence Transformer set to remote (Hugging Face Inference API)")
        print("✅ AI Content Detector set to remote (Hugging Face Inference API)")
        print("\n🚀 Remote models initialized — server accepting requests\n")
        return

    # Local fallback
    device = 0
    try:
        import torch
        if not torch.cuda.is_available():
            device = -1
    except ImportError:
        device = -1

    dev_name = "GPU ⚡" if device == 0 else "CPU"
    print(f"🔧 Device: {dev_name}")

    print("⏳ Loading sentence-transformers (local) ...")
    try:
        from sentence_transformers import SentenceTransformer
        embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        print("✅ Sentence Transformer ready")
    except ImportError:
        print("❌ Failed to import sentence-transformers for local execution")
        raise RuntimeError("sentence-transformers is required for local execution when HUGGINGFACE_API_TOKEN is not set.")

    print("⏳ Loading PirateXX/AI-Content-Detector (local) ...")
    try:
        from transformers import pipeline
        ai_detector = pipeline(
            "text-classification",
            model="PirateXX/AI-Content-Detector",
            device=device,
            truncation=True,
            max_length=512,
        )
        print("✅ AI Content Detector (upgraded) ready")
    except ImportError:
        print("❌ Failed to import transformers for local execution")
        raise RuntimeError("transformers is required for local execution when HUGGINGFACE_API_TOKEN is not set.")

    print("\n🚀 All local models loaded — server accepting requests\n")


def get_embedding_model():
    if embedding_model is None:
        raise RuntimeError("Call load_models() before using models.")
    return embedding_model


def get_ai_detector():
    if ai_detector is None:
        raise RuntimeError("Call load_models() before using models.")
    return ai_detector
