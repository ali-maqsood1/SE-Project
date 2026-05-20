// types/analysis.ts — TypeScript interfaces matching the FastAPI response

export type RiskLevel = "low" | "moderate" | "high" | "unknown";

export interface AIDetectionResult {
  ai_probability: number | null;
  ai_probability_pct: number | null;
  risk_level: RiskLevel;
  skipped: boolean;
  skip_reason: string | null;
  words_analyzed: number;
  total_words: number;
  truncated: boolean;
}

export interface AssignmentMeta {
  index: number;
  name: string;
  word_count: number;
  ai: AIDetectionResult;
}

export interface SentencePair {
  sentence_a: string;
  sentence_b: string;
  score: number;
  score_pct: number;
}

export interface FlaggedParagraph {
  para_a_index: number;
  para_b_index: number;
  para_a_text: string;
  para_b_text: string;
  score: number;
  score_pct: number;
  top_sentence_pairs?: SentencePair[];
}

export interface PairResult {
  assignment_a_index: number;
  assignment_b_index: number;
  name_a: string;
  name_b: string;
  overall_score: number;
  overall_score_pct: number;
  risk_level: RiskLevel;
  flagged_paragraphs: FlaggedParagraph[];
  top_sentence_pairs: SentencePair[];
  threshold_used: number;
}

export interface SimilarityResult {
  pair_count: number;
  assignment_count: number;
  pairs: PairResult[];
  summary_matrix: number[][];
  names: string[];
  high_risk_count: number;
  moderate_risk_count: number;
  threshold_used: number;
}

export interface OverallStats {
  highest_similarity_pct: number;
  average_similarity_pct: number;
  high_risk_pairs: number;
  moderate_risk_pairs: number;
  highest_ai_pct: number | null;
  average_ai_pct: number | null;
  flagged_for_review: number;
}

export interface BatchAnalysisResponse {
  success: boolean;
  assignment_count: number;
  pair_count: number;
  processing_time_s: number;
  skipped: string[];
  assignments: AssignmentMeta[];
  similarity: SimilarityResult;
  overall_stats: OverallStats;
}
