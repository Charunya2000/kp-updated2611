# RCNOA detailed-design diagnostic test data

These rows validate the 2026-10-23 detailed-design updates against this membership lookup record:

- MRN: `110094535259`
- coverage: `19950301` through `19961201`
- member: `IDOLYNN NARDENE`
- member/subscriber SSN: `379114706`
- relationship: `SUBSCRIBER`
- plan: `377`
- birth date: `19730501`
- deceased date: empty

Each code block contains one pipe-delimited RCNO row with exactly 73 columns. Paste only the row into the diagnostic page. The expected output names below refer to derived RCNA columns 74-76: Priority, PSHB Code, and Code Description.

## Preconditions

These expectations were verified with business date `20261023`, configured N12 code `AE999`, no matching prior RCNA decision, and no matching recent 834 unless stated otherwise. A prior RCNA match can select B200 before the tested rule. Recent 834 data can also change N12000, F10000, I2000, or F20000 outcomes.

Date gate: F4600, F5700, F6800, F8000, F9000, F11000, F12000, F13000, F14000, F20000, N5000-2, N12000, N13000, and N14000 require the PSHBS coverage end date (RCNO column 32) to be populated and on or after the business date. F10000 still requires it to be on or before the business date. The N12000, N13000, and F20000 rows below therefore use a PSHBS coverage end of `20271231`.

## 1. Priority 3 aggregation

Validates that all matching Priority 3 N-family rules contribute canonical PSHB codes in deterministic slash-delimited order.

```text
01|||N||110094535259|N|TEST-ANN||I|NARDENE|NARDENE|M|IDOLYNN|IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|379114706|379114706|M|377|377|M|20260101|20260101|M|20271231|20271231|M||||||||||||||||||||||||||||TEST-PAY||I|18||I||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `N1000/N2000/N3000` |
| Column 74 | `3: Active Demographic Mismatches` |
| Column 75 | `DM501 Annuitant Number pending update/DM508 Payroll Office Number pending update/DM509 Relationship Code pending update` |
| Column 76 | `Carrier to update member field/Carrier to update member field/Carrier to update member field` |

## 2. Priority 4 defeats Priority 3

Validates stakeholder precedence `1 > 2 > 4 > 3 > 5`. N1000 matches, but the expired PSHBS coverage also satisfies CE-4, so Priority 4 wins.

```text
01|||N||110094535259|N|TEST-ANN||I|NARDENE|NARDENE|M|IDOLYNN|IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|379114706|379114706|M|377|377|M|19950301|19950301|M|19961201|19961201|M|||||||||||||||||||||||||||||||||||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `CE-4` |
| Column 74 | `4: Cancelled Enrollment Mismatch` |
| Column 75 | `CE*` |
| Column 76 | `Cancelled enrollment mismatch` |

## 3. N13000 Priority 1 ordering

Validates that an actionable plan mismatch with a PSHBS coverage end on or after the business date selects N13000 before Priority 3 processing.

```text
01|||N||110094535259|N||||NARDENE|NARDENE|M|IDOLYNN|IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|379114706|379114706|M|999|377|I|19950301|19950301|M|20271231|20271231|M|||||||||||||||||||||||||||||||||||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `N13000` |
| Column 74 | `1: Active Enrollment mismatch` |
| Column 75 | `AE501 834 Enrollment Awaiting Processing` |
| Column 76 | `Carrier to process the 834 enrollment` |

## 4. N12000 and AE* rendering

Validates manual review when the PSHBS start date is later than membership's start date, the PSHBS coverage end is on or after the business date, and no matching recent 834 exists. It also verifies that configured canonical code `AE999` renders as `AE*`.

```text
01|||N||110094535259|N||||NARDENE|NARDENE|M|IDOLYNN|IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|379114706|379114706|M|999|377|I|19960401|19960401|M|20271231|20271231|M|||||||||||||||||||||||||||||||||||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `N12000` |
| Column 74 | `1: Active Enrollment mismatch` |
| Column 75 | `AE*` |
| Column 76 | `Manual business review` |

## 5. F10000 revised disposition

Validates F10000's revised Priority 4, `CE002` display, and action. The PSHBS end date differs from membership and is not an approved extension.

