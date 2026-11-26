# EDI Workbench Jira Epic and User Stories

## Epic: EDI Validation Workbench

### Epic Description

The EDI Validation Workbench provides users with a guided interface for validating EDI transactions against companion-guide rules and, when enabled, reference data in DataHub. The workbench reduces the time and technical effort required to identify invalid EDI elements by combining file upload, parsing, enrichment, structural validation, optional database validation, progress monitoring, and a readable findings report in one workflow.

Users upload an EDI input file and a companion-guide CSV, select the validation scope, configure parser options, and start an asynchronous validation job. A validation can process all subscribers in the transaction, one subscriber identified by SSN, or one subscriber with stipulated NM1 and REF values. During processing, the page reports the job status, current step, overall percentage, subscriber counts, and structural and database-validation progress.

The validation pipeline downloads the uploaded files from Azure Blob Storage, scopes the EDI transaction when requested, parses and enriches the EDI content, applies companion-guide validation rules, and optionally executes database lookup validation. The completed report summarizes valid, invalid, and unknown elements; validation checks; subscriber outcomes; execution settings; lookup coverage; and detailed invalid-element findings with subscriber and EDI location context.

### Business Value

- Gives analysts and EDI support teams a self-service validation workflow.
- Identifies structural, companion-guide, stipulated-value, and database-reference issues in a single run.
- Provides subscriber-level traceability and clear element-location context for troubleshooting.
- Supports targeted single-subscriber validation to shorten investigation cycles.
- Makes long-running validation observable through asynchronous job and subscriber progress.
- Preserves execution context so users can understand how each result was produced.

### In Scope

- Upload of an EDI `.txt` or `.edi` file and companion-guide CSV.
- Secure server-side file storage in Azure Blob Storage before processing.
- Asynchronous parse, enrich, and validation jobs.
- All-subscriber and single-subscriber validation scopes.
- Optional stipulated NM1 and REF values for a selected subscriber.
- Companion-guide structural and element validation.
- Optional DataHub database lookup validation.
- Parser options for subscriber-only database validation, lookup SQL details, CSV delimiter normalization, and memory logging.
- Live job, percentage, step, and subscriber progress.
- Summary and detailed reporting of invalid elements and validation outcomes.
- Friendly error reporting for invalid inputs, unavailable lookup specifications, processing failures, and lost progress connections.

### Epic Acceptance Criteria

- An authorized user can access the EDI Validation Workbench from an eligible assistant SmartNote.
- The user cannot start validation until the required EDI and companion-guide files and any scope-specific inputs are valid.
- Starting validation uploads both files and creates an asynchronous validation job.
- The page displays current job and subscriber progress until the job completes or fails.
- The pipeline applies companion-guide rules and applies DataHub lookups when database validation is enabled.
- The user can validate all subscribers or target one subscriber by a normalized nine-digit SSN.
- A completed run displays summary counts, subscriber outcomes, execution context, warnings, and detailed invalid elements.
- Invalid elements include sufficient subscriber, segment, element, location, value, and reason context when supplied by the validation pipeline.
- Processing errors are presented to the user without discarding the ability to correct inputs and retry.

---

## User Story 1: Parse EDI and Perform Database Validation

### Story Description

**As an** EDI analyst,  
**I want** the workbench to parse and enrich an EDI transaction, validate it against a companion guide, and optionally validate applicable values against DataHub,  
**so that** I can identify structural and reference-data defects without manually inspecting the transaction or querying the database.

### Acceptance Criteria

- The service requires an EDI blob location and a companion-guide blob location.
- The validation pipeline accepts a companion-guide CSV and rejects an unsupported companion-guide format with a clear error.
- The pipeline downloads temporary working copies, parses and enriches the EDI transaction, applies companion-guide rules, and removes temporary files after processing.
- The pipeline supports all-subscriber, single-subscriber, and single-subscriber-with-stipulated-values scopes.
- A single-subscriber scope uses a normalized nine-digit SSN and validates only the matched subscriber transaction content.
- Database validation is optional and uses available lookup specifications when enabled.
- The job reports queued, running, completed, or failed status and exposes current progress and subscriber metrics.
- The completed result includes summary counts, invalid elements, validation and subscriber summaries, lookup statistics, warnings, and execution context.
- A database-validation request fails clearly when required lookup specifications are unavailable.
- Database validation reports a warning when it is enabled and lookup rules exist but none are applied.

