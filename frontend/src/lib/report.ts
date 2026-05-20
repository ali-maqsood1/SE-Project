import { BatchAnalysisResponse, PairResult } from "@/types/analysis";

function formatPct(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${value}%`;
}

function pairLabel(pair: PairResult) {
  return `${pair.name_a} vs ${pair.name_b}`;
}

export function buildTextReport(result: BatchAnalysisResponse): string {
  const lines: string[] = [];
  const generatedAt = new Date().toISOString();

  lines.push("IntegrityGuard AI - Academic Integrity Report");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");

  lines.push("Executive Summary");
  lines.push(`- Assignments analyzed: ${result.assignment_count}`);
  lines.push(`- Pair count: ${result.pair_count}`);
  lines.push(`- Highest similarity: ${formatPct(result.overall_stats.highest_similarity_pct)}`);
  lines.push(`- Average similarity: ${formatPct(result.overall_stats.average_similarity_pct)}`);
  lines.push(`- High risk pairs: ${result.overall_stats.high_risk_pairs}`);
  lines.push(`- Flagged for review: ${result.overall_stats.flagged_for_review}`);
  lines.push(`- Highest AI probability: ${formatPct(result.overall_stats.highest_ai_pct)}`);
  lines.push(`- Average AI probability: ${formatPct(result.overall_stats.average_ai_pct)}`);
  lines.push("");

  lines.push("Pairwise Similarity Summary");
  result.similarity.pairs.forEach((pair) => {
    lines.push(`- ${pairLabel(pair)}: ${pair.overall_score_pct}% (${pair.risk_level})`);
  });
  lines.push("");

  lines.push("Flagged Sections");
  result.similarity.pairs.forEach((pair) => {
    if (!pair.flagged_paragraphs.length) return;
    lines.push(`- ${pairLabel(pair)}`);
    pair.flagged_paragraphs.forEach((p) => {
      lines.push(
        `  * Para ${p.para_a_index} vs Para ${p.para_b_index}: ${p.score_pct}%`
      );
      lines.push(`    A: ${p.para_a_text}`);
      lines.push(`    B: ${p.para_b_text}`);
    });
  });
  lines.push("");

  lines.push("AI Probability Breakdown");
  result.assignments.forEach((a) => {
    const ai = a.ai;
    const aiPct = ai.ai_probability_pct != null ? `${ai.ai_probability_pct}%` : "N/A";
    const note = ai.skipped ? ` (skipped: ${ai.skip_reason})` : "";
    lines.push(`- ${a.name}: ${aiPct} (${ai.risk_level})${note}`);
  });
  lines.push("");

  lines.push("Disclaimer");
  lines.push(
    "All scores are probabilistic indicators to assist human review and are not definitive verdicts."
  );

  return lines.join("\n");
}

export function buildJsonReport(result: BatchAnalysisResponse): string {
  const payload = {
    generated_at: new Date().toISOString(),
    ...result,
  };
  return JSON.stringify(payload, null, 2);
}

export function buildHtmlReport(result: BatchAnalysisResponse): string {
  const generatedAt = new Date().toISOString();
  const pairRows = result.similarity.pairs
    .map(
      (p) => `
        <tr>
          <td>${pairLabel(p)}</td>
          <td>${p.overall_score_pct}%</td>
          <td>${p.risk_level}</td>
        </tr>`
    )
    .join("");

  const flaggedSections = result.similarity.pairs
    .filter((p) => p.flagged_paragraphs.length)
    .map(
      (p) => `
        <section class="block">
          <h3>${pairLabel(p)}</h3>
          ${p.flagged_paragraphs
            .map(
              (fp) => `
                <div class="flagged">
                  <div class="meta">Para ${fp.para_a_index} vs Para ${fp.para_b_index} - ${fp.score_pct}%</div>
                  <div class="para"><strong>A:</strong> ${fp.para_a_text}</div>
                  <div class="para"><strong>B:</strong> ${fp.para_b_text}</div>
                </div>`
            )
            .join("")}
        </section>`
    )
    .join("");

  const aiRows = result.assignments
    .map((a) => {
      const ai = a.ai;
      const aiPct = ai.ai_probability_pct != null ? `${ai.ai_probability_pct}%` : "N/A";
      const note = ai.skipped ? ` (skipped: ${ai.skip_reason})` : "";
      return `
        <tr>
          <td>${a.name}</td>
          <td>${a.word_count}</td>
          <td>${aiPct}</td>
          <td>${ai.risk_level}${note}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>IntegrityGuard AI Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { margin-top: 20px; font-size: 16px; }
    h3 { margin: 12px 0 6px; font-size: 14px; }
    .meta { color: #6b7280; font-size: 12px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; }
    .block { margin-top: 10px; }
    .flagged { border-left: 3px solid #f59e0b; padding-left: 10px; margin: 6px 0; }
    .para { margin: 4px 0; }
    .disclaimer { margin-top: 16px; font-size: 12px; color: #6b7280; }
    .toolbar { margin: 12px 0 18px; }
    .toolbar button { padding: 6px 10px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>IntegrityGuard AI - Academic Integrity Report</h1>
  <div class="meta">Generated: ${generatedAt}</div>
  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <h2>Executive Summary</h2>
  <ul>
    <li>Assignments analyzed: ${result.assignment_count}</li>
    <li>Pair count: ${result.pair_count}</li>
    <li>Highest similarity: ${formatPct(result.overall_stats.highest_similarity_pct)}</li>
    <li>Average similarity: ${formatPct(result.overall_stats.average_similarity_pct)}</li>
    <li>High risk pairs: ${result.overall_stats.high_risk_pairs}</li>
    <li>Flagged for review: ${result.overall_stats.flagged_for_review}</li>
    <li>Highest AI probability: ${formatPct(result.overall_stats.highest_ai_pct)}</li>
    <li>Average AI probability: ${formatPct(result.overall_stats.average_ai_pct)}</li>
  </ul>

  <h2>Pairwise Similarity Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Pair</th>
        <th>Similarity</th>
        <th>Risk</th>
      </tr>
    </thead>
    <tbody>
      ${pairRows}
    </tbody>
  </table>

  <h2>Flagged Sections</h2>
  ${flaggedSections || "<p>No flagged sections exceeded the threshold.</p>"}

  <h2>AI Probability Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Assignment</th>
        <th>Words</th>
        <th>AI Probability</th>
        <th>Risk</th>
      </tr>
    </thead>
    <tbody>
      ${aiRows}
    </tbody>
  </table>

  <p class="disclaimer">
    All scores are probabilistic indicators to assist human review and are not definitive verdicts.
  </p>
</body>
</html>`;
}

export function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openReportWindow(html: string) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
