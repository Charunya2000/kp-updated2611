'use server';


import { chatCompletion } from "@/app/services/chatCompletionService2.js";

import { connectToDatabase } from '@/db/connection';
import {
  writeFileBufferToBlobStorage,
  generateTemporaryDownloadLink,
  getBlockBlobClient,
  downloadBlobText
} from '@/app/services/blobStorageService';
let analyticsTemplate = ''


async function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}




// CONVERSATION HISTORY — stores complete conversation per session
// ═══════════════════════════════════════════════════════════════════

async function saveConversationToHistory(sessionId, nuid, userPrompt, assistantContent, intentType, metadata) {
  try {
    if (!sessionId) {
      console.warn('[saveConversationToHistory] No sessionId provided — skipping save');
      return;
    }

    const db = await connectToDatabase('team-nps-db');
    const collection = db.collection('NPS_CHAT_HISTORY');

    const turnDoc = {
      role_user: userPrompt || '',
      role_assistant: assistantContent || '',
      intentType: intentType || 'unknown',
      timestamp: new Date(),
      metadata: {
        subType: metadata?.subType || null,
        dateRange: metadata?.dateRange || null,
        recordCount: metadata?.recordCount || 0,
        slaComplianceRate: metadata?.slaComplianceRate || null,
        tokensUsed: metadata?.tokensUsed || null,
      }
    };

    // Upsert: find existing session doc, push new turn to conversation array
    await collection.updateOne(
      { sessionId, type: 'chat_session' },
      {
        $set: {
          sessionId,
          type: 'chat_session',
          nuid: nuid || 'unknown',
          updatedAt: new Date(),
          lastIntentType: intentType || 'unknown',
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
        $push: {
          conversation: turnDoc
        }
      },
      { upsert: true }
    );

    console.log(`[saveConversationToHistory] Saved turn for session ${sessionId}`);
  } catch (error) {
    console.error('[saveConversationToHistory] Error saving conversation:', error.message);
    // Non-blocking — don't fail the main flow
  }
}

/**
 * Retrieve conversation history for a session to provide context
 */
async function getConversationHistory(sessionId, maxTurns = 5) {
  try {
    if (!sessionId) return [];

    const db = await connectToDatabase('team-nps-db');
    const collection = db.collection('NPS_CHAT_HISTORY');

    const sessionDoc = await collection.findOne(
      { sessionId, type: 'chat_session' },
      { projection: { conversation: { $slice: -maxTurns } } }
    );

    if (!sessionDoc || !sessionDoc.conversation) return [];

    // Convert stored conversation into messages format
    const messages = [];
    sessionDoc.conversation.forEach(turn => {
      if (turn.role_user) {
        messages.push({ role: 'user', content: turn.role_user });
      }
      if (turn.role_assistant) {
        messages.push({ role: 'assistant', content: turn.role_assistant });
      }
    });

    return messages;
  } catch (error) {
    console.error('[getConversationHistory] Error:', error.message);
    return [];
  }
}




/* INCIDENT / VECTOR CONTEXT FORMATTER */
function formatSearchContext(searchResults, state) {
  if (!searchResults?.items || searchResults.items.length === 0) return '';
  //Aggregate Metric & Group By Analysis
  if (searchResults.items.length === 1 && searchResults.items[0]?.filter != '') return ` For the Filter Applied: ${searchResults.items[0].filter}, We Got below information :${JSON.stringify(searchResults.items[0].records)}`

  //Group By Analysis
  if (state.analyticsContext?.lastTool == 'groupByAnalysis') {
    analyticsTemplate = `You are a senior incident analytics expert responsible for FINAL METRICS
and PRESENTATION of incident data.

You are given records pulled from MongoDB.
Each record is already CONSOLIDATED and represents exactly ONE unique
(category + error_type) combination.

Each record contains:
- error_type (canonical)
- category (canonical)
- occurrence_count
- summaries (one or more summarized descriptions)
- incident_ids (list of incident numbers)

IMPORTANT:
- You MUST NOT reclassify incidents.
- You MUST NOT split or merge categories.
- You MUST NOT move incidents across categories.
- MongoDB is the source of truth.

Your responsibilities are LIMITED to:
1. Calculating percentages
2. Ranking by occurrence_count
3. Formatting final output for reporting

STRICT RULES:

1. Taxonomy integrity
   - Use error_type and category EXACTLY as provided.
   - Do NOT normalize, rename, merge, or infer new categories.
   - Treat MongoDB records as authoritative.

2. Occurrence handling
   - occurrence_count MUST be used AS-IS from MongoDB.
   - Do NOT recompute counts from incidents.
   - Do NOT drop or duplicate any category.

3. Percentage calculation - 
  - Use the "Percentage Occurence calculation" section provided to populate for each of the error_type. 
    -DO NOT calcualte on your own and use the given values and map them to error_type
   - Format percentage with ONE decimal place (example: 18.6%).
   

4. Ranking
   - Sort categories by occurrence_count in DESCENDING order.

5. Summary section (below the table)
   - For EACH row in the table, display:
     - Category
     - Error Type
     - A concise combined summary
     - Associated incident IDs
   - Summaries must be descriptive only.
   - Do NOT include RCA, resolutions, recommendations, or speculation.

6. Output format (MANDATORY)
   - Return output in Structured Table
   - First: a single table with columns:
       | Category | Error Type | Occurrence | Percentage |
   - Second: a section titled:
       ## Category Summaries
     listing summaries grouped by Category + Error Type.

7. Output constraints
   - Do NOT return JSON.
   - Do NOT include explanations, notes, or analysis.
   - Do NOT omit any MongoDB record.
   - Do NOT introduce new fields.

The output must be deterministic.

MANDATORY OUTPUT FORMAT (CRITICAL):
Render output using GitHub‑compatible Markdown only.
• Use tables for structured data
• Insert section headers (###) between logical groups
• Use HTML, CSS, or inline styles
• Prefer monospace blocks when column alignment is critical

Output Template:

| Category                            | Error Type                        | Occurrence | Percentage |
|------------------------------------ |-----------------------------------|------------|------------|
| Rating / Methodology / Factor Error | Business Logic (Rating/Reporting) | 42         | 31.6%      |
| Batch/Job Failure                   | Platform/Integration & Processing | 28         | 21.1%      |
| UI / Access / Tool Error            | Access & User Experience          | 19         | 14.3%      |

## Category Summaries

### Rating / Methodology / Factor Error  
**Error Type:** Business Logic (Rating/Reporting)  
**Summary:** Rating failures caused by model version gaps, unpriced benefits,
missing subgroups, or invalid rating inputs leading to incorrect or missing rates.

### Batch/Job Failure  
**Error Type:** Platform/Integration & Processing  
**Summary:** Failures in scheduled or on-demand batch jobs resulting in
incomplete or delayed data processing.`
    //let res=searchResults.items
    // let path=searchResults.items.map((item,index)=>{
    // return `Records: ${JSON.stringify(item)}`


    // })

    let recordsText = searchResults.items.map((record, index) => {
      const fields = Object.entries(record).map(([key, value]) => `${key}: ${value}`).join('\n');
      return `Category ${index + 1}:\n${fields}`;
    }).join('\n\n');
    let recordCount = 0
    let records = searchResults.items.map((record, index) => {
      recordCount += record.occurrence_count
      return `${recordCount}`;
    });
    let percentage = 0
    let percentSplitup = searchResults.items.map((record, index) => {

      return `\n${index} ${record.error_type} :${((record.occurrence_count / recordCount) * 100).toFixed(2)}%`;
    }).join('\n');
    //let userContent=JSON.stringify(searchResults.items)
    return recordsText + '\nPercentage Occurence calculation:\n' + percentSplitup + "\n"
  }

  //Hybrid Search
  else {
    return searchResults.items.slice(0, 10).map((item, index) => {
      const doc = item.document || {};
      //  return `### Incident ${index + 1}\nIncident Number: ${doc.number || 'N/A'}\nShort Description: ${doc.short_description || 'N/A'}\nState: ${doc.state || 'N/A'}\nPriority: ${doc.priority || 'N/A'}\nDetails:\n${doc.content || doc.notes || 'No details available'}`;

      return `### Incident ${index + 1}\nIncident Number: ${doc.number || 'N/A'}\nShort Description: ${doc.short_description || 'N/A'}\nState: ${doc.state || 'N/A'}\nPriority: ${doc.priority || 'N/A'}\nDetails:\n${doc.content || doc.notes || 'No details available'}`;
    }).join('\n\n');
  }
}

function foramtSNOWGetData(records) {
  if (records.length === 0) return '';
  const msg =
    `Here is/are Ticket/Tickets opened with New/InProgress status
${JSON.stringify(records)}
   `
  return msg
}
const rcaTemplate = `
Key Findings:
- Summarize only high‑level insights and notable patterns derived from the database results.Do NOT include raw records, full arrays, or detailed row‑level data.
- Use Issue Reported if present.
- No interpretation.

Possible Root Cause (Conditional):
- Use RCA / RootCause from the database summary results or from the summary
If not present:“Root cause cannot be determined from the database summary.”

Resolution Observed / Resolution Needed (Conditional):
- Use only Work Notes or Resolution / ResolutionNotes from the database summary.
- Verbatim or tightly paraphrased.
- Omit if absent.

Suggested Next Steps (Conditional):
- Include only if explicitly stated in the database summary.
- Evidence‑based only.
- No new actions.`
/* DATABASE CONTEXT FORMATTER */
function formatDatabaseContext(state, metadata) {
  if (!metadata?.recordFound || !metadata?.records) return '';
  const records = Array.isArray(metadata.records) ? metadata.records : [metadata.records];
  const ratingErrorTemplate = ` 
Purpose:
You are an issue analysis engine that analyzes database diagnostic data AND Splunk log data
and produces strictly formatted, rule-driven outputs.

You must NOT assume, fabricate, infer, or collapse records.
All outputs must be based only on the data provided.

IMPORTANT CLARIFICATION:
- “No summarization” applies to DETAILED ANALYSIS sections and tables.
- High-level summarization is permitted ONLY in the Key Findings / Summary section,
  following the Summary Rules defined below.

Tool Context: Tool Used: investigateSystemErrorIssue
Role: You are a deterministic extraction and comparison engine.

CRITICAL DATABASE LOOKUP RULE (MANDATORY):

  - User input may provide an RQR ID or Instruction Set ID.
  - RQR / Instruction Set ID is NOT the failure unit.
  - Quote ID is the ONLY failure and analysis unit.
  - Generally Quote ID is extracted using the given RQR/Instruciton Set ID and have direct relation.

  MANDATORY BEHAVIOR:
  1. You MUST first query the provided RQR / base Instruction Set ID from Database to one or more Quote IDs using Database Summary data.
  2. You MUST analyze issues at the Quote level ONLY.
  3. You MUST NOT stop analysis because the RQR ID itself is not directly present in the Database Summary.

  IF Quote IDs are extracted: 
  - Even if one QUOTE ID is provided, use them to analyze
  - You MUST analyze EACH Quote ID.
  - You MUST produce the full table and analysis for ALL Quotes.

  IF Quote IDs cannot be determined from Database Summary:
  - Output EXACTLY:
      "RQR <RQR_ID> was processed, but no associated Quote IDs were found in the database summary. Quote-level analysis cannot be performed."

  PROHIBITED:
  - Generic responses such as:
    "No data available for RQR"
    "Please provide additional context"
    "Unable to determine due to missing data"

Input Contract (STRICT):
- You will ALWAYS be provided:
  1) Database Summary (structured data)
  2) Splunk Summary (structured log data)
- Both inputs may contain multiple records.
- EACH record MUST be processed independently.
- Database and Splunk data MUST be evaluated together per record.

❗ CRITICAL NON‑SKIP RULE ❗
- You MUST NOT ignore Database Summary if Splunk data exists.
- You MUST NOT ignore Splunk Summary if Database data exists.
- You MUST NOT collapse multiple records into a single output.
- You MUST NOT output partial tables.
- ONLY omit a section IF AND ONLY IF the corresponding data for THAT RECORD is completely blank.
- You MUST NOT ignore any Quote data

────────────────────────────────
DATABASE SUMMARY ANALYSIS RULES
(Never skip any of the below)
────────────────────────────────

  ${rcaTemplate}

Summary Rules (MANDATORY):

  Use the database results for each Quote ID to derive high-level findings only.
  Do NOT reproduce raw database records, arrays, or row-level details.

  If mismatches exist:
      - FIRST, output a concise 1–2 line summary explicitly listing the Quote IDs that failed.
      - Clearly state the type of mismatch (Model Version and/or BOB ID).
      - Then, list only the affected Quote IDs with a short, single-line reason per Quote.
      - Do NOT include full database field values or detailed comparisons.

      Example:
      For RQR_ID 16018369, mismatches were identified for Quote IDs 32090986 and 32090987 due to Model Version and/or BOB ID differences.
      Refer to the detailed breakdown below.

      Quote ID 32090942: Model Version or BOB ID mismatch
      Quote ID 32090943: Model Version or BOB ID mismatch

  If no mismatches exist:
    Explicitly state: "All Quote IDs match the expected values."


────────────────────────────────
STRICT OUTPUT CONTRACT
────────────────────────────────
- Output ONLY the sections listed below.
- Use BOTH Database Summary AND Splunk Summary.
- NEVER prefer one source over the other.
- NEVER suppress one source if the other is present.
- Omit Conditional sections ONLY when data is absent for THAT RECORD.
- Use fallback text EXACTLY as written.

────────────────────────────────
DETAILED OUTPUT RULES (MANDATORY)
────────────────────────────────

TABLE EXPANSION RULE (CRITICAL):
- You MUST generate the table using ALL records provided.
- If there are N records, the table MUST contain Record 1 through Record N.
- EVEN IF records are fully matching, they MUST still appear.
- Missing values = blank cell ONLY.
- Skipping records is a HARD FAILURE.


Render output using GitHub‑compatible Markdown only.
• Use tables for structured data
• Insert section headers (###) between logical groups
• Use horizontal rules (---) to simulate spacing
• Do not use HTML, CSS, or inline styles
• Prefer monospace blocks when column alignment is critical

❗ CRITICAL NON‑SKIP RULE OUTPUT FORMAT ❗ Output the table EXACTLY in the following structure:
Below table should be coming after Possible RootCause

| Field Name | Record 1 | Record 2 |
|-----------|----------|----------|
| quoteId | 32090941 | 32090942 |
| modelVersionBobId | 202215 | 202215 |
| planCategoryCode | SR ADV GRP HMO NCR | SR ADV GRP HMO NCR |
| productCode | 110 | 110 |
| productCategoryCode | 20 | 20 |
| groupId | 729938 | 729939 |
| processingDate | 2023-05-24 | 2023-05-25 |
| ratingRegionCode | NC | NC |
| effDateFrom | 2024-01-01 | 2024-01-01 |
| effDateTo | 2024-12-31 | 2024-12-31 |
| marketSegmentCode | 145 | 145 |
| localCommEligibleNum | 166 | 170 |
| calculatedModelVersionId | 14471 | 14471 |
| actualModelVersionId | 14471 | 14471 |
| modelVersionMatch | false | true |
| calculatedBobId | 110 | 110 |
| actualBobId | 110 | 110 |
| bobIdMatch | true | false |

CRITICAL RULE FORMAT: 
  If record count exceeds 4:
  • Split output into multiple GitHub‑compatible tables
  • Each table must contain at most 4 records (columns)
  • Repeat Field Name column in every table
  • Insert section headers indicating record ranges
  • Do not use HTML or styling

Populate ALL fields for ALL records.

MATCH / MISMATCH RULES:
- If true → replace value with **✅ MATCH**
- If false → replace value with **⚠️ MISMATCH**
- quoteId MUST always be bolded
- Existing and Expected ModelVersionID / BOBID MUST be bolded

Visual Indicators (STRICT):
- ✅ MATCH → bolded
- ⚠️ MISMATCH or MISSING → bolded
- Do NOT mix symbols.
`

  const adminPerfLogTemplate = `Purpose:
  You are an issue analysis engine that analyzes database diagnostic data AND splunk log data and produces strictly formatted, rule‑driven outputs.
You must not assume, fabricate, infer, summarize selectively, or collapse records.
All outputs must be based only on the data provided.

Tool Context:
Tool Used: investigateAdminPeformanceRatingIssue
Role: You are a deterministic extraction and comparison engine.

────────────────────────────────
RULE PRECEDENCE (MANDATORY)
────────────────────────────────

In case of conflict, rules must be applied in the following order:

1. Quote ID Non‑Skip Rules
2. Status Normalization Rules (MATCH vs MISMATCH)
3. Output Structure Rules
4. Large Dataset Rules
5. Visual Indicator Rules

Lower‑priority rules MUST NOT override higher‑priority rules.

────────────────────────────────
MANDATORY CLASSIFICATION PHASE
────────────────────────────────

Before generating summaries or tables:

- You MUST classify EVERY Quote ID as exactly one of:
  - ✅ MATCH
  - ⚠️ MISMATCH

This classification is REQUIRED even if:
- No issues are found
- Only one RCM exists
- No edit actions are present


IMPORTANT CLARIFICATION:
- “Omitting a section” applies ONLY to optional narrative sections.
- Tabular Quote rendering MUST ALWAYS occur for every Quote ID.
- A Quote with blank fields MUST still appear as a column with blank cells.


SUMMARY COMPLETENESS RULE:
- The total count of Quote IDs listed in the summary MUST equal
  the total Quote IDs rendered in tables.
- Any mismatch is a HARD FAILURE.

────────────────────────────────────────
CRITICAL DATABASE LOOKUP RULE (MANDATORY)
────────────────────────────────────────

- User input may provide an RQR ID or Instruction Set ID.
- RQR / Instruction Set ID is NOT the failure unit.
- Quote ID is the ONLY failure and analysis unit.

MANDATORY BEHAVIOR:
1. You MUST first query the provided RQR / base Instruction Set ID to get one or more Quote IDs using Database Summary data.
2. You MUST analyze issues at the Quote level ONLY.
3. You MUST NOT stop analysis because the RQR ID itself is not directly present in the Database Summary.

IF Quote IDs are extracted:
- Even if one Quote ID is provided, use it.
- You MUST analyze EACH Quote ID independently.
- You MUST produce output for ALL Quote IDs, regardless of whether they MATCH or MISMATCH.


PROHIBITED:
- Generic responses
- Partial analysis
- Skipping MATCH quotes

────────────────────────────────
INPUT CONTRACT (STRICT)
────────────────────────────────

You will ALWAYS be provided:
1) Database Summary (structured)
2) Splunk Summary (structured)

Rules:
- Each record MUST be processed independently.
- Database and Splunk data MUST be evaluated together per Quote ID.
- Presence of one does NOT allow skipping the other.

❗ CRITICAL NON‑SKIP RULE ❗
- DO NOT SKIP any Quote ID.
- DO NOT OMIT MATCHING records.
- MATCH is a REQUIRED outcome, not an absence of output.
- ONLY omit a section IF AND ONLY IF data for THAT Quote is completely blank.

────────────────────────────────
DATABASE SUMMARY ANALYSIS RULES
────────────────────────────────

${rcaTemplate}

Show Quotes having MATCH and having MISMTACH seperately along with analysis

E.g:
  Quote ID 32090969, 32090970:

    -The quotes have multiple RCM methods found (1,3,7,8,9) except for Quote ID 32090972 which has RCM (1,7,8,9) which is expected.
    -Edit Actions are not performed.
    - Issue reported is not specified for these quotes.
  Quote ID 32090973:

   - RCM Method 1 is found along with tables using this method: rating_summary, rate_summary_benefit_plan.
   - Issue is found with this quote.
   - Edit Actions are present, indicating a potential modification: <<Exact Method Name>> alogn with <<TimeStamp>>
────────────────────────────────
ADMIN LOG INTERPRETATION RULES
────────────────────────────────

- Admin logs may not always contain edit operations.
- A Quote may have only one RATING_CALC_METHOD (e.g., value 1).
- Typical RCM values: 1,3,7,8,9
- Evaluate BOTH flags per Quote:
  - issueFound (RCM inconsistency)
  - editLogsFound (edit actions presence). 
- Do NOT assume edits unless explicitly logged.

────────────────────────────────
DETAILED OUTPUT RULES (MANDATORY)
────────────────────────────────

TABLE EXPANSION RULE (CRITICAL):
- You MUST generate tables using ALL Quote records.
- If N Quotes exist, ALL N must appear.
- MATCH quotes MUST still be rendered.
- Missing values = blank cell ONLY.
- Skipping any Quote is a HARD FAILURE.

────────────────────────────────
STATUS NORMALIZATION RULE (CRITICAL)
────────────────────────────────

You MUST normalize status for EVERY Quote:

- issueFound = false → ✅ MATCH
- issueFound = true  → ⚠️ MISMATCH

This normalization MUST be applied EVEN IF:
- No edits exist
- Only one RCM is present
- All data aligns correctly

MATCH is a REQUIRED, explicit outcome.

────────────────────────────────
OUTPUT FORMAT (STRICT)
────────────────────────────────
Use:
- Tables for structured data
- ### headers between logical sections
- NO HTML or CSS

Below table MUST appear after "Possible Root Cause".

EVERY Quote ID MUST be rendered EXACTLY using this structure:
Quote With MATCH:
| Field Name | Record 1 | Record 2 |
|-----------|----------|----------|
| underwriter | | |
| **quoteId** | **32090973** | **32090974** |
| quoteCreationTimestamp | | |
| methodsFound | | |
| RCMissueFound | **✅ MATCH** | **✅ MATCH**  |
| tableStatus | | |
| tablesWithMethod1 | | |
| editLogsFound | | |
| logs | | |
| issueFound | **✅ MATCH** | **✅ MATCH**  |

Quote with MISMATCH:

| Field Name | Record 1 | Record 2 |
|-----------|----------|----------|
| underwriter | | |
| **quoteId** | **32090973** | **32090974** |
| quoteCreationTimestamp | | |
| methodsFound | | |
| RCMissueFound | **✅ MATCH** | **⚠️ MISMATCH** |
| tableStatus | | |
| tablesWithMethod1 | | |
| editLogsFound | | |
| logs | | |
| issueFound | **✅ MATCH** | **⚠️ MISMATCH** |
────────────────────────────────
LARGE DATASET RULE
────────────────────────────────

If Quote count > 5:
- Split into multiple tables
- Max 5 Quotes per table
- Repeat "Field Name" column
- Add section headers indicating Quote ranges
- Give 3 line spacing between each tables


────────────────────────────────
VISUAL INDICATORS (MANDATORY)
────────────────────────────────

- ✅ MATCH → **bold**
- ⚠️ MISMATCH → **bold**
- quoteId → **bold**

`
  let template = ''
  if (state.analyticsContext?.lastTool == 'investigateSystemErrorIssue') { template = ratingErrorTemplate }
  else if (state.analyticsContext?.lastTool == 'investigateAdminPeformanceRatingIssue') { template = adminPerfLogTemplate }
  const DBContext = `     Purpose:
You are an issue analysis engine that analyzes database diagnostic data and produces strictly formatted, rule‑driven outputs for two distinct issue types. You must not assume, fabricate, or infer any data. All outputs must be based only on the data provided.

Tool Context:
Tool Used: ${state.analyticsContext?.lastTool}

${template}

GLOBAL FORMATTING RULES (STRICT):
- Use ✅ for MATCH or OK and bold them.
- Use ⚠️ for MISMATCH or ISSUE DETECTED and bold them.
- Do not mix symbols within the same status.
- Summary must always appear before details.
- Output must be deterministic, repeatable, and strictly follow this structure.
- Always expand and show
       `

  if (records.length === 0) return '';
  const header = `SQL Query: ${metadata.sqlQuery}\nRecords Found: ${records.length}\nQuery Type: ${metadata.queryType || 'general'}`;
  let recordsText = records.slice(0, 10).map((record, index) => {
    const fields = Object.entries(record).map(([key, value]) => `${key}: ${value}`).join('\n');
    return `Record ${index + 1}:\n${fields}`;
  }).join('\n\n');
  //return header + '\n' +DBContext+'\n'+ recordsText;
  if (state.analyticsContext?.lastTool == 'investigateSystemErrorIssue') { recordsText = "System Rating Analysis Records: " + recordsText }
  else if (state.analyticsContext?.lastTool == 'investigateAdminPeformanceRatingIssue') { recordsText = "Admin PerformanceLog Analysis Records: " + recordsText }
  return [DBContext, recordsText]
}
function formatRpsStatusContext(metadata) {
  if (!metadata?.recordFound) return "No Database records found for this RQR ID.";

  let text = `### Database Summary for RQR_ID: ${metadata.records?.[0].targetId}\n`;
  text += `* **RQR_STATUS_CODE:** ${metadata.records?.[0].statusCode}\n`;
  text += `* **EXTERNAL_RQR_ID:** ${metadata.records?.[0].extRqrId}\n`;
  text += `* **Root Cause Analysis:** ${metadata?.records?.[0].analysis}\n`;

  if (metadata?.records?.[0].auditRecords?.length > 0) {
    text += `\n**Audit Logs Detected:**\n`;
    metadata.records[0].auditRecords.forEach(r => {
      text += `* Type: ${r.INTERFACE_TRANSACTION_TYPE} | Status: ${r.TRANSACTION_STATUS}\n`;
    });
  }

  return text;
}

/* RELEASE MANAGEMENT FORMATTER */
let downloadURL = ''
function formatReleaseContext(metadata) {
  if (!metadata || metadata.error) return `Release Data Error: ${metadata?.error || 'Unknown'}`;

  let text = `### Release Management Summary\n`;

  // ---> FLOW 3: PLAYBACK CHECKLIST FORMATTING <---
  // ---> FLOW 3: PLAYBACK CHECKLIST FORMATTING <---
  if (metadata.type === "PLAYBACK_CHECKLIST") {
    let text = `### Playback Checklist Validation & Excel Generation\n\n`;
    text += `**CHG Number:** ${metadata.chgNumber}\n\n`;

    text += `#### Database SCTASK Mapping:\n`;
    text += `- Implementation: ${metadata.taskIDs?.implementation || 'N/A'}\n`;
    text += `- EPS API Support: ${metadata.taskIDs?.epsApiSupport || 'N/A'}\n`;
    text += `- Functional Validation: ${metadata.taskIDs?.functionalValidation || 'N/A'}\n\n`;

    text += `#### Apps Deployed (Currently):\n`;
    if (metadata.appsData.deployedApps.length === 0) text += `- None found\n`;
    metadata.appsData.deployedApps.forEach(a => text += `- ${a.original}\n`);
    text += `\n`;

    text += `#### New App Versions Requested:\n`;
    if (metadata.appsData.newApps.length === 0) text += `- None found\n`;
    metadata.appsData.newApps.forEach(a => text += `- ${a.original}\n`);
    text += `\n`;

    // 1. ORIGINAL GITHUB VALIDATION FORMAT (Kept exactly as it was previously)
    text += `#### GitHub Validation Results (pom.xml):\n`;
    text += `**Successfully Validated and Added to Excel File:**\n`;
    if (metadata.githubResults.updated.length > 0) {
      metadata.githubResults.updated.forEach(a => text += `- ✅ ${a.repo} (Updated from ${a.oldVersion} to ${a.newVersion})\n`);
    } else {
      text += `- None\n`;
    }

    text += `\n**Skipped / No Version Change:**\n`;
    if (metadata.githubResults.skipped.length > 0) {
      metadata.githubResults.skipped.forEach(a => text += `- ❌ ${a.repo} (${a.reason})\n`);
    } else {
      text += `- None\n`;
    }
    text += `\n`;

    // 2. THE NEW REQUESTED LISTS (Added right after GitHub Validation)
    text += `#### Updated Version As Per github:\n`;
    if (metadata.githubResults.updated.length > 0) {
      metadata.githubResults.updated.forEach(a => text += `- ✅ ${a.repo} (New Version: ${a.newVersion})\n`);
    } else {
      text += `- None\n`;
    }
    text += `\n`;

    text += `#### Apps with the Same version:\n`;
    if (metadata.githubResults.skipped.length > 0) {
      metadata.githubResults.skipped.forEach(a => text += `- ➖ ${a.repo} (Version remains ${a.oldVersion})\n`);
    } else {
      text += `- None\n`;
    }

    // 3. DOWNLOAD LINK
    text += `\n**Download Link:** [Download Generated Deployment Plan Excel](${metadata.excelUrl})\n`;
    return text;
  }

  // ---> FLOW 1: DEPLOYMENT PLAN FORMATTING (UNCHANGED) <---
  if (metadata.type === "DEPLOYMENT_PLAN") {
    text += `**Fix Version:** ${metadata.fixVersion}\n\n`;
    if (!metadata.data || metadata.data.length === 0) return text + `No team tables found.\n`;

    let lastPage = null;

    // 1. LOOP THROUGH TEAMS FOR PR COUNTS AND JIRA STORIES
    metadata.data.forEach((teamData) => {
      if (teamData.pageSource !== lastPage) {
        text += `\n========================================\n`;
        text += `DATA_FOR_CONFLUENCE_PAGE: ${teamData.pageSource}\n`;
        text += `========================================\n\n`;
        lastPage = teamData.pageSource;
      }

      text += `#### Team: ${teamData.team}\n`;

      text += `#### GitHub Pull Requests:\n`;
      if (!teamData.github || teamData.github.length === 0) {
        text += `- No PRs found.\n`;
      } else {
        const approvedCount = teamData.github.filter(pr => pr.isApproved).length;
        const notApprovedCount = teamData.github.filter(pr => !pr.isApproved).length;
        if (approvedCount > 0) text += `- GitHub pull request approved (${approvedCount} PRS TOTAL)\n`;
        if (notApprovedCount > 0) text += `- Not approved (${notApprovedCount} PRS TOTAL)\n`;
      }

      text += `\n#### Jira Stories Included:\n`;
      if (!teamData.jira || teamData.jira.length === 0) {
        text += `- No Jira stories found for this team.\n`;
      } else {
        const accepted = teamData.jira.filter(s => s.status?.toLowerCase() === 'accepted');
        const others = teamData.jira.filter(s => s.status?.toLowerCase() !== 'accepted');

        if (accepted.length > 0) {
          text += `**Accepted Stories:**\n`;
          accepted.forEach(s => text += `- ${s.key} (${s.status}): ${s.summary}\n`);
        }
        if (others.length > 0) {
          text += `\n**Other Statuses:**\n`;
          others.forEach(s => text += `- ${s.key} (${s.status}): ${s.summary}\n`);
        }
      }
    }); // <-- THIS WAS THE MISSING BRACKET THAT CAUSED THE CRASH!

    // 2. LOOP THROUGH AGAIN FOR HIDDEN CONTEXT
    // 2. LOOP THROUGH AGAIN FOR HIDDEN CONTEXT
    text += `\n\n[HIDDEN DATA FOR FUNCTIONALITY COVERAGE]\n`;

    // Calculate total stories across all pages to force the AI to count them
    let totalStories = 0;
    metadata.data.forEach(td => { if (td.jira) totalStories += td.jira.length; });
    text += `CRITICAL INSTRUCTION: You MUST explain ALL ${totalStories} stories below. Do not stop early.\n\n`;

    let lastHiddenPage = null;
    metadata.data.forEach((teamData) => {
      if (teamData.jira && teamData.jira.length > 0) {
        // Group the hidden context by page!
        if (teamData.pageSource !== lastHiddenPage) {
          text += `\n--- STORIES FOR CONFLUENCE PAGE: ${teamData.pageSource} ---\n`;
          lastHiddenPage = teamData.pageSource;
        }

        text += `Team: ${teamData.team}\n`;
        let counter = 1;
        teamData.jira.forEach(s => {
          text += `- [STORY ${counter} OF ${teamData.jira.length}] ${s.key}: ${s.description || s.summary}\n`;
          counter++;
        });
        text += `\n`;
      }
    });

    // 3. EXCEL DOWNLOAD LINK
    if (metadata.excelUrl) {
      text += `\n**Download Link:** [Download Generated Deployment Plan Excel](${metadata.excelUrl})\n`;
    }

    return text;
  }

  return text;
}

/* SPLUNK CONTEXT FORMATTER */
function formatSplunkContext(metadata) {
  if (!metadata?.logs?.length) return '';
  const logsText = metadata.logs.slice(0, 10).map((log, index) => {
    const message = log.message || JSON.stringify(log);
    return `[${index + 1}] ${log.time || 'N/A'} ${message}`;
  }).join('\n');
  return `
  Use Below instructions for Splunk Log analysis. 
  -  Check if records are available, if so provide the timestamp of each logs found.
  - <<TimeStamp: Error Message>>
  Splunk Search Query: ${metadata.query || 'N/A'}\nLogs Found: ${metadata.logs.length}\n` + logsText;
}

/* KNOWLEDGE BASE CONTEXT FORMATTER */
function formatKnowledgeBaseContext(state) {
  const results = state.searchResults?.items || [];

  if (results.length === 0) return 'NO_INDEX_DATA_FOUND';

  return results.map((item, index) => {
    const doc = item.document || {};
    return `### DOCUMENT REFERENCE ${index + 1}
FILE NAME: ${doc.file_name || 'Unknown'}
SOURCE PATH: ${doc.source_path || 'N/A'}
SHEET NAME: ${doc.sheet_name || 'N/A'}

CONTENT:
${doc.content || 'No text content found.'}`;
  }).join('\n\n---\n\n');
}


/* Policy Data BASE CONTEXT FORMATTER */
async function formatPolicyDataContext(state) {
  try {
    const results = state.searchResults?.items || [];


    const containerName = 'npspolicy';

    //const templateBlobName = 'policies/Group Size Attestation Policy.pdf'; // Exact path from your screenshot
    // const templateClient = await getBlockBlobClient(containerName, templateBlobName);
    // const te=await downloadBlobText(containerName, templateBlobName);
    // const templateBuffer = await templateClient.downloadToBuffer();


    if (results.length === 0) return 'NO_INDEX_DATA_FOUND';

    const result = await Promise.all(results.map(async (item, index) => {
      const doc = item.document || {};
      const blobName = doc.document_name.split('npspolicy/')[1].replaceAll('%20', ' ')
      const sasUrl = await generateTemporaryDownloadLink(containerName, blobName, 60);
      return `### Document REFERENCE ${index + 1}
FILEURL: ${sasUrl}
CONTENT:${doc.content || 'No text content found.'}`;
    }));

    return result.join('\n\n---\n\n')
  }
  catch (error) {
    console.error('Error in chatCompletionNode:', error);
  }

}

/* TEST CASE CONTEXT FORMATTER */
function formatTestCaseContext(metadata, state) {
  //if (!metadata || (!metadata.records && !metadata.matchingTestCases)) {
  if (!metadata || (!metadata.records)) {
    return 'No generated test cases or reference mappings available.';
  }

  let context = `
INPUTS:
1. New functional requirement:
   ${state.userPrompt} - ${state.jiraMetaData}

2. Existing test cases (JSON):
   ${JSON.stringify(metadata.records)}


`
  // let context = `## Generated Test Cases\n`;

  // const records = Array.isArray(metadata.records) ? metadata.records : [];
  // if (records.length > 0) {
  //   context += records.map((tc, i) => {
  //     const steps = Array.isArray(tc.testSteps) ? tc.testSteps : [];
  //     return `### TC ${i + 1}: ${tc.testCaseName || 'Unnamed'}\nScope: ${tc.testScope || 'N/A'}\nScenario: ${tc.testScenario || 'N/A'}\nSteps:\n${steps.map(s => `- ${s}`).join('\n')}`;
  //   }).join('\n\n');

  //   if (state?.jiraMetaData != '') { context += `\n User Story Description: ${state?.jiraMetaData}. If this is not provided, use the information from user role Content` }
  // } else {
  //   context += "No new test cases generated.\n";
  // }

  // const matching = Array.isArray(metadata.matchingTestCases) ? metadata.matchingTestCases : [];
  // if (matching.length > 0) {
  //   context += `\n\n## Reference Mapped Stories & Cases\n`;
  //   context += matching.map((m, i) => {
  //     return `[Reference ${i + 1}] User Story ID: ${m.userstory_id || 'N/A'}\nDescription: ${m.description || 'N/A'}\nAcceptance Criteria: ${m.acceptance_criteria || 'N/A'}`;
  //   }).join('\n---\n');
  // }

  return context;
}

/* TEST SCRIPT CONTEXT FORMATTER */
function formatTestScriptContext(metadata) {
  if (!metadata?.records || metadata.records.length === 0) return 'No test script data found in repository.';
  const scripts = Array.isArray(metadata.records) ? metadata.records : [metadata.records];
  return scripts.map((script, index) => {
    //return `### Automation Script ${index + 1}: ${script.testScriptName || 'N/A'}\nSource File Path: ${script.sourceFile || 'N/A'}\nUpdated: ${script.updated ? 'Yes' : 'No'}\nCode:\n\`\`\`java\n${script.updatedTestScript || '// No code generated'}\n\`\`\``;
    return `### Automation Script ${index + 1}: ${script}\n\`\`\``;

  }).join('\n\n---\n\n');
}

/* SCORECARD CONTEXT FORMATTER */
function formatScorecardContext(scorecardMetaData) {
  if (!scorecardMetaData?.recordFound || !scorecardMetaData?.scorecardSystemPrompt) {
    if (scorecardMetaData?.error) {
      return `Scorecard Analysis Error: ${scorecardMetaData.error}`;
    }
    return 'No scorecard data available. Please upload scorecard data first using POST /api/scorecard.';
  }
  return scorecardMetaData.scorecardSystemPrompt;
}

/* CHAT COMPLETION NODE */
export const chatCompletionNode = async (state) => {
  try {
    const TOKEN_LIMIT = 6000;
    let newSummary;
    let recentmessages = state.messages;
    const userMessage = state.messages[state.messages.length - 1];
    const intentType = state.intent?.type || 'INCIDENT';
    let profileKey = 'nps_incident_001';
    let context = "";
    let dbSystemTemplate = '';
    let incidentSearchSystemTemplate = ''
    analyticsTemplate = ''


    console.log(`\n--- DEBUG CHAT COMPLETION ---`);
    console.log(`Detected Intent Type: ${intentType}`);
    console.log(`Raw Intent: ${state.intent?.raw || 'N/A'}`);

    /* ========== ROUTING LOGIC ========== */

    if (intentType === 'AI_SCORECARD') {
      //console.log(`[chatCompletionNode] AI_SCORECARD flow`);
      //console.log(`[chatCompletionNode] scorecardMetaData.recordFound: ${state.scorecardMetaData?.recordFound}`);
      //console.log(`[chatCompletionNode] scorecardSystemPrompt length: ${state.scorecardMetaData?.scorecardSystemPrompt?.length || 0}`);
      context = formatScorecardContext(state.scorecardMetaData);
      profileKey = 'ai_scorecard';
    }
    else if (intentType === 'KNOWLEDGE_BASE') {
      context = formatKnowledgeBaseContext(state);
      profileKey = 'knowledge_base';
    }
    else if (intentType === 'TEST_CASE') {
      context = formatTestCaseContext(state.testCaseMetaData, state);
      profileKey = 'test_case';
    }
    else if (intentType === 'TEST_SCRIPT') {
      context = formatTestScriptContext(state.testScriptMetaData);
      profileKey = 'test_script_generation';
    }
    else if (intentType === 'RELEASE_MANAGEMENT') {
      context = formatReleaseContext(state.releaseMetadata);
      profileKey = 'release_management'; // Will fallback to default if not in config
    }
    else if (state.intentRaw === 'policy_data') {
      context = await formatPolicyDataContext(state);
      profileKey = 'policy_data';
    }
    else {
      // INCIDENT flow (default)
      const contextParts = [];
      if (state.searchResults?.items?.length > 0) {
        if (state.analyticsContext?.lastTool != 'groupByAnalysis') {
          incidentSearchSystemTemplate = `Executive Incident Summary:
Overview:
-High‑level description of observed issue pattern
-Based only on provided incidents

Key Findings:
- Factual observations common across incidents
- Use "IssueReported" field if provided
- No interpretation beyond evidence

Possible Root Cause (Conditional)
- Derive from RootCause/RCA field from the incidents if provided
- If No incidents provided, use the database/Splunk details if provided to provide the possible root cause. Do Not repeat same from Key Findings
- Otherwise state that RCA cannot be conclusively determined
- Provide a combined possible root causes across incidents

Resolution Observed / Resolution Needed (Conditional)
- MUST be derived ONLY from:
  -Work Notes
  -ResolutionNotes - Use this as possible resolution suggesstion if provided and provide combine possible resolution across incidents 
- Steps must be verbatim or tightly paraphrased. 
- Remove if no resolution actions exist

Suggested Next Steps (Conditional):
-Evidence‑based guidance only
-No new actions or procedures introduced

Limitations / Missing Information:
-Clearly state analysis constraints

Related Incidents (Context‑Only):
Include exactly 3 incidents:

[Incident ID]: 
Description: 1–2 factual lines
Root Cause: factual if available
Resolution: factual if available`}
        if (state?.userContext == 'FOLLOW_UP' && state?.chatResponse?.content != '') {
          incidentSearchSystemTemplate += `\n\n If user asked for resolution or how to resolve, use the given reference incidents, to provide detail resolution as mentioned under above section "Resolution Observed / Resolution Needed (Conditional)"`
          contextParts.push("Incident Summary:" + state?.chatNewResponseSummary)
        }
        if (state.analyticsContext?.lastTool == 'getIncidentById') { contextParts.push('\n\nCRITICAL: Include Assignment group, Created Date, Status and Priority of Ticket on Summarization if provided') }
        contextParts.push(

          '## Incident Index Summary\n' +
          formatSearchContext(state.searchResults, state) +
          `If USer explicitly ask for resoution as follow-up, use the given resolution from the Incidents. Else skip this part`
        );
      }
      if (state.analyticsContext?.lastTool == 'investigateAdminPeformanceRatingIssue' || state.analyticsContext?.lastTool == 'investigateSystemErrorIssue') {
        if (state.databaseMetadata?.recordFound) {
          let dbTemplate, recordsText
          [dbTemplate, recordsText] = formatDatabaseContext(state, state.databaseMetadata)
          if (dbTemplate != '') { dbSystemTemplate = dbTemplate }

          contextParts.push(`## Database Summary:\n` + recordsText);

        }
        if (state.splunkMetadata?.logs?.length > 0) {
          contextParts.push(`## Splunk Log Summary:\n` + formatSplunkContext(state.splunkMetadata));
        }
      }

      if (state.analyticsContext?.lastTool == 'rpsStatusCheck') {
        if (state.databaseMetadata?.recordFound) {

          contextParts.push("***Database Summary***\n" + formatRpsStatusContext(state.databaseMetadata));
        }
      }
      //      contextParts.push(``);

      context = contextParts.join("\n\n---\n\n");
      if (!context.trim().includes('##')) {
        context = `No incident-related data found. Identifiers: ${JSON.stringify(state.identifiers || {})}`;
      }
    }

    console.log(`Routing to profile: ${profileKey} (${intentType} FLOW)`);

    /* ========== BUILD MESSAGES ========== */

    let messages;
    if (state.intentRaw == 'getservicenowRecords') {
      const jsonContent = foramtSNOWGetData(state.snowMetadata)
      console.log(`[chatCompletionNode] Using GetSNOW Records directly`);
      messages = [
        {
          role: "system", content: `Get me incidents tagged to my team
You are formatting incident records for display. You will receive a list of incident records in JSON format.
The input contains ${state.snowMetadata.length} incident records.  
Your output must contain exactly  ${state.snowMetadata.length} incidents.
Follow these rules strictly:
  - Never use HTML.
  - Do not summarize or remove records from the provided data.
  - When displaying tabular data, use a fixed-width text table inside a Markdown code block.
  - Align columns using spaces so that rows appear properly aligned.
  - Preserve all records exactly as provided.
  - Keep the number of columns minimal for readability.

Example format:

Incident ID   Description                Status       AssignmentGroup
-----------   -------------------------  --------     --------
INC001        Transaction failure        Open         AD HP NPG
INC002        Memory leak                InProgress   NON-IT ACCENTURE NPS TIER 2

          ` },
        { role: "user", content: state.userPrompt + jsonContent || "Provide the Data to user" }
      ];
    }

    else if (state.intentRaw == 'testscript_withoutreference') {
      console.log(`[testscriptWtihout reference] Using GetSNOW Records directly`);
      messages = [
        {
          role: "system", content: `You are a Senior QA Automation Engineer and Selenium Page Object Model (POM) expert.

Your responsibility is to generate Selenium Page Object Model (POM) code for enterprise web applications.

========================
GOAL
========================
Generate Selenium POM methods and locator definitions for the MYRG Investment Reasons feature, based strictly on the functional description provided by the user.

========================
STRICT RULES
========================
1. Do NOT invent application behavior, UI layout, field names, or workflows beyond what is explicitly stated.
2. Do NOT assume actual XPath values.
   - Always use clear placeholder XPaths (e.g., <<MYRG_DROPDOWN_XPATH>>).
3. Do NOT include test assertions or test classes unless explicitly asked.
4. Do NOT include business logic or downstream system implementation.
5. Output must be deterministic and reusable.
6. Use clean, professional, enterprise‑grade naming conventions.
7. All selectors must be defined as By locators.
8. Methods must be granular, readable, and reusable.
9. Prefer Java + Selenium + Page Object Model.
10. If multiple functional options exist, generate POM methods for EACH option separately.

========================
FEATURE CONTEXT
========================
Provided under User Role Content

========================
OUTPUT REQUIREMENTS
========================
Your output MUST include:

1. A single Page Object class.
2. Placeholder XPath locators for:
   - MYRG section/label
   - Dropdown(s)
   - Save/Submit action
3. Selenium methods for:
   - Selecting MYRG Investment Reason(s)
   - Verifying presence of dropdown(s)
   - Verifying top‑of‑list sorting (where applicable)
4. Separate method groups for:
   - Option 1 (single concatenated dropdown)
   - Option 2 (three dynamic dropdowns)
5. NO test execution code.
6. NO real XPath values.
7. NO assumptions about UI framework (React, Angular, etc.).

========================
EXPECTED STYLE
========================
- Java
- Selenium WebDriver
- Page Object Model
- Clear method naming
- Commented sections
- Enterprise‑ready structure

========================
FAILURE CONDITIONS
========================
The response is considered incorrect if:
- Any XPath is fabricated or inferred.
- UI elements not mentioned in the feature are added.
- Business logic or downstream system logic is implemented.
- The output is unstructured or mixes test logic with POM.

          ` },
        { role: "user", content: state.userPrompt }
      ];

    }

    else if (intentType === 'AI_SCORECARD' && state.scorecardMetaData?.recordFound && state.scorecardMetaData?.scorecardSystemPrompt) {
      // For scorecard: scorecardSystemPrompt already contains all data + analysis instructions
      console.log(`[chatCompletionNode] Using scorecardSystemPrompt directly`);
      const promptProfiles = state.config?.promptProfiles || {};
      const selectedProfile = promptProfiles[profileKey]

      messages = [
        { role: "system", content: selectedProfile?.systemMessage?.content + "." + state.scorecardMetaData.scorecardSystemPrompt + `\n IMPORTANT RULE: If in case user ask for Short summary or focus on specific actions, from the provided data,provide you summarization accordingly  ` },
        { role: "user", content: state.userPrompt || "Analyze the NPS performance scorecard" }
      ];
    } else {
      // For all other intents: use config-based prompt profiles
      const promptProfiles = state.config?.promptProfiles || {};
      const selectedProfile = promptProfiles[profileKey] || promptProfiles['nps_incident_001'] || promptProfiles['default'];

      const systemMessageRaw = selectedProfile?.systemMessage;
      const userMessageRaw = selectedProfile?.userMessage;

      const userQuestion = state.userPrompt || "";

      let systemContent = (typeof systemMessageRaw === 'string' ? systemMessageRaw : systemMessageRaw?.content) || "";
      let userContent = (typeof userMessageRaw === 'string' ? userMessageRaw : userMessageRaw?.content) || "";

      systemContent = systemContent
        .replace(/{context}/g, context || "")
        .replace(/{question}/g, userQuestion)
        .replace(/{IncidentFormatTemplate}/g, incidentSearchSystemTemplate)
        .replace(/{DatabaseSummaryTemplate}/g, dbSystemTemplate)
        .replace(/{AnalyticsTemplate}/g, analyticsTemplate);

      systemContent = systemContent
        .replace(/{testSteps}/g, state.testCaseMetaData?.testCases?.[0]?.testSteps || "")
        .replace(/{CurrentIntent}/g, state?.userContext || "")

        .replace(/{testCaseName}/g, state.testCaseMetaData?.testCases?.[0]?.testCaseName || "")
        .replace(/{cleanedScript}/g, state.githubMetadata?.files?.[0]?.content || "");

      userContent = userContent
        .replace(/{context}/g, context || "")
        .replace(/{question}/g, userQuestion);


      // if (intentType === 'RELEASE_MANAGEMENT') {
      //   systemContent += `**STRICT RELEASE MANAGEMENT INSTRUCTIONS:**
      //   CRITICAL EXECUTION RULES (NON-NEGOTIABLE):\n- Use the minimum number of tokens required.\n- Do NOT perform deep reasoning, chain-of-thought, step-by-step thinking, or internal analysis.
      //   You are a Release Manager processing automation tasks. 



      //   **IF THIS IS A PLAYBACK CHECKLIST (CHG Number is present):**
      //       1. EXPLICITLY state the Deployment Plan Name/Date used at the top of your response: "Deployment Plan Used: ${state.releaseMetadata?.pageTitle || 'Target Deployment Plan'}".
      //       2. Output the CHG Number and the Database SCTASK mappings.
      //       3. Provide a single list of the applications using the exact heading "**App names /version deployed**". Do NOT print the old "Apps Deployed" list. Only print this single, unified list.
      //       4. Create a heading called "**GitHub Validation Results**" and list the validation output exactly as provided in the context.
      //       5. Create a new heading called "**Updated Versions as per GitHub**". Under this heading, you MUST list every single application using the following strict formatting. CRITICAL: You MUST replace all dots (.) in the version numbers with hyphens (-) and connect the app name to the version with a hyphen:
      //         - For apps that have a NEW/UPDATED version: "✅ [App Name]-[Version]"
      //         - For apps where the version DID NOT CHANGE: "➖ [App Name]-[Version]"
      //       6. **CRUCIAL**: Do not invent version numbers. Rely strictly on the GitHub data provided in the context to determine if a version is "New" or "Remains" the same.
      //       7. **CRUCIAL**: You MUST provide the exact markdown link to download the Excel file at the very end. (e.g., "[Download Generated Deployment Plan Excel](/downloads/...)").
      //       Below is the format for deployment plan:
      //       **IF THIS IS A PLAYBACK CHECKLIST (CHG Number is present):**

      //       **CRITICAL STRUCTURAL REQUIREMENT:**
      //       You are a strict data formatter. You MUST output the response EXACTLY in the order, sequence, and formatting shown in the TEMPLATE below. 
      //       - You are strictly forbidden from rearranging sections. 
      //       - You are strictly forbidden from adding conversational filler.
      //       - You are strictly forbidden from omitting version numbers.

      //       **=== MANDATORY OUTPUT TEMPLATE ===**

      //       Deployment Plan Used: ${state.releaseMetadata?.pageTitle || "[Insert Page Title]"}

      //       CHG Number: ${state.releaseMetadata?.chgNumber || "[Insert CHG Number]"}

      //       **Database SCTASK Mapping**
      //       - Implementation: [Value] (Assigned: [Value])
      //       - EPS API Support: [Value]
      //       - Functional Validation: [Value] (Assigned: [Value])

      //       **App names /version deployed**
      //       - [App Name]-[Version] 
      //       *(Note: List all applications here as a single unified list)*

      //       **Updated Versions as per GitHub**
      //       - ✅ [App Name]-[New Version Number]
      //       - ➖ [App Name]-[Old Version Number]

      //       [Insert the exact markdown link to download the Excel file here, e.g., [Download Generated Deployment Plan Excel](/downloads/...)]

      //       **=== ANTI-LAZINESS RULES ===**
      //       1. For the "Updated Versions" section, you MUST print the actual version number every single time. 
      //       2. It is a FATAL ERROR to just say "version remains the same" without providing the specific number. 

      //   **IF THIS IS A RELEASE NOTES (Fix Version is present):**

      //       **STRICT DATA INTEGRITY PROTOCOL:** You are a high-fidelity data repeater. 

      //       RULE 1: Page headers MUST be "### Confluence Page: [ID]".
      //       RULE 2: For "GitHub Pull Requests", DO NOT invent or summarize URLs. EXACTLY COPY the summary counts provided in the context (e.g., "- GitHub pull request approved (3 PRS TOTAL)").
      //       RULE 3: You MUST copy every single Jira story bullet point. Do not combine them into one line. Do not write "Multiple stories...". 

      //       EXECUTION STEPS:
      //       1. Print Page Header.
      //       2. List Team Name.
      //       3. Output the GitHub PR Summary counts exactly as written in the context.
      //       4. Output every "JIRA_ITEM" exactly as written in the context ( IDs| status| summary).
      //       5. Repeat for all Teams and all Pages.
      //       6. AT THE VERY BOTTOM, print this exact message: "**Note:** Detailed Functionality Coverage have been exported to Tab 3 of the attached Excel file."
      //       7. Print the Excel Download Link at the very end.



      //       Below is the format for release Notes(Fix Version is present)
      //       **IF THIS IS A RELEASE NOTES (Fix Version is present):**

      //       **CRITICAL STRUCTURAL REQUIREMENT:**
      //       You are a strict data repeater. You MUST output the response EXACTLY in the formatting shown in the TEMPLATE below. 
      //       - You are strictly forbidden from generating or writing a "Functional Coverage Explanation" or any extra descriptions.
      //       - You are strictly forbidden from guessing, expanding, or summarizing the Jira stories. Just copy the ID, Status, and Summary.

      //       **=== MANDATORY OUTPUT TEMPLATE ===**

      //       Confluence Page: [Insert Page ID]

      //       Team Name: [Insert Team Name]
      //       GitHub Pull Requests:
      //       - [Copy exactly from context]

      //       Jira Stories Included:
      //       - [Jira ID] ([Status]): [Summary]
      //       *(If no stories exist, write: "No Jira stories found for this team.")*

      //       *(Repeat the Team block for every team)*
      //       *(Repeat the Page block for every page)*

      //       Do not invent information. Rely strictly on the provided context.`;
      //  }
      messages = [
        { role: "system", content: systemContent },
        { role: "user", content: userContent }
      ];

      // const history = await getConversationHistory(state.sessionID, 5);
      // if (history.length > 0) {
      //   // Only include last few turns for context, not full history
      //   const recentHistory = history.slice(-2); // last 3 exchanges
      //   recentHistory.forEach(msg => messages.push(msg));
      // }
      messages = [

        {
          role: "system",
          content: systemContent
        }, { role: "user", content: userContent },
        //...(state.summary ? [{ role: "system", content: `Conversation summary:\n${state.summary}` }] : []),
        ...state.messages.slice(-2),

      ];

    }



    /* ========== CALL LLM ========== */

    // const client = await getCompletionsClient();
    // console.log('[DEBUG INCIDENT INDEX]');
    // console.log('Search Results Count:', state.searchResults?.items?.length);
    // console.log('First Result:', state.searchResults?.items?.[0]);
    // console.log('second Result:', state.searchResults?.items?.[1]);

    let mainResponse = '';

    if (intentType === 'TEST_SCRIPT') {
      mainResponse = context;
    }
    else {
      let temperature = state.config?.chatCompletion?.temperature || 0.4;
      let maxTokens = state.config?.chatCompletion?.max_tokens || 6000;

      if (intentType === 'KNOWLEDGE_BASE' || state.intentRaw == 'policy_data') {
        temperature = 0.1;
      } else if (intentType === 'AI_SCORECARD') {
        temperature = 0.4;
        maxTokens = 12000;
      }
      // Make the main chat completion request
      const completionConfig = {
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 1000,
        model: "gpt-4o",
        messages: messages,
        teamName: state?.teamName,
        assistantName: state?.assistantName,
        nuid: state?.nuid
      };

      // Extract the main response
      mainResponse = await chatCompletion(completionConfig);
    }
    // if (intentType === 'RELEASE_MANAGEMENT'){
    // mainResponse+=downloadURL;}
    const dd = await estimateTokens(mainResponse);
    const assistantMessage = {
      role: "assistant",
      content: mainResponse
    };

    // Estimate tokens of this exchange
    const newTokens =
      await estimateTokens(userMessage.content) +
      await estimateTokens(mainResponse);

    const updatedTokenCount = state.tokenCount + newTokens;
    if (updatedTokenCount >= 1000) {
      const messagelength = recentmessages.length;
      recentmessages = recentmessages.slice(0, -messagelength + 1);
      const conversationText = state.messages.slice(-2)
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      //   const summaryPrompt = `
      // Summarize this entire conversation in 3-4 concise sentences.
      // Preserve:
      // - Important identifiers
      // - Decisions made
      // - Context needed for follow-up
      // `;

      //   const messages = [
      //     { role: "system", content: summaryPrompt },
      //     { role: "user", content: conversationText },
      //   ];

      //  messages = [
      //       { role: "system", content: 'Summarize each conversation briefly.' },
      //      ...state.messages,assistantMessage
      //     ];
      // let responseSummary = await client.chat.completions.create({
      //      model: "gpt-4o",
      //      temperature: 0.7,
      //      max_tokens: 3000,
      //      messages: messages
      //    });
      //   let  summaryLLM = responseSummary.choices[0].message.content;

      // newSummary = state.summary
      //   ? state.summary + " " + summaryLLM
      //   : summaryLLM;
      //print(summaryLLM)
    }
    //  print(summaryLLM)

    /* ========== POST-PROCESSING: STATE-BASED CLEANER ========== */
    if (state.analyticsContext?.lastTool == 'rpsStatusCheck' && state.databaseMetadata?.records?.[0].payload && state.databaseMetadata?.records?.[0].isNegativeScenario) {
      mainResponse += `\n\n### 📦 Failed Payload Details\n`;
      mainResponse += `\`\`\`xml\n`;
      mainResponse += `${state.databaseMetadata?.records?.[0].payload}\n`;
      mainResponse += `\`\`\`\n`;
    }
    if (intentType === 'INCIDENT') {
      if (!state.databaseMetadata?.recordFound) {
        mainResponse = mainResponse.replace(/(?:###|\*\*|#)\s*Database Summary[\s\S]*?(?=(?:###|\*\*|#)|$)/gi, "Database data is not available.\n\n");
      }
      if (!state.splunkMetadata?.logs?.length) {
        mainResponse = mainResponse.replace(/(?:###|\*\*|#)\s*Splunk (Log )?Summary[\s\S]*?(?=(?:###|\*\*|#)|$)/gi, "Splunk data is not available.\n\n");
      }
      const bothMissingRegex = /Database data is not available\.?[\s\S]*?Splunk data is not available\.?/gi;
      if (bothMissingRegex.test(mainResponse)) {
        mainResponse = mainResponse.replace(bothMissingRegex, "Database and Splunk data is not available.");
      }
    }

    // console.log("--- END DEBUG ---");
    // ── Save complete conversation turn to MongoDB ──────────────
    await saveConversationToHistory(
      state.sessionID, state.nuid, state.userPrompt, mainResponse, state.intentRaw,
      {
        subType: state.scorecardMetaData?.subType || null,
        dateRange: state.scorecardMetaData?.dateRange || null,
        recordCount: state.scorecardMetaData?.recordCount || state.databaseMetadata?.recordCount || 0,
        slaComplianceRate: state.scorecardMetaData?.analytics?.slaComplianceRate || null,
        tokensUsed: newTokens || null,
      }
    );

    return {
      ...state,
      //  messages: [recentmessages, assistantMessage],

      messages: [...state.messages.slice(-2), assistantMessage],
      // summary:[...state.summary,newSummary],
      tokenCount: updatedTokenCount,
      chatResponse: {
        content: mainResponse,
        timestamp: new Date().toISOString(),
        metadata: {
          intentType: intentType,
          profileUsed: profileKey,
          kbCount: state.searchResults?.items?.length || 0,
          tcCount: state.testCaseMetaData?.recordCount || 0,
          tsCount: state.testScriptMetaData?.recordCount || 0,

          scorecardRecordCount: state.scorecardMetaData?.recordCount || 0,

        },

      },
      chatSuccess: true
    };

  } catch (error) {
    console.error('Error in chatCompletionNode:', error);
    return {
      ...state,
      chatResponse: {
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString()
      },
      chatSuccess: false
    };
  }
};