### Gherkin Scenarios

```gherkin
Feature: Parse, enrich, and validate an EDI transaction

  Background:
    Given an authorized user has uploaded a valid EDI file
    And the user has uploaded a valid companion-guide CSV

  Scenario: Validate all subscribers using companion-guide rules
    Given the validation scope is "All subscribers"
    And database validation is disabled
    When the user starts validation
    Then an asynchronous validation job is created
    And the job progresses from queued or running to completed
    And every subscriber in the EDI transaction is evaluated against applicable companion-guide rules
    And the result contains validation summary counts
    And each invalid finding includes available subscriber and EDI element location context

  Scenario: Validate one subscriber by SSN
    Given the validation scope is "Single subscriber SSN"
    And the user enters a valid 9-digit subscriber SSN
    When the user starts validation
    Then the EDI transaction is scoped to the matching subscriber
    And only the matched subscriber content is parsed and validated
    And the result records the requested scope and normalized SSN
    And the result reports the number of subscribers matched

  Scenario: Validate one subscriber using stipulated values
    Given the validation scope is "Single SSN with stipulated values"
    And the user enters a valid 9-digit subscriber SSN
    And the user supplies one or more stipulated NM1 or REF values
    When the user starts validation
    Then the matching subscriber is validated
    And the stipulated values are compared with the corresponding EDI values
    And each mismatch is returned as an invalid finding

  Scenario: Perform database validation
    Given database validation is enabled
    And applicable database lookup specifications are installed
    When the user starts validation
    Then applicable enriched EDI values are validated against DataHub
    And the job reports database passed, failed, and skipped counts when available
    And the completed result includes database lookup statistics
    And database lookup failures appear in the invalid-elements report

  Scenario: Restrict database validation to subscriber data
    Given database validation is enabled
    And "Subscriber-only DB" is enabled
    When the user starts validation
    Then database lookup validation is limited to applicable subscriber-level values
    And structural companion-guide validation continues for the selected validation scope

  Scenario: Database lookup specifications are unavailable
    Given database validation is enabled
    And the installed validation package does not contain database lookup specifications
    When the validation pipeline begins
    Then the job fails
    And the user is shown an error explaining that database lookup specifications are unavailable

  Scenario: No database lookup rules are applied
    Given database validation is enabled
    And lookup rules are present in the validation result
    But no lookup rule is applied
    When the job completes
    Then the result contains a warning that database validation applied no lookup rules
    And the result advises checking lookup specifications and rule coverage

  Scenario: Reject an unsupported companion-guide format
    Given the uploaded companion guide is not a CSV file
    When the validation pipeline begins
    Then the job fails
    And the user is shown an error identifying the unsupported companion-guide format

  Scenario: Validation worker fails unexpectedly
    Given a validation job is running
    When the validation worker exits unexpectedly or exceeds its allowed runtime
    Then the job status becomes "failed"
    And the job records a meaningful failure reason
    And the user can correct the inputs or configuration and start a new run
```

---

## User Story 2: Use the EDI Workbench Page

### Story Description

**As an** EDI analyst,  
**I want** a single page where I can configure, run, monitor, and review EDI validation,  
**so that** I can efficiently find transaction defects and understand the context of each result.

### Acceptance Criteria

