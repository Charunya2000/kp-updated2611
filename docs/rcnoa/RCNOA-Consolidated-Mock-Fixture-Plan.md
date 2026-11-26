# RCNOA Broad-Coverage Mock Fixture Plan

## Goal

Create a small set of selectable admin-page mock fixtures that collectively execute the complete RCNO-to-RCNA rule catalog through the production parsing, mock lookup, reconciliation, RCNA serialization, and 834 generation paths.

Each fixture group will use:

- one family-focused, multi-row `.rcno` input file;
- one paired `.mock.json` file containing that family's MDW membership, EPDS recent-834, and prior-RCNA lookup responses;
- one manifest entry exposed by the existing mock-fixture API;
- per-row expected results tied back to `RCNO-RCNA-Complete-TestCases.json`.

The existing focused mock fixtures may remain. They are useful as quick regression cases, but the new family fixtures become the broad catalog-coverage set.

## Scope Boundary

`RCNO-RCNA-Complete-TestCases.json` contains 61 cases, but they are not all representable as rows in one valid RCNO upload.

| Case group | Count | Broad-coverage treatment |
| --- | ---: | --- |
| Ordered rule-catalog cases | 51 | Materialize across five family-level fixtures with isolated mock lookup data. |
| Successful service-invariant cases | 4 | Cover through generator/Jest assertions over the family fixtures. Do not duplicate rows when a catalog row already proves the behavior. |
| Intentionally invalid or conflicting contract cases | 6 | Record in validation metadata and execute as isolated Jest cases. They cannot be embedded in one valid upload without invalidating or contaminating the entire shared lookup payload. |

The five admin fixtures cover every executable rule outcome in manageable runs and link the remaining validation cases to automated isolated checks.

## Current Constraints

1. The complete test-case JSON is a design catalog. Most entries contain predicate hints, not concrete 73-column RCNO and positional lookup records.
2. Mock processing supplies one shared set of `membershipRecords`, `recent834Records`, and `priorRcnaRecords` to every input row.
3. Shared lookup arrays within a family fixture can cause cross-row matches unless each scenario has unique subscriber, member, SSN, MRN, and date keys.
4. N91000 and N92000 require an `addressNormalizer`, but the admin processing path currently creates `RcnoToRcnaService` without one.
5. The processing path attempts 834 generation for every successfully transformed RCNA row. Every emitted PSHB code, including catch-all codes, must have an approved test intent or an explicitly defined exclusion policy.
6. The existing fixture manifest assumes one expected rule and code per fixture. Multi-row family fixtures need row-level expectations while retaining backward compatibility with existing single-row fixtures.

## Proposed Fixture Contract

Add the following generated pairs under `docs/rcnoa/testFiles`:

- `complete-ab-rules.rcno` and `complete-ab-rules.mock.json` for A100 and B200: 2 rows;
- `complete-f-rules.rcno` and `complete-f-rules.mock.json` for F1300 through F20000: 15 rows;
- `complete-i-rules.rcno` and `complete-i-rules.mock.json` for I1000 through I7000: 7 rows;
- `complete-n-rules.rcno` and `complete-n-rules.mock.json` for N0000 through N16000: 22 rows;
- `complete-fallback-rules.rcno` and `complete-fallback-rules.mock.json` for AE-1, AC-2, DM-3, CE-4, and No_rule99999: 5 rows.

This grouping follows the production transformer's rule-family boundaries, keeps fixture selection understandable in the admin page, and limits the amount of shared lookup data in any one run.

Each JSON file will retain the current mock DB arrays and add row-level traceability:

```json
{
  "fixtureId": "complete-f-rules",
  "version": "1.0.0",
  "businessDate": "20260810",
  "membershipRecords": [],
  "recent834Records": [],
  "priorRcnaRecords": [],
  "expectedRows": [
    {
      "sourceRow": 1,
      "testCaseId": "CAT-001-A100",
      "ruleId": "A100",
      "code": "MM"
    }
  ],
  "catalogRange": "CAT-003 through CAT-017"
}
```

`expectedRows` is verification metadata only. Production processing will continue to consume the three positional mock DB arrays exactly as it does today.

Keep the six upload-incompatible validation cases in test code or a generated `complete-validation-cases.json` index. Do not register that index as an admin mock fixture because it is not a valid RCNO/mock DB pair.

## Implementation Steps

### 1. Build Concrete Scenario Definitions

Extend `scripts/generateRcnoaMockFixtures.mjs` with one scenario definition for each of the 51 ordered catalog rules.

Each definition will contain:

- the source `testCaseId`;
- expected rule ID, priority, code, and description;
- RCNO positional overrides;
- membership positional records;
- recent-834 positional records;
- prior-RCNA positional records where required;
- optional transformer configuration such as address normalization.

Use the production `RcnoToRcnaService` rule predicates as the executable authority. Do not infer concrete records from the catalog's generic predicate hints alone.

### 2. Isolate Shared Mock DB Keys

Assign deterministic synthetic identities per row, for example:

- subscriber ID: `SUB-CAT-001`;
- member ID/MRN: `MRN-CAT-001`;
- annuitant number: `ANN-CAT-001`;
- member/subscriber SSN: a unique valid nine-digit synthetic value;
- source lookup IDs derived from the test-case ID.

Rewrite all scenario-specific lookup rows with the same identity namespace. Verify that each RCNO row matches only its intended membership, recent-834, and prior-RCNA records.

