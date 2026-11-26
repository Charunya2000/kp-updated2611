# Jira Epic: Automate PSHB RCNO Reconciliation and RCNA/834 Processing

## Epic Summary

Implement an auditable, deterministic workflow that reconciles Office of Personnel Management (OPM) Postal Service Health Benefits (PSHB) RCNO records against Kaiser Permanente membership, recent enrollment transactions, and prior reconciliation results; produces working and outbound RCNA records; generates approved X12 834 enrollment transactions; and gives authorized administrators the controls needed to configure, initiate, schedule, and monitor processing.

## Business Context

KP sends membership information to OPM through the monthly MENR process. OPM compares that information with its PSHB records and returns RCNO records that identify matches and enrollment or demographic discrepancies.

Today, resolving these discrepancies requires coordinated review across OPM data, KP membership, recent 834 activity, and prior RCNA decisions. This epic automates that reconciliation loop so each RCNO record receives one explainable disposition, the appropriate owner and next action are identified, eligible outcomes can be translated into approved X12 834 transactions, and operations teams can manage the workflow through a protected administration experience.

## Business Value

- Reduce manual reconciliation effort and inconsistent case handling.
- Apply the approved RCNA rule catalog consistently and in a deterministic order.
- Preserve prior decisions and aging when an RCNO discrepancy repeats unchanged.
- Clearly assign corrective action to OPM, KP, the carrier, or manual review.
- Produce auditable working and outbound RCNA records for every successfully processed RCNO row.
- Enable standards-compliant X12 834 generation for dispositions with approved transaction mappings.
- Give authorized administrators operational visibility and versioned configuration control without requiring an application deployment.
- Protect member information and credentials throughout processing, diagnostics, storage, and transfer.

## Epic Scope

### RCNO to RCNA Reconciliation

- Accept and validate canonical 73-field RCNO records.
- Evaluate each RCNO record against supplied KP membership, recent 834, and prior RCNA evidence.
- Apply the ordered RCNA business-rule catalog using first-match-wins behavior.
- Return exactly one 78-field working RCNA record and one 76-field outbound RCNA record for each successful invocation.
- Preserve the original RCNO values and add the selected priority, PSHB code, description, notes, and aging values as defined by the design.
- Reject malformed, ambiguous, or non-deterministic inputs without emitting a success-shaped result.
- Record non-sensitive audit metadata sufficient to explain the selected rule and source evidence.

### RCNA to X12 834 Processing

- Select only RCNA records that have an approved 834 transaction intent.
- Transform each selected RCNA row into one validated X12 834 member-loop representation.
- Group subscribers and dependents deterministically and assemble complete `005010X220A1` interchanges.
- Validate required segments, approved relationship values, dates, quantities, control numbers, and envelope integrity.
- Generate one 834 output file for each RCNO input-file processing boundary.
- Fail closed when an RCNA code, trading-partner value, maintenance intent, or other required mapping has not been approved.

### Administration and Operations

- Restrict RCNOA administration functions to authorized application administrators.
- Support protected ad hoc processing and scheduled SFTP processing when their required configurations are available.
- Allow administrators to maintain versioned business configuration and EPDS/MDW query configuration without rebuilding or redeploying the application.
- Provide run history, status, failure details, artifact access, and mock-fixture provenance where enabled.
- Keep secrets server-side, expose only configuration status where appropriate, and prevent sensitive values from appearing in logs or user-facing diagnostics.
- Require approved scheduler authentication, pinned SFTP host verification, and approved encryption controls before production scheduled transfer is enabled.

## Epic Success Criteria

- Every accepted RCNO row produces exactly one explainable RCNA disposition.
- Working and outbound RCNA outputs conform to their approved 78-field and 76-field contracts.
- Rule selection is repeatable for the same source snapshot, business date, rule version, and configuration version.
- Conflicting lookup evidence, invalid contracts, and unresolved blocking configuration produce explicit failures rather than inferred results.
- Eligible RCNA rows produce structurally valid X12 834 member loops and interchanges only when all required mappings are approved.
- Subscriber/dependent hierarchy, transaction quantities, segment counts, and control-number pairs reconcile before an 834 artifact is released.
- Administrators can manage approved configuration and monitor processing through a protected interface.
- Ad hoc and scheduled runs retain auditable status, configuration versions, source identifiers, and artifact associations.
- Logs and diagnostics exclude raw RCNO, RCNA, membership, and 834 records, full SSNs, credentials, and other sensitive member data.
- Failed work remains retryable and does not create duplicate persisted RCNA records or partially released interchange artifacts.

