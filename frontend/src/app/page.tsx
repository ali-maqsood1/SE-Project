"use client";

import { useState } from "react";
import BatchUploadForm from "@/components/BatchUploadForm";
import BatchResults from "@/components/BatchResults";
import { BatchAnalysisResponse } from "@/types/analysis";

export default function Home() {
  const [result, setResult] = useState<BatchAnalysisResponse | null>(null);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Nav */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎓</span>
            <div>
              <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                IntegrityGuard AI
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Hero (only on upload screen) */}
        {!result && (
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Batch Academic Integrity Analysis
            </h1>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Upload 2–30 student assignments. The system compares every possible pair
              for semantic plagiarism and detects AI-generated content — simultaneously.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {[
                "Up to 30 assignments",
                "N×(N−1)/2 pairs analyzed",
                "Encode once, compare all",
                "Parallel AI detection",
                "Interactive similarity matrix",
                "Upgraded AI detector (GPT-4 era)",
              ].map(f => (
                <span key={f} className="text-xs px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 sm:p-8">
          {result ? (
            <BatchResults result={result} onReset={() => setResult(null)} />
          ) : (
            <BatchUploadForm onResult={setResult} />
          )}
        </div>

        {/* Footer */}
        <footer className="text-center mt-10 text-xs text-gray-400 dark:text-gray-600 space-y-1">
          <p>
            Similarity: <code className="font-mono">all-MiniLM-L6-v2</code>
            {" · "}
            AI detection: <code className="font-mono">PirateXX/AI-Content-Detector</code>
          </p>
          <p>All scores are probabilistic indicators — not definitive verdicts.</p>
        </footer>
      </div>
    </main>
  );
}
