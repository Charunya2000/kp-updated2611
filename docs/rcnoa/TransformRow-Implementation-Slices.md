# `transformRow()` Implementation Slices

## Purpose

This document breaks the remaining service refactor into small, independently testable slices.

The target architecture is:

- one primary database-sourced row per service invocation;
- all lookup candidates supplied as arguments;
- no file or database I/O inside transformation services;
- no input mutation;
- one deterministic result or one explicit error; and
- X12 member-loop transformation separated from interchange assembly.

## Current state

| Area | Current implementation | Target |
|---|---|---|
| RCNO to RCNA | `transform({ rcnoRecords: [...] })` processes an array | `transformRow({ rcnoRecord, ... })` processes one row |
| RCNA to 834 | `transform({ workingRcnaRecords: [...] })` groups rows and creates a complete interchange | `transformRow({ workingRcnaRecord, ... })` returns one member-loop representation |
| X12 assembly | Embedded in `RcnaTo834Service` | Separate future orchestrator/assembler responsibility |
| Tests | 17 batch-oriented focused tests pass | Row-oriented tests plus full regression suite |

---

## Slice 1: Freeze the row-level contracts

### Goal

Define the public method signatures and result shapes without changing rule behavior.

### RCNO-to-RCNA input

```javascript
{
  rcnoRecord,
  membershipCandidates: [],
  recentEnrollmentCandidates: [],
  priorRcnaCandidates: [],
  context: {
    correlationId,
    workItemId,
  },
}
```

### RCNO-to-RCNA output

```javascript
{
  workingRcnaRecord,
  outboundRcnaRecord,
  audit,
}
```

### RCNA-to-834 input

```javascript
{
  workingRcnaRecord,
  transactionIntent,
  context: {
    correlationId,
    workItemId,
  },
}
```

### RCNA-to-834 output

```javascript
{
  subscriberKey,
  memberSortKey,
  isSubscriber,
  segments,
  audit,
}
```

### Acceptance checks

- Method names are `transformRow`.
- Inputs and outputs use singular primary-record names.
- Context contains no database client or repository.
- Existing private rule helpers remain reusable.

---

## Slice 2: Refactor RCNO input validation

### Goal

Validate one primary RCNO record and its supplied lookup collections.

### Changes

1. Replace `rcnoRecords` with `rcnoRecord`.
2. Replace:
   - `membershipRecords` with `membershipCandidates`;
   - `recent834Records` with `recentEnrollmentCandidates`;
   - `priorRcnaRecords` with `priorRcnaCandidates`.
3. Require exactly 73 fields in the primary row.
4. Validate every supplied lookup candidate against its canonical width.
5. Preserve all values as strings.
6. Do not mutate input arrays.

### Tests

- accepts one valid 73-field row;
- rejects 72- and 74-field primary rows;
- rejects malformed lookup candidates;
- accepts empty lookup collections;
- proves the input arrays remain unchanged.

---

## Slice 3: Return one RCNA result

### Goal

Remove the outer record loop while preserving existing deterministic rules.

### Changes

1. Build one evaluation context.
2. Evaluate the existing ordered rule chain once.
3. Return:
   - one 78-field working RCNA record;
   - one 76-field outbound RCNA record; and
   - one audit object.
4. Include `correlationId` and `workItemId` in audit metadata.
5. Do not return arrays containing one item.

### Tests

- A100 returns one working and one outbound record;
- B200 copies the prior decision and increments Aging Months;
- F13/F14 distinguish processed status;
- N0 handles a missing membership candidate;
- default rule remains deterministic;
- output source fields exactly equal the input source fields.

---

## Slice 4: Harden lookup-candidate handling

### Goal

Prevent nondeterministic selection when database queries return duplicates.

### Changes

1. Collapse byte/logically identical duplicate candidates.
2. Reject conflicting duplicates for the same lookup key.
3. Include only counts and source identifiers in audit data.
4. Never select the first conflicting candidate based on database order.

### Tests

- identical duplicate membership candidates behave as one;
- conflicting membership candidates throw an explicit error;
- identical recent-enrollment candidates behave as one;
- conflicting recent-enrollment candidates throw;
- conflicting prior-RCNA candidates throw.

---

## Slice 5: Apply approved RCNA decisions and retain unresolved boundaries

### Goal

Apply the approved N12 and I-family decisions while retaining configuration boundaries for questions that remain unresolved.

### Changes

1. Use approved code `AE999` for N12000, with an optional explicit override.
2. Select I4/I6 when matching membership coverage is active on the business date and I5/I7 when it is not active.
3. Require `addressNormalizer` only for N91/N92.
4. Require seven explicit zero-based `membershipAddressColumns` for N91/N92.
5. Do not provide silent defaults for decisions that remain unresolved.

### Tests

- N12000 uses `AE999` by default and accepts an explicit override;
- processed 834 plus active coverage selects I4;
- processed 834 plus inactive coverage selects I5;
- unprocessed 834 plus active coverage selects I6;
- unprocessed 834 plus inactive coverage selects I7;
- N91/N92 fail without address configuration;
- configured address normalization selects N91 or N92.

