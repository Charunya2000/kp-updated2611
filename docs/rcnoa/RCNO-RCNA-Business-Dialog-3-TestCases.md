# RCNO/RCNA Business-Level Dialog for the Complete BDD Catalog

This narrative translates every scenario currently specified in `RCNO-RCNA-Complete-TestCases-BDD.md` into a business-facing conversation and traces the outcome to `RCNO-RCNA-834-Detailed-Design.md`. The BDD contains 47 catalog scenarios and 10 validation scenarios. Although its coverage header reports 61 total cases, CAT-047 through CAT-050 are not present; the related design-only catch-all rules are therefore identified as coverage gaps rather than represented as executed tests.

---

## 1) Positive Test: CAT-001-A100 (Perfect Match, No Action)

**Business rule basis (Design):**
- Section 10.1, Rule **A100**: if RCNO column 4 is `M`, assign **Priority 5**, **Code MM**, description **"Matches (no action required)"**, aging `0`.
- Section 19.1 (OQ-14): `Z` is not treated as perfect match; `M` is required.

**Business dialog:**

> **Business Owner:** "If OPM says the subscriber matches, we should not trigger operational work."  
> **Operations Lead:** "Agreed. For a true match (`M`), we classify it as 'no action required' so teams are not distracted."  
> **QA Analyst:** "In CAT-001-A100, we force RCNO result to `M` and run reconciliation with no lookup dependencies."  
> **Operations Lead:** "And the system returns Rule A100 with code `MM`, priority `5`, and aging `0`?"  
> **QA Analyst:** "Yes. Both working RCNA and outbound RCNA carry 'Matches (no action required)' exactly."

**Result evidence from BDD:**
- Selected rule: `A100`
- Working RCNA: `Priority=5`, `PSHB_Code=MM`, `Code_Description=Matches (no action required)`, `Aging_Months=0`
- Outbound RCNA: same derived values

**Business conclusion:**  
This outcome satisfies the business rule that true subscriber matches are informational and require no correction workflow.

---

## 2) Positive Test: CAT-002-B200 (Carry Forward Prior Decision + Aging Increment)

**Business rule basis (Design):**
- Section 10.1, Rule **B200**: when current RCNO columns 1-73 exactly match a prior RCNA row, carry forward prior priority/code/description and increment aging.
- Section 19.1 (OQ-20): if prior aging is valid numeric, increment; if missing/invalid, initialize to `1`.

**Business dialog:**

> **Business Owner:** "When the same discrepancy repeats month over month, we need continuity, not re-triage."  
> **Operations Lead:** "Right. Repeated cases should keep prior classification and simply age forward for follow-up tracking."  
> **QA Analyst:** "In CAT-002-B200, we make Rule A fail, provide an exact prior RCNA match, and execute transform."  
> **Business Owner:** "Did it preserve the prior operational decision?"  
> **QA Analyst:** "Yes. It selected Rule B200, kept the prior decision values, and increased aging to `3`."

**Result evidence from BDD:**
- Selected rule: `B200`
- Working RCNA: `Priority=4`, `PSHB_Code=CE001`, `Code_Description=OPM to send 834 cancellation`, `Aging_Months=3`
- Outbound RCNA: `Priority=4`, `PSHB_Code=CE001`, `Code_Description=OPM to send 834 cancellation`

**Business conclusion:**  
This confirms the business intent of preserving prior operational disposition for identical recurring records while tracking issue persistence through aging.

---

## 3) Negative Test: VAL-001-PrimaryFieldCount72 (Reject Invalid RCNO Contract)

**Business rule basis (Design):**
- Section 11.1: primary RCNO input must contain exactly **73 canonical fields**.
- Section 11.1: on validation failure, service returns **no partial or success-shaped record**.

**Business dialog:**

> **Compliance Lead:** "If the inbound RCNO structure is wrong, we cannot trust downstream reconciliation."  
> **Business Owner:** "So we must fail fast and visibly, not produce a questionable RCNA row."  
> **QA Analyst:** "VAL-001 intentionally submits a 72-field RCNO record."  
> **Compliance Lead:** "What does the service return?"  
> **QA Analyst:** "A blocking validation failure with code `INVALID_RCNO_FIELD_COUNT` and message 'Primary RCNO field count must be exactly 73.' No success record is emitted."

**Result evidence from BDD:**
- Invocation outcome: blocking validation error
- Error code: `INVALID_RCNO_FIELD_COUNT`
- Error message: `Primary RCNO field count must be exactly 73.`

