# IntegrityGuard AI - User Manual

## Overview

IntegrityGuard AI helps instructors detect semantic plagiarism and estimate AI-generated content probability across multiple student assignments. It supports PDF/TXT uploads and generates a structured Academic Integrity Report.

## How to Use

1. Open the web app in your browser.
2. Upload at least two assignments:
   - PDF or TXT files
   - Or paste text into a slot and provide a name
3. Adjust the similarity threshold (0.50 to 0.95) if needed.
4. Click "Analyze" to run the batch analysis.

## Reading Results

### Similarity Matrix

- Each cell shows the similarity percent for a pair.
- Click a cell to open the detailed pair view.

### Pair Detail

- Shows overall similarity and risk level.
- Lists flagged paragraph pairs above the threshold.
- Shows the most similar sentence pairs for context.

### AI Detection Tab

- Shows AI probability, risk label, and word counts.
- If AI probability is 31-60%, a note says the result is inconclusive.

## Report Downloads

- View report: opens a printable HTML report.
- Download TXT: text-based report for quick review.
- Download JSON: structured data for analysis or archiving.
- Download PDF: text-based PDF export.

## Notes and Limitations

- AI detection is probabilistic and may produce false positives/negatives.
- Very short texts may be skipped for AI detection.
- The system does not store uploaded files permanently.

## Troubleshooting

- Unsupported format: only PDF and TXT are accepted.
- Scanned PDFs: use a text-based PDF or paste text directly.
- If analysis fails, reduce file count or try again with fewer assignments.

## Disclaimer

All scores are probabilistic indicators to assist human review and are not definitive verdicts. Final decisions must be made by qualified academic reviewers.
