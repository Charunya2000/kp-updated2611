# EFS-S Agent Instructions: Implement Bounded-Memory Validation

## Objective

Modify the EFS-S repository so `parseEnrichValidate` can validate large multi-ISA EDI files without retaining the complete file's parsed and enriched trees in memory.

The target is peak memory proportional to the largest in-flight ISA interchange plus required aggregate output, rather than proportional to the complete EDI file:

$$
O(\text{largest ISA} + \text{compact aggregate results})
$$

Do not stop after analysis. Implement the smallest correct streaming or ISA-reducer design, add regression tests, compile the ClojureScript, and stage a new npm package.

## Confirmed Consumer Failure

The consuming Node.js application calls:

```javascript
parseEnrichValidate(companionCsvPath, ediPath, options)
```

with these relevant options:

```javascript
{
  dbValidation: true,
  subscriberOnlyDbValidation: true,
  singleQueryDbValidation: true,
  includeParsed: false,
  includeEnriched: true,
  logMemory: process.env.EFSS_LOG_MEMORY === 'true',
  onProgress(event) {
    // Forward subscriber progress to the UI.
  },
}
```

The worker has a `1200 MB` V8 old-generation limit inside a Kubernetes pod with a `2Gi` memory limit.

A representative run reports:

```text
Fetching EDI file                              10%
Fetching companion guide                       25%
Reading the EDI file                            40%
Parsing, enriching, and validating EDI payload 58%
[run-rule-harness]
Worker terminated due to reaching memory limit: JS heap out of memory
```

No `subscriber-heartbeat` or `subscriber-completed` event is emitted before the crash. This means the failure occurs before EFS-S reaches subscriber-level validation progress.

At entry to the EFS-S pipeline, worker telemetry was approximately:

```text
RSS:        1335 MB
heap used:    33 MB
heap total:  186 MB
external:     10 MB
```

The worker then reaches its heap limit inside `run-rule-harness` in roughly 20 seconds.

## Confirmed Limitation of Existing Output Controls

The following controls are implemented and must remain supported:

```javascript
{
  includeParsed: false,
  includeEnriched: false,
  logMemory: true,
}
```

However, `includeParsed` and `includeEnriched` are currently applied in `parse-enrich-validate-json` only after this call returns:

```clojure
(companion-rules/run-rule-harness companion-csv edi-file opts)
```

They reduce final ClojureScript-to-JavaScript result copying, but do not reduce the peak memory consumed while parsing, enriching, and validating the complete file.

The immediate consumer still needs `includeEnriched: true` because invalid findings are derived by traversing the annotated tree. A compact complete findings output is therefore also required before the consumer can safely use `includeEnriched: false`.

## Required Implementation

### 1. Add an ISA-Bounded Pipeline

Implement an ISA-at-a-time path behind `parseEnrichValidate`, preferably controlled by an explicit option such as:

```javascript
{
  streaming: true
}
```

The implementation must:

1. Read or iterate the EDI input without constructing a parse tree for the complete file.
2. Identify one complete ISA/IEA interchange at a time.
3. Parse, enrich, structurally validate, and database-validate that ISA.
4. Extract compact invalid findings and subscriber statuses from that ISA.
5. Merge only compact summaries and findings into run-level accumulators.
6. Release all references to the ISA parse tree and annotated tree before processing the next ISA.
7. Preserve ordering and subscriber identity across ISA boundaries.
8. Handle an ISA larger than the read-buffer size.
9. Fail clearly for malformed or unterminated ISA interchanges.

Do not implement streaming by first reading or parsing the complete file and then partitioning the resulting tree. That does not solve peak memory.

### 2. Return Compact Invalid Findings

Add a documented result property containing every finding currently available by traversing the annotated tree. Use one stable name, such as:

```javascript
result.invalidFindings
```

Each finding must preserve all fields needed by the consuming UI when available:

```javascript
{
  path,
  reason,
  failedValue,
  valueProvided,
  segment,
  ref,
  name,
  locatorTrail,
  subscriberIndex,
  subscriberSsn,
  isaIndex,
}
```

Requirements:

- Findings must be complete, not only a sample or aggregate count.
- Finding values and descriptions must match the existing annotated-tree traversal.
- Subscriber indices must remain globally meaningful across multiple ISA interchanges.
- Paths must remain useful for troubleshooting, with ISA context added when necessary.
- The compact findings collection must not retain references to parse or annotated tree nodes.

Once this property is complete, the consumer must be able to use:

```javascript
{
  includeParsed: false,
  includeEnriched: false,
}
```

without losing any UI-visible finding.

### 3. Preserve Aggregate Outputs

The streaming result must preserve the existing public result contract for:

- Validation totals
- Lookup summary
- Subscriber progress summary
- Subscriber statuses
- Run ID and elapsed time
- Database validation outcomes
- Compact invalid findings

Totals from streaming mode must match the current full-file mode for the same fixture.

### 4. Emit Progress Before Subscriber Validation

Extend progress reporting so a large parse does not appear stalled before the first subscriber event.

Emit phase or ISA events such as:

```javascript
{
  "event-type": "isa-started",
  "isa-index": 1,
  "processed-isas": 0,
  "total-isas": null
}
```

```javascript
{
  "event-type": "isa-parsed",
  "isa-index": 1,
  "segment-count": 12000
}
```

```javascript
{
  "event-type": "isa-completed",
  "isa-index": 1,
  "processed-isas": 1,
  "subscriber-count": 500
}
```