**Business conclusion:**  
The failure behavior enforces data contract integrity and prevents invalid source data from entering operational reconciliation or outbound artifacts.

---

## Remaining Rule-Catalog Dialogs

### Rule Family F: Failed Enrollment Reconciliation

The F-family basis is Detailed Design Section 10.2. These rules distinguish ended and active coverage, membership evidence, recent 834 evidence, deceased and age-out conditions, and date exceptions. Section 8.2 defines deterministic lookup matching; the first matching rule wins under Section 9.1.

#### CAT-003-F1300: Ended Coverage Already Aligned

**Business dialog:**

> **Business Owner:** "If ended PSHBS coverage already agrees with membership, should anyone work it?"  
> **Operations Lead:** "No. F1 treats matching start and end dates, name, and subscriber SSN as reconciled."  
> **QA Analyst:** "CAT-003 selects F1300 and confirms the no-action carrier-match disposition."

**BDD evidence:** `Priority=1`, `PSHB_Code=CE502`, `Code_Description=Carrier data matches RCNO; no action`, `Aging_Months=0` in working RCNA, with the same disposition outbound.

**Design trace:** Section 10.2, Rule F1; OQ-17.

---

#### CAT-004-F2400: Ended Coverage Requires OPM Cancellation

**Business dialog:**

> **Business Owner:** "What if coverage ended but the membership dates do not align and no recent 834 explains it?"  
> **Operations Lead:** "OPM must send the cancellation transaction needed to reconcile the carrier."  
> **QA Analyst:** "CAT-004 confirms F2400 routes that work to OPM."

**BDD evidence:** `Priority=4`, `PSHB_Code=CE001`, `Code_Description=OPM to send 834 cancellation`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F2; Section 8.2 recent-834 matching.

---

#### CAT-005-F3500: Processed 834 Requires Carrier Reprocessing

**Business dialog:**

> **Business Owner:** "If an 834 was already sent for ended coverage but the carrier result is still wrong, who owns the correction?"  
> **Operations Lead:** "The carrier must investigate and reprocess the transaction."  
> **QA Analyst:** "CAT-005 confirms F3500 assigns that carrier action."

**BDD evidence:** `Priority=4`, `PSHB_Code=CE500`, `Code_Description=Carrier to investigate and reprocess the 834`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F3; Section 8.2.1 for EPDS processed-status configuration.

---

#### CAT-006-F4600: Deceased Subscriber Coverage Correction

**Business dialog:**

> **Business Owner:** "How do we handle active carrier coverage when the subscriber is recorded as deceased?"  
> **Operations Lead:** "OPM must align the record to ended coverage."  
> **QA Analyst:** "CAT-006 confirms F4600 produces the ended-coverage action."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE002`, `Code_Description=OPM to match ended coverage`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F4.

---

#### CAT-007-F5700: Deceased Member Carrier Alignment

**Business dialog:**

> **Business Owner:** "What if the deceased indicator belongs to the covered member rather than the subscriber?"  
> **Operations Lead:** "OPM must align its enrollment record to the carrier record under the member-specific rule."  
> **QA Analyst:** "CAT-007 confirms F5700 selects that disposition."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE003`, `Code_Description=OPM to match carrier record`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F5.

---

#### CAT-008-F6800: Dependent Age-Out Investigation

**Business dialog:**

> **Business Owner:** "How should active coverage be treated for a non-spouse dependent over age 26 who is not disabled?"  
> **Operations Lead:** "OPM must investigate whether an 834 is missing and apply the age-out handling."  
> **QA Analyst:** "CAT-008 confirms F6800 identifies this age-out case."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE004`, `Code_Description=OPM to investigate missing 834 / age-out handling`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F6.

---

#### CAT-009-F7000: Invalid Spouse Age-Out Scenario

**Business dialog:**

> **Business Owner:** "A spouse should not be classified through the dependent age-out rule. What happens if that combination appears?"  
> **Operations Lead:** "The design identifies it as invalid, but its `Z0000` production disposition remains unresolved."  
> **QA Analyst:** "CAT-009 verifies the current F7000 result; it does not constitute approval to emit `Z0000` in production."

**BDD evidence:** `Priority=1`, `PSHB_Code=Z0000`, `Code_Description=Invalid scenario`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F7. Detailed Design Section 2.2 flags `Z0000` as malformed/unresolved; production emission must remain blocked pending business approval.

---

#### CAT-010-F8000: Approved Coverage-End Extension

**Business dialog:**

> **Business Owner:** "Should a known 31-day or year-end extension create correction work?"  
> **Operations Lead:** "No. When starts match and the end-date difference is an approved extension, carrier data is accepted."  
> **QA Analyst:** "CAT-010 confirms F8000 returns no action."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE502`, `Code_Description=Carrier data matches RCNO; no action`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F8.

