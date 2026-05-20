"use client";

// components/SimilarityMatrix.tsx
// NxN heatmap grid showing pairwise similarity scores at a glance

import { useState } from "react";
import { PairResult } from "@/types/analysis";
import { getMatrixCellStyle, shortName } from "@/lib/utils";

interface Props {
  matrix: number[][];
  names: string[];
  pairs: PairResult[];
  onSelectPair: (pair: PairResult) => void;
}

export default function SimilarityMatrix({ matrix, names, pairs, onSelectPair }: Props) {
  const [hovered, setHovered] = useState<[number, number] | null>(null);
  const n = names.length;

  const getPair = (i: number, j: number): PairResult | undefined => {
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    return pairs.find(
      p => p.assignment_a_index === a && p.assignment_b_index === b
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Similarity matrix ({n}×{n})
        </h4>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-200 inline-block"/>≥75%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-200 inline-block"/>40–74%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 inline-block"/>&lt;40%
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              {/* top-left empty corner */}
              <th className="w-8"/>
              {names.map((name, j) => (
                <th
                  key={j}
                  className="pb-1 px-1 text-gray-400 dark:text-gray-500 font-normal"
                  style={{ minWidth: 48, maxWidth: 64 }}
                >
                  <div
                    className="truncate text-center"
                    style={{ maxWidth: 60 }}
                    title={name}
                  >
                    {shortName(name, 8)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((rowName, i) => (
              <tr key={i}>
                {/* Row label */}
                <td
                  className="pr-2 text-gray-400 dark:text-gray-500 text-right font-normal truncate"
                  style={{ maxWidth: 80 }}
                  title={rowName}
                >
                  {shortName(rowName, 8)}
                </td>

                {names.map((_, j) => {
                  const score = matrix[i][j];
                  const isSelf = i === j;
                  const pair   = !isSelf ? getPair(i, j) : null;
                  const isHov  = hovered && (
                    (hovered[0] === i && hovered[1] === j) ||
                    (hovered[0] === j && hovered[1] === i)
                  );

                  return (
                    <td key={j} className="p-0.5">
                      <div
                        className={`
                          w-12 h-10 rounded flex items-center justify-center cursor-default
                          transition-all duration-100
                          ${getMatrixCellStyle(score)}
                          ${!isSelf && pair ? "cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-1" : ""}
                          ${isHov && !isSelf ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                        `}
                        title={isSelf ? rowName : `${rowName} vs ${names[j]}: ${score}%`}
                        onMouseEnter={() => !isSelf && setHovered([i, j])}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => { if (pair) onSelectPair(pair); }}
                      >
                        {isSelf ? (
                          <span className="text-blue-400 dark:text-blue-500 text-base">—</span>
                        ) : (
                          <span className="font-mono font-semibold text-xs">
                            {score.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Click any cell to view the detailed comparison for that pair.
      </p>
    </div>
  );
}
