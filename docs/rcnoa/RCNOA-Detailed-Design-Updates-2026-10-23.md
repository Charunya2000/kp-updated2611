# RCNOA Detailed Design Updates - October 23, 2026

## 1. Purpose

This document records RCNOA detailed-design decisions from discussions with senior RCNOA stakeholders on October 23, 2026. It amends the corresponding behavior in `RCNO-RCNA-834-Detailed-Design.md`. Where this note conflicts with that baseline, this dated stakeholder decision governs until the baseline is revised.

## 2. N-family evaluation order

### 2.1 Priority-group processing

N-family rules must no longer be evaluated solely by the numeric value in the existing `Order` column.

Evaluate N-family rules by priority group in this sequence:

1. Priority 1
2. Priority 2
3. Priority 3
4. Priority 4
5. Any later approved priority group

Within each priority group, use the approved rule order for that group. Do not allow a match from a later priority group to prevent evaluation of an earlier priority group.

The business meaning of the priority groups is:

| Priority | Business meaning |
|---:|---|
| 1 | The member is not active in KP as of the applicable dates |
| 2 | OPM has the member and KP does not |
| 3 | Member or enrollment data mismatches |
| 4 | The member's coverage is already end-dated |

### 2.2 Revised Priority 1 order

Evaluate Priority 1 N-family rules in this exact order:

| Priority 1 order | Rule |
|---:|---|
| 1 | `N0000` |
| 2 | `N5000-2` |
| 3 | `N13000` |
| 4 | `N14000` |
| 5 | `N12000` |

This order supersedes the relative order of these rules in the baseline catalog.

### 2.3 N5000-2 priority

> **Superseded (November 3, 2026):** `N5000-2` is Priority 3, not Priority 1. It is aggregated with the other Priority 3 mismatches and is no longer part of the Priority 1 sequence. See Section 10.4 of `RCNO-RCNA-834-Detailed-Design.md`.

Change `N5000-2` from Priority 3 to Priority 1.

| Rule | Previous priority | Revised priority | Code | Action |
|---|---:|---:|---|---|
| `N5000-2` | 3 | 1 | `AE014` | OPM to correct date of death and coverage end |

### 2.4 Priority 3 mismatch aggregation

Priority 3 N-family processing must evaluate all applicable mismatch rules rather than stopping after the first match.

For every applicable Priority 3 mismatch:

- retain the match in the rule-evaluation audit;
- use its canonical PSHB code, not its N-family catalog rule ID;
- render its canonical PSHB code using the full Section 9.2 column 75 display mapping;
- include its rule-catalog `Description/action` value in RCNA column 76; and
- concatenate the full display messages in column 75 and the corresponding `Description/action` values in column 76 with a forward slash (`/`) in deterministic evaluation order.

Example column 75 format:

```text
DM501 Annuitant Number pending update/DM508 Payroll Office Number pending update/DM509 Relationship Code pending update
```

Example column 76 format:

```text
Carrier to update member field/Carrier to update member field/Carrier to update member field
```

The slash-delimited values must contain no spaces around `/` unless a later outbound-interface decision requires them. This aggregation changes the N-family Priority 3 stop-after-first-match behavior in Section 9.1 of the baseline design.

The RCNA output still represents one row. The implementation must preserve every matched Priority 3 rule and canonical PSHB code in audit metadata.

## 3. Rule execution and catch-all precedence

### 3.1 Section 9.1.5 amendment

When a specific rule and a catch-all rule both match, Priority 4 is more urgent than Priority 3. Therefore, the overlap selection in Section 9.1.5 must use this stakeholder-approved precedence:

```text
Priority 1 > Priority 2 > Priority 4 > Priority 3 > Priority 5
```

Here, `>` means "more urgent than."

Equal-priority overlap continues to keep the specific rule. Overlap logging must continue to record both rule IDs, both priorities, whether they differed, and which decision was retained.