---

#### CAT-011-F9000: Approved Age-26 End Date

**Business dialog:**

> **Business Owner:** "What if the carrier end date reflects the member's age-26 extension?"  
> **Operations Lead:** "That expected date difference requires no action."  
> **QA Analyst:** "CAT-011 confirms F9000 suppresses unnecessary work."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE504`, `Code_Description=No action required`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F9.

---

#### CAT-012-F10000: Unexplained Coverage-End Difference

**Business dialog:**

> **Business Owner:** "Who corrects an active member's end date when neither approved extension applies?"  
> **Operations Lead:** "OPM owns the coverage-end correction."  
> **QA Analyst:** "CAT-012 confirms F10000 is selected only after F8 and F9 fail."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE010`, `Code_Description=OPM to correct coverage end date`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F10; Section 9.1 first-match ordering.

---

#### CAT-013-F11000: Pending Enrollment Needs OPM Start-Date Review

**Business dialog:**

> **Business Owner:** "What if coverage differs and the matching enrollment transaction is still unprocessed?"  
> **Operations Lead:** "OPM must correct the start date or resolve the pending enrollment."  
> **QA Analyst:** "CAT-013 confirms F11000 represents that pending state."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE001`, `Code_Description=OPM to correct coverage start date / pending enrollment`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F11; Section 8.2.1 for processed-status configuration.

---

#### CAT-014-F12000: Membership Coverage Fully Matches

**Business dialog:**

> **Business Owner:** "When both membership coverage dates match PSHBS, can the failed result be closed without work?"  
> **Operations Lead:** "Yes. The supporting membership evidence makes it a carrier-data match."  
> **QA Analyst:** "CAT-014 confirms F12000 returns no action."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE502`, `Code_Description=Carrier data matches RCNO; no action`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F12.

---

#### CAT-015-F13000: Processed Enrollment Missing from Membership

**Business dialog:**

> **Business Owner:** "If EPDS says the enrollment was processed but membership is still absent, where should the case go?"  
> **Operations Lead:** "The carrier must investigate and reprocess the 834."  
> **QA Analyst:** "CAT-015 confirms F13000 uses the processed transaction branch."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE500`, `Code_Description=Carrier to investigate and reprocess the 834`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F13; Section 8.2.1. The exact EPDS status field/value mapping must be configured before production.

---

#### CAT-016-F14000: Unprocessed Enrollment Missing from Membership

**Business dialog:**

> **Business Owner:** "What if membership is absent because the matching enrollment has not been processed?"  
> **Operations Lead:** "The carrier must process the enrollment transaction."  
> **QA Analyst:** "CAT-016 confirms F14000 uses the unprocessed branch."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE501`, `Code_Description=Carrier to process the 834 enrollment`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F14; Section 8.2.1. The exact EPDS status field/value mapping must be configured before production.

---

#### CAT-017-F20000: Missing Membership and Missing 834

**Business dialog:**

