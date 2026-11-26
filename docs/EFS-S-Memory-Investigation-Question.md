# EFS-S Memory Investigation Question

We are integrating the EFS-S X12 parser and validation pipeline into a Node.js application and are seeing unexpectedly high heap usage in deployed environments.

## Problem

The EDI Workbench invokes the EFS-S pipeline through:

```javascript
parseEnrichValidate(companionCsvPath, ediPath, options)
```

Our expectation is that EFS-S processes one ISA interchange, or another bounded unit of EDI data, at a time. However, validating a large EDI file in a Node.js worker eventually fails in our dev and UAT Kubernetes environments with:

```text
Worker terminated due to reaching memory limit: JS heap out of memory
```

The Kubernetes pod has a `2Gi` memory limit. The validation worker now has a configurable V8 old-generation limit of `1200 MB`. The same input succeeds locally, where more host memory is available.

EFS-S emits subscriber-level progress events while processing. Heap consumption continues to grow across those events instead of returning to a relatively stable baseline, which suggests that data from previously processed ISA interchanges, subscribers, or validation operations may remain reachable.

## Current Integration Behavior

The caller:

1. Downloads the complete EDI file and companion-guide CSV to temporary files.
2. Calls `parseEnrichValidate` once for the EDI file.
3. Receives subscriber progress through `options.onProgress`.
4. Waits for the full pipeline result.
5. Reads these result properties:
   - parsed or parse tree
   - enriched or enriched result
   - validation summary
   - subscriber statuses
   - invalid findings
6. Serializes the completed result before returning it to the parent worker.

The UI only needs summary information, subscriber statuses, execution metrics, and invalid findings. It does not need the full parsed and enriched EDI trees.

## Questions

Please inspect the actual EFS-S implementation and answer the following with file and function references.

### Processing Model

1. Does `parseEnrichValidate` truly process one ISA interchange at a time, or does it first parse the entire input file into an in-memory tree?
2. What is the exact bounded processing unit: file, ISA, transaction set, subscriber, or another structure?
3. After an ISA or subscriber is processed, which objects remain referenced until the entire call completes?
4. Are parsed or enriched ISA trees appended to a top-level result collection?
5. Does lazy ClojureScript sequence evaluation retain the head of the source sequence or previously processed interchanges?

### Result Accumulation

6. Does the returned `parsed`, `enriched`, `report`, `subscriber-statuses`, or findings structure accumulate data for every ISA or subscriber?
7. Are full segment objects or parse-tree paths copied into each validation finding?
8. Are both original parsed structures and enriched copies retained concurrently?
9. Are intermediate collections built with `map`, `group-by`, `reduce`, `into`, `concat`, lazy sequences, atoms, or global caches that grow with the input?
10. Is progress history accumulated internally, or is each progress event transient?

### Database Validation

11. Does database validation retain query results, lookup caches, SQL text, subscriber context, or comparison details across subscribers?
12. Does single-query database validation fetch or retain a large result set for the entire file?
13. Is subscriber-only database validation materially more memory efficient?
14. Are JDBC/Node database rows converted into multiple ClojureScript and JavaScript representations?

### Streaming and Memory-Safe Output

15. Is there an existing streaming or iterator API that returns findings and summaries without returning full parsed and enriched trees?
16. Can `parseEnrichValidate` support an option such as `includeParsed: false` and `includeEnriched: false` so processed trees can become unreachable?
17. Can findings and subscriber statuses be emitted incrementally through callbacks and omitted from the final in-memory result?
18. If processing is intended to be ISA-at-a-time, where should references be cleared or collections reduced so garbage collection can reclaim each completed ISA?
19. Would explicitly realizing bounded sequences with `doall`, `vec`, or another approach prevent accidental lazy-sequence retention, or would it increase memory usage in this implementation?
20. Are there module-level atoms, memoized functions, caches, run registries, or debug collections that must be reset after each ISA or validation run?

## Requested Investigation

Please perform a memory-focused code review of the complete path behind `parseEnrichValidate` and provide:

1. A call-flow diagram from file read through parsing, enrichment, structural validation, database validation, and result construction.
2. A list of collections whose size grows with ISA, transaction, subscriber, segment, lookup, or finding count.
3. Identification of the longest-lived reference that prevents completed ISA data from being garbage collected.
4. The expected peak-memory complexity in terms of input size and largest ISA size, for example $O(file)$ versus $O(largest\ ISA)$.
5. A minimal code change that makes memory bounded while preserving validation results and subscriber progress.
6. A focused regression test that processes many ISA interchanges and verifies that heap usage reaches a plateau rather than growing approximately linearly.

## Suggested Diagnostic

Please add temporary memory telemetry at these boundaries:

- Before reading the EDI file
- After parsing each ISA
- After enriching each ISA
- After structural validation for each ISA
- After database validation for each subscriber or ISA
- After findings are merged into the run result
- After references to the completed ISA are released

For Node.js output, capture at least:

```javascript
const memory = process.memoryUsage();
console.log({
  rssMb: memory.rss / 1024 / 1024,
  heapUsedMb: memory.heapUsed / 1024 / 1024,
  heapTotalMb: memory.heapTotal / 1024 / 1024,
  externalMb: memory.external / 1024 / 1024,
  arrayBuffersMb: memory.arrayBuffers / 1024 / 1024,
});
```

Please include the current ISA index, subscriber index, segment count, accumulated finding count, accumulated subscriber-status count, and database row/cache count with each sample.

The central question is:

> If EFS-S is designed to process one ISA interchange at a time, what data from completed interchanges remains reachable, and what change is required to make peak heap usage proportional to the largest interchange rather than the complete EDI file?