```text
01|||F||110094535259|||||NARDENE|NARDENE|M|IDOLYNN|IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|379114706|379114706|M|377|377|M|19950301|19950301|M|19961101|19961101|M|||||||||||||||||||||||||||||||||||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `F10000` |
| Column 74 | `4: Cancelled Enrollment Mismatch` |
| Column 75 | `CE002 Record incorrectly matched` |
| Column 76 | `OPM to correct match` |

## 6. AC004 approved display

Validates the approved display for I2000's canonical `AC004` code. The MENR range extends beyond the business date and no matching recent 834 exists.

```text
01|||I||110094535259|||||NARDENE|NARDENE|M|IDOLYNN|IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|379114706|379114706|M|377|377|M|20260101|20260101|M|20271231|20271231|M|||||||||||||||||||||||||||||||||||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `I2000` |
| Column 74 | `2: Active Carrier Enrollment Mismatch` |
| Column 75 | `AC004 No 834 Term or Cancel Received` |
| Column 76 | `No 834 termination or cancellation received` |

## 7. AE013 approved display

Validates the approved F20000 display when the PSHBS coverage end is on or after the business date and neither membership nor recent 834 evidence matches. The deliberately unique names and SSN prevent matching the supplied membership row.

```text
01|||F||110094535259|||||NOLOOKUP-NARDENE|NOLOOKUP-NARDENE|M|NOLOOKUP-IDOLYNN|NOLOOKUP-IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|000000001|000000001|M|377|377|M|20260101|20260101|M|20271231|20271231|M|||||||||||||||||||||||||||||||||||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `F20000` |
| Column 74 | `1: Active Enrollment mismatch` |
| Column 75 | `AE013 No 834 Enrollment Received` |
| Column 76 | `OPM to investigate why an 834 was not sent` |

## 8. N13000 date gate (ended PSHBS coverage)

Validates the N-family date gate. The row is the N13000 row above, but the PSHBS coverage end (`19961201`) is before the business date, so N13000 does not match and the row falls through to the Priority 4 CE-4 catch-all.

```text
01|||N||110094535259|N||||NARDENE|NARDENE|M|IDOLYNN|IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|379114706|379114706|M|999|377|I|19950301|19950301|M|19961201|19961201|M|||||||||||||||||||||||||||||||||||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `CE-4` |
| Column 74 | `4: Cancelled Enrollment Mismatch` |
| Column 75 | `CE*` |
| Column 76 | `Cancelled enrollment mismatch` |

## 9. F-family date gate (future PSHBS coverage end)

Validates that F10000 is not selected when the PSHBS coverage end is on or after the business date. Membership coverage (`19950301` through `19961201`) differs from PSHBS, there is no recent 834, and the PSHBS coverage end is `20271231`, so no specific F rule applies and the AE-1 catch-all is selected.

```text
01|||F||110094535259|||||NARDENE|NARDENE|M|IDOLYNN|IDOLYNN|M|19730501|19730501|M|379114706|379114706|M|379114706|379114706|M|377|377|M|19950301|19950301|M|20271231|20271231|M|||||||||||||||||||||||||||||||||||||M|M|M
```

Expected:

| Output | Value |
| --- | --- |
| Rule | `AE-1` |
| Column 74 | `1: Active Enrollment mismatch` |
| Column 75 | `AE*` |
| Column 76 | `Active enrollment mismatch` |

## Lookup-data limitations

The supplied membership row cannot exercise these amended outcomes without changing lookup data:

| Outcome | Required lookup change |
| --- | --- |
| `N5000-2` / `AE014 Conflicting Date of Death` | Populate `MEMBER_DECEASED_DATE` and use a PSHBS coverage end on or after the business date; this is a Priority 3 rule, aggregated first with any other Priority 3 mismatches, and Priority 1 N-family rules and the `AE-1` catch-all take precedence over it. |
| `N14000` / `AE504` | Supply membership whose coverage end is the PSHBS coverage end plus 31 days (or birth date + 26 years + 31 days), with plan and start matching, `RCNO_Coverage_End_Result = I`, and a PSHBS coverage end on or after the business date. |
| `F4600`, `F5700`, `F6800`, `F8000`, `F9000`, `F11000`, `F12000` | Supply membership with the required deceased flags, age/disability values, coverage dates, or recent 834 evidence, and use a PSHBS coverage end on or after the business date. |
| `F13000` / `F14000` | Use a PSHBS coverage end on or after the business date, a name/SSN that matches no membership row, and a matching recent 834 with processed `Y` / `N`. |
| `F1300` / Priority 4 / `CE502` | Supply membership coverage whose end date is on or before its start date, then use those exact dates in PSHBS. |

`AE014` display formatting and F1300's revised Priority 4 are covered by the automated RCNOA tests even though this specific Oracle membership row cannot reach them.