> **Business Owner:** "What if neither membership nor a recent 834 explains active coverage?"  
> **Operations Lead:** "OPM must investigate why the enrollment transaction was never sent."  
> **QA Analyst:** "CAT-017 confirms F20000 is the final specific F-family disposition after deceased and age-out exceptions fail."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE013`, `Code_Description=OPM to investigate why an 834 was not sent`, `Aging_Months=0`.

**Design trace:** Section 10.2, Rule F20; Section 9.1 ordered evaluation.

---

### Rule Family I: Inconsistent Carrier Enrollment

The I-family basis is Detailed Design Section 10.3. Rules I4 through I7 use the OQ-02 definition of active membership: coverage starts on or before the business date and has a blank end date or an end date on or after the business date. Processed 834s select I4/I5; unprocessed 834s select I6/I7.

#### CAT-018-I1000: Ended Membership Against Year-End Enrollment

**Business dialog:**

> **Business Owner:** "What if membership has already ended while MENR still carries coverage through year-end?"  
> **Operations Lead:** "OPM must align the enrollment to ended coverage."  
> **QA Analyst:** "CAT-018 confirms I1000 assigns that correction."

**BDD evidence:** `Priority=2`, `PSHB_Code=AC002`, `Code_Description=OPM to match ended coverage`, `Aging_Months=0`.

**Design trace:** Section 10.3, Rule I1.

---

#### CAT-019-I2000: Active MENR Coverage Without Termination 834

**Business dialog:**

> **Business Owner:** "If MENR coverage remains active and no matching termination or cancellation 834 exists, what should happen?"  
> **Operations Lead:** "OPM must investigate why the transaction was not received."  
> **QA Analyst:** "CAT-019 confirms I2000 identifies that missing-transaction condition."

**BDD evidence:** `Priority=2`, `PSHB_Code=AC004`, `Code_Description=No 834 termination/cancel received; OPM to investigate`, `Aging_Months=0`.

**Design trace:** Section 10.3, Rule I2; Section 8.2 recent-834 matching.

---

#### CAT-020-I3000: Cancellation Must Be Sent

**Business dialog:**

> **Business Owner:** "Who acts when membership exists but no cancellation transaction matches the MENR dates?"  
> **Operations Lead:** "OPM must send the 834 cancellation."  
> **QA Analyst:** "CAT-020 confirms I3000 routes the case accordingly."

**BDD evidence:** `Priority=4`, `PSHB_Code=CE001`, `Code_Description=OPM to send 834 cancellation`, `Aging_Months=0`.

**Design trace:** Section 10.3, Rule I3.

---

#### CAT-021-I4000: Processed 834 with Active Membership

**Business dialog:**

> **Business Owner:** "If the 834 is marked processed but membership is still active on the business date, who owns the discrepancy?"  
> **Operations Lead:** "The carrier must investigate and reprocess the processed enrollment."  
> **QA Analyst:** "CAT-021 confirms I4000 is the active-coverage, processed-status branch."

**BDD evidence:** `Priority=2`, `PSHB_Code=AC500`, `Code_Description=Carrier to investigate and reprocess processed enrollment`, `Aging_Months=0`.

**Design trace:** Section 10.3, Rule I4; OQ-02.

---

#### CAT-022-I5000: Processed 834 with Inactive Membership

**Business dialog:**

> **Business Owner:** "Does the disposition change when that membership is not active on the business date?"  
> **Operations Lead:** "Yes. It moves to the cancelled-enrollment carrier reprocessing path."  
> **QA Analyst:** "CAT-022 confirms I5000 is selected for inactive coverage with processed status."

**BDD evidence:** `Priority=4`, `PSHB_Code=CE500`, `Code_Description=Carrier investigation/reprocessing required`, `Aging_Months=0`.

**Design trace:** Section 10.3, Rule I5; OQ-02.

---

#### CAT-023-I6000: Unprocessed 834 with Active Membership

**Business dialog:**

> **Business Owner:** "What if membership is active but the cancellation or termination is still unprocessed?"  
> **Operations Lead:** "The case should indicate that carrier processing is pending."  
> **QA Analyst:** "CAT-023 confirms I6000 represents the active-coverage, unprocessed-status branch."

**BDD evidence:** `Priority=2`, `PSHB_Code=AC501`, `Code_Description=Cancellation/termination awaiting processing`, `Aging_Months=0`.

**Design trace:** Section 10.3, Rule I6; OQ-02.

---

#### CAT-024-I7000: Unprocessed 834 with Inactive Membership

**Business dialog:**

> **Business Owner:** "And when membership is inactive and the cancellation remains unprocessed?"  
> **Operations Lead:** "The carrier must process the cancellation."  
> **QA Analyst:** "CAT-024 confirms I7000 is the inactive-coverage, unprocessed-status branch."

**BDD evidence:** `Priority=4`, `PSHB_Code=CE501`, `Code_Description=Carrier to process cancellation`, `Aging_Months=0`.

**Design trace:** Section 10.3, Rule I7; OQ-02.

---

### Rule Family N: Demographic and Enrollment Differences

The N-family basis is Detailed Design Section 10.4. These rules assign correction ownership according to which source is authoritative and are evaluated in order under Section 9.1.

#### Identity and Name Outcomes

##### CAT-025-N0000: MRN Not Found

**Business dialog:**

> **Business Owner:** "Can demographic reconciliation continue if the MRN has no membership row?"  
> **Operations Lead:** "No. The missing identity link is a kickoff exception requiring investigation."  
> **QA Analyst:** "CAT-025 confirms N0000 identifies that condition."

**BDD evidence:** `Priority=1`, `PSHB_Code=KICKO`, `Code_Description=MRN not found on an N record`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N0.

---

##### CAT-026-N1000: Carrier Annuitant Correction

**Business dialog:**

> **Business Owner:** "Who updates an annuitant value that is blank or different in membership when PSHBS has it?"  
> **Operations Lead:** "The carrier owns that member-field correction."  
> **QA Analyst:** "CAT-026 confirms N1000 assigns carrier action."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM501`, `Code_Description=Carrier to update member field`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N1.

