# RCNO-RCNA Complete BDD Test Specification

Source suite: RCNO-RCNA-Complete-TestCases
Version: 1.0.0
Generated from: RCNO-RCNA-834-Detailed-Design.md

## Coverage Summary

- Total catalog rules: 51
- Total catalog cases: 51
- Total validation cases: 10
- Total test cases: 61

## Core Ordered Rules (strict sequence)

| Order | Rule Name | Selected Rule ID |
|---:|---|---|
| 1 | RuleA | A100 |
| 2 | RuleB | B200 |
| 3 | RuleF1 | F1300 |
| 4 | RuleF2 | F2400 |
| 5 | RuleF3 | F3500 |
| 6 | RuleF4 | F4600 |
| 7 | RuleF5 | F5700 |
| 8 | RuleF6 | F6800 |
| 9 | RuleF7 | F7000 |

## Feature: RCNO to RCNA deterministic reconciliation

Background:
  Given exactly one canonical 73-field RCNO record is supplied per invocation
  And zero or more MDW membership candidates are supplied explicitly
  And zero or more EPDS recent-834 candidates are supplied explicitly
  And zero or more prior RCNA candidates are supplied explicitly
  And rules are evaluated strictly in configured order with first-match-wins behavior

### Rule Family A

```gherkin
@rule-catalog @order-1
Scenario: CAT-001-A100 - Rule-catalog coverage for RuleA (A100)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "M"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to M. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "A100"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 5: Matches (no action required) |
    | PSHB_Code | MM |
    | Code_Description | Matches (no action required) |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 5: Matches (no action required) |
    | PSHB_Code | MM |
    | Code_Description | Matches (no action required) |
```

### Rule Family B

```gherkin
@rule-catalog @order-2
Scenario: CAT-002-B200 - Rule-catalog coverage for RuleB (B200)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 1 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Ensure RuleA does not match. |
    | Provide prior RCNA candidate with exact RCNO columns 1-73 match. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "B200"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE001 No 834 cancellation received |
    | Code_Description | OPM to send 834 cancellation |
    | Notes |  |
    | Aging_Months | 3 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE001 No 834 cancellation received |
    | Code_Description | OPM to send 834 cancellation |
```

### Rule Family F

```gherkin
@rule-catalog @order-3
Scenario: CAT-003-F1300 - Rule-catalog coverage for RuleF1 (F1300)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F1300"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | CE502 Erroneous cancellation reported on MENR |
    | Code_Description | Carrier data matches RCNO; no action |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | CE502 Erroneous cancellation reported on MENR |
    | Code_Description | Carrier data matches RCNO; no action |
```

```gherkin
@rule-catalog @order-4
Scenario: CAT-004-F2400 - Rule-catalog coverage for RuleF2 (F2400)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F2400"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE001 No 834 cancellation received |
    | Code_Description | OPM to send 834 cancellation |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE001 No 834 cancellation received |
    | Code_Description | OPM to send 834 cancellation |
```

```gherkin
@rule-catalog @order-5
Scenario: CAT-005-F3500 - Rule-catalog coverage for RuleF3 (F3500)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F3500"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE500 |
    | Code_Description | Carrier to investigate and reprocess the 834 |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE500 |
    | Code_Description | Carrier to investigate and reprocess the 834 |
```

```gherkin
@rule-catalog @order-6
Scenario: CAT-006-F4600 - Rule-catalog coverage for RuleF4 (F4600)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F4600"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE002 Deceased Subscriber |
    | Code_Description | OPM to match ended coverage |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE002 Deceased Subscriber |
    | Code_Description | OPM to match ended coverage |
```

```gherkin
@rule-catalog @order-7
Scenario: CAT-007-F5700 - Rule-catalog coverage for RuleF5 (F5700)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F5700"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE003 Deceased Member |
    | Code_Description | OPM to match carrier record |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE003 Deceased Member |
    | Code_Description | OPM to match carrier record |
```

```gherkin
@rule-catalog @order-8
Scenario: CAT-008-F6800 - Rule-catalog coverage for RuleF6 (F6800)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F6800"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE004 Coverage end date set for aged off dependent |
    | Code_Description | OPM to investigate missing 834 / age-out handling |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE004 Coverage end date set for aged off dependent |
    | Code_Description | OPM to investigate missing 834 / age-out handling |
```

