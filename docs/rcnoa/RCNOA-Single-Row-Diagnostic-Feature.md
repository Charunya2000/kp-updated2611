# RCNOA Single-Row Diagnostic Feature

## 1. Purpose

Add an interactive diagnostic view to the RCNOA administration page. An authorized analyst can paste one plaintext RCNO row, process it through the production RCNO-to-RCNA rules, and inspect why the resulting RCNA decision was selected.

The diagnostic must make the transformation explainable without creating a processing run, uploading an artifact, modifying source data, or persisting an RCNA decision.

This document supplements the [RCNO-RCNA-834 Detailed Business and Technical Design](./RCNO-RCNA-834-Detailed-Design.md). The detailed design remains authoritative for field contracts, lookup schemas, match predicates, rule ordering, output layouts, validation, and security requirements. If this document conflicts with the detailed design, the detailed design governs.

## 2. Goals

The feature must:

1. add a `Diagnostic` tab immediately to the right of the `Configuration` tab;
2. accept exactly one pipe-delimited RCNO row;
3. validate the row against the 73-column RCNO contract;
4. load the MDW membership and EPDS recent-834 data relevant to that row;
5. load an applicable prior-RCNA decision using the normal repository boundary;
6. process the row through the same transformation implementation used by normal RCNOA runs;
7. return exactly one 76-column outbound RCNA row and its 78-column working representation;
8. explain each evaluated rule, its pass/fail result, and the facts used by its predicates;
9. identify the selected rule and all derived RCNA fields;
10. preserve source values, including leading zeroes; and
11. present the result using the existing MUI theme and RCNOA administration patterns.

## 3. Non-goals

The first release does not:

- process multiple RCNO rows;
- accept encrypted input or file uploads;
- create or update an operational run;
- write RCNO, RCNA, or 834 artifacts;
- save the diagnostic result as prior-RCNA history;
- generate or deliver an 834;
- edit MDW, EPDS, MongoDB, or local prior-RCNA data;
- override the configured SQL from the diagnostic screen;
- allow the analyst to alter rule outcomes; or
- replace the existing batch workflow or test harness.

## 4. User experience

### 4.1 Navigation

The RCNOA page tab order is:

1. `Operations`
2. `Configuration`
3. `Diagnostic`

Use a MUI troubleshooting or analytics icon consistent with the icons already used by the page. The tab is available only to users who can access the RCNOA administration experience.

### 4.2 Initial state

The diagnostic view contains:

- a heading, `Single-row diagnostic`;
- a multiline RCNO input field using a monospace font;
- a field-count indicator, such as `0 of 73 fields`;
- a `Process row` primary action;
- a `Clear` text or action button; and
- a short statement that processing reads live configured lookup sources and does not create a run or save a decision.

The interface must not contain explanatory marketing content. It is an operational work surface.

### 4.3 Input behavior

The input accepts one plaintext row. Leading and trailing line-ending characters may be removed, but field content must not otherwise be changed before parsing.

The client may provide immediate field-count feedback, but server validation is authoritative.

Reject the request when:

- the input is empty;
- it contains more than one nonblank row;
- it contains a null byte;
- it does not contain exactly 73 pipe-delimited fields; or
- the parsed record violates an invocation-level contract in detailed design Section 11.1.

The UI displays a specific validation message and retains the pasted input for correction.

### 4.4 Processing state

While processing:

- disable `Process row` to prevent duplicate requests;
- show a progress indicator in the action;
- retain the submitted text;
- clear stale results from a previous submission; and
- allow the request to use the configured Oracle timeout.

### 4.5 Result layout

Results appear below the input in the following order.

#### Decision summary

Show a compact summary band containing:

- selected rule ID;
- priority;
- PSHB code;
- description/action;
- aging months;
- business date;
- rule-catalog identifier or application version when available;
- business-configuration version; and
- counts of MDW, EPDS, and prior-RCNA candidates considered.

Use status color as a secondary signal only. Do not rely on color to communicate the decision.

#### RCNA output

