# Jira User Story: Add Business Review and Controlled 834 Processing to RCNOA

## Story Summary

Separate RCNO-to-RCNA reconciliation from X12 834 generation and outbound delivery so the business can review generated RCNA results before explicitly initiating the next action.

## User Story

**As an** authorized RCNOA business administrator,  
**I want** RCNO processing to pause after generating the RCNA and provide explicit controls for RCNA-to-834 conversion and 834 delivery,  
**So that** the business can review reconciliation results before an enrollment transaction is created or sent to the outbound SFTP folder.

## Business Value

- Establishes a required business-review checkpoint after RCNA generation.
- Prevents RCNO intake from automatically creating or delivering an 834.
- Supports correction or replacement files without rerunning RCNO reconciliation.
- Preserves an auditable run and artifact history for each distinct operation.
- Allows administrators to tune MDW query load without an application deployment.

## Scope

### RCNO-to-RCNA Processing

- Ad hoc and scheduled RCNO runs generate RCNA output only.
- Successful runs pause in `AWAITING_RCNA_REVIEW`.
- Scheduled input is archived after its RCNA artifact is staged, preventing duplicate pickup.
- The generated outbound RCNA remains available for authorized download and review.

### Controlled 834 Processing

- An authorized user can generate an 834 from the reviewed RCNA associated with a paused run.
- An authorized user can import a separate 76- or 78-column RCNA file into cycle-scoped prior history without generating an 834.
- After import, an authorized user can explicitly generate an 834 from the stored uploaded RCNA.
- An authorized user can upload an existing X12 834 file and deliver it to the configured outbound SFTP folder.
- Generated 834 files are staged for download; they are not automatically delivered to SFTP.
- 834 generation fails closed when generation is disabled or required mappings are not approved.

### Administration and Audit

- Run history identifies the operation as `RCNO_TO_RCNA`, `RCNA_IMPORT`, or `834_TO_SFTP`; legacy `RCNA_TO_834` runs remain readable.
- Run history exposes the `AWAITING_RCNA_REVIEW` status and the applicable **Generate 834** action.
- Separate controls are available for **Import RCNA into prior history**, per-run **Generate 834**, and **Upload 834 to outbound SFTP**.
- Uploaded artifacts, generated artifacts, status transitions, errors, actors, and timestamps remain associated with their runs.

### MDW Query Configuration

- The administration page provides an **MDW SSNs per query** setting.
- The setting controls the maximum number of unique SSNs included in each MDW query batch.
- The allowed range is 1 through 5000 and the default is 300.
- The setting is stored in the existing versioned MongoDB page query configuration, not KP Config or `configActions`.

## Acceptance Criteria