```gherkin
@rule-catalog @order-9
Scenario: CAT-009-F7000 - Rule-catalog coverage for RuleF7 (F7000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F7000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | Z0000 |
    | Code_Description | Invalid scenario |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | Z0000 |
    | Code_Description | Invalid scenario |
```

```gherkin
@rule-catalog @order-10
Scenario: CAT-010-F8000 - Rule-catalog coverage for RuleF8 (F8000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F8000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE502 No 834 Enrollment Received |
    | Code_Description | Carrier data matches RCNO; no action |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE502 No 834 Enrollment Received |
    | Code_Description | Carrier data matches RCNO; no action |
```

```gherkin
@rule-catalog @order-11
Scenario: CAT-011-F9000 - Rule-catalog coverage for RuleF9 (F9000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F9000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE504 |
    | Code_Description | No action required |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE504 |
    | Code_Description | No action required |
```

```gherkin
@rule-catalog @order-12
Scenario: CAT-012-F10000 - Rule-catalog coverage for RuleF10 (F10000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F10000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE010 Conflicting enrollment coverage end date |
    | Code_Description | OPM to correct coverage end date |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE010 Conflicting enrollment coverage end date |
    | Code_Description | OPM to correct coverage end date |
```

```gherkin
@rule-catalog @order-13
Scenario: CAT-013-F11000 - Rule-catalog coverage for RuleF11 (F11000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F11000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE001 Conflicting enrollment coverage start date |
    | Code_Description | OPM to correct coverage start date / pending enrollment |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE001 Conflicting enrollment coverage start date |
    | Code_Description | OPM to correct coverage start date / pending enrollment |
```

```gherkin
@rule-catalog @order-14
Scenario: CAT-014-F12000 - Rule-catalog coverage for RuleF12 (F12000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F12000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE502 No 834 Enrollment Received |
    | Code_Description | Carrier data matches RCNO; no action |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE502 No 834 Enrollment Received |
    | Code_Description | Carrier data matches RCNO; no action |
```

```gherkin
@rule-catalog @order-15
Scenario: CAT-015-F13000 - Rule-catalog coverage for RuleF13 (F13000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F13000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE500 |
    | Code_Description | Carrier to investigate and reprocess the 834 |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE500 |
    | Code_Description | Carrier to investigate and reprocess the 834 |
```

```gherkin
@rule-catalog @order-16
Scenario: CAT-016-F14000 - Rule-catalog coverage for RuleF14 (F14000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F14000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE501 834 Enrollment Awaiting Processing |
    | Code_Description | Carrier to process the 834 enrollment |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE501 834 Enrollment Awaiting Processing |
    | Code_Description | Carrier to process the 834 enrollment |
```

```gherkin
@rule-catalog @order-17
Scenario: CAT-017-F20000 - Rule-catalog coverage for RuleF20 (F20000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "F"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to F. |
    | Satisfy specific F-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "F20000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE013 |
    | Code_Description | OPM to investigate why an 834 was not sent |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE013 |
    | Code_Description | OPM to investigate why an 834 was not sent |
```

### Rule Family I

```gherkin
@rule-catalog @order-18
Scenario: CAT-018-I1000 - Rule-catalog coverage for RuleI1 (I1000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "I"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to I. |
    | Satisfy specific I-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "I1000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 2: Active Carrier Enrollment Mismatch |
    | PSHB_Code | AC002 Active Carrier enrollment now ended |
    | Code_Description | OPM to match ended coverage |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 2: Active Carrier Enrollment Mismatch |
    | PSHB_Code | AC002 Active Carrier enrollment now ended |
    | Code_Description | OPM to match ended coverage |
```

```gherkin
@rule-catalog @order-19
Scenario: CAT-019-I2000 - Rule-catalog coverage for RuleI2 (I2000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "I"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to I. |
    | Satisfy specific I-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "I2000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 2: Active Carrier Enrollment Mismatch |
    | PSHB_Code | AC004 |
    | Code_Description | No 834 termination/cancel received; OPM to investigate |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 2: Active Carrier Enrollment Mismatch |
    | PSHB_Code | AC004 |
    | Code_Description | No 834 termination/cancel received; OPM to investigate |
```

```gherkin
@rule-catalog @order-20
Scenario: CAT-020-I3000 - Rule-catalog coverage for RuleI3 (I3000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "I"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to I. |
    | Satisfy specific I-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "I3000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE001 No 834 cancellation received |
    | Code_Description | OPM to send 834 cancellation |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE001 No 834 cancellation received |
    | Code_Description | OPM to send 834 cancellation |
```