Show a diagnostic-only 78-column RCNA row in a read-only monospace field with a copy action. This row includes the two internal working fields, `Notes` and `Aging_Months`; normal outbound RCNA artifacts remain 76 columns. Also provide a structured field table showing:

- column number;
- field name;
- source RCNO value or derived value; and
- whether the field was preserved or derived.

The working-only `Notes` and `Aging_Months` fields must be clearly identified as diagnostic fields because they are not part of the 76-column outbound row sent to OPM.

#### Rule evaluation trace

Show all rules actually evaluated, in execution order, through and including the selected rule. Each trace entry contains:

- evaluation order;
- rule ID;
- rule family;
- outcome: `passed`, `failed`, `selected`, or `not-applicable`;
- a concise governing-condition label;
- each predicate evaluated;
- the left and right facts used by the predicate;
- comparison normalization applied;
- predicate result;
- lookup candidate identifiers or response-local candidate numbers used; and
- a reason explaining why evaluation continued or stopped.

Rules after the selected rule are not executed. The UI may list them as `not evaluated after first match`, but it must not imply that their predicates were run.

Use an expandable MUI table or accordion. The selected rule is expanded by default. Failed rules remain inspectable.

#### MDW membership evidence

Display every MDW candidate returned for this RCNO row that was available to the transformer. The table uses the canonical membership contract from detailed design Section 8.1, including available values for:

- `kp_mrn`;
- coverage start and end dates;
- first and last name;
- member and subscriber SSNs;
- gender;
- relationship;
- plan code;
- annuitant and payroll office values;
- deceased indicators and date;
- age and disability indicators;
- birth date; and
- address fields when the configured query provides them.

For each candidate, show which match strategies it satisfied: membership by MRN, subscriber identity, and member identity. Show comparison-normalized values when normalization affected a decision. Preserve and display the original source value separately.

Digit-only MRNs follow detailed design Section 8.3: insignificant leading zeroes are removed for comparison only. For example, `000321456` matches `321456`, and `000032145` matches `032145`.

#### EPDS recent-834 evidence

Display every EPDS candidate returned for this RCNO row that was available to the transformer. The table uses the canonical recent-834 contract from detailed design Section 8.2:

- subscriber SSN;
- coverage start date;
- coverage end date; and
- processed indicator.

For each candidate, show whether it matched the F-family date strategy, the I/N-family date strategy, or neither. State whether and where the candidate affected an evaluated predicate.

#### Prior-RCNA evidence

Show whether a prior decision was found for the exact normalized RCNO columns 1-73 and reconciliation cycle. When found, show:

- prior priority;
- prior code;
- prior description;
- prior notes;
- prior aging months;
- current calculated aging months; and
- whether rule B200 selected the prior decision.

Do not expose the HMAC match-key secret or internal raw match key.

#### Input facts

Provide a field-by-field view of the 73 source columns using the names in detailed design Section 7. Highlight fields referenced by evaluated predicates. Empty values must remain visibly distinguishable from values that were not loaded.

## 5. Processing behavior

### 5.1 Request sequence

The server-side diagnostic operation performs these steps:

1. authorize the request using `PERMISSIONS.RCNOA_PROCESSING_MANAGE`;
2. validate the RCNOA team and assistant route parameters;
3. validate that the request body contains one string `rcnoRow`;
4. parse the value with the standard RCNO parser;
5. verify that exactly one record was produced;
6. load the current RCNOA business configuration;
7. capture `businessDate` once in `YYYYMMDD` format;
8. derive the reconciliation cycle using the same production convention;
9. load MDW and EPDS lookups through `loadRcnoaOracleLookups()`;
10. load prior-RCNA evidence through `loadPriorRcnaRecords()` when the configured secret permits it;
11. invoke `RcnoToRcnaService.transform()` in diagnostic trace mode;
12. verify that exactly one working and one outbound record were returned;
13. map positional source and lookup records to named response fields; and
14. return the result without invoking any save, artifact, run, 834, or delivery operation.

### 5.2 Production parity

The diagnostic must call the same parser, repository functions, lookup loader, normalization helpers, and rule predicates used by normal processing. It must not duplicate the business rules in the API route or UI.