- The page provides separate controls for selecting a companion-guide file and an EDI input file.
- The page displays each selected file name and approximate size and allows the file to be replaced.
- The page provides validation scopes for all subscribers, one subscriber by SSN, and one subscriber with stipulated values.
- The page validates the subscriber SSN before enabling a scoped run.
- Stipulated NM1 and REF fields are shown only for the stipulated-values scope.
- The page exposes parser options for database validation, subscriber-only database validation, lookup SQL details, and parser memory logging.
- The Run Validation action remains disabled until required files and inputs are present and no validation job is already running.
- While validation runs, the page shows current status, step, percentage, a progress bar, and available subscriber metrics.
- Temporary polling failures are retried and communicated without immediately failing the validation run.
- On completion, the page displays result totals, validation-check totals, subscriber outcomes, execution context, warnings, and invalid-element details.
- The user can show unique element errors only and toggle exact technical paths.
- When no invalid elements are found, the page displays a successful validation message.
- When a request or job fails, the page displays a clear error message.

### Gherkin Scenarios

```gherkin
Feature: Operate the EDI Validation Workbench page

  Scenario: Select the required validation files
    Given the user is on the EDI Validation Workbench page
    When the user selects a companion-guide CSV
    And the user selects an EDI .txt or .edi file
    Then the page displays each selected file name and size
    And the user can replace either selected file
    And the Run Validation action is enabled when all other required inputs are valid

  Scenario: Prevent an incomplete validation request
    Given the user is on the EDI Validation Workbench page
    And either the companion-guide file or EDI file has not been selected
    When the user reviews the Run Validation action
    Then the action is disabled
    And no validation request can be submitted

  Scenario: Require a valid SSN for a single-subscriber run
    Given the user selects "Single subscriber SSN"
    When the subscriber SSN does not contain exactly 9 digits
    Then the page displays an SSN validation message
    And the Run Validation action remains disabled
    When the user enters a valid 9-digit SSN
    Then the SSN validation message is cleared
    And the run can proceed when the required files are selected

  Scenario: Configure stipulated subscriber values
    Given the user selects "Single SSN with stipulated values"
    Then the page displays the subscriber SSN field
    And the page displays the supported NM1 and REF stipulated-value fields
    When the user changes to "All subscribers"
    Then the subscriber-specific stipulated-value controls are hidden

  Scenario: Configure parser and database options
    Given the required files are selected
    When the user enables database validation
    And the user selects subscriber-only database validation
    And the user chooses whether to include lookup SQL or parser memory logging
    Then the selected options are included in the validation request
    And the completed report displays the effective execution options

  Scenario: Monitor an active validation job
    Given the user has started validation
    When the job is queued or running
    Then the Run Validation action displays a processing state and cannot be submitted again
    And the page displays the current server status
    And the page displays the current validation step and completion percentage
    And the page checks for updated progress periodically
    And subscriber totals and structural and database outcomes are displayed when available

  Scenario: Recover from a temporary progress connection failure
    Given a validation job is running
    When a progress request temporarily fails
    Then the page informs the user that it is reconnecting
    And the page retries the progress request up to the configured retry limit
    And the active run is not immediately marked failed

  Scenario: Display a completed report with invalid elements
    Given a validation job completes with invalid findings
    When the result is displayed
    Then the page shows invalid, valid, and unknown totals
    And the page shows validation-check and subscriber summaries when available
    And the page shows the effective scope, database options, and lookup statistics
    And each finding displays available subscriber identity, segment, element, location, failed value, and reason
    And no more than the configured maximum number of findings is rendered at one time

  Scenario: Filter and inspect invalid findings
    Given a completed report contains repeated invalid-element findings
    When the user enables "Unique element errors"
    Then duplicate findings are removed from the displayed list
    When the user selects "Show exact paths"
    Then technical EDI paths are displayed for the findings
    When the user selects "Hide exact paths"
    Then technical EDI paths are hidden

  Scenario: Display a successful report
    Given a validation job completes with no invalid elements
    When the result is displayed
    Then the page shows a success message stating that no invalid elements were detected
    And the execution summary remains available for review

  Scenario: Display a validation failure
    Given the user has started validation
    When file upload, job creation, processing, or progress monitoring fails beyond the retry limit
    Then the page displays a clear error message
    And the processing state ends
    And the user can correct the inputs or configuration and run validation again
```
