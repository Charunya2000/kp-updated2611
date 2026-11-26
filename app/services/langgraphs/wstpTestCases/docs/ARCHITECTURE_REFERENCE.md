# Multi-Call Workflow Architecture

## Execution Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Input State                                 │
│  - messages (consolidated document string)                      │
│  - systemMessage (test case generation instructions)            │
│  - nuid, teamName, etc.                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         ┌──────────────────────────────┐
         │   PHASE 1: Parse Sections    │
         ├──────────────────────────────┤
         │ API Call #1                  │
         │ - System: DOCUMENT_SECTION   │
         │   _SYSTEM_MESSAGE            │
         │ - User: state.messages       │
         │ - Returns: JSON array        │
         │   of sections with:          │
         │   * start_index              │
         │   * end_index                │
         │   * short_topic              │
         │   * test_case_suggestions    │
         └────────────┬─────────────────┘
                      │
                      ▼
         ┌──────────────────────────────┐
         │  PHASE 2: Process Sections   │
         ├──────────────────────────────┤
         │ For each section in array:   │
         │  ├─ Extract content slice    │
         │  ├─ API Call #2..N           │
         │  │  - System: system         │
         │  │    Message (TC gen)       │
         │  │  - User: Focused prompt   │
         │  │    with section content   │
         │  ├─ Parse response (JSON)    │
         │  ├─ Normalize test cases     │
         │  └─ Accumulate results       │
         └────────────┬─────────────────┘
                      │
                      ▼
         ┌──────────────────────────────┐
         │ Output: All Test Cases       │
         ├──────────────────────────────┤
         │ Returns: { testCases: [...] }│
         │ - Already normalized         │
         │ - Ready for saving           │
         └──────────────────────────────┘
```

## Data Flow Through Graph

```
systemMessagesNode
        │
        ▼
retrieveWorkflowNotesNode
        │
        ▼
getSourcesNode
        │
        ▼
vectorizeOriginalPromptNode
        │
        ▼
processUploadedDocument2Node
        │
        ▼
retrieveSavedNoteNode
        │
        ▼
processWebsiteURLsNode
        │
        ▼
processSavedResponseSearchResults
        │
        ▼
processSharePointFilesNode
        │
        ▼
processJiraIssuesNode
        │
        ▼
designIndexNode
        │
        ▼
createMessagesNode ────────────────► state.messages = consolidated string
        │                                 ▲
        │                                 │
        ▼                                 │
chatCompletionNode ◄─────────────────────┘
│
├─ Phase 1: Parse sections (API Call #1)
│  └─ Returns: Array of section objects
│
├─ Phase 2: For each section (API Calls #2..N)
│  ├─ Extract section content
│  ├─ Generate test cases
│  └─ Parse and normalize
│
└─ Returns: { testCases: [...] }
        │
        ▼
saveTemplateToBlobStorageNode
        │
        ▼
      END
```

## Code Flow: Single Section Processing

```javascript
// Input from Phase 1:
const section = {
  start_index: 1000,
  end_index: 3000,
  short_topic: "Authentication Flow",
  test_case_suggestions: "Login scenarios, error handling"
};

// Step 1: Extract content
const sectionContent = state.messages.substring(1000, 3000);
// Result: "User logs in with valid credentials..."

// Step 2: Build focused prompt
const userMessage = `
Topic: Authentication Flow
Test Case Suggestions: Login scenarios, error handling

Document Section:
${sectionContent}
`;

// Step 3: API Call
const response = await makeChatCompletionCall(
  state.systemMessage,  // Test case generation instructions
  userMessage,
  4000  // max tokens
);

// Step 4: Parse Response
const testCases = parseAndNormalizeTestCases(response, state, sectionIndex);
// Result: Array of normalized test case objects

// Step 5: Accumulate
allTestCases.push(...testCases);
```

## Error Handling Flow

```
Phase 1: Parse Sections
├─ ✅ Success → Continue to Phase 2
└─ ❌ Failure → Return: { testCases: [], error: "..." }

Phase 2: For Each Section
├─ ✅ Success → Add to allTestCases
├─ ❌ Parse Error → Log warning, continue next section
├─ ❌ Index Error → Log warning, skip section
└─ ❌ API Error → Log warning, continue next section

Final Check:
├─ ✅ testCases.length > 0 → Return testCases
└─ ❌ testCases.length === 0 → Return error: "No test cases generated"
```

## Performance Profile

### Estimated Metrics

| Metric | Value |
|--------|-------|
| **Phase 1 Duration** | ~2-3 seconds (section parsing) |
| **Phase 2 Duration** | ~3-5 sec/section (depends on section size) |
| **Total Calls** | N + 1 (where N = # sections) |
| **Typical Section Count** | 5-10 |
| **Typical Total Duration** | 20-60 seconds (for 5-10 sections) |
| **Test Cases Generated** | 5-10 per section (50-100 total) |
| **Token Usage** | ~1K-2K per section call |

### Memory Impact
- ✅ Lower per-call memory (focused section vs. full document)
- ⚠️ Accumulation: All test cases held in memory (50-100 objects)
- 💾 Estimated: ~2-5MB for typical run

---

**Reference:** Implementation dates December 19, 2025
