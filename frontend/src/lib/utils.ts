// lib/utils.ts
import { RiskLevel } from "@/types/analysis";

export function getRiskBadge(level: RiskLevel): string {
  switch (level) {
    case "high":     return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "moderate": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "low":      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    default:         return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case "high":     return "High risk";
    case "moderate": return "Moderate";
    case "low":      return "Low risk";
    default:         return "Unknown";
  }
}

export function getRiskDot(level: RiskLevel): string {
  switch (level) {
    case "high":     return "bg-red-500";
    case "moderate": return "bg-amber-500";
    case "low":      return "bg-emerald-500";
    default:         return "bg-gray-400";
  }
}

/** Color for the similarity matrix cell (score 0-100) */
export function getMatrixCellStyle(score: number): string {
  if (score >= 100) return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold";
  if (score >= 75)  return "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 font-semibold";
  if (score >= 40)  return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200";
  if (score >= 25)  return "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300";
  return "bg-gray-50 dark:bg-gray-800/40 text-gray-400 dark:text-gray-500";
}

export function shortName(name: string, max = 14): string {
  if (name.length <= max) return name;
  const ext = name.includes(".") ? "." + name.split(".").pop() : "";
  return name.slice(0, max - ext.length - 1) + "…" + ext;
}
