# Jira User Story: Edit and Validate an EFS-S Companion Guide

## Story Description

**As an** EDI analyst,<br>
**I want** the portal to load a companion-guide CSV as an editable document and validate my changes through EFS-S,<br>
**so that** I can correct companion-guide rules and verify their effect without changing the source CSV outside the portal.

## Business Value

- Reduces the time required to investigate and correct companion-guide validation rules.
- Preserves source-row and rule identity so edits remain traceable to the uploaded guide.
- Uses the same EFS-S validation behavior for edited and unedited guides.
- Prevents the portal from enabling editing against an incomplete or incompatible package contract.

## Acceptance Criteria

- EFS-S advertises `editableCompanionGuide: true` and `editableCompanionGuideSchemaVersion: 1`.
- The public package exports `parseCompanionGuideEditable(companionCsvPath)` and `validateEditableCompanionGuide(document, ediPath, options)`.
- The public package may also parse in-memory CSV content through `parseCompanionGuideEditableText(csvText, { sourceName })`.
- The portal enables companion-guide editing only when both capabilities and both required public functions are available.
- The editable schema version 1 document is JSON serializable and preserves schema, source, row, loop, element, option, and diagnostic identity.
- Validation rejects an invalid editable document with `error.type` set to `invalid-editable-companion-guide`.
- Structured errors are exposed through `error.details.diagnostics` using JavaScript property names, including `rowId`, `sourceRow`, and `sourceValue`.
- Diagnostic `field` values use JavaScript names, including `loopId`, `schemaVersion`, `segmentRef`, and `segmentRequirement`.
- The portal consumes structured diagnostics and does not parse error message text or translate Clojure-style field names.
- Validating an unedited editable document produces results equivalent to validating its source CSV through `parseEnrichValidate` with the same EDI file and options.
- A valid rule correction in the editable document changes the validation result as defined by the corrected rule.
- Editable validation preserves existing lookup-spec defaults, database validation, findings, subscriber statuses, progress reporting, and streaming options.
- The EFS-S build output is restaged as one coherent artifact, including `index.js`, `package.json`, `cljs/`, `save/`, and `reference/`.
- Package documentation defines feature detection, schema version 1, public APIs, typed diagnostics, and CSV-path parity.

## Gherkin Specification

```gherkin
Feature: Edit and validate an EFS-S companion guide
  As an EDI analyst
  I want to edit companion-guide rules in the portal
  So that I can validate corrections without modifying the source CSV externally

  Scenario: Enable editing when the complete EFS-S contract is available
    Given the EFS-S package advertises editable companion-guide support
    And the advertised editable companion-guide schema version is 1
    And "parseCompanionGuideEditable" is a public function
    And "validateEditableCompanionGuide" is a public function
    When the portal checks for editable companion-guide support
    Then the portal enables the companion-guide editor

  Scenario Outline: Keep editing disabled when the EFS-S contract is incomplete
    Given <missing contract condition>
    When the portal checks for editable companion-guide support
    Then the portal keeps the companion-guide editor disabled
    And the existing CSV validation workflow remains available

    Examples:
      | missing contract condition                                      |
      | editable companion-guide support is not true                    |
      | the editable companion-guide schema version is not 1            |
      | "parseCompanionGuideEditable" is not a public function         |
      | "validateEditableCompanionGuide" is not a public function      |

  Scenario: Parse a companion-guide CSV into an editable document
    Given a valid companion-guide CSV file
    When the caller invokes "parseCompanionGuideEditable"
    Then EFS-S returns an editable document with schema version 1
    And the document identifies its CSV source
    And the document contains its columns, legend entries, loops, elements, options, and diagnostics
    And source rows and stable row and loop identifiers are retained

  Scenario: Preserve editable document identity through JSON serialization
    Given a schema version 1 editable companion-guide document
    When the document is serialized to JSON and deserialized
    Then its schema version and source identity are unchanged
    And its row and loop identifiers are unchanged
    And its source-row references are unchanged
    And its element options and diagnostics are unchanged

  Scenario: Reject an invalid editable document with structured diagnostics
    Given an editable companion-guide document containing an invalid field
    When the caller invokes "validateEditableCompanionGuide"
    Then EFS-S throws an error with type "invalid-editable-companion-guide"
    And the error contains structured diagnostics in "error.details.diagnostics"
    And diagnostic properties use "rowId", "sourceRow", and "sourceValue"
    And diagnostic field names use JavaScript camelCase
    And the caller does not need to parse the error message

  Scenario: Preserve validation parity for an unedited document
    Given a companion-guide CSV and an EDI file
    And the CSV has been parsed into an editable document without changes
    When the CSV is validated through "parseEnrichValidate"
    And the editable document is validated through "validateEditableCompanionGuide" with equivalent options
    Then both results have equivalent validation counts and findings
    And both results have equivalent subscriber statuses
    And both executions have equivalent progress, lookup-default, and streaming behavior

  Scenario: Apply a valid companion-guide correction
    Given an editable companion-guide document with a known rule defect
    And an EDI file that fails because of that defect
    When the analyst corrects the rule in the editable document
    And validates the corrected document
    Then EFS-S applies the corrected rule
    And the affected validation finding changes as expected
    And unchanged rules continue to produce the same results

  Scenario: Preserve database validation and execution options
    Given a valid editable companion-guide document
    And database validation and supported execution options are configured
    When the caller invokes "validateEditableCompanionGuide"
    Then EFS-S applies the same lookup-spec defaults as "parseEnrichValidate"
    And database validation behavior is preserved
    And findings, subscriber statuses, progress reporting, and streaming output are preserved

  Scenario: Restage a coherent EFS-S package artifact
    Given EFS-S has been built using its established build process
    When the generated npm library is restaged in the portal
    Then "index.js", "package.json", "cljs", "save", and "reference" come from the same build
    And the package wrapper is not combined with older compiled output
    And the complete editable companion-guide feature check returns true
```

## Technical Contract

The portal must use this complete feature check before enabling editing:

```js
const supportsEditableGuide =
  efs.capabilities?.editableCompanionGuide === true &&
  efs.capabilities?.editableCompanionGuideSchemaVersion === 1 &&
  typeof efs.parseCompanionGuideEditable === "function" &&
  typeof efs.validateEditableCompanionGuide === "function";
```

The portal must consume `app/services/efss/npm-lib` as generated by the EFS-S repository. Generated ClojureScript, the package wrapper, and package documentation must not be patched independently in the portal.