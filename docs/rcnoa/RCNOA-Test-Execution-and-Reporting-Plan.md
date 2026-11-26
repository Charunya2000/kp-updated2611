# RCNOA Test Execution and Reporting Plan

## Goal

Run the complete automated test suite, execute every RCNOA mock fixture to create reviewable output files, and produce one test-results report first in Markdown and then in HTML.

The process must preserve raw machine-readable evidence so report totals and fixture outcomes can be reproduced without scraping terminal text.

## Coverage

The run will include three layers:

| Layer | Scope | Primary evidence |
| --- | --- | --- |
| Repository tests | All Jest tests discovered by the repository configuration | Jest JSON results and console log |
| RCNOA fixture generation | Ten focused fixtures and five broad family fixtures | Generated `.rcno`, `.mock.json`, and manifest files |
| RCNOA fixture execution | All 15 manifest fixtures, including all 51 ordered catalog cases | Actual RCNA files, eligible 834 files, comparison JSON, and execution summary |

The broad A/B, F, I, N, and fallback fixtures are RCNA-only by design. The focused fixtures continue through 834 generation when their configured code and member structure permit it.

## Output Location

Write run artifacts beneath a timestamped directory that is separate from the server-owned fixture source files:

```text
out/rcnoa-test-results/<YYYYMMDD-HHmmss>/
  raw/
    jest-results.json
    jest-console.log
    fixture-execution.json
  fixtures/
    <fixture-id>/
      input.rcno
      actual.rcna
      actual.834.x12            # focused fixtures when eligible
      comparison.json
  RCNOA-Test-Results.md
  RCNOA-Test-Results.html
```

Do not write actual outputs into `docs/rcnoa/testFiles`. That directory remains generated test input and manifest data.

## Implementation Artifacts

### 1. Fixture Execution Script

Add `scripts/runRcnoaMockFixtureSuite.mjs`.

Responsibilities:

1. load fixtures only through `listRcnoaMockFixtures` and `loadRcnoaMockFixture`;
2. parse each fixture's RCNO input with `parseRcnoText`;
3. run `RcnoToRcnaService` with the fixture business date, shared mock DB arrays, approved N12 test code, and production address normalizer;
4. serialize actual outbound RCNA rows with `serializeRcnoaRecords`;
5. compare actual rule IDs, codes, match counts, row order, and row count with fixture expectations;
6. run `RcnaTo834Service` only for focused fixtures that are not marked `rcnaOnly`;
7. write one directory per fixture containing copied input, actual output, and structured comparison evidence;
8. write `raw/fixture-execution.json` with aggregate and per-fixture results;
9. continue through all fixtures after a fixture failure, record the failure, and exit nonzero after all evidence is written.

The runner must redact nine-digit identifiers from errors and summaries. Raw synthetic fixture content may remain in the fixture-specific evidence files because it contains no production data.

### 2. Report Generator

Add `scripts/renderRcnoaTestResults.mjs`.

Inputs:

- `raw/jest-results.json`;
- `raw/fixture-execution.json`;
- run metadata such as timestamp, Node version, package version, and current Git commit/worktree state.

Outputs:

- `RCNOA-Test-Results.md`;
- `RCNOA-Test-Results.html`.

Generate Markdown first. Render that exact Markdown to HTML using the existing `docs/rcnoa/copy-markdown-to-html.mjs` renderer so both formats carry the same results.

### 3. Package Commands

Add scripts with stable names:

```json
{
  "test-rcnoa-fixtures": "node scripts/runRcnoaMockFixtureSuite.mjs",
  "render-rcnoa-test-results": "node scripts/renderRcnoaTestResults.mjs",
  "test-rcnoa-report": "node scripts/runRcnoaTestReport.mjs"
}
```

`runRcnoaTestReport.mjs` will orchestrate the complete sequence, capture exit codes, produce the report even when tests fail, and return a final nonzero exit code if any test or fixture failed.

## Execution Sequence

### 1. Establish the Run Directory

Create one timestamped output directory and pass its path to every command. Record:

- UTC start and end times;
- package name and version;
- Node and npm versions;
- Git commit when available;
- whether the worktree contains local changes;
- operating system.

Do not include environment-variable values, credentials, database URLs, or secrets.

### 2. Regenerate Fixture Inputs

Run:

```powershell
npm run generate-rcnoa-mock-fixtures
```

Capture success or failure in the report. Stop fixture execution if generation fails because later evidence would not describe the current scenario definitions. Continue to report generation so the failure remains reviewable.

### 3. Run All Repository Tests

Run Jest once in-band with JSON output and a separate console log:

```powershell
npm test -- --runInBand --json --outputFile=<run-dir>/raw/jest-results.json
```

The orchestration script must capture stdout and stderr in `raw/jest-console.log`. It must retain Jest's exit code but continue to fixture execution and report generation.

"All tests" means all tests discovered by the repository's current Jest configuration, not only RCNOA test files. A full Next.js production build is outside this test-report run unless separately requested.

### 4. Execute All Mock Fixtures

Run:

```powershell
npm run test-rcnoa-fixtures -- --output <run-dir>
```

Expected scope:

