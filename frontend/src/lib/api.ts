// lib/api.ts — API Client Layer
import { BatchAnalysisResponse } from "@/types/analysis";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface BatchInput {
  entries: { file: File | null; text: string; name: string }[];
  threshold: number;
}

export async function analyzeBatch(input: BatchInput): Promise<BatchAnalysisResponse> {
  const form = new FormData();

  const texts: string[] = [];
  const names: string[] = [];

  input.entries.forEach((entry) => {
    if (entry.file) {
      form.append("files", entry.file);
      texts.push("");
      names.push(entry.file.name);
    } else if (entry.text.trim()) {
      // For text-only entries, append a dummy empty file blob so indices stay aligned
      form.append("files", new Blob([]), "");
      texts.push(entry.text.trim());
      names.push(entry.name || `Assignment ${texts.length}`);
    }
  });

  form.append("texts_json", JSON.stringify(texts));
  form.append("names_json", JSON.stringify(names));
  form.append("threshold", String(input.threshold));

  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Server error ${response.status}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/health`);
    return r.ok;
  } catch {
    return false;
  }
}
