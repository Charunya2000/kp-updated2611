# RCNOA Changes - November 4, 2026

## 1. Purpose

This document catalogs the RCNOA functionality changed on November 4, 2026. It records the implemented behavior, operational impact, tests, and detailed-design updates for:

1. MRN-only I-family membership matching with deterministic membership-row selection.
2. Cycle-scoped use of manually uploaded RCNA files as prior evidence for Rule B200.

The governing detailed design was updated in `RCNO-RCNA-834-Detailed-Design.md` as part of the same work.

## 2. I-family membership matching

### 2.1 Identity used for matching

Every I-family rule now establishes membership only by comparing:

- RCNO `MENR_Member_ID` in column 6; and
- MDW membership `kp_mrn`.

Member SSN, subscriber SSN, first name, and last name no longer establish I-family membership. Those fields remain available for rule families whose documented predicates require them.

MRNs are normalized for comparison without changing source or output values:

- surrounding whitespace is ignored;
- comparison is case-insensitive; and
- insignificant leading zeroes are removed when both values contain only digits.

Examples such as `00012345` and `12345` therefore match, while nonnumeric MRNs retain their full normalized text.

### 2.2 Deterministic membership-row selection

When multiple MDW membership rows match an I-family MRN, the selected row is the one with the highest populated coverage end date. Blank coverage end dates sort after populated dates. `kp_mrn` is the secondary SQL ordering field.

The selected row supplies the membership coverage dates evaluated by I-family rules, including I1000 and the active/inactive coverage checks used by I4000 through I7000.

### 2.3 Runtime indexing and audit behavior

The RCNO-to-RCNA transformer now builds and uses a membership-by-MRN index for I-family evaluation. Buckets are sorted by descending coverage end date before a rule selects the first candidate.

I-family audit candidate counts now report MRN-matched candidates rather than candidates found through the previous subscriber-identity lookup.

### 2.4 MDW query changes

The default MDW query now requires both candidate inputs:

| Bind | Purpose |
|---|---|
| `:ssnsJson` | F-family and other approved SSN-driven candidate retrieval |
| `:mrnsJson` | Mandatory I-family MRN candidate retrieval |

The query:

- uses `baseConfigMDWQuery.sql` as the authoritative default seed;
- splits MENR member IDs into the two-character `MRN_PFX_NB` and remaining `MRN_NB` portions;
- removes insignificant zeroes from the MRN number for lookup and reconstructs `kp_mrn` as prefix plus a ten-character padded number;
- restricts SSN and MRN candidates to regions `SC` and `NC`;
- selects the highest membership line number for each MRN-matched person;
- preserves the existing 19-column result contract;
- uses correlated death-date lookups for member and subscriber death status; and
- returns rows ordered by `coverage_end_date DESC NULLS LAST, kp_mrn`.

Query configuration validation and Oracle runtime guardrails now reject an MDW query that omits `:mrnsJson`.

### 2.5 Deployment consideration

The MDW SQL is versioned in MongoDB. Updating `baseConfigMDWQuery.sql` and the default seed in source does not replace an existing stored query. Administrators must update the deployed MDW query through the protected RCNOA query-configuration interface so it uses the base query, includes `:mrnsJson`, preserves the positional result contract, and applies the required ordering.

## 3. Uploaded RCNA as B200 prior evidence

### 3.1 Explicit reconciliation cycle

The manual **Import RCNA into prior history** workflow requires a reconciliation cycle in strict `YYYYMM` format. The UI defaults the field to the current month in `America/Los_Angeles` time.

The server validates:

- exactly six digits; and
- a month from `01` through `12`.

The cycle is not inferred from the file name or upload date.

### 3.2 Upload processing sequence

A successful manual RCNA upload now follows this sequence:

1. Stage the uploaded RCNA artifact.
2. Parse and validate every 76- or 78-column row.
3. Transition the run to `SAVING_PRIOR_RCNA`.
4. Save every uploaded RCNA row as prior evidence for the selected cycle.
5. Place the `RCNA_IMPORT` run in `AWAITING_RCNA_REVIEW` with RCNA row counts.

The import does not generate an 834 and does not require mapping approval, an intent mapping, or carrier-action eligibility. Eligible and noneligible rows are both imported into B200 prior evidence. Parsing or validation failures do not partially update B200 evidence and use error code `RCNOA_RCNA_IMPORT_FAILED`.

An administrator may later select **Generate 834** for the imported run. That explicit operation reads the stored `rcna` artifact, selects F-, I-, and N-family rows whose action begins with `Carrier to`, and applies the remaining Section 12 mapping requirements only to selected rows. A later 834 failure leaves the run awaiting review and does not remove prior evidence already imported.

### 3.3 Uploaded row normalization

A standard 76-column outbound RCNA is restored to the internal 78-column working shape:

| Working column | Imported value |
|---:|---|
| 1-76 | Values from the uploaded RCNA |
| 77, Notes | Blank |
| 78, Aging Months | `0` |

For an uploaded 78-column working RCNA:

- a valid nonnegative integer Aging Months value is retained;
- a blank Aging Months value becomes `0`; and
- a negative, fractional, or nonnumeric value rejects the operation.

Priority, PSHB code, and description must be populated on every imported row.

### 3.4 B200 lookup semantics

Uploaded and generated RCNA rows use the same protected prior-record repository. Records are keyed by:

- reconciliation cycle; and
- HMAC-SHA256 match key derived from normalized RCNO columns 1-73.

A later successful generated or uploaded RCNA for the same cycle and match key replaces the earlier decision. Records in another cycle remain separate and cannot satisfy B200.