- 15 manifest fixtures;
- 10 focused fixture rows;
- 51 broad rule-catalog rows;
- 61 total transformed fixture rows;
- 51 unique catalog IDs across the broad fixtures;
- RCNA output for every fixture that transforms successfully;
- 834 output only where the fixture contract permits it.

### 5. Generate Markdown Results

Run:

```powershell
npm run render-rcnoa-test-results -- --input <run-dir> --format markdown
```

The Markdown report must include:

1. overall PASS/FAIL status;
2. execution metadata and duration;
3. repository Jest totals: suites, tests, passed, failed, pending, and duration;
4. failed Jest tests with suite path, test name, and sanitized failure message;
5. fixture generation status;
6. fixture totals and transformed row totals;
7. a table for all 15 fixtures with row count, expected rules, actual rules, RCNA status, 834 status, and result;
8. a 51-case catalog coverage table with test-case ID, source fixture/row, expected rule/code, actual rule/code, and result;
9. validation-case coverage mapped to the responsible Jest tests;
10. links to relative raw evidence and generated fixture outputs;
11. limitations, skipped behavior, and explicit RCNA-only rationale;
12. final failure summary and rerun commands.

Do not claim a test passed if its result is absent. Missing or malformed result files must produce an incomplete/failed report state.

### 6. Render HTML

After Markdown generation succeeds, run:

```powershell
node docs/rcnoa/copy-markdown-to-html.mjs `
  <run-dir>/RCNOA-Test-Results.md `
  <run-dir>/RCNOA-Test-Results.html
```

The HTML must be standalone, printable, and contain the same headings, tables, statuses, evidence links, and failure details as the Markdown source.

## Fixture Comparison Rules

For every fixture:

- input row count must equal manifest `rowCount` or default to one;
- every input row must contain exactly 73 columns;
- every actual working RCNA row must contain 78 columns;
- every actual outbound RCNA row must contain 76 columns;
- source row order must be preserved;
- expected and actual rule IDs and PSHB codes must match;
- expected and actual membership/recent-834 match counts must match when supplied;
- the checksum loaded for execution must match the manifest-owned source pair;
- broad fixtures must be marked `rcnaOnly` and must not produce an 834 file;
- focused fixtures must report either a valid 834 output or an explicit, expected ineligibility/failure reason;
- any unexpected exception, missing output, or comparison mismatch fails that fixture.

## Validation-Case Traceability

Map the ten `VAL-*` cases from `RCNO-RCNA-Complete-TestCases.json` to executable evidence rather than embedding invalid rows into normal fixture files:

| Validation case | Evidence |
| --- | --- |
| VAL-001 | Wrong-width RCNO Jest test |
| VAL-002 | Malformed membership lookup Jest test |
| VAL-003 | Conflicting/identical membership duplicate Jest test |
| VAL-004 | Conflicting/identical recent-834 duplicate Jest test |
| VAL-005 | Explicit default-rule Jest test |
| VAL-006 | Input mutation guard Jest test |
| VAL-007 | N12000 AE999 fixture and Jest test |
| VAL-008 | I4000/I5000 discriminator fixture rows and Jest parameter cases |
| VAL-009 | I6000/I7000 discriminator fixture rows and Jest parameter cases |
| VAL-010 | Missing address-normalizer Jest test plus N91000/N92000 fixture rows |

The report generator must mark a validation case as covered only when its mapped Jest or fixture evidence appears in the current run.

## Failure Handling

- Fixture generation failure: skip fixture execution, retain Jest results, and generate a failed report.
- Jest failure: retain JSON/log output, continue fixture execution, and generate a failed report.
- Individual fixture failure: continue remaining fixtures, write comparison evidence, and generate a failed report.
- Report-generation failure: retain raw evidence and return nonzero; do not emit a misleading partial HTML report.
- HTML-rendering failure: retain Markdown and raw evidence, return nonzero, and report that HTML was not produced.

No step should delete a previous timestamped run directory.

## Acceptance Criteria

- Fixture generation completes successfully.
- All repository Jest tests execute once and produce valid JSON plus a console log.
- All 15 manifest fixtures execute and produce structured comparison evidence.
- The five broad fixtures prove all 51 catalog IDs exactly once with no gaps or duplicates.
- RCNA output files are created for all successful fixture runs.
- Focused fixtures create 834 output when eligible; RCNA-only fixtures never create misleading 834 files.
- Validation-case traceability covers all ten `VAL-*` cases with current-run evidence.
- One Markdown report is generated entirely from machine-readable current-run results.
- One standalone HTML report is rendered from that Markdown.
- Relative links in both reports resolve to raw evidence and fixture output files.
- The orchestration command exits zero only when generation, Jest, fixture execution, Markdown generation, and HTML rendering all satisfy their contracts.

## Recommended Delivery Sequence

1. Implement the fixture execution script and verify it against one focused and one broad fixture.
2. Expand execution to all 15 fixtures and validate output-directory contents.
3. Implement Jest JSON/log orchestration with failure continuation.
4. Implement Markdown report generation from raw evidence.
5. Render the Markdown with the existing HTML renderer.
6. Add package commands and focused tests for report parsing, missing evidence, and failure summaries.
7. Run the complete workflow and review both report formats before treating the results as test evidence.