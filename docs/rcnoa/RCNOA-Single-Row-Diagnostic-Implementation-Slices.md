# RCNOA Single-Row Diagnostic Implementation Slices

## Purpose

This plan breaks the [single-row diagnostic feature](./RCNOA-Single-Row-Diagnostic-Feature.md) into independently testable changes. The detailed business rules remain governed by [RCNO-RCNA-834-Detailed-Design.md](./RCNO-RCNA-834-Detailed-Design.md).

The implementation must preserve normal RCNOA processing behavior while adding an authorized, read-only diagnostic path.

## Current state

| Area | Current implementation | Diagnostic target |
|---|---|---|
| Transformation | Batch `transform()` with early-return rule branches | Same rules with optional structured trace |
| Audit | Selected rule plus MDW/EPDS match counts | Every evaluated rule and predicate fact through selection |
| Prior decision | Repository loader exists; B200 selection is currently disabled in the transformer | Prior evidence and B200 operate through the normal boundary |
| API | Run, configuration, query, and artifact routes | Guarded, no-store `POST /rcnoa/diagnostic` |
| UI | Operations and Configuration tabs | Diagnostic tab immediately after Configuration |
| Persistence | Normal runs and artifacts persist | Diagnostic request has no write side effects |

## Delivery rules

Every slice must:

- use existing RCNOA parsers, repositories, query loaders, and rule helpers;
- preserve RCNO columns 1-73 exactly;
- avoid logging raw RCNO, RCNA, MDW, or EPDS values;
- add focused tests before opening the next behavior boundary;
- avoid changes to startup configuration or non-RCNOA architecture; and
- leave the full project build to the user unless explicitly requested.

---

## Slice 1: Add the opt-in trace foundation

**Status:** Complete

### Goal

Add a trace recorder to `RcnoToRcnaService` without changing decisions or the default result shape.

### Changes

1. Accept `trace: false` in `transform()`.
2. Create one response-local trace per source row only when requested.
3. Record rule ID, family, outcome, condition, structured facts, normalization, and reason.
4. Return `traces` only for trace-enabled calls.
5. Instrument A100 and family dispatch first to prove the contract.

### Acceptance checks

- normal transform results remain deeply equal to pre-trace results;
- trace mode returns one trace for one input row;
- A100 is marked selected when the overall result is `M`;
- nonmatching A100 is marked failed before family evaluation; and
- trace mode writes no additional logs.

---

## Slice 2: Trace prior-decision evaluation

**Status:** Complete

### Goal

Restore and explain B200 prior-decision reuse.

### Changes

1. Remove the hardcoded `const prior = null` bypass.
2. Use the existing exact normalized 73-column prefix match.
3. Record candidate count, match result, prior decision fields, and aging calculation.
4. Keep HMAC secrets and internal match keys out of the trace.

### Acceptance checks

- exact prior RCNA selects B200;
- nonmatching prior candidates leave B200 failed;
- prior aging increments by one;
- invalid prior aging fails explicitly; and
- the existing prior-decision regression test passes.

---

## Slice 3: Instrument F-family rules

**Status:** Complete

### Goal

Record each F-family rule evaluated from F1300 through F20000.

### Acceptance checks

- each branch records all facts used by its current condition;
- failed rules appear in design order;
- only the selected rule is marked selected;
- later rules are not reported as evaluated; and
- representative F2, F3, F13, F14, and F20 tests verify lookup evidence.

---

## Slice 4: Instrument I-family rules

**Status:** Complete

### Goal

Record each I-family rule evaluated from I1000 through I7000.

### Acceptance checks

- MENR subscriber matching facts are visible;
- MENR date and recent-834 facts are visible;
- active-coverage boundaries are explicit and inclusive; and
- processed/unprocessed branches agree with unchanged RCNA output.

---

## Slice 5: Instrument N-family and catch-all rules

**Status:** Complete

### Goal

Record N0000 through N16000 and all catch-all/default evaluations.

### Acceptance checks

- original and comparison-normalized MRNs are distinct trace values;
- leading-zero MRN equivalence is explained without source mutation;
- name, SSN, demographic, plan, date, and address predicates are represented;
- address normalizer identity/version is included when available; and
- catch-all ordering agrees with detailed design Section 10.5.