---

##### CAT-027-N2000: Carrier Payroll Office Correction

**Business dialog:**

> **Business Owner:** "What if the payroll office is missing or different in membership?"  
> **Operations Lead:** "When PSHBS supplies the value, the carrier updates its member field."  
> **QA Analyst:** "CAT-027 confirms N2000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM508`, `Code_Description=Carrier to update member field`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N2.

---

##### CAT-028-N3000: Carrier Relationship Correction

**Business dialog:**

> **Business Owner:** "Who corrects a blank or mismatched relationship value in membership?"  
> **Operations Lead:** "The carrier does when PSHBS contains the authoritative relationship."  
> **QA Analyst:** "CAT-028 confirms N3000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM509`, `Code_Description=Carrier to update member field`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N3.

---

##### CAT-029-N4000: OPM Last-Name Update for Approved Partial Match

**Business dialog:**

> **Business Owner:** "How are last-name differences handled when the carrier value begins with the PSHBS value or an approved newborn/exception condition applies?"  
> **Operations Lead:** "That evidence points to an OPM member-field update rather than a carrier correction."  
> **QA Analyst:** "CAT-029 confirms N4000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM502`, `Code_Description=OPM to update member field`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N4.

---

##### CAT-030-N5000: OPM First-Name Update for Approved Partial Match

**Business dialog:**

> **Business Owner:** "Does the same ownership apply to an approved partial or exception first-name match?"  
> **Operations Lead:** "Yes. OPM updates the member field."  
> **QA Analyst:** "CAT-030 confirms N5000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM503`, `Code_Description=OPM to update member field`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N5.

---

##### CAT-031-N4000_1: OPM Last-Name Update Without Exception

**Business dialog:**

> **Business Owner:** "What if the last names differ and the partial-match exceptions do not apply?"  
> **Operations Lead:** "The ordered fallback still directs OPM to update the member field, with the distinct N4-1 code."  
> **QA Analyst:** "CAT-031 confirms N4000-1."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM001`, `Code_Description=OPM to update member field`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N4-1.

---

##### CAT-032-N5000_1: OPM First-Name Update Without Exception

**Business dialog:**

> **Business Owner:** "And if the first-name difference has no approved partial-match exception?"  
> **Operations Lead:** "OPM receives the distinct N5-1 correction code."  
> **QA Analyst:** "CAT-032 confirms N5000-1."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM002`, `Code_Description=OPM to update member field`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N5-1.

---

##### CAT-033-N5000_2: Date-of-Death and Coverage-End Correction

**Business dialog:**

> **Business Owner:** "What action follows when membership contains a deceased date?"  
> **Operations Lead:** "OPM must correct the date of death and corresponding coverage end."  
> **QA Analyst:** "CAT-033 confirms N5000-2."

**BDD evidence:** `Priority=3`, `PSHB_Code=AE014`, `Code_Description=OPM to correct date of death and coverage end`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N5-2.

---

#### SSN and Address Outcomes

##### CAT-034-N6000: OPM Member SSN Correction

**Business dialog:**

> **Business Owner:** "Who acts when a non-subscriber member SSN differs and the PSHBS SSN is invalid?"  
> **Operations Lead:** "OPM corrects its member SSN using the valid membership value."  
> **QA Analyst:** "CAT-034 confirms N6000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM003`, `Code_Description=OPM to update member SSN`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N6. A valid SSN is exactly nine digits and is not `999999999` or `000000000`.

---

##### CAT-035-N7000: OPM Subscriber SSN Correction

**Business dialog:**

> **Business Owner:** "Does the same validity test apply to a subscriber SSN difference?"  
> **Operations Lead:** "Yes. If PSHBS is invalid and membership is populated, OPM updates the subscriber SSN."  
> **QA Analyst:** "CAT-035 confirms N7000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM004`, `Code_Description=OPM to update subscriber SSN`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N7.

---