The diagnostic trace is observational. Enabling it must not change:

- rule order;
- predicate truth values;
- selected rule;
- derived values;
- source value preservation; or
- normal batch response contracts.

A diagnostic invocation and a production invocation with the same row, business date, lookup snapshot, prior decision, and configuration must produce the same working and outbound RCNA records.

### 5.3 Side-effect boundary

The operation is read-only except for standard application access/error logs. It must not:

- create a run document;
- reserve an artifact;
- write local or Azure files;
- call `savePriorRcnaRecords()`;
- enqueue processing;
- generate an 834; or
- send data to SFTP.

The response itself is not persisted by the diagnostic feature.

## 6. Diagnostic trace model

The current transformation audit reports the selected rule and lookup match counts. The feature requires an additive, structured trace mode to satisfy detailed design Sections 9.1 and 11.2.

A recommended service option is:

```javascript
await service.transform({
  rcnoRecords,
  membershipRecords,
  recent834Records,
  priorRcnaRecords,
  trace: true,
});
```

Normal callers omit `trace` and retain the existing result shape and cost. Diagnostic callers receive an additional `traces` array.

### 6.1 Trace shape

```json
{
  "sourceRow": 1,
  "businessDate": "20260915",
  "selectedRuleId": "N0000",
  "evaluations": [
    {
      "order": 1,
      "ruleId": "A100",
      "family": "match",
      "outcome": "failed",
      "condition": "RCNO overall result equals M",
      "predicates": [
        {
          "name": "overallResultIsMatch",
          "left": { "field": "RCNO_Subscriber_ID_Result", "value": "N" },
          "operator": "equals",
          "right": { "value": "M" },
          "normalization": ["trim", "uppercase"],
          "result": false
        }
      ],
      "reason": "Overall RCNO result is N"
    },
    {
      "order": 25,
      "ruleId": "N0000",
      "family": "N",
      "outcome": "selected",
      "condition": "No membership row exists for MENR member ID/MRN",
      "predicates": [
        {
          "name": "membershipByMrnExists",
          "left": { "field": "MENR_Member_ID", "value": "000032145" },
          "operator": "matches any normalized MRN",
          "right": { "candidateCount": 0 },
          "normalization": ["trim", "uppercase", "remove insignificant leading zeroes for digit-only MRN"],
          "result": false
        }
      ],
      "reason": "No MDW candidate matched comparison MRN 32145"
    }
  ]
}
```

### 6.2 Trace requirements

- Trace entries are generated at the point each predicate is evaluated.
- Human-readable reasons supplement, but do not replace, structured facts.
- Field names and rule IDs match the detailed design.
- Original and comparison-normalized values are distinct properties.
- Empty string, database `NULL` mapped to empty string, invalid value, and unavailable field must be distinguishable where the repository has that information.
- Candidate numbering is stable within one response.
- Conflicting duplicate lookup candidates produce a diagnostic error, not an arbitrary selected result.
- Address rules identify the normalizer and version when available.
- Trace generation must not write PII to logs.

## 7. API design

### 7.1 Endpoint

```text
POST /api/{teamName}/rcno-rcna-834/rcnoa/diagnostic
Content-Type: application/json
```

Permission:

```text
PERMISSIONS.RCNOA_PROCESSING_MANAGE
```

Request:

```json
{
  "rcnoRow": "01|...exactly 73 fields..."
}
```

Successful response:

```json
{
  "success": true,
  "diagnostic": {
    "businessDate": "20260915",
    "configurationVersion": 4,
    "source": {
      "fieldCount": 73,
      "fields": [],
      "serializedRow": "01|..."
    },
    "decision": {
      "ruleId": "N1000",
      "priority": "3",
      "code": "DM501",
      "description": "Carrier to update member field",
      "notes": "",
      "agingMonths": "0"
    },
    "output": {
      "workingFieldCount": 78,
      "outboundFieldCount": 76,
      "workingFields": [],
      "outboundFields": [],
      "serializedOutboundRow": "01|..."
    },
    "evidence": {
      "membership": [],
      "recent834": [],
      "priorRcna": null
    },
    "trace": {
      "sourceRow": 1,
      "selectedRuleId": "N1000",
      "evaluations": []
    }
  }
}
```