## Dependencies and Readiness Gates

- EPDS and MDW connectivity and complete canonical lookup mappings must be available to the orchestration layer.
- MongoDB must provide versioned query/business configuration, schedules, run state, audit metadata, and protected prior-RCNA history.
- Blob storage must be available for authorized input and output artifacts.
- The eligible RCNA-code-to-834 intent mappings and required trading-partner identifiers must receive business approval before 834 generation is activated.
- The deterministic address-standardization service and version required by address rules must be approved and configured.
- Catch-all RCNA codes containing literal wildcards require outbound-interface confirmation.
- Production scheduled processing requires approved scheduler authentication, SFTP configuration with host-key pinning, and an approved PGP implementation and key-management process.
- Repository snapshot, idempotency-key, work-item status, and batch-closure policies must be finalized for production operations.

## Out of Scope

- Direct updates to OPM systems or KP membership systems.
- Inventing missing source data, RCNA dispositions, X12 values, or trading-partner mappings.
- Enabling production 834 output for RCNA codes without approved transaction intent.
- Enabling production encrypted transfer before the PGP implementation and key-custody process are approved.
- Defining payer-specific behavior not supported by the approved source material or companion-guide decisions.

## Source of Truth

This epic summarizes `docs/rcnoa/RCNO-RCNA-834-Detailed-Design.md`. The detailed design governs field contracts, rule predicates and order, X12 mappings, validation behavior, runtime configuration, operational controls, resolved decisions, and outstanding readiness questions.

## User Story 1: Reconcile RCNO Records into Deterministic RCNA Outcomes

### Story Statement

**As a** reconciliation analyst,  
**I want** each RCNO record evaluated against KP membership, recent 834 activity, and prior RCNA history using the approved ordered rule catalog,  
**So that** every accepted discrepancy receives one consistent, explainable, and auditable RCNA disposition.

### Business Value

This story replaces manual and inconsistent reconciliation decisions with repeatable rule evaluation. It preserves unchanged prior decisions, identifies the party responsible for corrective action, and produces both analyst-facing and OPM-facing RCNA records without altering source values.

### Scope Notes

- Processing is row-at-a-time and database-backed.
- The transformation receives all lookup candidates as arguments and performs no database or file access.
- Repository loading, persistence, retry, and idempotency are orchestration responsibilities.
- The complete ordered rule catalog and field-level predicates remain governed by the detailed design.

### Acceptance Criteria

