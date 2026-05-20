"use client";

// components/BatchUploadForm.tsx
// Multi-assignment upload: drag-drop or text paste, up to 30 slots

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { analyzeBatch } from "@/lib/api";
import { BatchAnalysisResponse } from "@/types/analysis";

interface Entry { file: File | null; text: string; name: string; }

const EMPTY_ENTRY = (): Entry => ({ file: null, text: "", name: "" });

interface Props { onResult: (r: BatchAnalysisResponse) => void; }

export default function BatchUploadForm({ onResult }: Props) {
  const [entries, setEntries]     = useState<Entry[]>([EMPTY_ENTRY(), EMPTY_ENTRY()]);
  const [threshold, setThreshold] = useState(75);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState<number | null>(null);
  const fileInputRefs             = useRef<(HTMLInputElement | null)[]>([]);

  const setEntry = (i: number, patch: Partial<Entry>) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, ...patch } : e));

  const addSlot = () => {
    if (entries.length >= 30) return;
    setEntries(prev => [...prev, EMPTY_ENTRY()]);
  };

  const removeSlot = (i: number) => {
    if (entries.length <= 2) return;
    setEntries(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleFile = (file: File, i: number) => {
    if (!file.name.match(/\.(pdf|txt)$/i)) {
      setError(`"${file.name}" is not a PDF or TXT file.`);
      return;
    }
    setEntry(i, { file, text: "", name: file.name });
    setError(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, i: number) => {
    e.preventDefault();
    setDragOver(null);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f, i);
  };

  // Drop multiple files onto the form (auto-fills empty slots)
  const handleGlobalDrop = (e: DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.match(/\.(pdf|txt)$/i)
    );
    if (!files.length) return;

    setEntries(prev => {
      const next = [...prev];
      let fileIdx = 0;
      for (let i = 0; i < next.length && fileIdx < files.length; i++) {
        if (!next[i].file && !next[i].text) {
          next[i] = { file: files[fileIdx], text: "", name: files[fileIdx].name };
          fileIdx++;
        }
      }
      // If we ran out of slots, add new ones
      while (fileIdx < files.length && next.length < 30) {
        next.push({ file: files[fileIdx], text: "", name: files[fileIdx].name });
        fileIdx++;
      }
      return next;
    });
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    const valid = entries.filter(e => e.file || e.text.trim());
    if (valid.length < 2) {
      setError("Please provide at least 2 assignments.");
      return;
    }
    setLoading(true);
    try {
      const result = await analyzeBatch({ entries, threshold: threshold / 100 });
      onResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const filledCount = entries.filter(e => e.file || e.text.trim()).length;

  return (
    <form
      onDragOver={e => e.preventDefault()}
      onDrop={handleGlobalDrop}
      className="space-y-6"
    >
      {/* Global drop hint */}
      <div className="rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-3 text-center text-sm text-blue-600 dark:text-blue-400">
        💡 Drag and drop <strong>multiple files at once</strong> anywhere on this form to auto-fill slots
      </div>

      {/* Assignment slots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((entry, i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2"
          >
            {/* Slot header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                #{i + 1}
              </span>
              {entries.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); setDragOver(i); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.stopPropagation(); handleDrop(e, i); }}
              onClick={() => !entry.file && fileInputRefs.current[i]?.click()}
              className={`
                border-2 border-dashed rounded-lg p-2 text-center cursor-pointer
                transition-all text-xs min-h-[44px] flex items-center justify-center
                ${dragOver === i
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  : entry.file
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 cursor-default"
                  : "border-gray-200 dark:border-gray-700 hover:border-blue-400"
                }
              `}
            >
              {entry.file ? (
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <span>✅</span>
                  <span className="truncate max-w-[140px] font-medium">{entry.file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEntry(i, { file: null }); }}
                    className="text-gray-400 hover:text-red-500 ml-1 flex-shrink-0"
                  >✕</button>
                </div>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">
                  Drop PDF/TXT or{" "}
                  <span className="text-blue-500 underline underline-offset-1">browse</span>
                </span>
              )}
              <input
                ref={el => { fileInputRefs.current[i] = el; }}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f, i);
                }}
              />
            </div>

            {/* Text area */}
            {!entry.file && (
              <textarea
                value={entry.text}
                onChange={(e) => setEntry(i, { text: e.target.value })}
                rows={4}
                placeholder="Or paste text..."
                className="
                  w-full rounded-lg border border-gray-200 dark:border-gray-700
                  bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300
                  p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500
                  placeholder-gray-300 dark:placeholder-gray-600 font-mono
                "
              />
            )}

            {/* Name field (shown when using text input) */}
            {!entry.file && (
              <input
                value={entry.name}
                onChange={(e) => setEntry(i, { name: e.target.value })}
                placeholder={`Student ${i + 1} name`}
                className="
                  w-full rounded-lg border border-gray-200 dark:border-gray-700
                  bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400
                  px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500
                "
              />
            )}
          </div>
        ))}

        {/* Add slot button */}
        {entries.length < 30 && (
          <button
            type="button"
            onClick={addSlot}
            className="
              rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700
              hover:border-blue-400 dark:hover:border-blue-600
              flex flex-col items-center justify-center gap-2 min-h-[120px]
              text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-all
            "
          >
            <span className="text-2xl">+</span>
            <span className="text-xs">Add assignment</span>
            <span className="text-xs opacity-60">{entries.length}/30</span>
          </button>
        )}
      </div>

      {/* Settings row */}
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Flagging threshold
          </label>
          <input
            type="range"
            min={50}
            max={95}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-10 text-right">
            {threshold}%
          </span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Paragraph pairs above this similarity are flagged as suspicious
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || filledCount < 2}
        className="
          w-full py-4 rounded-xl font-semibold text-white text-base
          bg-blue-600 hover:bg-blue-700 active:bg-blue-800
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all flex items-center justify-center gap-3 shadow-sm
        "
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Analyzing {filledCount} assignments — please wait...
          </>
        ) : (
          `🔍  Analyze ${filledCount} Assignment${filledCount !== 1 ? "s" : ""}`
        )}
      </button>
    </form>
  );
}