```gherkin
Feature: Review RCNA before controlled 834 generation and delivery

	Background:
		Given the RCNOA team is "reconciliation-notice-processing"
		And the RCNOA assistant is "rcno-rcna-834"
		And the user has the RCNOA processing-management permission

	Scenario: Pause an ad hoc RCNO run after RCNA generation
		Given the user has uploaded a valid 73-column RCNO file
		When the queued ad hoc run finishes RCNO-to-RCNA processing
		Then an outbound 76-column RCNA artifact is staged in Blob Storage
		And the run operation is "RCNO_TO_RCNA"
		And the run status is "AWAITING_RCNA_REVIEW"
		And the run stage is "AWAITING_RCNA_REVIEW"
		And the 834 member count is 0
		And no 834 artifact is generated
		And no output is delivered to SFTP

	Scenario: Pause a scheduled RCNO run and archive its input
		Given the scheduler has selected and staged a valid inbound RCNO file
		When scheduled RCNO-to-RCNA processing completes
		Then the outbound RCNA artifact is staged in Blob Storage
		And the inbound RCNO file is archived on SFTP
		And the run status is "AWAITING_RCNA_REVIEW"
		And no 834 artifact is generated
		And no RCNA or 834 output is automatically delivered to outbound SFTP

	Scenario: Generate an 834 from a reviewed generated RCNA
		Given an RCNO-to-RCNA run is in "AWAITING_RCNA_REVIEW"
		And its outbound RCNA artifact is available
		And 834 generation is enabled
		And the 834 mapping is approved
		When the user selects "Generate 834"
		Then the run transitions through the "GENERATING_834" stage
		And eligible carrier-action RCNA records are converted to X12 834 transactions
		And the generated 834 is staged in Blob Storage
		And the run finishes with stage "834_GENERATED"
		And the 834 member count reflects the generated transactions
		And the generated 834 is not automatically delivered to SFTP

	Scenario: Reject 834 generation for a run that is not awaiting review
		Given an RCNO-to-RCNA run is not in "AWAITING_RCNA_REVIEW"
		When the user requests 834 generation for that run
		Then the request is rejected
		And no additional 834 artifact is created

	Scenario Outline: Prevent unapproved 834 generation
		Given an RCNO-to-RCNA run is in "AWAITING_RCNA_REVIEW"
		And 834 generation is <generation_state>
		And the 834 mapping is <mapping_state>
		When the user views or requests the "Generate 834" action
		Then the action is unavailable or rejected
		And no 834 artifact is created

		Examples:
			| generation_state | mapping_state |
			| disabled         | approved      |
			| enabled          | unapproved    |

	Scenario: Return a failed generated-RCNA conversion to business review
		Given an RCNO-to-RCNA run is in "AWAITING_RCNA_REVIEW"
		And the user initiates 834 generation
		When conversion fails validation or artifact generation
		Then the run returns to "AWAITING_RCNA_REVIEW"
		And a sanitized generation error is recorded
		And the reviewed RCNA artifact remains available

	Scenario Outline: Import an uploaded RCNA into prior history
			Given the user selects "Import RCNA into prior history"
			And selects a valid reconciliation cycle
		And the selected RCNA contains exactly <column_count> columns per row
		When the upload is processed
			Then a run with operation "RCNA_IMPORT" is created
		And the uploaded RCNA is staged as its input artifact
		And the RCNA is normalized to the internal 78-column representation
			And every row is saved as prior evidence for the selected cycle
			And no X12 834 artifact is generated
			And the run finishes in "AWAITING_RCNA_REVIEW"

		Examples:
			| column_count |
			| 76           |
			| 78           |

	Scenario: Reject an uploaded RCNA with an invalid field count
		Given the user uploads an RCNA row that does not contain 76 or 78 columns
		When RCNA import is attempted
		Then the run finishes in "ERROR"
		And a sanitized validation error is recorded
		And no prior evidence is imported

	Scenario: Generate an 834 later from an imported RCNA
		Given an "RCNA_IMPORT" run is in "AWAITING_RCNA_REVIEW"
		And 834 generation is enabled with approved mappings
		When the user selects "Generate 834"
		Then the stored uploaded RCNA is converted to a valid X12 834
		And the 834 artifact is staged for download
		And the run finishes with stage "834_GENERATED"

	Scenario: Deliver an uploaded 834 to outbound SFTP
		Given the user selects "Upload 834 to outbound SFTP"
		And the file begins with an ISA envelope
		And the file contains an ST transaction with implementation code "834"
		When the upload is processed
		Then a run with operation "834_TO_SFTP" is created
		And the uploaded 834 is staged as its input artifact
		And the file is uploaded to a temporary remote name
		And the file is atomically renamed into the configured outbound SFTP folder
		And the run finishes with stage "834_DELIVERED"

	Scenario Outline: Reject an invalid uploaded 834
		Given the user selects an 834 file that <invalid_condition>
		When delivery is requested
		Then the request is rejected before SFTP delivery
		And no remote outbound file is created

		Examples:
			| invalid_condition                         |
			| does not begin with an ISA envelope       |
			| does not contain an ST transaction for 834 |

	Scenario: Record a failed direct-upload operation
		Given a direct RCNA or 834 upload run has been created
		When Blob staging fails
		Then the run transitions from "AWAITING_UPLOAD" to "ERROR"
		And the run does not remain orphaned in "AWAITING_UPLOAD"
		And a sanitized upload-stage error is recorded

	Scenario: Enforce ad hoc run ownership
		Given an ad hoc RCNO-to-RCNA run is owned by another user
		When the current user requests 834 generation for that run
		Then the request is rejected
		And the run and artifacts are unchanged

	Scenario: Deny RCNOA operations to an unauthorized user
		Given a user does not have the RCNOA processing-management permission
		When the user requests RCNA conversion, 834 generation, or SFTP delivery
		Then the API returns "403 Forbidden"
		And no run, artifact, or remote file is created

	Scenario: Configure the MDW unique-SSN batch size
		Given the user opens the RCNOA query configuration page
		When the user saves "MDW SSNs per query" as 125
		Then the value 125 is stored in the versioned MongoDB query configuration
		And each MDW lookup contains no more than 125 unique SSNs
		And duplicate RCNO SSNs do not consume additional positions in a batch

	Scenario Outline: Reject an invalid MDW SSN batch size
		Given the user enters <batch_size> for "MDW SSNs per query"
		When the user saves the query configuration
		Then validation rejects the configuration
		And the prior MongoDB query configuration remains active

		Examples:
			| batch_size |
			| 0          |
			| 1.5        |
			| 5001       |

	Scenario: Hydrate the default batch size for existing configuration
		Given an existing MongoDB query configuration has no "mdwSsnBatchSize" field
		When the configuration is loaded
		Then "MDW SSNs per query" defaults to 300
		And the existing EPDS and MDW SQL values are preserved

	Scenario: Preserve auditable lifecycle timestamps
		Given a run has paused in "AWAITING_RCNA_REVIEW"
		When the run transitions back to "PROCESSING" for 834 generation
		Then its previous completion timestamp is cleared
		And a new completion timestamp is recorded when the operation reaches a terminal status
```

## Technical Notes

- All new API operations use the existing team permission guard and fixed RCNOA scope validation.
- Blob payloads remain outside MongoDB; MongoDB stores run and artifact metadata.
- RCNA parsing rejects null bytes and field widths other than 76 or 78.
- Uploaded 834 validation derives the X12 element separator from the ISA segment.
- Scheduled processing archives inbound RCNO after RCNA staging and before entering the review state.
- Existing MongoDB query configurations are hydrated with the default MDW batch size at read time for backward compatibility.

## Out of Scope

- Automatically delivering an 834 generated from a reviewed RCNA.
- Automatically generating an 834 during RCNO intake.
- Defining or implementing the pending backup strategy; that requires the business-provided strategy.
- Adding the MDW batch-size setting to KP Config or `configActions`.

## Definition of Done

- The protected admin page exposes the review, conversion, and delivery controls described above.
- API routes enforce permission, fixed team/assistant scope, file validation, and run ownership where applicable.
- Run history displays operation and review status and retains artifact/audit associations.
- MDW lookup batching uses the configured maximum number of unique SSNs.
- RCNOA service tests covering parsing, readiness, conversion, and query batching pass.
- Operational documentation reflects the explicit RCNA review and 834 initiation workflow.