```gherkin
@rule-catalog @order-21
Scenario: CAT-021-I4000 - Rule-catalog coverage for RuleI4 (I4000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "I"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to I. |
    | Satisfy specific I-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "I4000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 2: Active Carrier Enrollment Mismatch |
    | PSHB_Code | AC500 |
    | Code_Description | Carrier to investigate and reprocess processed enrollment |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 2: Active Carrier Enrollment Mismatch |
    | PSHB_Code | AC500 |
    | Code_Description | Carrier to investigate and reprocess processed enrollment |
```

```gherkin
@rule-catalog @order-22
Scenario: CAT-022-I5000 - Rule-catalog coverage for RuleI5 (I5000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "I"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to I. |
    | Satisfy specific I-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "I5000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE500 |
    | Code_Description | Carrier investigation/reprocessing required |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE500 |
    | Code_Description | Carrier investigation/reprocessing required |
```

```gherkin
@rule-catalog @order-23
Scenario: CAT-023-I6000 - Rule-catalog coverage for RuleI6 (I6000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "I"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to I. |
    | Satisfy specific I-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "I6000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 2: Active Carrier Enrollment Mismatch |
    | PSHB_Code | AC501 No 834 Enrollment Received |
    | Code_Description | Cancellation/termination awaiting processing |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 2: Active Carrier Enrollment Mismatch |
    | PSHB_Code | AC501 No 834 Enrollment Received |
    | Code_Description | Cancellation/termination awaiting processing |
```

```gherkin
@rule-catalog @order-24
Scenario: CAT-024-I7000 - Rule-catalog coverage for RuleI7 (I7000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "I"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to I. |
    | Satisfy specific I-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "I7000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE501 834 cancellation awaiting processing |
    | Code_Description | Carrier to process cancellation |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 4: Cancelled Enrollment Mismatch |
    | PSHB_Code | CE501 834 cancellation awaiting processing |
    | Code_Description | Carrier to process cancellation |
```

### Rule Family N

```gherkin
@rule-catalog @order-25
Scenario: CAT-025-N0000 - Rule-catalog coverage for RuleN0 (N0000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N0000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | KICKO |
    | Code_Description | MRN not found on an N record |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | KICKO |
    | Code_Description | MRN not found on an N record |
```

```gherkin
@rule-catalog @order-26
Scenario: CAT-026-N1000 - Rule-catalog coverage for RuleN1 (N1000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N1000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM501 Annuitant Number pending update |
    | Code_Description | Carrier to update member field |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM501 Annuitant Number pending update |
    | Code_Description | Carrier to update member field |
```

```gherkin
@rule-catalog @order-27
Scenario: CAT-027-N2000 - Rule-catalog coverage for RuleN2 (N2000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N2000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM508 Payroll Office Number pending update |
    | Code_Description | Carrier to update member field |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM508 Payroll Office Number pending update |
    | Code_Description | Carrier to update member field |
```

```gherkin
@rule-catalog @order-28
Scenario: CAT-028-N3000 - Rule-catalog coverage for RuleN3 (N3000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N3000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM509 Relationship Code pending update |
    | Code_Description | Carrier to update member field |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM509 Relationship Code pending update |
    | Code_Description | Carrier to update member field |
```

```gherkin
@rule-catalog @order-29
Scenario: CAT-029-N4000 - Rule-catalog coverage for RuleN4 (N4000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N4000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM502 Member Last Name pending update |
    | Code_Description | OPM to update member field |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM502 Member Last Name pending update |
    | Code_Description | OPM to update member field |
```

```gherkin
@rule-catalog @order-30
Scenario: CAT-030-N5000 - Rule-catalog coverage for RuleN5 (N5000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N5000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM503 Member First Name pending update |
    | Code_Description | OPM to update member field |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM503 Member First Name pending update |
    | Code_Description | OPM to update member field |
```

```gherkin
@rule-catalog @order-31
Scenario: CAT-031-N4000_1 - Rule-catalog coverage for RuleN4_1 (N4000-1)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N4000-1"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM001 PSHBS Member Last Name truncated or invalid |
    | Code_Description | OPM to update member field |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM001 PSHBS Member Last Name truncated or invalid |
    | Code_Description | OPM to update member field |
```