This amendment is intentionally narrower than N-family priority-group evaluation. N-family groups are evaluated in numeric group order, while specific-versus-catch-all overlap resolution treats Priority 4 as more urgent than Priority 3.

### 3.2 Section 10.5 effect

No catch-all predicates or catch-all codes are changed by this decision. Section 10.5 changes only in how a Priority 4 catch-all competes with a Priority 3 specific decision under Section 9.1.5.

## 4. F-family rule changes

### 4.1 F1300

Change `F1300` from Priority 1 to Priority 4. Its condition, code, and action remain unchanged.

| Rule | Previous priority | Revised priority | Code | Action |
|---|---:|---:|---|---|
| `F1300` | 1 | 4 | `CE502` | Carrier data matches RCNO; no action |

### 4.2 F10000

Change `F10000` as follows:

| Attribute | Previous value | Revised value |
|---|---|---|
| Priority | 1 | 4 |
| Canonical code | `AE010` | `CE002` |
| Action | OPM to correct coverage end date | OPM to correct match |

The existing `F10000` condition remains unchanged: it applies to the documented ended-coverage mismatch when neither the F8000 nor F9000 extension exception applies.

## 5. RCNA column 75 display updates

Add or replace these entries in the PSHB code display mapping for RCNA column 75:

| Canonical code | RCNA column 75 display |
|---|---|
| `AC004` | `AC004 No 834 Term or Cancel Received` |
| `AE013` | `AE013 No 834 Enrollment Received` |
| `AE014` | `AE014 Conflicting Date of Death` |
| `AE999` | `AE*` |

These are display values only. Rule evaluation and audit continue to use the canonical code shown in the first column.

## 6. I-family rules

There are no changes to the I-family rules. Their existing predicates, priorities, order, codes, and actions remain in effect.

## 7. Required implementation and test updates

Implementation work based on this decision must update:

- N-family orchestration from global order-only evaluation to priority-group evaluation;
- the exact Priority 1 N-family sequence;
- `N5000-2` priority and expected output;
- Priority 3 evaluation so all applicable canonical PSHB codes are captured, their full Section 9.2 display messages are slash-concatenated in RCNA column 75, and their `Description/action` values are slash-concatenated in column 76;
- specific-versus-catch-all precedence so Priority 4 defeats Priority 3;
- `F1300` priority;
- `F10000` priority, canonical code, action, and rendered output;
- RCNA column 75 display mappings; and
- rule catalog, unit tests, generated fixtures, BDD cases, and expected audit results affected by these decisions.

At minimum, tests must prove:

1. Priority 1 N-family rules are evaluated in the newly approved order.
2. `N5000-2` is selected as Priority 1 where applicable.
3. Multiple Priority 3 mismatches are all evaluated; their full Section 9.2 display messages are rendered in stable slash-delimited order in RCNA column 75 and their corresponding `Description/action` values in column 76.
4. A Priority 4 catch-all defeats a Priority 3 specific rule, while an equal-priority specific rule still wins.
5. `F1300` renders Priority 4.
6. `F10000` renders Priority 4, canonical code `CE002`, and action `OPM to correct match`.
7. The four revised column 75 displays are exact.
8. Existing I-family behavior remains unchanged.

## 8. Resolved implementation clarification

For Priority 3 mismatch aggregation, "rule code" means the canonical PSHB code, such as `DM501`, and not the N-family catalog rule ID, such as `N1000`.

When multiple Priority 3 rules match, RCNA column 75 must contain all matched codes as full Section 9.2 display messages in deterministic slash-delimited order, and column 76 must contain the corresponding rule-catalog `Description/action` values in the same order. For example, column 75 contains `DM501 Annuitant Number pending update/DM508 Payroll Office Number pending update` and column 76 contains `Carrier to update member field/Carrier to update member field` when those two codes apply. The audit must retain all matched catalog rule IDs and canonical PSHB codes.