```gherkin
Feature: Reconcile an RCNO record into one deterministic RCNA outcome

	Background:
		Given one canonical 73-field RCNO record is supplied
		And zero or more canonical KP membership candidates are supplied
		And zero or more canonical recent 834 candidates from the approved 30-day window are supplied
		And zero or more canonical prior working RCNA candidates are supplied
		And a stable business date is supplied
		And a rule-catalog version and configuration version are supplied
		And comparison values are normalized without changing source values

	Scenario: Produce one working and one outbound RCNA record
		When the RCNO record is reconciled successfully
		Then exactly one 78-field working RCNA record is returned
		And exactly one 76-field outbound RCNA record is returned
		And RCNO fields 1 through 73 are preserved unchanged in both records
		And the selected rule ID and non-sensitive evidence are included in the audit result

	Scenario: Apply the perfect-match disposition
		Given RCNO column 4 is "M"
		When the ordered rule catalog is evaluated
		Then rule "A100" is selected
		And priority is "5: Matches (no action required)"
		And PSHB code is "MM"
		And the description is "Matches (no action required)"
		And aging months is 0
		And no later rule is selected

	Scenario: Carry forward an unchanged prior disposition
		Given rule "A100" does not apply
		And current RCNO fields 1 through 73 equal prior RCNA fields 1 through 73 after comparison normalization
		And the prior aging months value is 4
		When the ordered rule catalog is evaluated
		Then rule "B200" is selected
		And the prior priority is preserved
		And the prior PSHB code is preserved
		And the prior description is preserved
		And aging months is 5

	Scenario Outline: Select the approved discrepancy rule family
		Given RCNO column 4 is "<result>"
		And the supplied lookup evidence satisfies one approved rule in the "<family>" family
		And no earlier rule in the catalog applies
		When the ordered rule catalog is evaluated
		Then exactly one rule in the "<family>" family is selected
		And its approved priority, PSHB code, and description are returned

		Examples:
			| result | family |
			| F      | F      |
			| I      | I      |
			| N      | N      |

	Scenario: Apply the explicit default disposition
		Given no specific catalog rule applies
		And no approved catch-all rule applies
		When rule evaluation completes
		Then rule "No_rule99999" is selected
		And priority is "1: Active Enrollment mismatch"
		And PSHB code is "0000"
		And the description is "No Rules Applied"

	Scenario: Reject an invalid primary record
		Given the supplied RCNO record contains 72 fields
		When reconciliation is requested
		Then the invocation is rejected before rule evaluation
		And no working RCNA record is returned
		And no outbound RCNA record is returned
		And the error identifies the invalid RCNO field count

	Scenario: Reject conflicting lookup evidence
		Given conflicting duplicate lookup candidates could produce different rule outcomes
		When reconciliation is requested
		Then the invocation is rejected as ambiguous
		And no lookup candidate is selected arbitrarily
		And no RCNA record is returned

	Scenario: Keep transformation behavior side-effect free
		Given all required primary and lookup records have been supplied
		When the RCNO record is reconciled
		Then the transformation does not query a database
		And the transformation does not read or write a file
		And the transformation does not mutate any supplied record or candidate collection

	Scenario: Prevent duplicate persisted outcomes
		Given the RCNO work item was processed successfully for the same idempotency key and rule-catalog version
		When the orchestration layer encounters the work item again
		Then the persisted result is reused or returned according to repository policy
		And a duplicate RCNA result is not persisted

	Scenario: Protect sensitive reconciliation data
		Given reconciliation produces an audit event or validation error
		When the event is logged
		Then raw RCNO, RCNA, membership, and recent 834 records are absent
		And names, birth dates, addresses, member identifiers, and full SSNs are absent
		And the correlation ID, source identifier, rule ID, and masked identifier are available when applicable
```

### Design Traceability

- Detailed Design Sections 5 through 11 define contracts, normalization, lookup matching, ordered rule execution, output layouts, and validation.
- Detailed Design Section 15 provides the governing acceptance examples.
- Detailed Design Sections 17 and 19 define completion criteria and unresolved readiness decisions.

---

## User Story 2: Generate Approved X12 834 Transactions from RCNA Outcomes

### Story Statement

**As an** enrollment operations analyst,  
**I want** eligible RCNA outcomes transformed into validated ASC X12N 834 transactions,  
**So that** approved enrollment corrections can be delivered accurately without inferring missing business or trading-partner decisions.

### Business Value

This story converts approved carrier-directed RCNA outcomes into standards-compliant enrollment transactions while enforcing subscriber hierarchy, field mappings, counts, control numbers, and configuration gates. Invalid or unapproved mappings fail closed before an interchange is released.

### Scope Notes

- Only RCNA rows selected by the approved disposition policy are eligible.
- The row transformation returns one validated member-loop representation and does not finalize interchange envelopes.
- The assembler groups subscribers and dependents and finalizes envelope, quantity, segment-count, and control-number values.
- Production activation depends on approved RCNA-code intent mappings and trading-partner configuration.

### Acceptance Criteria

