# Generate2 Test Case Generation Process (Current Implementation)

This document describes the **current** end-to-end behavior of the alternate test case generation flow started by:

- `POST /api/[teamName]/[assistantName]/smartNote/[smartNoteId]/testCase/generate2`

## 1. Entry Point and Async Kickoff

1. API route receives `teamName`, `assistantName`, `smartNoteId`, and request body `{ prompt }`.
2. Request body can optionally include runtime direction overrides:
   - `llmDirections.sectioningDirections`
   - `llmDirections.categoryAnalysisDirections`
3. Route resolves current session and reads `nuid`.
4. Route calls `initializeGenerationProgress({ nuid, smartNoteId, prompt, teamName, assistantName, llmDirections })`.
5. `initializeGenerationProgress` creates a UUID `testCaseGenerationProgressId` and starts `generateTestCases2(...)` **without awaiting it**.
6. Route returns immediately with:
   - `success: true`
   - `testCaseGenerationProgressId`

This means generation runs in the background while the client polls progress.

## 2. Graph Pipeline (High-Level)

`generateTestCases2` runs a linear LangGraph pipeline:

1. `systemMessagesNode`
2. `retrieveWorkflowNotesNode`
3. `getSourcesNode`
4. `vectorizeOriginalPromptNode`
5. `processUploadedDocument2Node`
6. `retrieveSavedNoteNode`
7. `processWebsiteURLsNode`
8. `processSavedResponseSearchResults`
9. `processSharePointFilesNode`
10. `processJiraIssuesNode`
11. `designIndexNode`
12. `createMessagesNode`
13. `chatCompletionNode`
14. `saveTemplateToBlobStorageNode`
15. `completeProgressNode`

## 3. Source Context Gathering

The workflow gathers source material selected for the smart note and filters content to only sources present in `actualSources`.

### Source categories currently pulled

- Uploaded documents (`smartnote-file-002` index)
- Saved notes
- Website URLs (`smartnote-001` index)
- Saved responses (`smartnote-001` index)
- SharePoint files (`sharepoint-uploads` index)
- Jira issues (`smartnote-001` index)
- Design indexes (dynamic index config/template)
- Workflow notes (user-authored instructions)

The user prompt is vectorized first, and that embedding is used for semantic retrieval from vector indexes.

## 4. Message Assembly for LLM Input

`createMessagesNode` concatenates the gathered context into a single large `messages` string in this order:

1. Saved notes
2. Uploaded document content
3. Design index content
4. Website URL content
5. Saved response content
6. SharePoint file content
7. Jira issue content
8. `Workflow Instructions: ...` (workflow notes JSON)

## 5. Two-Phase LLM Generation (Core Logic)

`chatCompletionNode` performs the key two-step process.

### Phase 1: Section Parsing

- Uses resolved sectioning directions in this order:
   1. `llmDirections.sectioningDirections` (if provided)
   2. built-in default sectioning directions
- Sends full combined `messages` text to the model.
- Expects JSON array of sections with:
  - `start_index`
  - `end_index`
  - `short_topic`
  - `test_case_suggestions`

If section JSON parsing fails or no sections are found, generation returns an error.

### Phase 2: Per-Section Test Case Generation

For each section:

1. Validate section bounds against `messages` length.
2. Slice section content by `[start_index, end_index)`.
3. Build per-section user prompt containing:
   - topic
   - test case suggestions
   - sliced section content
4. Call model again using resolved category-analysis directions built as:
   1. required base schema instructions (`state.systemMessage`, fallback to built-in default)
   2. optional supplemental high-level guidance from `llmDirections.categoryAnalysisDirections`

Important:

- Supplemental category guidance is additive only.
- It is treated as high-level steering (for example, more/fewer test cases or coverage emphasis).
- It does **not** replace required output schema instructions (fields, JSON shape, and steps structure).
5. Parse model output into normalized test case objects.
6. Update per-section progress with test case count.

After all sections:

- Merge all generated test cases.
- Resequence IDs globally to `TC-001`, `TC-002`, ...
- Build generation summary by section and total count.

## 6. Progress Tracking Model

Progress document type: `TestCaseGenerationProgress`

Lifecycle:

1. Created inside `chatCompletionNode` once sections are known (`status: in_progress`).
2. Updated per section via `updateSectionProgress(...)`.
3. Can move to intermediate `status: sectionsCompleted` when all sections processed.
4. Finalized in `completeProgressNode` to `status: completed` with:
   - `finalMessage`
   - `templateDownloadUrl`
5. If unrecoverable error occurs, marked `status: failed`.

Polling endpoint:

- `GET /api/[teamName]/[assistantName]/smartNote/[smartNoteId]/testCase/generate2/progress/[progressId]`
- Returns status, section list, counts, and final download link/message when complete.

## 7. Output Artifact

If test cases exist:

1. Convert test cases to workbook rows (including per-step rows).
2. Upload XLSX to blob container `test-case-spreadsheets`.
3. Generate temporary download link (48 hours).
4. Return human-readable completion message plus section summary.

If no test cases are produced, spreadsheet creation is skipped.

## 8. Notable Current Behaviors

- Kickoff route does not wait for generation completion; it only returns a progress ID.
- Actual progress document initialization happens after section parsing (inside `chatCompletionNode`), not at route entry.
- Workflow notes are appended as plain text instructions at the end of combined messages.
- Sectioning and generation both depend on model returning parseable JSON/structured output; fallback parsing exists for non-JSON test case responses.

## 9. Main Files Involved

- `app/api/[teamName]/[assistantName]/smartNote/[smartNoteId]/testCase/generate2/route.js`
- `app/api/[teamName]/[assistantName]/smartNote/[smartNoteId]/testCase/generate2/progress/[progressId]/route.js`
- `app/services/langgraphs/wstpTestCases/testCaseGenerationService.js`
- `app/services/langgraphs/wstpTestCases/nodes/chatCompletionNode.js`
- `app/services/langgraphs/wstpTestCases/nodes/createMessagesNode.js`
- `app/services/langgraphs/wstpTestCases/nodes/saveTemplateToBlobStorageNode.js`
- `app/services/langgraphs/wstpTestCases/nodes/completeProgressNode.js`
- `app/services/testCaseService.js`
