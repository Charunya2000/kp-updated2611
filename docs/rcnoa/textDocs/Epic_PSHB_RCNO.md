# EPIC

## Overview

Develop an automated reconciliation engine that processes PSHB RCNO records, compares them against Kaiser Membership records, 834 enrollment transactions from the last 30 days, and prior RCNA results, then applies a deterministic rules engine to identify, categorize, prioritize, and route enrollment, cancellation, carrier, and demographic discrepancies.

The solution will generate a standardized RCNA output file for operational and business resolution activities.

**Business Requirement:** One RCNA record per RCNO record. Correct rules, priority, code, number of months, and description assigned.

### Problem Statement

Current reconciliation activities require manual analysis of:

- Enrollment records
- Coverage dates
- Demographic information
- Membership records
- 834 transactions
- Cancellation transactions

Manual review results in:

- Delayed issue detection
- Inconsistent resolution
- High operational effort
- Increased reconciliation backlog

## Scope

### In Scope

- `RCNO_CURRENT_ALL` ingestion
- Membership data
- 834 file — last 30 days of records
- `RCNA_PRIOR` — last month’s RCNA file

**Draft RCNA** = RCNO + priority + code + action + number of months + notes

The user will work on this file.

**RCNA Output** = RCNO + priority + code + action

The RCNA output is sent to OPM.

### Matching Logic

- Membership matching
- 834 transaction matching
- Prior RCNA matching

### Rule Processing

The solution will apply deterministic rule processing to compare RCNO records against membership, recent 834 transactions, and prior RCNA records.

### Out of Scope

- Membership system updates
- OPM system updates

## Requirements Context

Driver file: `RCNO_CURRENT_ALL`

Lookup sources:

- Membership
- 834 transactions
- Prior RCNA

Processing approach:

- Deterministic rule execution

## Assumptions, Dependencies & Risks

### Assumptions

- Source files are available.
- The process depends on Membership and 834 data.
- Invalid or missing data may affect reconciliation quality.

### Dependencies

- Monthly RCNO file
- Membership data
- 834 files

### Risks

- Risk of invalid or missing data.

## Acceptance Criteria

- One RCNA record is created per RCNO record.
- Correct rule priority, code, description, and number of months are assigned.

## Testing Requirements

Testing will include:

- Unit testing
- Integration testing
- UAT
- Negative testing for all reconciliation rules

## Attachments & References

N/A

## Optional Governance Fields

N/A

## Appendix 1

_Image included in source document._

## Appendix 2

_Image included in source document._

## Appendix 3 — Written Description

Appendix 3 is blank in the source document; however, based on the surrounding content, it appears intended to support the RCNO-to-RCNA reconciliation workflow.

The process centers on automating reconciliation between OPM records and Kaiser Permanente membership records. The reconciliation begins with OPM enrollment activity and continues through KP membership enrollment, monthly reporting, OPM validation, RCNO file generation, automated reconciliation, and RCNA file output.

The intended diagram likely represents how RCNO records are ingested, compared against internal and external data sources, categorized by reconciliation outcome, enriched with rule-driven attributes, and converted into an RCNA file for transmission back to OPM.

The key flow is:

1. OPM provides enrollment information to KP.
2. KP enrolls members in the KP membership system.
3. KP reports member information back to OPM through the monthly MENR report.
4. OPM validates KP-reported membership data against OPM records.
5. OPM returns an RCNO file identifying reconciliation results and discrepancies.
6. KP processes RCNO records against membership data and recent 834 transactions.
7. The process assigns reconciliation priority, code, action, number of months, and description.
8. The resulting RCNA file is produced and transmitted to OPM.

This appendix should therefore be used to describe the reconciliation automation concept and how source records are transformed into actionable RCNA output.

## Appendix 4 — RCNO / RCNA Process Flow Diagram Description

Appendix 4 references the Lucidchart diagram titled `RCNO_FLOW_20260428`.

The diagram describes the end-to-end reconciliation process between OPM and Kaiser Permanente for PSHB enrollment and membership reconciliation. It shows the flow of data from initial enrollment through monthly reporting, OPM validation, RCNO file creation, KP reconciliation processing, and final RCNA file transmission.

The process starts when KP receives an 834 enrollment file from OPM. KP uses the 834 file to enroll the member in KP’s membership system, referred to as FS. After enrollment, KP produces a monthly MENR report containing member information and sends that report to OPM. OPM validates the MENR report against its own database to determine whether members and member data align between the two organizations.

After validation, OPM sends an RCNO file back to KP. The RCNO file identifies reconciliation scenarios such as:

- KP does not have a member that OPM expects KP to have.
- OPM does not have a member that KP has in its membership system.
- The member exists on both sides and matches.
- The member exists on both sides, but the data does not match.

The diagram then introduces a new automated reconciliation process. In the current state, this reconciliation is manual. The new process has AAR read each record from the RCNO file and validate it against FS using FS screen data. In addition, the new process validates the RCNO record against the last 30 days of 834 transactions to determine whether recent enrollment activity explains or resolves the discrepancy.

Based on the validation results, the process appends the RCNO record with reconciliation attributes, including priority, code, and description. This enriched RCNO record becomes part of the RCNA file.

Finally, the completed RCNA file is transmitted back to OPM. This closes the reconciliation loop by providing OPM with KP’s response, categorization, and action details for each RCNO record.

### Appendix 4 Source Link

RCNO_FLOW_20260428: Lucidchart

### Appendix 4 Process Steps

1. KP receives the 834 file from OPM.
2. KP enrolls the member in KP FS.
3. KP sends a monthly MENR report for all members to OPM.
4. OPM validates the members against its database.
5. KP receives the RCNO file from OPM.

The RCNO file may identify the following scenarios:

- KP does not have the member.
- OPM does not have the member, but KP does.
- The member is present on both sides and matches.
- The member is present on both sides, but the data does not match.

6. New process: currently this is manual.

   AAR reads records from the RCNO file and validates them in FS using FS screens.

   In addition, the new process validates against the last 30 days of 834 records.