```gherkin
Feature: Generate an approved ASC X12N 834 interchange from selected RCNA outcomes

	Background:
		Given an approved RCNA-code-to-834-intent configuration is active
		And approved envelope and trading-partner configuration is active
		And approved relationship mappings are active
		And selected canonical working RCNA records are supplied

	Scenario: Transform one selected RCNA row into one member loop
		When one selected RCNA record is transformed
		Then exactly one validated INS-loop representation is returned
		And the result identifies whether the member is a subscriber or dependent
		And the result includes a subscriber grouping key and stable member sort key
		And the row transformation does not finalize ISA, GS, ST, SE, GE, or IEA segments

	Scenario Outline: Classify subscriber and dependent rows
		Given the PSHBS member SSN is "<memberSsn>"
		And the PSHBS subscriber SSN is "<subscriberSsn>"
		When the RCNA row is transformed
		Then INS01 is "<ins01>"

		Examples:
			| memberSsn | subscriberSsn | ins01 |
			| 111223333 | 111223333     | Y     |
			| 444556666 | 111223333     | N     |

	Scenario: Map approved member data
		When the member loop is generated
		Then PSHBS last name maps to NM103
		And PSHBS first name maps to NM104
		And PSHBS member SSN maps to NM109 where NM108 is "34"
		And PSHBS subscriber SSN maps to REF02 where REF01 is "0F"
		And PSHBS birth date maps to DMG02 using CCYYMMDD format
		And PSHBS gender maps to DMG03
		And PSHBS coverage start maps to DTP03 where DTP01 is "348"
		And PSHBS address line 3 is not emitted

	Scenario: Map a populated coverage end
		Given the PSHBS coverage end is populated with a valid date
		When the health coverage loop is generated
		Then DTP01 is "349"
		And DTP02 is "D8"
		And DTP03 contains the coverage end in CCYYMMDD format

	Scenario: Assemble subscribers before their dependents
		Given all selected member-loop results for an RCNO input file have been collected
		When the interchange is assembled
		Then results are grouped by PSHBS subscriber SSN
		And every group contains exactly one subscriber
		And the subscriber INS loop precedes its dependent INS loops
		And groups and dependents use stable configured ordering

	Scenario: Reject an invalid subscriber hierarchy
		Given a subscriber group contains no subscriber or more than one subscriber
		When interchange assembly is attempted
		Then the subscriber group is rejected
		And no completed interchange containing that invalid group is released

	Scenario: Maintain transaction quantities and control-number integrity
		Given all intended member-loop results have been collected
		When the interchange is finalized
		Then QTY ET equals the subscriber INS count
		And QTY DT equals the dependent INS count
		And QTY TO equals the total INS count
		And SE01 equals the inclusive ST-through-SE segment count
		And SE02 equals ST02
		And GE02 equals GS06
		And IEA02 equals ISA13

	Scenario: Preserve the RCNO input-file assembly boundary
		Given selected RCNA rows originated from one RCNO input file
		When their validated member loops are assembled
		Then exactly one 834 output file is associated with that RCNO input file
		And rows from another RCNO input file are not included

	Scenario: Reject an RCNA code without approved transaction intent
		Given a selected RCNA PSHB code has no approved 834 transaction intent
		When 834 generation is requested
		Then the row is rejected
		And INS03, INS04, INS05, HD01, and BGN08 are not inferred
		And no 834 artifact containing the row is released

	Scenario: Block generation when approval gates are not satisfied
		Given the 834 mapping approval gate is not active
		When 834 generation is requested
		Then processing is blocked with a non-sensitive configuration error
		And no interchange is generated

	Scenario: Protect sensitive 834 data in diagnostics
		Given member-loop or interchange validation fails
		When the failure is logged
		Then names, birth dates, addresses, member identifiers, and full SSNs are absent
		And the correlation ID, source identifier, failed element, and masked identifier are available
```

### Design Traceability

- Detailed Design Sections 12 and 13 define selection, member mapping, hierarchy, envelope, segment, count, and control-number rules.
- Detailed Design Sections 14 and 15 define failure behavior and governing acceptance examples.
- Detailed Design Sections 17, 19, and 20 define completion criteria, approval gates, and runtime configuration.

---

## User Story 3: Administer and Monitor RCNOA Processing

### Story Statement

**As an** authorized RCNOA administrator,  
**I want** to configure, initiate, schedule, and monitor RCNO-to-RCNA-to-834 processing from a protected administration page,  
**So that** reconciliation operations are controlled, observable, recoverable, and auditable without exposing sensitive configuration or member data.

### Business Value

This story provides a single operational experience for readiness, ad hoc processing, schedules, versioned configuration, run history, diagnostics, and artifact access. It separates administrator actions from server-managed credentials and ensures incomplete production controls cannot be bypassed through the UI.

### Scope Notes

- The administration route and APIs require the approved RCNOA team scope and management permission.
- MongoDB is authoritative for versioned business/query configuration and operational metadata.
- Blob Storage holds input and output artifacts; MongoDB holds artifact references and audit state, not file payloads.
- SFTP credentials, Oracle credentials, tokens, and protected match-key secrets remain server-side.

### Acceptance Criteria