Validation and operational failures use the existing RCNOA error response format. Recommended statuses are:

| Status | Condition |
|---:|---|
| 400 | Empty input, multiple rows, malformed JSON, invalid field count, or invalid field value |
| 403 | User lacks RCNOA processing permission |
| 409 | Conflicting duplicate candidates or configuration state prevents deterministic processing |
| 500 | Unexpected repository or transformation error |
| 502 | MDW or EPDS connection/query failure when upstream failures are distinguishable |

Do not return database connection strings, SQL credentials, secrets, stack traces, or unrelated lookup rows.

### 7.2 Client service

Add a named client service function consistent with the existing RCNOA client:

```javascript
export async function diagnoseRcnoaRow(teamName, rcnoRow) {
  return apiRequest(`${baseUrl(teamName)}/diagnostic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rcnoRow }),
  });
}
```

## 8. Component design

Keep the page component focused by placing the diagnostic work surface in a dedicated component, for example:

```text
app/[teamName]/admin/rcnoa/RcnoaDiagnostic.js
```

Recommended component responsibilities:

- `RcnoaDiagnostic`: request state, input, process/clear actions, top-level result composition;
- `RcnoaDecisionSummary`: selected decision and invocation metadata;
- `RcnoaOutputView`: serialized RCNA and field table;
- `RcnoaRuleTrace`: ordered expandable evaluations;
- `RcnoaLookupEvidence`: MDW, EPDS, and prior-RCNA evidence tabs or sections; and
- `RcnoaFieldTable`: reusable positional-to-named field display.

These may begin in one file and be extracted only when the implementation becomes difficult to scan. Do not create cards inside cards. Use unframed sections, restrained dividers, compact tables, MUI `Alert`, `Chip`, `Tabs`, `Table`, `Accordion`, `TextField`, `Tooltip`, and project button variants.

### 8.1 Responsive behavior

- On desktop, the decision summary may use a compact responsive grid.
- Evidence and trace tables must scroll horizontally rather than compress values until unreadable.
- On mobile, controls stack vertically and actions remain visible without overlap.
- Long RCNO/RCNA values use `overflowWrap: anywhere` or a horizontal monospace viewport.
- Fixed-format counters and actions use stable dimensions so loading and result states do not shift the layout.

### 8.2 Accessibility

- Associate the input label and validation message with the text field.
- Give icon-only actions tooltips and accessible labels.
- Preserve keyboard navigation through tabs, accordions, and tables.
- Announce request errors using MUI `Alert` semantics.
- Do not encode pass/fail or selected state by color alone.

## 9. Data protection and logging

RCNO, RCNA, MDW, and EPDS values contain sensitive member data. The diagnostic UI may display row-relevant values to an authorized analyst because that is the feature's purpose, but the server must minimize the response to the submitted row and candidates supplied to its transformation.

The implementation must:

- use the existing authenticated same-origin request behavior;
- enforce authorization on the server;
- avoid browser persistence such as `localStorage` or URL query parameters;
- avoid analytics or telemetry payloads containing source or lookup values;
- send `Cache-Control: no-store` on the diagnostic response;
- never log pasted rows, returned RCNA rows, names, addresses, MRNs, or SSNs;
- use masked identifiers and counts in `kpmsg` logs;
- never expose Oracle credentials, prior-match secrets, or HMAC keys; and
- clear in-memory UI results when the analyst uses `Clear` or leaves the page component.

Local-testing logs that reveal actual MRNs are an existing narrowly gated debugging behavior and are not a model for this endpoint's normal logging.

## 10. Error presentation

Errors must identify the failing stage without disclosing sensitive values:

- `Input validation`: row count, field count, or canonical-value problem;
- `Configuration`: missing or invalid RCNOA configuration;
- `MDW lookup`: membership source unavailable or contract-invalid;
- `EPDS lookup`: recent-834 source unavailable or contract-invalid;
- `Prior decision lookup`: prior-RCNA source unavailable;
- `Rule evaluation`: ambiguous evidence or transformation contract failure; and
- `Unexpected error`: unclassified server failure with a correlation ID.

A failed request returns no success-shaped partial RCNA result. If one upstream lookup is optional for the selected rule but its query failed, the service must still fail unless the production processing contract explicitly permits degraded operation. Diagnostics must not claim a deterministic outcome from incomplete evidence.

## 11. Testing strategy

### 11.1 Service tests

Add focused tests proving that the diagnostic orchestration:

- accepts one valid 73-field row;
- rejects empty, multi-row, and wrong-field-count input;
- calls the standard lookup loader with exactly one parsed RCNO record;
- captures one business date and passes it to lookup and transformation operations;
- uses current business configuration and prior-RCNA history;
- returns one working and one outbound record;
- maps MDW and EPDS positional records to named evidence;
- creates no run, artifact, prior-history save, 834, or SFTP side effect; and
- does not include secrets or SQL configuration in the response.

### 11.2 Transformation trace tests

For representative A, B, F, I, N, catch-all, and default outcomes, prove that:

- evaluations are ordered according to detailed design Section 10;
- each evaluated rule reports pass/fail facts;
- evaluation stops at the first selected rule;
- selected trace data agrees with the existing audit and output fields;
- trace mode and normal mode produce identical RCNA records;
- leading-zero MRN comparisons show original and normalized values without mutating output;
- conflicting candidates are reported as ambiguity errors; and
- PII is not written to logs.

### 11.3 Route tests

Prove that the endpoint:

- uses the RCNOA processing permission guard;
- validates team and assistant route parameters;
- returns `400` for invalid input;
- returns the standard success envelope for valid input;
- uses `Cache-Control: no-store`; and
- maps expected service failures to appropriate status codes.

### 11.4 UI tests

Prove that the UI:

- places `Diagnostic` after `Configuration`;
- disables processing for empty or visibly invalid input;
- displays server validation errors without clearing input;
- prevents duplicate submission while processing;
- renders decision, RCNA output, trace, MDW, EPDS, and prior evidence;
- identifies rules not executed after the selected rule accurately;
- copies the exact 76-column outbound row;
- clears sensitive input and results on command; and
- remains usable at desktop and mobile widths.

## 12. Acceptance criteria

The feature is complete when:

1. an authorized analyst can open the third RCNOA tab and paste one RCNO row;
2. the server rejects any input other than one valid 73-column row;
3. processing uses the same configured MDW, EPDS, prior-RCNA, normalization, and transformation boundaries as normal RCNOA processing;
4. the screen displays exactly one 76-column outbound RCNA result;
5. RCNO columns 1-73 in the result exactly preserve the submitted source fields;
6. the selected priority, code, description, notes, and aging values are visible;
7. all rules evaluated before selection and the selected rule are shown in order with predicate facts and outcomes;
8. all MDW and EPDS candidates made available to the transformer are shown with their relevance to matching and rules;
9. prior-RCNA evidence and aging behavior are shown when applicable;
10. leading-zero MRN equivalence is explained without altering either source value;
11. the request creates no run, artifact, prior-decision record, 834, or SFTP action;
12. unauthorized requests are rejected server-side;
13. diagnostic data is not cached or persisted in the browser;
14. application logs contain no raw row or unmasked member data; and
15. focused service, route, transformation trace, and UI tests pass.

## 13. Implementation sequence

1. Add the additive transformation trace contract and focused parity tests.
2. Add a read-only diagnostic orchestration service with mocked repository/Oracle tests.
3. Add the guarded `POST /rcnoa/diagnostic` route and route tests.
4. Add `diagnoseRcnoaRow()` to the RCNOA client service.
5. Add the `Diagnostic` tab and diagnostic component.
6. Add result sections for decision, output, rule trace, MDW, EPDS, prior decision, and input facts.
7. Validate responsive layout, accessibility, no-store behavior, and absence of sensitive logs.

This order establishes the explainability contract before the UI depends on it and keeps normal processing behavior independently verifiable.
