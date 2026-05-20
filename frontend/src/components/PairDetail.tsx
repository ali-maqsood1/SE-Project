"use client";

// components/PairDetail.tsx
// Detailed view of one pair: flagged paragraphs + top sentence pairs

import { PairResult, FlaggedParagraph, SentencePair } from "@/types/analysis";
import { getRiskBadge, getRiskLabel } from "@/lib/utils";

interface Props {
  pair: PairResult;
  onClose: () => void;
}

export default function PairDetail({ pair, onClose }: Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Pair detail
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            <span className="font-medium text-gray-700 dark:text-gray-300">{pair.name_a}</span>
            {" "}vs{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">{pair.name_b}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none flex-shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Score bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Overall similarity</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 dark:text-gray-100 text-lg">
              {pair.overall_score_pct}%
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRiskBadge(pair.risk_level)}`}>
              {getRiskLabel(pair.risk_level)}
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ${
              pair.overall_score_pct >= 75 ? "bg-red-500" :
              pair.overall_score_pct >= 50 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${pair.overall_score_pct}%` }}
          />
        </div>
      </div>

      {/* Flagged paragraphs */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Flagged paragraph pairs
          <span className="ml-2 text-xs font-normal text-gray-400">
            (threshold: {Math.round(pair.threshold_used * 100)}%)
          </span>
        </h4>

        {pair.flagged_paragraphs.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3">
            ✅ No paragraph pairs exceeded the threshold.
          </p>
        ) : (
          pair.flagged_paragraphs.map((p, i) => (
            <FlaggedParaCard key={i} para={p} />
          ))
        )}
      </div>

      {/* Top sentence pairs */}
      {pair.top_sentence_pairs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Most similar sentence pairs
          </h4>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60">
                  <th className="text-left p-2.5 font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    {pair.name_a}
                  </th>
                  <th className="text-left p-2.5 font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    {pair.name_b}
                  </th>
                  <th className="text-center p-2.5 font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-16">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {pair.top_sentence_pairs.map((sp, i) => (
                  <SentencePairRow key={i} pair={sp} shade={i % 2 === 1} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FlaggedParaCard({ para }: { para: FlaggedParagraph }) {
  const color = para.score_pct >= 85 ? "border-red-400" : "border-amber-400";
  const badge = para.score_pct >= 85
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";

  const primaryPair = para.top_sentence_pairs?.[0];
  const aText = highlightSentence(para.para_a_text, primaryPair?.sentence_a);
  const bText = highlightSentence(para.para_b_text, primaryPair?.sentence_b);

  return (
    <div className={`border-l-4 ${color} pl-3 py-2 bg-gray-50 dark:bg-gray-800/40 rounded-r-lg space-y-1.5`}>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
        Para {para.para_a_index} (A) ↔ Para {para.para_b_index} (B) — {para.score_pct}%
      </span>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        <strong>A:</strong> {aText}{para.para_a_text.length >= 280 ? "..." : ""}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        <strong>B:</strong> {bText}{para.para_b_text.length >= 280 ? "..." : ""}
      </p>
      {primaryPair && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Top sentence match: "{truncate(primaryPair.sentence_a, 120)}" vs "{truncate(primaryPair.sentence_b, 120)}"
        </p>
      )}
    </div>
  );
}

function SentencePairRow({ pair, shade }: { pair: SentencePair; shade: boolean }) {
  const sc = pair.score_pct;
  const color = sc >= 85 ? "text-red-600 dark:text-red-400"
              : sc >= 70 ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400";
  return (
    <tr className={shade ? "bg-gray-50 dark:bg-gray-800/30" : ""}>
      <td className="p-2.5 text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 align-top">
        {pair.sentence_a.length > 120 ? pair.sentence_a.slice(0, 120) + "…" : pair.sentence_a}
      </td>
      <td className="p-2.5 text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 align-top">
        {pair.sentence_b.length > 120 ? pair.sentence_b.slice(0, 120) + "…" : pair.sentence_b}
      </td>
      <td className={`p-2.5 text-center font-bold border-b border-gray-100 dark:border-gray-800 ${color}`}>
        {sc}%
      </td>
    </tr>
  );
}

function highlightSentence(text: string, sentence?: string) {
  if (!sentence) return text;
  const target = sentence.trim();
  if (!target) return text;
  const idx = text.toLowerCase().indexOf(target.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + target.length);
  const after = text.slice(idx + target.length);
  return (
    <>
      {before}
      <span className="bg-yellow-200/60 dark:bg-yellow-700/40 px-0.5 rounded-sm">
        {match}
      </span>
      {after}
    </>
  );
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}
