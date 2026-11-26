# Comparison Response Format V2

## Comprehensive Comparison

1. Question and compared documents.
   - Use `Source Document` (first selected in UI) and `Target Document` (second selected in UI).
2. Count summary:
   - Source topics total
   - Target topics total
   - Matching topics
   - Source not in target
   - Target not in source
   - Count validation pass/fail
3. `### Comparison Analysis` narrative (executive summary, risks, practical actions).
4. `### Alignment Summary` with balance checks and matched-topic count.
5. Matching topics list with citations.
6. Source-only topics with citations.
7. Target-only topics with citations.

## Topic Comparison

1. Question and compared documents.
   - Use `Source Document` (first selected in UI) and `Target Document` (second selected in UI).
2. Evidence count per document.
3. `### Comparison Analysis` section.
4. `### Comparative Assessment` section:
   - Key similarities
   - Key differences
   - Missing evidence caveats
   - If model analysis is sparse, provide deterministic fallback assessment from retrieved evidence.
5. `### Alignment Summary` (evidence count and assessment status).
6. Evidence lists for source and target documents.

Cross-cutting:
- Inline citations in `[file:page]` format should be hyperlinkable to the corresponding document/page when document URL is available.