```gherkin
Feature: Administer and monitor RCNOA processing securely

	Background:
		Given the RCNOA administration capability is configured for the approved team and assistant
		And server-side authorization derives the current user's identity and permissions from the authenticated session

	Scenario: Allow an authorized administrator to access RCNOA operations
		Given the user has the RCNOA processing management permission
		When the user opens the RCNOA administration page
		Then the readiness status, ad hoc controls, schedule controls, configuration, and run history are available

	Scenario: Deny an unauthorized user
		Given the user does not have the RCNOA processing management permission
		When the user requests the RCNOA administration page or API
		Then access is denied
		And no schedule, configuration, run, failure, or artifact metadata is disclosed

	Scenario: Save versioned business configuration
		Given the administrator supplies valid business and transformation settings
		And the submitted version matches the current configuration version
		When the administrator saves the configuration
		Then a new configuration version is persisted
		And new runs use the new version without an application build or deployment
		And prior runs retain their original configuration-version reference

	Scenario: Reject invalid or conflicting configuration changes
		Given the administrator supplies invalid JSON, an unsafe query, or a stale configuration version
		When the administrator saves the configuration
		Then the change is rejected with a sanitized validation or conflict message
		And the current configuration remains unchanged

	Scenario: Keep secrets write-only
		Given a protected secret is already configured
		When the administrator views configuration
		Then the secret value is not returned or displayed
		And only its configured status is shown
		When the administrator submits a blank replacement
		Then the existing secret is preserved

	Scenario: Start an authorized ad hoc run
		Given the administrator selects one valid RCNO input file within the approved size limit
		When the upload completes and the server confirms the staged Blob artifact
		Then one ad hoc run is created with a unique run ID
		And the input artifact is associated with the authenticated user and run ID
		And processing uses the configuration version captured at run start

	Scenario: Reject an invalid ad hoc input
		Given the selected file violates the approved RCNO file contract
		When the administrator attempts to start processing
		Then the run is not started
		And a sanitized validation message identifies the violated contract

	Scenario: Configure a non-overlapping schedule
		Given scheduled processing prerequisites are satisfied
		And the administrator supplies a valid daily or selected-weekday schedule in the America/New_York time zone
		When the administrator enables the schedule
		Then the schedule version, next execution time, changer identity, and change time are persisted
		And only one active schedule exists for the approved RCNOA scope

	Scenario: Block schedule activation when readiness is incomplete
		Given scheduler authentication, SFTP host verification, or required transfer configuration is incomplete
		When the administrator attempts to enable scheduled processing
		Then schedule activation is rejected
		And the missing readiness requirements are identified without exposing secret values

	Scenario: Prevent overlapping scheduled runs
		Given a scheduled RCNOA run is active
		When another execution becomes due
		Then the due execution is recorded as skipped according to the approved overlap policy
		And a second overlapping run is not started

	Scenario: Display current and historical run status
		Given ad hoc or scheduled runs exist
		When the administrator views run history
		Then runs are displayed with run ID, mode, requester, timestamps, duration, stage, status, and counts
		And history can be filtered and paged server-side
		And run details show sanitized job and row-level failures

	Scenario: Represent partial row processing accurately
		Given at least one row succeeds
		And at least one row fails with a row-level error
		When processing completes
		Then the run status is "PARTIAL"
		And valid output artifacts are retained
		And an error-report artifact is available
		And failed row details contain no unmasked sensitive data

	Scenario: Authorize artifact downloads
		Given a completed run has an available artifact
		And the administrator is authorized for that run and artifact
		When the administrator requests a download
		Then a short-lived read link is issued
		And the artifact remains associated with its run
		And an ad hoc artifact remains associated with its authenticated owner

	Scenario: Prevent unauthorized artifact access
		Given the user is not authorized for a requested run or artifact
		When the user requests a download link
		Then the request is denied
		And no storage location or temporary link is disclosed

	Scenario: Expose mock fixtures only in approved non-production environments
		Given mock fixtures are enabled in a non-production environment
		When the administrator starts a fixture-based ad hoc run
		Then the fixture ID, version, checksum, and mock provenance are recorded
		And live EPDS and MDW lookup sources are not called
		And synthetic prior-RCNA history is not persisted

	Scenario: Keep operational credentials out of the administration page
		When the administrator views or operates RCNOA processing
		Then SFTP passwords, Oracle credentials, scheduler tokens, storage credentials, and private keys are not displayed
		And the server obtains required operational credentials from approved server-side configuration
```

### Design Traceability

- Detailed Design Sections 17 and 20 define operational completion, runtime configuration, fixed file contracts, infrastructure dependencies, and scheduled-processing gates.
- Detailed Design Section 19 identifies approvals that must remain blocking until resolved.
- `docs/rcnoa/rcnoa_ui.md` defines the protected administration workflow, run states, artifact ownership, schedule behavior, and operational acceptance criteria consistent with the detailed design.
