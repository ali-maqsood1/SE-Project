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

# ─────────────────────────────────────────────────────────────────────────────
# DNS Patch for Render DNS Resolution Issues (DoH Fallback)
# ─────────────────────────────────────────────────────────────────────────────
import urllib3
from urllib3.util import connection

orig_create_connection = connection.create_connection

def resolve_dns_doh(hostname: str) -> str:
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # Try Google DoH by IP
    try:
        url = f"https://8.8.8.8/resolve?name={hostname}&type=A"
        resp = requests.get(url, timeout=5, verify=False)
        if resp.status_code == 200:
            data = resp.json()
            if "Answer" in data:
                for ans in data["Answer"]:
                    if ans.get("type") == 1:  # A record
                        return ans.get("data")
    except Exception as e:
        print(f"⚠️ Google DoH resolution failed: {e}")
        
    # Try Cloudflare DoH by IP
    try:
        url = f"https://1.1.1.1/dns-query?name={hostname}&type=A"
        headers = {"Accept": "application/dns-json"}
        resp = requests.get(url, headers=headers, timeout=5, verify=False)
        if resp.status_code == 200:
            data = resp.json()
            if "Answer" in data:
                for ans in data["Answer"]:
                    if ans.get("type") == 1:  # A record
                        return ans.get("data")
    except Exception as e:
        print(f"⚠️ Cloudflare DoH resolution failed: {e}")
        
    raise RuntimeError(f"Failed to resolve {hostname} via DoH.")

def patched_create_connection(address, *args, **kwargs):
    host, port = address
    if host == "api-inference.huggingface.co":
        try:
            return orig_create_connection(address, *args, **kwargs)
        except Exception as e:
            print(f"⚠️ Standard DNS resolution failed for {host}: {e}. Trying DoH fallback...")
            try:
                ip = resolve_dns_doh(host)
                print(f"📡 DoH resolved {host} to {ip}")
                return orig_create_connection((ip, port), *args, **kwargs)
            except Exception as doh_err:
                print(f"⚠️ DoH fallback also failed: {doh_err}")
                raise e
    return orig_create_connection(address, *args, **kwargs)

connection.create_connection = patched_create_connection

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
            retries = 5  # increased retries for loading models
            for attempt in range(retries):
                try:
                    resp = requests.post(self.api_url, headers=headers, json=payload, timeout=30)
                    
                    # 503 Service Unavailable / Loading state
                    if resp.status_code == 503:
                        try:
                            err_data = resp.json()
                            wait_time = float(err_data.get("estimated_time", 15.0))
                        except Exception:
                            wait_time = 15.0
                        print(f"⏳ Hugging Face model is loading (HTTP 503). Waiting {wait_time}s (attempt {attempt + 1}/{retries})...")
                        time.sleep(wait_time)
                        continue

                    # 200 OK
                    if resp.status_code == 200:
                        data = resp.json()
                        
                        # Sometimes loading/errors are returned as 200 OK with error payload
                        if isinstance(data, dict):
                            if "error" in data:
                                err_msg = data.get("error", "")
                                if "loading" in err_msg.lower() or "estimated_time" in data:
                                    wait_time = float(data.get("estimated_time", 15.0))
                                    print(f"⏳ Hugging Face model is loading (HTTP 200). Waiting {wait_time}s (attempt {attempt + 1}/{retries})...")
                                    time.sleep(wait_time)
                                    continue
                                else:
                                    raise ValueError(f"Hugging Face API Error: {err_msg}")
                            else:
                                raise ValueError(f"Unexpected JSON object format: {data}")
                        
                        if isinstance(data, list):
                            arr = np.array(data, dtype=np.float32)
                            if arr.ndim == 3:
                                arr = np.mean(arr, axis=1)
                            elif arr.ndim == 1:
                                arr = arr.reshape(1, -1)
                            all_embeddings.extend(arr.tolist())
                            break
                        else:
                            raise ValueError(f"Unexpected response type: {type(data)}")
                    
                    # Other status codes
                    resp.raise_for_status()

                except Exception as e:
                    if attempt == retries - 1:
                        raise RuntimeError(f"Remote embedding failed after {retries} attempts. Error: {str(e)}")
                    print(f"⚠️ Attempt {attempt + 1} failed: {str(e)}. Retrying in 3s...")
                    time.sleep(3)

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