---

## Slice 6: Add named diagnostic evidence mapping

**Status:** Complete

### Goal

Map positional source and lookup arrays to stable, named response objects.

### Changes

1. Define RCNO, working RCNA, MDW, and EPDS field metadata in an RCNOA-local module.
2. Return original values and response-local candidate IDs.
3. Calculate match-strategy annotations using the same comparison helpers as transformation.
4. Exclude connection details, SQL, credentials, secrets, and internal HMAC keys.

### Acceptance checks

- all 73 source fields have correct names and positions;
- working and outbound output widths are 78 and 76;
- MDW and EPDS evidence follows detailed design Section 8; and
- missing versus blank data remains distinguishable where known.

---

## Slice 7: Add read-only diagnostic orchestration

**Status:** Complete

### Goal

Process one pasted row with current configuration and lookup sources without creating operational state.

### Changes

1. Parse with `parseRcnoText()` and require exactly one record.
2. Load business configuration.
3. Capture one business date and reconciliation cycle.
4. Load MDW/EPDS candidates with `loadRcnoaOracleLookups()`.
5. Load prior-RCNA evidence through `loadPriorRcnaRecords()`.
6. Transform with trace enabled.
7. Map the result and evidence to the diagnostic response.

### Acceptance checks

- one valid row produces one response;
- empty, multi-row, and malformed input fail before lookups;
- configured timeouts and N12 code are honored;
- no run, artifact, prior-decision save, 834, or SFTP function is called; and
- upstream failures never return a partial success result.

---

## Slice 8: Add guarded API and client function

**Status:** Complete

### Goal

Expose the diagnostic operation through the existing authenticated RCNOA API pattern.

### Changes

1. Add `POST /api/[teamName]/[assistantName]/rcnoa/diagnostic`.
2. Apply `PERMISSIONS.RCNOA_PROCESSING_MANAGE`.
3. Validate route parameters with `rcnoaParams()`.
4. Return the standard JSON success/error envelope.
5. Set `Cache-Control: no-store`.
6. Add `diagnoseRcnoaRow(teamName, rcnoRow)` to the client service.

### Acceptance checks

- unauthorized access returns 403;
- invalid input returns 400;
- successful responses are not cacheable; and
- no sensitive values are written to route logs.

---

## Slice 9: Add the Diagnostic tab and input workflow

**Status:** Complete

### Goal

Add a focused MUI diagnostic work surface immediately after Configuration.

### Changes

1. Add the third tab to `RcnoaAdminExperience`.
2. Add a dedicated `RcnoaDiagnostic` component.
3. Implement multiline input, field count, Process row, Clear, loading, and error states.
4. Keep pasted data in component memory only.

### Acceptance checks

- tab order is Operations, Configuration, Diagnostic;
- only one request can run at a time;
- validation errors preserve input;
- Clear removes input and result; and
- controls remain usable on mobile and desktop.

---

## Slice 10: Render complete diagnostic results

**Status:** Complete

### Goal

Display the decision, output, rule trace, and all relevant evidence using themed components.

### Changes

1. Decision summary.
2. Copyable 76-column outbound RCNA row.
3. Structured source and output field tables.
4. Expandable ordered rule evaluation trace.
5. MDW membership evidence.
6. EPDS recent-834 evidence.
7. Prior-RCNA evidence.

### Acceptance checks

- selected rule is visually and textually identified;
- failed rules through selection remain inspectable;
- rules after selection are not presented as evaluated;
- evidence shows how each candidate affected matching;
- long values do not overlap or resize controls; and
- icon-only actions have tooltips and accessible labels.

---

## Slice 11: Security and end-to-end verification

**Status:** Complete

### Goal

Verify production parity, privacy, accessibility, and responsive behavior.

### Acceptance checks

- diagnostic and normal transforms produce identical records for identical inputs;
- response and browser state are not persisted or cached;
- logs contain no raw member data;
- focused service, route, and UI tests pass;
- desktop and mobile screenshots show no overlap or clipping; and
- no full build is required for completion unless requested by the user.