##### CAT-036-N8000: Carrier Member SSN Correction

**Business dialog:**

> **Business Owner:** "Who acts when the differing PSHBS member SSN is valid?"  
> **Operations Lead:** "The carrier updates the member SSN."  
> **QA Analyst:** "CAT-036 confirms N8000 reverses ownership based on validity."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM505`, `Code_Description=Carrier to update member SSN`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N8.

---

##### CAT-037-N9000: Carrier Subscriber SSN Correction

**Business dialog:**

> **Business Owner:** "And for a valid PSHBS subscriber SSN?"  
> **Operations Lead:** "The carrier updates its subscriber SSN."  
> **QA Analyst:** "CAT-037 confirms N9000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM506`, `Code_Description=Carrier to update subscriber SSN`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N9.

---

##### CAT-038-N91000: Address Difference Normalizes to a Match

**Business dialog:**

> **Business Owner:** "Should formatting-only address differences create carrier work?"  
> **Operations Lead:** "No. If the approved standardizer makes the addresses equal, no action is required."  
> **QA Analyst:** "CAT-038 confirms N91000, provided the configured deterministic standardizer is available."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM512`, `Code_Description=No action required`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N91. The approved standardization service and version must be configured and auditable as required by the design.

---

##### CAT-039-N92000: Standardized Addresses Still Differ

**Business dialog:**

> **Business Owner:** "What if the standardized addresses remain different?"  
> **Operations Lead:** "The carrier must update the mailing address."  
> **QA Analyst:** "CAT-039 confirms N92000 using the same approved standardizer prerequisite."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM507`, `Code_Description=Carrier to update mailing address`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N92; address-standardization requirement following the N-family catalog.

---

#### Gender, Plan, Coverage, and Birth-Date Outcomes

##### CAT-040-N10000: OPM Gender Correction

**Business dialog:**

> **Business Owner:** "Who corrects gender when membership has a known value but PSHBS is blank or unknown?"  
> **Operations Lead:** "OPM updates its gender value."  
> **QA Analyst:** "CAT-040 confirms N10000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM006`, `Code_Description=OPM to update gender`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N10.

---

##### CAT-041-N11000: Carrier Gender Correction

**Business dialog:**

> **Business Owner:** "What if the differing PSHBS gender is known?"  
> **Operations Lead:** "The carrier updates its gender value."  
> **QA Analyst:** "CAT-041 confirms N11000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM510`, `Code_Description=Carrier to update gender`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N11.

---

##### CAT-042-N12000: Manual Review for Unexplained Plan or Date Mismatch

**Business dialog:**

> **Business Owner:** "What if plan or coverage dates differ, no recent 834 explains the mismatch, and no approved extension applies?"  
> **Operations Lead:** "That ambiguity requires manual business review."  
> **QA Analyst:** "CAT-042 confirms N12000 uses the approved default review code `AE999`."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE999`, `Code_Description=Manual business review`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N12; OQ-01 approves `AE999` as the default.

---

##### CAT-043-N13000: Carrier Must Process Enrollment

**Business dialog:**

> **Business Owner:** "When plan or coverage differs but the N12 manual-review timing condition does not apply, what is the disposition?"  
> **Operations Lead:** "The carrier must process the enrollment transaction."  
> **QA Analyst:** "CAT-043 confirms N13000."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE501`, `Code_Description=Carrier to process enrollment transaction`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N13.

---

##### CAT-044-N14000: Approved Coverage Extension Needs No Action

**Business dialog:**

> **Business Owner:** "Can an otherwise matching record be closed when only an approved 31-day or age-26 extension differs?"  
> **Operations Lead:** "Yes. That expected difference requires no action."  
> **QA Analyst:** "CAT-044 confirms N14000."

**BDD evidence:** `Priority=1`, `PSHB_Code=AE504`, `Code_Description=No action required`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N14.

---

##### CAT-045-N15000: OPM Birth-Date Correction

**Business dialog:**