B200 itself has no coverage-date or elapsed-time predicate. It receives repository candidates already restricted to the current processing cycle and exact columns 1-73 match, then copies prior columns 74-76 and increments Aging Months. A newly imported 76-column row starts at aging `0`, so its next B200 reuse produces aging `1`.

## 4. UI and API changes

### Admin experience

- Added a reconciliation-cycle text field beside the manual RCNA upload action.
- Defaults the value using the current Pacific-time year and month.
- Restricts entry to six numeric characters and marks an invalid month as an error.
- Disables RCNA import only while the cycle is invalid; 834 mapping approval does not control import availability.

### Client request

`uploadRcnaForPriorLookup` accepts the selected reconciliation cycle and includes it in multipart form data as `reconciliationCycle`.

### Upload route

The team-scoped `upload-rcna` route reads the multipart cycle value and passes it to the upload operation. Server-side validation remains authoritative.

## 5. Detailed-design updates

`RCNO-RCNA-834-Detailed-Design.md` was revised to document:

- MRN-only I-family membership identity;
- leading-zero MRN normalization;
- highest-coverage-end candidate selection;
- mandatory `:mrnsJson` MDW query filtering and ordering;
- revised I-family predicates and test requirements;
- reconciliation-cycle terminology;
- uploaded RCNA import and aging initialization;
- B200 cycle isolation, exact-match behavior, and latest-write semantics;
- no partial prior-evidence import when RCNA parsing or validation fails;
- separation of prior-history import from optional later 834 generation; and
- acceptance scenarios and coverage-matrix entries for both change groups.

## 6. Test coverage added or updated

### I-family and MDW query tests

Coverage now proves:

- I-family matching by MRN only;
- rejection of SSN-only and name-only membership matches;
- insignificant-leading-zero MRN matching;
- highest populated coverage-end selection;
- blank coverage ends sorting last;
- I-family audit counts use MRN candidates;
- mandatory `:mrnsJson` query validation;
- Oracle guardrails reject missing MRN binds; and
- the default SQL includes MRN normalization and required ordering.

### Uploaded RCNA and B200 tests

Coverage now proves:

- valid and invalid `YYYYMM` cycle handling;
- 76-column RCNA restoration to the working shape;
- zero initialization of missing Aging Months;
- rejection of invalid Aging Months;
- client propagation of the selected cycle;
- upload persistence without invoking 834 generation;
- no prior-evidence persistence after RCNA validation failure;
- later explicit 834 generation from the imported artifact;
- visibility in the selected cycle only; and
- existing same-cycle upsert and cross-cycle isolation behavior.

### Validation result

The final focused validation completed successfully:

```text
Test Suites: 9 passed, 9 total
Tests:       204 passed, 204 total
Snapshots:   0 total
```

The validated suites covered the base MDW query contract and Oracle guardrails, RCNO-to-RCNA rules, core parsing and normalization, upload orchestration, local and Mongo prior-RCNA repositories, and the client upload request.

## 7. Files changed

| File | Change summary |
|---|---|
| `app/services/rcnoa/RcnoToRcnaService.js` | Added MRN-indexed I-family membership selection, coverage-end ordering, and MRN-based audit counts. |
| `app/services/rcnoa/rcnoaQueryConfigurationService.js` | Added MRN candidate SQL, leading-zero comparison, result ordering, and mandatory bind validation. |
| `app/services/rcnoa/rcnoaOracleService.js` | Added runtime protection against MDW queries without `:mrnsJson`. |
| `app/services/rcnoa/rcnoaCore.js` | Added reconciliation-cycle validation and uploaded RCNA prior-record preparation. |
| `app/services/rcnoa/rcnoaProcessingService.js` | Validates uploaded RCNA rows once and returns all working records for prior persistence. |
| `app/services/rcnoa/rcnoaOperationsService.js` | Imports uploaded RCNA rows under the selected cycle and supports optional later 834 generation. |
| `app/api/[teamName]/[assistantName]/rcnoa/runs/upload-rcna/route.js` | Accepts the multipart reconciliation cycle. |
| `app/clientServices/rcnoaService.js` | Sends the cycle with manual RCNA uploads. |
| `app/[teamName]/admin/rcnoa/RcnoaAdminExperience.js` | Adds and validates the reconciliation-cycle control. |
| `app/services/rcnoa/__tests__/RcnoToRcnaService.test.js` | Adds and revises I-family MRN and ordering regressions. |
| `app/services/rcnoa/__tests__/rcnoaQueryConfigurationService.test.js` | Covers MRN bind, normalization SQL, and ordering. |
| `app/services/rcnoa/__tests__/rcnoaCore.test.js` | Covers cycle and uploaded-row validation. |
| `app/services/rcnoa/__tests__/rcnoaPriorRcnaLocalStore.test.js` | Covers uploaded-row cycle visibility and isolation. |
| `app/services/rcnoa/__tests__/rcnoaOperationsUpload.test.js` | Covers successful persistence ordering and failure atomicity. |
| `app/clientServices/__tests__/rcnoaService.test.js` | Covers multipart cycle propagation. |
| `docs/rcnoa/RCNO-RCNA-834-Detailed-Design.md` | Aligns the governing design and acceptance coverage with the implementation. |

## 8. Operational summary

Before deploying these changes:

1. Update the stored MDW query to include `:mrnsJson` and the required coverage-end ordering.
2. Confirm the configured prior-RCNA HMAC secret remains stable; changing it makes existing protected match keys unavailable without migration or rebuild.
3. Train RCNOA administrators to select the intended `YYYYMM` cycle when uploading a reviewed RCNA.
4. Treat a completed manual upload as both an 834-generation event and a prior-evidence import for the selected cycle.