```gherkin
@rule-catalog @order-32
Scenario: CAT-032-N5000_1 - Rule-catalog coverage for RuleN5_1 (N5000-1)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N5000-1"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM002 PSHBS Member First Name truncated or invalid |
    | Code_Description | OPM to update member field |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM002 PSHBS Member First Name truncated or invalid |
    | Code_Description | OPM to update member field |
```

```gherkin
@rule-catalog @order-33
Scenario: CAT-033-N5000_2 - Rule-catalog coverage for RuleN5_2 (N5000-2)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N5000-2"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | AE014 |
    | Code_Description | OPM to correct date of death and coverage end |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | AE014 |
    | Code_Description | OPM to correct date of death and coverage end |
```

```gherkin
@rule-catalog @order-34
Scenario: CAT-034-N6000 - Rule-catalog coverage for RuleN6 (N6000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N6000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM003 Carrier has more accurate Member SSN |
    | Code_Description | OPM to update member SSN |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM003 Carrier has more accurate Member SSN |
    | Code_Description | OPM to update member SSN |
```

```gherkin
@rule-catalog @order-35
Scenario: CAT-035-N7000 - Rule-catalog coverage for RuleN7 (N7000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N7000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM004 Carrier has more accurate Subscriber SSN |
    | Code_Description | OPM to update subscriber SSN |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM004 Carrier has more accurate Subscriber SSN |
    | Code_Description | OPM to update subscriber SSN |
```

```gherkin
@rule-catalog @order-36
Scenario: CAT-036-N8000 - Rule-catalog coverage for RuleN8 (N8000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N8000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM505 Member SSN pending update |
    | Code_Description | Carrier to update member SSN |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM505 Member SSN pending update |
    | Code_Description | Carrier to update member SSN |
```

```gherkin
@rule-catalog @order-37
Scenario: CAT-037-N9000 - Rule-catalog coverage for RuleN9 (N9000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N9000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM506 Subscriber SSN pending update |
    | Code_Description | Carrier to update subscriber SSN |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM506 Subscriber SSN pending update |
    | Code_Description | Carrier to update subscriber SSN |
```

```gherkin
@rule-catalog @order-38
Scenario: CAT-038-N91000 - Rule-catalog coverage for RuleN91 (N91000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N91000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM512 |
    | Code_Description | No action required |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM512 |
    | Code_Description | No action required |
```

```gherkin
@rule-catalog @order-39
Scenario: CAT-039-N92000 - Rule-catalog coverage for RuleN92 (N92000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N92000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM507 Mailing Address pending update |
    | Code_Description | Carrier to update mailing address |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM507 Mailing Address pending update |
    | Code_Description | Carrier to update mailing address |
```

```gherkin
@rule-catalog @order-40
Scenario: CAT-040-N10000 - Rule-catalog coverage for RuleN10 (N10000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N10000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM006 Carrier has more accurate Gender Code |
    | Code_Description | OPM to update gender |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM006 Carrier has more accurate Gender Code |
    | Code_Description | OPM to update gender |
```

```gherkin
@rule-catalog @order-41
Scenario: CAT-041-N11000 - Rule-catalog coverage for RuleN11 (N11000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N11000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM510 Gender Code pending update |
    | Code_Description | Carrier to update gender |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM510 Gender Code pending update |
    | Code_Description | Carrier to update gender |
```

```gherkin
@rule-catalog @order-42
Scenario: CAT-042-N12000 - Rule-catalog coverage for RuleN12 (N12000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N12000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE999 |
    | Code_Description | Manual business review |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE999 |
    | Code_Description | Manual business review |
```

```gherkin
@rule-catalog @order-43
Scenario: CAT-043-N13000 - Rule-catalog coverage for RuleN13 (N13000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N13000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE501 834 Enrollment Awaiting Processing |
    | Code_Description | Carrier to process enrollment transaction |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE501 834 Enrollment Awaiting Processing |
    | Code_Description | Carrier to process enrollment transaction |
```

```gherkin
@rule-catalog @order-44
Scenario: CAT-044-N14000 - Rule-catalog coverage for RuleN14 (N14000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N14000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE504 |
    | Code_Description | No action required |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | AE504 |
    | Code_Description | No action required |
```

```gherkin
@rule-catalog @order-45
Scenario: CAT-045-N15000 - Rule-catalog coverage for RuleN15 (N15000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N15000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM007 Carrier has more accurate Date of Birth |
    | Code_Description | OPM to update birth date |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM007 Carrier has more accurate Date of Birth |
    | Code_Description | OPM to update birth date |
```