---

## Slice 6: Refactor RCNA-to-834 validation

### Goal

Accept and validate exactly one working RCNA record.

### Changes

1. Replace `workingRcnaRecords` with `workingRcnaRecord`.
2. Require exactly 78 fields.
3. Resolve one approved transaction intent:
   - use the explicit `transactionIntent` argument; or
   - use configured `intentByCode`.
4. Reject an unknown code.
5. Validate delimiters and row-level required values.

### Tests

- accepts one valid 78-field record;
- rejects invalid widths;
- rejects unknown RCNA code;
- accepts explicit transaction intent;
- rejects invalid dates and reserved delimiters.

---

## Slice 7: Return one 834 member-loop representation

### Goal

Map one RCNA row into one INS loop and its child segments.

### Changes

1. Determine subscriber status:
   - subscriber when member SSN equals subscriber SSN;
   - dependent otherwise.
2. Return `subscriberKey`, `memberSortKey`, and `isSubscriber`.
3. Generate only member-level segments:
   - INS;
   - member REF segments;
   - NM1;
   - optional PER;
   - optional N3;
   - N4;
   - DMG;
   - HD;
   - DTP 348;
   - optional DTP 349.
4. Preserve segment elements as arrays or a structured representation.
5. Do not serialize ISA, GS, ST, BGN, QTY, SE, GE, or IEA.

### Tests

- subscriber produces `INS01=Y` and `INS02=18`;
- dependent produces `INS01=N` and mapped relationship;
- subscriber receives configured HD05 coverage level;
- dependent does not receive HD05;
- coverage dates map to DTP 348/349;
- output contains no envelope or trailer segments.

---

## Slice 8: Preserve explicit address-line-3 handling

### Goal

Avoid silently losing RCNA address line 3.

### Changes

1. Reject a populated address line 3 when no handler is configured.
2. Invoke `addressLine3Handler` when configured.
3. Require the handler to return `{ line1, line2 }`.
4. Validate the returned values for X12 delimiters.

### Tests

- populated line 3 fails without a handler;
- handler can combine lines 2 and 3;
- malformed handler result fails;
- delimiters introduced by the handler are rejected.

---

## Slice 9: Remove interchange assembly from the service

### Goal

Ensure `RcnaTo834Service` remains a pure row transformer.

### Remove from this service

- subscriber-group collection;
- cross-row sorting;
- ISA and GS generation;
- ST and BGN generation;
- QTY calculations;
- SE, GE, and IEA generation;
- control-number assignment;
- final X12 string assembly.

### Preserve for a later assembler

The removed logic can be moved into a separate `Rcna834InterchangeAssembler` after its batching contract is approved.

### Tests

- `transformRow` accepts only one row;
- returned result has one member-loop representation;
- no batch counts are returned;
- no final X12 string is returned;
- no clock or envelope configuration is required by the row transformer.

---

## Slice 10: Migrate and expand tests

### Goal

Replace batch-oriented tests with row-oriented tests while retaining rule coverage.

### Changes

1. Update all RCNO service tests to call `transformRow`.
2. Update all 834 service tests to call `transformRow`.
3. Remove complete-interchange assertions from `RcnaTo834Service` tests.
4. Add audit-context assertions.
5. Add duplicate and address-mapping hardening tests.

### Verification commands

```powershell
npm test -- --runInBand app/services/rcnoa/__tests__
npm test -- --runInBand
```

### Completion threshold

- all focused tests pass;
- all repository tests pass;
- no existing test is skipped;
- `git diff --check` passes.

---

## Slice 11: Final implementation review

### Goal

Verify the implementation matches the corrected design rather than merely passing tests.

### Review checklist

- [ ] Both classes expose `transformRow`.
- [ ] Each call accepts exactly one primary row.
- [ ] Neither class performs file I/O.
- [ ] Neither class performs database I/O.
- [ ] Neither class mutates input arguments.
- [ ] RCNO output is exactly 78 and 76 fields.
- [ ] 834 output is one structured member loop.
- [ ] Interchange assembly is absent from the row service.
- [ ] Duplicate lookup behavior is deterministic.
- [ ] Unresolved business rules require explicit configuration.
- [ ] Errors contain no PII.
- [ ] Focused and full Jest suites pass.

---

## Recommended execution order

| Order | Slice | Risk |
|---:|---|---|
| 1 | Freeze contracts | Low |
| 2 | Refactor RCNO validation | Low |
| 3 | Return one RCNA result | Medium |
| 4 | Harden lookup candidates | Medium |
| 5 | Preserve unresolved-rule configuration | Medium |
| 6 | Refactor 834 validation | Low |
| 7 | Return one member loop | Medium |
| 8 | Preserve address handling | Low |
| 9 | Remove interchange assembly | Medium |
| 10 | Migrate and expand tests | Medium |
| 11 | Final review | Low |

Each slice should be implemented and tested before beginning the next slice. If a slice fails, revert only that incomplete slice rather than combining multiple API and behavior changes into one large patch.
