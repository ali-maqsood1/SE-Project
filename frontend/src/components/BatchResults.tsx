"use client";

// components/BatchResults.tsx
// Full results view: stats → matrix → ranked pairs → AI detection table

import { useState } from "react";
import { BatchAnalysisResponse, PairResult, AssignmentMeta } from "@/types/analysis";
import { getRiskBadge, getRiskLabel, getRiskDot } from "@/lib/utils";
import {
  buildHtmlReport,
  buildJsonReport,
  buildTextReport,
  downloadBlob,
  openReportWindow,
} from "@/lib/report";
import SimilarityMatrix from "./SimilarityMatrix";
import PairDetail from "./PairDetail";

interface Props {
  result: BatchAnalysisResponse;
  onReset: () => void;
}

export default function BatchResults({ result, onReset }: Props) {
  const [selectedPair, setSelectedPair] = useState<PairResult | null>(null);
  const [activeTab, setActiveTab]       = useState<"matrix" | "pairs" | "ai">("matrix");
  const { assignments, similarity, overall_stats, processing_time_s } = result;
  const fileStamp = new Date().toISOString().replace(/[:.]/g, "-");

  const downloadText = () => {
    downloadBlob(
      `integrity-report-${fileStamp}.txt`,
      buildTextReport(result),
      "text/plain"
    );
  };

  const downloadJson = () => {
    downloadBlob(
      `integrity-report-${fileStamp}.json`,
      buildJsonReport(result),
      "application/json"
    );
  };

  const openHtmlReport = () => {
    openReportWindow(buildHtmlReport(result));
  };

  const tabs = [
    { id: "matrix" as const, label: "Similarity matrix" },
    { id: "pairs"  as const, label: `Ranked pairs (${similarity.pair_count})` },
    { id: "ai"     as const, label: "AI detection" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            📋 Batch Integrity Report
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {result.assignment_count} assignments · {similarity.pair_count} pairs ·{" "}
            {processing_time_s}s
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openHtmlReport}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
          >
            View report
          </button>
          <button
            onClick={downloadText}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
          >
            Download TXT
          </button>
          <button
            onClick={downloadJson}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
          >
            Download JSON
          </button>
          <button
            onClick={onReset}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            ← New analysis
          </button>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Highest similarity"
          value={`${overall_stats.highest_similarity_pct}%`}
          sub="across all pairs"
          alert={overall_stats.highest_similarity_pct >= 75}
        />
        <StatCard
          label="High risk pairs"
          value={String(overall_stats.high_risk_pairs)}
          sub="≥75% similarity"
          alert={overall_stats.high_risk_pairs > 0}
        />
        <StatCard
          label="Flagged for review"
          value={String(overall_stats.flagged_for_review)}
          sub="similarity + AI combined"
          alert={overall_stats.flagged_for_review > 0}
        />
        <StatCard
          label="Avg AI probability"
          value={overall_stats.average_ai_pct != null ? `${overall_stats.average_ai_pct}%` : "N/A"}
          sub="across all assignments"
          alert={(overall_stats.average_ai_pct ?? 0) >= 50}
        />
      </div>

      {/* ── Skipped notice ── */}
      {result.skipped.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ Skipped (too short): {result.skipped.join(", ")}
        </div>
      )}

      {/* ── Pair detail panel (shown when matrix cell is clicked) ── */}
      {selectedPair && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-5">
          <PairDetail pair={selectedPair} onClose={() => setSelectedPair(null)} />
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-3 text-sm font-medium transition-colors flex-1 sm:flex-none
                ${activeTab === tab.id
                  ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ── Matrix tab ── */}
          {activeTab === "matrix" && (
            <SimilarityMatrix
              matrix={similarity.summary_matrix}
              names={similarity.names}
              pairs={similarity.pairs}
              onSelectPair={(pair) => {
                setSelectedPair(pair);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

          {/* ── Ranked pairs tab ── */}
          {activeTab === "pairs" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                Sorted by similarity score (highest first). Click any row for full details.
              </p>
              {similarity.pairs.map((pair, i) => (
                <PairRow
                  key={i}
                  pair={pair}
                  rank={i + 1}
                  onSelect={() => {
                    setSelectedPair(pair);
                    setActiveTab("matrix");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))}
            </div>
          )}

          {/* ── AI detection tab ── */}
          {activeTab === "ai" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Model: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">PirateXX/AI-Content-Detector</code> — trained on GPT-3.5/GPT-4 output
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/60">
                      <th className="text-left p-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">#</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Assignment</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Words</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">AI probability</th>
                      <th className="text-center p-3 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments
                      .slice()
                      .sort((a, b) => (b.ai.ai_probability_pct ?? 0) - (a.ai.ai_probability_pct ?? 0))
                      .map((asgn, i) => (
                        <AIRow key={i} asgn={asgn} rowNum={i + 1} />
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        <strong>⚠️ Disclaimer:</strong> All scores are probabilistic indicators to assist human review — not definitive verdicts. Final determinations must be made by qualified academic reviewers.
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, alert }: {
  label: string; value: string; sub: string; alert: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 text-center space-y-1 ${
      alert
        ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
    }`}>
      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${alert ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>
    </div>
  );
}

function PairRow({ pair, rank, onSelect }: {
  pair: PairResult; rank: number; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="
        w-full flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-900 hover:border-blue-400 dark:hover:border-blue-600
        px-4 py-3 text-left transition-all group
      "
    >
      <span className="text-sm font-mono text-gray-400 w-6 flex-shrink-0">#{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {pair.name_a} <span className="text-gray-400">vs</span> {pair.name_b}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {pair.flagged_paragraphs.length} paragraph(s) flagged · {pair.top_sentence_pairs.length} sentence pairs
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`
          inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full
          ${getRiskBadge(pair.risk_level)}
        `}>
          <span className={`w-1.5 h-1.5 rounded-full ${getRiskDot(pair.risk_level)}`}/>
          {pair.overall_score_pct}%
        </span>
        <span className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 transition-colors">→</span>
      </div>
    </button>
  );
}

function AIRow({ asgn, rowNum }: { asgn: AssignmentMeta; rowNum: number }) {
  const ai = asgn.ai;
  const shade = rowNum % 2 === 0;

  return (
    <tr className={shade ? "bg-gray-50 dark:bg-gray-800/30" : ""}>
      <td className="p-3 text-gray-400 dark:text-gray-500 text-center">{rowNum}</td>
      <td className="p-3 text-gray-700 dark:text-gray-300 font-medium max-w-[200px] truncate">
        {asgn.name}
        {ai.truncated && (
          <span className="ml-2 text-xs text-amber-500">⚠️ truncated</span>
        )}
      </td>
      <td className="p-3 text-center text-gray-500 dark:text-gray-400">{asgn.word_count}</td>
      <td className="p-3 text-center">
        {ai.skipped ? (
          <span className="text-xs text-gray-400 italic">{ai.skip_reason}</span>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="font-bold text-gray-800 dark:text-gray-100">
              {ai.ai_probability_pct}%
            </span>
            <div className="w-16 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  (ai.ai_probability_pct ?? 0) >= 61 ? "bg-red-500" :
                  (ai.ai_probability_pct ?? 0) >= 31 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${ai.ai_probability_pct ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </td>
      <td className="p-3 text-center">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getRiskBadge(ai.risk_level)}`}>
          {getRiskLabel(ai.risk_level)}
        </span>
      </td>
    </tr>
  );
}