```gherkin
@rule-catalog @order-46
Scenario: CAT-046-N16000 - Rule-catalog coverage for RuleN16 (N16000)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Set RCNO column 4 result to N. |
    | Satisfy specific N-family predicate for this rule while failing prior rules. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "N16000"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM504 Member Date of Birth pending update |
    | Code_Description | Carrier to update birth date |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 3: Active Demographic Mismatches |
    | PSHB_Code | DM504 Member Date of Birth pending update |
    | Code_Description | Carrier to update birth date |
```

### Rule Family Other

```gherkin
@rule-catalog @order-51
Scenario: CAT-051-No_rule99999 - Rule-catalog coverage for DefaultRule (No_rule99999)
  Given one canonical RCNO record is prepared from template "baselineRcnoTemplate"
  And the RCNO overrides are applied as follows:
    """json
{
  "RCNO_Subscriber_ID_Result": "N"
}
    """
  And 0 MDW enrollment candidate record(s) are supplied
  And 0 EPDS recent-834 candidate record(s) are supplied
  And 0 prior RCNA candidate record(s) are supplied
  And the rule-targeting predicate hints are:
    | Ensure no catalog or catch-all rule conditions match. |
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And selected rule ID is "No_rule99999"
  And the working RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | 0000 |
    | Code_Description | No Rules Applied |
    | Notes |  |
    | Aging_Months | 0 |
  And the outbound RCNA derived fields are:
    | Field | Value |
    | Priority | 1: Active Enrollment mismatch |
    | PSHB_Code | 0000 |
    | Code_Description | No Rules Applied |
```

## Feature: RCNO to RCNA validation and determinism safeguards

```gherkin
@contract-validation
Scenario: VAL-001-PrimaryFieldCount72 - Reject invocation with 72-field RCNO row
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation fails as a blocking validation error
  And error code is "INVALID_RCNO_FIELD_COUNT"
  And error message is "Primary RCNO field count must be exactly 73."
```

```gherkin
@contract-validation
Scenario: VAL-002-MalformedLookupRow - Reject malformed MDW lookup candidate
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation fails as a blocking validation error
  And error code is "INVALID_LOOKUP_FIELD_COUNT"
  And error message is "Lookup candidate violates canonical contract."
```

```gherkin
@determinism-validation
Scenario: VAL-003-ConflictingDuplicateMembership - Reject conflicting duplicate membership candidates
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation fails as a blocking validation error
  And error code is "AMBIGUOUS_LOOKUP_DUPLICATE"
  And error message is "Conflicting duplicate membership candidates found."
```

```gherkin
@determinism-validation
Scenario: VAL-004-ConflictingDuplicateRecent834 - Reject conflicting duplicate recent enrollment candidates
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation fails as a blocking validation error
  And error code is "AMBIGUOUS_LOOKUP_DUPLICATE"
  And error message is "Conflicting duplicate recent enrollment candidates found."
```

```gherkin
@engine-validation
Scenario: VAL-005-NoRuleSelectedImpossible - Engine must always resolve one rule or explicit error
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation fails as a blocking validation error
  And error code is "RULE_SELECTION_FAILED"
  And error message is "No rule selected and no default applied."
```

```gherkin
@immutability-validation
Scenario: VAL-006-InputMutationGuard - Input arrays must remain unchanged after execution
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
  And invariant "no-input-mutation" is satisfied
```

```gherkin
@business-validation
Scenario: VAL-007-N12ApprovedDefault - N12 uses the approved default code
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
```

```gherkin
@business-validation
Scenario: VAL-008-I4I5CoverageDiscriminator - I4/I5 use active membership coverage as the discriminator
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
```

```gherkin
@business-validation
Scenario: VAL-009-I6I7CoverageDiscriminator - I6/I7 use active membership coverage as the discriminator
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation succeeds
```

```gherkin
@business-validation
Scenario: VAL-010-AddressStandardizerRequiredForN91N92 - N91/N92 requires configured deterministic address standardizer
  Given one RCNO-to-RCNA invocation context is prepared
  And the validation precondition for this scenario is intentionally triggered
  When the RCNO-to-RCNA transformRow service is executed
  Then the invocation fails as a blocking validation error
  And error code is "ADDRESS_STANDARDIZER_REQUIRED"
  And error message is "Address standardizer configuration is required for N91/N92."
```

---
Generated by docs/rcnoa/render-rcno-complete-testcases-to-bdd-md.mjs