> **Business Owner:** "Who corrects a birth-date mismatch when the approved OPM condition applies?"  
> **Operations Lead:** "OPM updates the birth date."  
> **QA Analyst:** "CAT-045 confirms N15000 for the exception or PSHBS first-of-month condition."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM007`, `Code_Description=OPM to update birth date`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N15.

---

##### CAT-046-N16000: Carrier Birth-Date Correction

**Business dialog:**

> **Business Owner:** "What if the birth dates differ and the N15 condition does not apply?"  
> **Operations Lead:** "The carrier updates the birth date."  
> **QA Analyst:** "CAT-046 confirms N16000."

**BDD evidence:** `Priority=3`, `PSHB_Code=DM504`, `Code_Description=Carrier to update birth date`, `Aging_Months=0`.

**Design trace:** Section 10.4, Rule N16.

---

### Default Outcome

#### CAT-051-No_rule99999: No Catalog or Catch-All Rule Applies

**Business dialog:**

> **Business Owner:** "Can a row disappear if none of the specific or catch-all conditions applies?"  
> **Operations Lead:** "No. The engine must return an explicit default disposition so the result remains visible and auditable."  
> **QA Analyst:** "CAT-051 confirms `No_rule99999` produces the documented fallback rather than silently dropping the row."

**BDD evidence:** `Priority=1`, `PSHB_Code=0000`, `Code_Description=No Rules Applied`, `Aging_Months=0`.

**Design trace:** Section 10.5, Rule `No_rule99999`; Section 9.1 requires exactly one selected outcome.

---

### Design Rules Missing from the BDD Catalog

Detailed Design Section 10.5 defines four catch-all rules at orders 47 through 50, but the BDD source contains no CAT-047 through CAT-050 scenarios. They are not described here as passing tests because no BDD evidence exists.

| Missing BDD ID | Design rule | Intended business fallback | Priority | Provisional code | Readiness concern |
|---|---|---|---:|---|---|
| CAT-047 | AE-1 | Active enrollment mismatch after earlier rules fail | 1 | `AE*` | Literal wildcard acceptance is unconfirmed |
| CAT-048 | AC-2 | Active carrier-enrollment mismatch after earlier rules fail | 2 | `AC*` | Literal wildcard acceptance is unconfirmed |
| CAT-049 | DM-3 | Active demographic mismatch after earlier rules fail | 3 | `DM*` | Literal wildcard acceptance is unconfirmed |
| CAT-050 | CE-4 | Cancelled enrollment mismatch after earlier rules fail | 4 | `CE*` | Literal wildcard acceptance is unconfirmed |

**Design trace:** Section 10.5; OQ-11. These codes must not be treated as final outbound-interface approval until literal asterisk support is confirmed and executable BDD scenarios are added.

---

## Remaining Validation and Determinism Dialogs

### VAL-002-MalformedLookupRow: Reject Invalid Lookup Contract

**Business dialog:**

> **Business Owner:** "Can reconciliation trust a membership or recent-834 lookup with the wrong structure?"  
> **Operations Lead:** "No. A malformed lookup could drive the wrong business rule and must block the row."  
> **QA Analyst:** "VAL-002 confirms the service rejects it before producing RCNA output."

**BDD evidence:** Blocking error `INVALID_LOOKUP_FIELD_COUNT` with message `Lookup candidate violates canonical contract.`

**Design trace:** Sections 6.1 and 11.1 require canonical lookup inputs and no success-shaped result after contract failure.

---

### VAL-003-ConflictingDuplicateMembership: Reject Ambiguous Membership Evidence

**Business dialog:**

> **Business Owner:** "What if two membership rows for the same lookup key disagree in a way that could change the result?"  
> **Operations Lead:** "The engine cannot choose one arbitrarily. The ambiguity must be surfaced for resolution."  
> **QA Analyst:** "VAL-003 confirms conflicting membership duplicates block reconciliation."

**BDD evidence:** Blocking error `AMBIGUOUS_LOOKUP_DUPLICATE` with message `Conflicting duplicate membership candidates found.`

**Design trace:** Sections 8.3 and 11.1. Identical duplicates may collapse; conflicting duplicates must fail deterministic selection.

---

### VAL-004-ConflictingDuplicateRecent834: Reject Ambiguous Enrollment Evidence

**Business dialog:**

> **Business Owner:** "Should conflicting recent-834 rows be handled differently?"  
> **Operations Lead:** "No. They could change processed-status branching, so arbitrary selection is unsafe."  
> **QA Analyst:** "VAL-004 confirms the same deterministic failure policy for recent enrollment candidates."

**BDD evidence:** Blocking error `AMBIGUOUS_LOOKUP_DUPLICATE` with message `Conflicting duplicate recent enrollment candidates found.`

**Design trace:** Sections 8.3 and 11.1.

---

### VAL-005-NoRuleSelectedImpossible: Enforce One Explicit Outcome

**Business dialog:**

> **Business Owner:** "Can the rule engine return without a disposition?"  
> **Operations Lead:** "No. It must select one rule, including the documented default, or return an explicit engine error."  
> **QA Analyst:** "VAL-005 confirms a zero-rule result is treated as a blocking invariant violation."

**BDD evidence:** Blocking error `RULE_SELECTION_FAILED` with message `No rule selected and no default applied.`

**Design trace:** Sections 9.1 and 11.1; Section 10.5 defines `No_rule99999` as the normal fallback.

---

### VAL-006-InputMutationGuard: Preserve Invocation Evidence

**Business dialog:**

> **Business Owner:** "Can processing alter the source arrays supplied to the reconciliation call?"  
> **Operations Lead:** "No. Mutation would compromise audit evidence and make retries non-deterministic."  
> **QA Analyst:** "VAL-006 confirms execution succeeds while every input remains unchanged."

**BDD evidence:** Invocation succeeds and invariant `no-input-mutation` is satisfied.

**Design trace:** Section 6.1 row-level contract explicitly prohibits mutation of any input argument.

---

### VAL-007-N12ApprovedDefault: Preserve the Approved Manual-Review Code

**Business dialog:**

> **Business Owner:** "Has the previously unresolved N12 disposition been approved?"  
> **Operations Lead:** "Yes. `AE999` is the default code for manual business review."  
> **QA Analyst:** "VAL-007 confirms N12 executes successfully with that approved decision."

**BDD evidence:** Invocation succeeds for the N12 approved-default precondition.

**Design trace:** Section 10.4, Rule N12; OQ-01 resolves the default to `AE999`.

---

### VAL-008-I4I5CoverageDiscriminator: Processed 834 Ownership Boundary

**Business dialog:**

> **Business Owner:** "How does the engine choose between I4 and I5 for a processed 834?"  
> **Operations Lead:** "I4 applies when membership is active on the business date; I5 applies when it is not active."  
> **QA Analyst:** "VAL-008 confirms that approved boundary produces a successful deterministic result."

**BDD evidence:** Invocation succeeds for the I4/I5 coverage-discriminator precondition.

**Design trace:** Section 10.3, Rules I4/I5; OQ-02 defines active coverage as start on/before the business date and blank end or end on/after it.

---

### VAL-009-I6I7CoverageDiscriminator: Unprocessed 834 Ownership Boundary

**Business dialog:**

> **Business Owner:** "Does the same active-coverage boundary govern unprocessed 834s?"  
> **Operations Lead:** "Yes. Active membership selects I6; inactive membership selects I7."  
> **QA Analyst:** "VAL-009 confirms the boundary remains deterministic when processed status is `N`."

**BDD evidence:** Invocation succeeds for the I6/I7 coverage-discriminator precondition.

**Design trace:** Section 10.3, Rules I6/I7; OQ-02.

---

### VAL-010-AddressStandardizerRequiredForN91N92: Block Uncontrolled Address Comparison

**Business dialog:**

> **Business Owner:** "Can N91 or N92 decide address ownership without the approved standardization service?"  
> **Operations Lead:** "No. Different normalization behavior could reverse no-action and carrier-update outcomes."  
> **QA Analyst:** "VAL-010 confirms those paths block until a deterministic, versioned standardizer is configured."

**BDD evidence:** Blocking error `ADDRESS_STANDARDIZER_REQUIRED` with message `Address standardizer configuration is required for N91/N92.`

**Design trace:** Section 10.4, Rules N91/N92, and the address-standardization requirement following the N-family catalog. Standardized values and the standardizer version must be auditable.

---

## Summary of Business Rule Satisfaction

- **57 BDD scenarios documented:** all 47 CAT scenarios actually present in the BDD and all 10 VAL scenarios.
- **Ordered business behavior traced:** A100 and B200, F1-F20, I1-I7, N0-N16, and `No_rule99999` are tied back to Detailed Design Sections 10.1 through 10.5.
- **Contract and determinism controls traced:** field counts, lookup validity, duplicate ambiguity, exactly-one-rule selection, immutability, approved defaults, coverage boundaries, and address-standardizer readiness are tied to the applicable design sections and resolved open questions.
- **Four BDD gaps identified:** CAT-047 through CAT-050 are design-only catch-all rules and require executable scenarios plus outbound wildcard-code approval.
- **Readiness caveats preserved:** `Z0000`, wildcard catch-all codes, EPDS processed-status mapping, and the versioned address standardizer are not presented as approved beyond what the detailed design states.