Continue emitting the existing events unchanged:

- `subscriber-heartbeat`
- `subscriber-completed`

Callbacks must receive plain JavaScript objects through the existing `onProgress` option.

### 5. Bound Database Validation State

Inspect and correct database-validation state that may retain file-wide data:

- Subscriber prefetch rows
- Lookup indexes and caches
- `db-state*`
- Subscriber maps
- Query results
- Comparison/debug collections

Prefer per-ISA state where semantics allow it. If a run-level cache is required, document why and ensure it stores compact scalar lookup data rather than parsed or annotated nodes.

If single-query prefetch necessarily loads data for the complete EDI file, add an ISA-scoped prefetch path for streaming mode.

### 6. Prevent Lazy-Sequence Retention

Review the streaming path for lazy ClojureScript sequences that retain:

- The source file contents
- The head of the ISA sequence
- Previous parse trees
- Previous annotated trees

Ensure each ISA is fully consumed within one bounded iteration and no run-level closure, atom, callback payload, finding, or status references its tree afterward.

## Compatibility Requirements

Preserve the existing behavior when `streaming` is absent or false unless converting the default is proven safe by the test suite.

Preserve these options and behaviors:

```text
dbValidation
envName
subscriberOnlyDbValidation
singleQueryDbValidation
compareSingleQueryVsLegacy
includeLookupSql
heartbeatEveryDbAttempts
validationScope
includeParsed
includeEnriched
logMemory
onProgress
lookupSpecFile
```

Do not remove or rename existing subscriber progress fields.

## Required Tests

### Equivalence Test

Create a multi-ISA fixture and run both full-file and streaming modes. Assert equality for:

- Validation totals
- Passed and failed counts
- Lookup summary
- Subscriber status count
- Subscriber identities and status values
- Invalid finding count
- Finding values, descriptions, segment refs, subscriber identities, and locator trails

### Output-Control Test

With:

```javascript
{
  streaming: true,
  includeParsed: false,
  includeEnriched: false,
}
```

assert that:

- `result.parsed` is absent.
- `result.enriched` is absent.
- Compact invalid findings remain complete.
- Validation and subscriber summaries remain present.

### Progress Test

Assert that:

- At least one ISA-level progress event occurs before subscriber completion events.
- Existing subscriber event fields remain unchanged.
- Subscriber indices and SSNs are correct across multiple ISAs.

### Memory Regression Test

Generate or use fixtures containing the same moderately sized ISA repeated many times, for example 1, 5, 10, 25, and 50 interchanges.

Run streaming mode in a child Node process with a constrained heap. Record memory after each completed ISA. Assert that memory reaches a bounded plateau rather than growing approximately linearly with ISA count.

The test should fail against the current full-file implementation and pass with streaming mode. Avoid asserting exact garbage-collection timing from a single sample; use post-ISA samples, repeated GC where available in the test process, and a reasonable growth threshold.

### Large-ISA Test

Verify that one ISA larger than the file read-buffer size is reconstructed and validated correctly without truncation or duplicated segments.

### Malformed Input Test

Verify clear errors for:

- Content before the first ISA when unsupported
- Nested ISA before IEA
- Missing IEA
- Empty ISA
- Invalid segment terminator detection

## Memory Instrumentation

Keep `logMemory` environment-controlled. When enabled, log these boundaries with ISA and subscriber context:

- Before reading input
- ISA detected
- ISA parsed
- ISA enriched
- ISA structurally validated
- ISA database-validated
- Compact findings extracted
- ISA references released
- Run result constructed
- Before `clj->js`
- After `clj->js`

Include:

```text
rssMb
heapUsedMb
heapTotalMb
externalMb
arrayBuffersMb
isaIndex
processedIsaCount
subscriberIndex
segmentCount
accumulatedFindingCount
accumulatedSubscriberStatusCount
dbRowCount
dbCacheCount
```

Do not log EDI content, SSNs, credentials, SQL bind values, or other sensitive data.

## Build and Package

After implementation:

```bat
build-npm-lib.bat
```

Do not use `-SkipCompile` for the first package containing this implementation.

Then create the package artifact:

```bat
cd target\npm-lib
npm pack
```

Confirm the tarball contains the newly compiled JavaScript, not only changed `.cljs` source.

## Deliverables

Return:

1. Root-cause explanation with exact file and function references.
2. Implementation summary and API option documentation.
3. Changed-file list.
4. Equivalence, progress, output-control, malformed-input, and memory-test results.
5. Peak-memory measurements for increasing ISA counts in full-file and streaming modes.
6. The generated npm tarball name and package version.
7. Consumer migration example using:

```javascript
const result = parseEnrichValidate(companionCsvPath, ediPath, {
  ...existingOptions,
  streaming: true,
  includeParsed: false,
  includeEnriched: false,
  logMemory: process.env.EFSS_LOG_MEMORY === 'true',
});
```

## Acceptance Criteria

- Large multi-ISA validation reaches subscriber progress instead of failing during `run-rule-harness`.
- Streaming and current modes produce equivalent validation results for the same fixtures.
- `includeParsed: false` and `includeEnriched: false` omit both trees without losing findings.
- Worker-facing output contains only compact results.
- Peak heap in streaming mode is bounded by the largest in-flight ISA plus compact aggregate output.
- The compiled npm artifact contains and exposes the new implementation.