### 3. Generate Five Family Pairs

After validating every scenario independently:

1. partition scenarios into the A/B, F, I, N, and fallback families;
2. append each family's RCNO records in catalog order to its `.rcno` file;
3. concatenate only that family's lookup arrays into its `.mock.json` file;
4. add `expectedRows` in source-row order to every mock JSON file;
5. register all five pairs in `manifest.json`;
6. verify that the union of all `testCaseId` values is exactly the 51 rule-catalog cases with no gaps or duplicates.

Keep the existing ten focused fixtures unchanged for quick targeted testing.

### 4. Extend the Manifest and Loader Safely

Update the fixture service to support optional aggregate metadata without changing existing callers:

- preserve `expectedRuleId` and `expectedCode` for single-row fixtures;
- allow `expectedRows` for multi-row fixtures;
- expose `rowCount`, rule family, and catalog coverage in fixture summaries;
- validate that `expectedRows.length` equals the parsed RCNO row count;
- validate unique positive `sourceRow` values and unique `testCaseId` values;
- continue calculating the checksum from the exact RCNO and mock JSON contents;
- continue allowing only server-owned files named in `manifest.json`.

### 5. Supply Deterministic Address Normalization

Add a small RCNOA address-normalization function in the service layer and pass it to `RcnoToRcnaService` from the processing path.

The same function must be used by:

- the fixture generator;
- the family fixture tests;
- the admin processing service.

Its behavior should be deliberately narrow and documented, covering only approved deterministic normalization such as case, whitespace, and agreed street-suffix handling. N91000 and N92000 must produce distinct verified outcomes.

### 6. Resolve 834 Generation by Fixture Family

Before exposing the family fixtures in the admin page, define test-environment behavior for every expected PSHB code.

Preferred approach:

- provide a generated test intent map for all concrete catalog codes that are valid 834 candidates;
- define and enforce an explicit skip policy for non-834 outcomes such as `MM`, `0000`, `AE*`, `AC*`, `DM*`, and `CE*` if those are not approved transaction codes;
- report skipped rows separately from failed rows.

Do not invent production 834 maintenance intents merely to make a mock run pass. If the current requirement is that every RCNA row must generate an 834, business-approved intents are a prerequisite for running the affected family fixture end to end. Family grouping allows valid families to run while unresolved code families remain clearly identified.

### 7. Add Focused Verification

Expand `rcnoaMockFixtureService.test.js` or add a neighboring broad-coverage fixture test that performs these checks:

1. load every family fixture only through the manifest service;
2. parse exactly 51 total RCNO rows across the expected 2, 15, 7, 22, and 5 row groups, with exactly 73 columns per row;
3. verify lookup row widths;
4. transform each row independently with its family's shared mock DB arrays, matching the admin processing path;
5. compare every rule ID and PSHB code with `expectedRows`;
6. assert each row's membership and recent-834 match counts where applicable;
7. transform each complete family batch and verify output order and counts;
8. prove that source and lookup arrays are not mutated;
9. run the six incompatible validation cases independently and compare their expected failures;
10. verify the 834 policy for generated, skipped, and rejected rows.

The generator must stop before writing files if any expected rule, code, family count, total catalog count, or lookup-isolation assertion fails.

### 8. Update Operator Documentation

Update `docs/rcnoa/testFiles/README.md` and `docs/rcnoa/RCNOA-Implementation-Runbook.md` with:

- the family fixtures' purpose and grouping;
- their collective 51-row rule coverage;
- the distinction between upload-compatible cases and isolated validation cases;
- required mock enablement;
- required 834 test configuration or skip policy;
- expected artifact and row counts per fixture family;
- instructions to regenerate rather than manually edit generated files.

## Validation Commands

Run focused validation only; a full project build is not required.

```powershell
npm run generate-rcnoa-mock-fixtures
npm test -- --runInBand app/services/rcnoa/__tests__/rcnoaMockFixtureService.test.js
npm test -- --runInBand app/services/rcnoa/__tests__/RcnoToRcnaService.test.js
npm test -- --runInBand app/services/rcnoa/__tests__/RcnaTo834Service.test.js
```

## Acceptance Criteria

- The admin fixture picker lists the five broad-coverage family fixtures.
- Selecting a family queues one predefined mock run with the documented row count.
- Mock DB calls use only the selected family's JSON positional lookup arrays.
- Every RCNO row resolves to its documented rule ID and PSHB code without cross-row lookup contamination.
- The five fixtures collectively cover all 51 rule-catalog cases exactly once.
- Each RCNA output preserves catalog order within its family and contains the expected successful rows unless an explicitly approved policy excludes a row.
- 834 output behavior is deterministic and business-approved for every row: generated, explicitly skipped, or explicitly rejected.
- N91000 and N92000 execute through the same deterministic address normalizer used by the generator.
- The six upload-incompatible validation scenarios remain automated and traceable from the validation index or test suite.
- Existing focused fixtures and their manifest behavior continue to work unchanged.
- No production data, credentials, or real member identifiers are included.

## Recommended Delivery Sequence

1. Implement and verify all 51 concrete scenario vectors in the generator.
2. Generate and validate the five family-level RCNO/mock JSON pairs against their shared lookup arrays.
3. Add loader/manifest multi-row metadata support.
4. Wire deterministic address normalization into the admin processing path.
5. Implement the approved 834 generation/skip policy.
6. Add aggregate and isolated-validation tests.
7. Update the fixture README and operator runbook.