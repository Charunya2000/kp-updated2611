'use server';


import { chatCompletion } from "@/app/services/chatCompletionService2.js";

import { connectToDatabase } from '@/db/connection';

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

    const db = await connectToDatabase('team-bcs-db');
    const collection = db.collection('BCS_Chat_History');

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

    const db = await connectToDatabase('team-bcs-db');
    const collection = db.collection('BCS_Chat_History');

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




//SNOW
function foramtSNOWGetData(records) {
  if (records.length === 0) return '';
  const msg =
    `Here is/are Ticket/Tickets opened with New/InProgress status
${JSON.stringify(records)}
   `
  return msg
}

/* KNOWLEDGE BASE CONTEXT FORMATTER */
function formatKnowledgeBaseContext(state) {
  const results = state.knowledgeBaseMetaData?.records || [];

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

/* TEST CASE CONTEXT FORMATTER */
function formatTestCaseContext(metadata, state) {
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

  return context;
}

function formatAPValidationSummary(metadata, state) {
  if (!metadata) {
    return 'No Credit Amount Available';
  }
  let requestType = metadata.requestType
  let category = metadata.category
  const currentDate = new Date().toString();
  let APValidaitonInstuction = `ROLE:
You are a AP (account Payable) Validation Summary Analyst.

PRIMARY GOAL:
Based on given data, generate stuctured Table output using the data
FORMATTING RULES

• Tables first, text second.
• No long paragraphs.
• Use trend indicators wherever possible.
•• Show only categories that exist in the data.



  
    
  
Using the below given Compensation Summary details in JSON, 

 ${JSON.stringify(metadata)}

 Provide your analysis/summary based on below instructions.
 ${APValidaitonInstuction}
`

  return context;
}


/* TEST CASE CONTEXT FORMATTER */
function formatPaymentSummary(metadata, state) {
  if (!metadata) {
    return 'No Credit Amount Available';
  }
  let requestType = metadata.requestType
  let category = metadata.category
  const currentDate = new Date().toString();
  let paySummaryInstructions = ''
  if (requestType == 'paymentcycle_query') {
    paySummaryInstructions = `
    Role - You are a Payment Cycle Summarizer agent. Below are the Payment Cycle Week and their dates.
    Rules:
    1.Use this information and respond based on user query. Use the Current date provided to compare the dates completed and upcoming.
    2.If any of payment date equals current date,do include them. 
    3.Also include most recent completed payment date alone (recent single date from past) for both types and  mention as "Complete"
    4. If requested for sepcific payment cycles, populate them alone. If General request for payment cycles, include both payment cycles. 
    
    Upcoming Payment Cycles (JSON):

    {
  "2026 Week3": [
    "August 13 Thu",
    "September 15 Tue",
    "October 13 Tue",
    "November 16 Mon",
    "December 15 Tue"
  ],
  "2026 Week5": [
    "August 25 Tue",
    "September 25 Fri",
    "October 26 Mon",
    "November 24 Tue",
    "December 23 Wed"
  ]
}
Week 3 = Default Commission
Week 5 = Default Rewards
Weeks 1, 2, 4 = Off-cycle

 Output:
    Below are the <<Completed/Upcoming>>payment cycles: 
    Week 3 Payment Cycle:
      -Completed:<Populate with Dates and day>
      -Upcoming:<Populate with Dates and day>
    Week 5 Payment Cycle:
      -Completed:<Populate with Dates and day>
      -Upcoming:<Populate with Dates and day>

Formatting rules:
   -Give output in styled format above
   - Bold headings and sub headings
   - Do not callout any JSON Input data provided


     
`
  }
  if (requestType == 'analysis') {
    paySummaryInstructions = `
    
     ROLE: You are a Payment Summary Analyst. 

PRIMARY GOAL:
Focus on trend analysis and key drivers rather than lengthy narrative explanations.

CRITICAL EXECUTION RULES (NON-NEGOTIABLE):\n- Use the minimum number of tokens required.\n- Do NOT perform deep reasoning, chain-of-thought, step-by-step thinking, or internal analysis.
  
RESPONSE MODES:

Detailed Analysis:
• Use trend-based tables as the primary output.
• Keep narrative sections to a maximum of 2-3 sentences.
• Emphasize category trends, variances, and drivers.

Quick Analysis:
• Provide only summary trend tables and 3 key insights.
• Avoid detailed explanations and percentages unless meaningful.

TREND INDICATORS

▲ GREEN   = Significant Increase (>10%)

► YELLOW  = Stable (-10% to +10%)

▼ RED     = Significant Decrease (<-10%)

{"Current Date":"${currentDate}"
"Payment CycleDate":" ${metadata.payment_cycle}"
}

Disclaimer Rule:
{
  "When to Populate": "Show the disclaimer only when the upcoming Payment Cycle Date is between 0 and 7 days from the current date, inclusive.",
  "Condition": "Payment Cycle Date >= Current Date AND Payment Cycle Date <= Current Date + 7 days",
  "Message to Show": "Payments are generally processed around the <<replace with payment cycle date>> of each month. Since the data is being reviewed earlier in the cycle, the payment values may appear lower than expected.",
  "When to Hide": "Do not show the disclaimer if the Payment Cycle Date has already passed or is more than 7 days away.",
  "Example - Show": "Current Date: 11/10/2026, Payment Cycle Date: 11/15/2026 → Show",
  "Example - Hide Too Early": "Current Date: 10/17/2026, Upcoming Payment Cycle Date: 11/15/2026 → Hide",
  "Example - Hide Completed Cycle": "Current Date: 10/17/2026, Payment Cycle Date: 10/13/2026 → Hide because the cycle date has passed."
}

SUMMARY: Provide 2-3 sentences on overall summary analysis

COMPENSATION TREND SUMMARY (Skip this part for Week 5 Summary)

| Metric | <<Current Month Week> | <<Prev Month Week>> | <<Prev Year Week>> | MoM Trend | YoY Trend |
|----------|----------|----------|----------|----------|----------|
| Total Commission | $X | $Y | $Z | ▼ RED (-12%) | ▲ GREEN (+18%) |
| Total Rewards | $X | $Y | $Z | ► YELLOW (+2%) | ▼ RED (-8%) |
| Total Compensation | $X | $Y | $Z | ▲ GREEN (+15%) | ► YELLOW (+3%) |

COMMISSION TREND ANALYSIS (SKip this part for Week 5 Summary)

| Category |  <<Current Month Week> | <<Prev Month Week>> | <<Prev Year Week>>| MoM % | YoY % | Trend |
|----------|----------|----------|----------|----------|----------|----------|
| Standard | | | | +5% | +8% | ► YELLOW |
| Adjust | | | | -20% | -15% | ▼ RED |
| GA | | | | +18% | +25% | ▲ GREEN |
| Medicare FMO | | | | +12% | +7% | ▲ GREEN |
| Medicare MPEX | | | | -3% | +2% | ► YELLOW |
| Medicare WBE | | | | -22% | -18% | ▼ RED |

REWARD TREND ANALYSIS

| Category |  <<Current Monk Week> | <<Prev Month Week>> | <<Prev Year Week>> | MoM% | YoY% | Trend |
|----------|----------|----------|----------|----------|----------|----------|
| CalTech/JPL | | | | +14% | +10% | ▲ GREEN |
| Retro-GA Override | | | | -18% | -11% | ▼ RED  |
| KPIF New Business Rewards | | | | +14% | +10% | ▲ GREEN |
| KPIF Renewal Rewards | | | | -18% | -11% | ▼ RED  |

Note: Add this statement for Week 3 Payment analysis. Else Skip them
"Usually Rewards are paid out during Week 5, so negative trend not to be considered as alert"

Transaction TREND ANALYSIS: (Skip if not provided)

| Category |  <<Current Monk Week> | <<Prev Month Week>> | <<Prev Year Week>> | MoM% | YoY% | Trend |
|----------|----------|----------|----------|----------|----------|----------|
| KPIF New Business Rewards | | | | +14% | +10% | ▲ GREEN |
| KPIF Renewal Rewards | | | | -18% | -11% | ▼ RED  |


EXECUTIVE INSIGHTS

• Overall compensation trend: ▲ GREEN / ► YELLOW / ▼ RED
• Largest commission driver: <Category>
• Largest reward driver: <Category>

KEY DRIVERS

▲ GREEN Top Positive Contributors
• Category 1 (+$X)
• Category 2 (+$Y)

▼ RED Top Negative Contributors
• Category 1 (-$X)
• Category 2 (-$Y)


CRITICAL COLOR FORMAT RULE (Mandatory)
Use Below to show trend pattern instead of color name 
📈  Positive Trend / Increase (Green)
➡️  Stable Trend (Yellow substitute)
📉  Negative Trend / Decrease (Red)

Give % MOM and % YoY along with Trend Symbol

Color Code:
Red Color for Dollar Amont which are Negative
Positive Trend should have Green colr upward symbol
Negative Trend should have Red color downward symbol

MANDATORY RULE: All Amount should be shown as $

FORMATTING RULES:

• Summary at Top, followed  by Tables and executive insights and key driver
• Tables first, text second.
• Maximum 3 executive insights .
• No long paragraphs.
• Use trend indicators wherever possible.
• Show only categories that exist in the data.
• Highlight top gainers and decliners.
• Focus on trends and drivers instead of restating values.

Key Rules on Notes:
• DO NOT add notes below each table to show sum of records like "\Total Compensation" or "\Cal tech". 
• Do Not add ? or Approx values for any of column values. Populate as "0" is there are no values


`
  }
  if (requestType == 'generate_summary' && (category == 'Week3' || category == "Week2")) {
    paySummaryInstructions = `Role - You are a Payment Summary Generation agent using the template provided.
    Generate style summary as per below: Dollar ouput in wordings should in format of ($M) and not for tabular data where complete $ dollar value to be populated
Note -Based on current Date and requested month, determine what to be called out.
If current date is past requested Week and month, then 
- say 'we closed out the period', Else 'we move towards closing out period'
- say 'received', Else 'are expecting' under General summary


current Date:${currentDate}
Payment Cyle Date: ${metadata.payment_cycle}
If current date is before 7 days from upcomingg Payment Cycle Date, then add below statement at start of summary. Else Skip below statement . Skip them for all completed months from curren date.
"
"Payments are generally processed around the <<replace with payment cycle date>> of each month. Since the data is being reviewed earlier in the cycle, the payment values may appear lower than expected."


Template:
As <<we move toward closing out the period/ we closed out the period>> , I'd like to provide a brief update for the <<Given Month and Year like 2026 June >> Week 3 compensation cycle: 
 
GENERAL SUMMARY:
We <<are expecting/received>> to approximately pay <<Total from Given  Month and Year >> in total compensation today. This amount is <<Higher or Lower >> than last month’s amount <<  Total Previous of given Month >> and <<Higher or Lower >> than <<Previous Year Current Month>> Week 3 amount  << Total Previous Year >>
 
Commission Breakdown:
Approximately <<total Commission for given month>> of this payment is commission. This amount is <<higher or lower>> than last month’s <<total commission of last month>> and <<lower or higher>> than <<Last Month and Year >> amount <<Commission of last Month year>>
 
The largest impact to this week’s cycle is <<1st Largest Commission Name  -and it’s dollar sum value>> , and <<dollar sum value>>net in <2nd Largest Commission>>General Agency commissions.    
Show in below Style table format. Populate below based on <<given month value -This is the User Input period>>
Item | $ Amount| Total Transactions
Standard Commissions	$	<<>>	 <>
Adjust Commissions	$	<<>>	<>
GA	$	<<>>	  <>
Medicare FMO	$	<<>>	 <>
Medicare MPEX	$	<<>>	 <>
Medicare WBE	$	<<>>	 <>
Estimated Commission Total:	$	<<>>	 <>

Note: - 
 
Rewards Breakdown: Use the Rewards Summary to populate below section
We are paying <<Rewards in total>> in rewards. These numbers for rewards fluctuate from week to week. 

Below Section if Retro-GA override is provided on the rewards summary:
  Additionally, <<Rewards in total>> is being paid in <<This is for retro-ga override>>. This would normally not be classified as a reward, and the retro process is being reviewed for future cases.
 
Item| $Amount|Transactions
CalTech $<<>> <>
JPL	$	<<>>	 <>
Retro-GA Override	$	<<>> <>	 
Adjust Rewards $ <<>> <<>
Estimated Reward Total:	$	<<>>  <> 
 
Note - Rewards summary will have Term/Enroll. Sum both for each category like CalTech Term and CalTech Enroll. 
Any of Reward item $ Amount is 0 or not provided form above list, skip those

Strict Rule:
 Generate as per above format, Highlight Key headersa and pointer and  render the Rewards and Commission Breakdown in tabular format and do not provide additional details apart from template above unless explicitly asked. 
We believe these were the key factors in understanding <<this month’s Week 3>> compensation cycle.
`
  }
  if (requestType == 'generate_summary' && (category == 'Week5')) {
    paySummaryInstructions = `Role - You are a Payment Summary Generation agent using the template provided.
    Generate style summary as per below: Dollar ouput in wordings should in format of ($M) or ($K) and not for tabular data where complete $ dollar value to be populated
Note -Based on current Date and requested month, determine what to be called out.
If current date is past requested Week and month, then 
- say 'we closed out the period', Else 'we proceed with finalizing'


current Date:${currentDate}
Payment Cycle Date: ${metadata.payment_cycle}
If current date is before 7 days from upcomingg Payment Cycle Date, then add below statement at start of summary. Else Skip below statement . Skip them for all completed months from curren date.
"
"Payments are generally processed around the <<replace with payment cycle date>> of each month. Since the data is being reviewed earlier in the cycle, the payment values may appear lower than expected."


Template:

 As <<we proceed with finalizing/ we closed out the period>> the <<July 2026 Week 5>> period, here is a brief update regarding the amounts to pay on this AP Cycle.
 
GENERAL SUMMARY: These amounts to pay vary month by month.
KPIF New Business Rewards	$	<<>>
KPIF Renewal Rewards	$	<<>>
Production Rewards	$	<<>>
Manual Transaction Rewards	$	<<>>
Off-Cycle Commissions	$	<<>>
GRAND TOTAL AMOUNT TO PAY	$	$	<<>>
 
This cycle’s grand total amount to pay is lower than the previous month’s payment <<($)>>, and higher than last year’s <<July 2025 Week 5 >>payment <<($0.0M)>>.
The largest impact on this week’s cycle is KPIF Renewal Rewards <<($)>>.

Below is a further breakdown:
Off-Cycle Commissions – We are processing <<$0>> in commissions. This commission amount varies from month to month.
Manual Transaction Rewards – This month we are paying <<$>>. These amounts vary from month to month.
KPIF New Business Rewards – We are processing <<x Transactions in K>> Initials Reward Transactions for a total around <<$>>. The vast majority of these are for the current year <<(K for $)>>, with a few retros responding to broker requests. This amount varies month over month.
KPIF Renewal Rewards – We are processing <<x Transactions in K>> Persistency Reward Transactions for a total around <<$>>. Again, the vast majority of these are for the current year <<(K for $)>>, with the rest being retros responding to broker requests. This amount varies month over month.
Production Rewards – We are processing about <<$>> in Production Rewards this week. This value varies month over month.

Formatting:
Do Bold and underLine above Breakdown
Show the Summary split in Table
 

`
  }
  else if (requestType == 'general_inquiry') {
    paySummaryInstructions = `You will be provided with compensation data for:
• Current Month
• Previous Month
• Same Month Previous Year

The data may contain Commission and Reward categories and corresponding amounts.

For general inquiries:

1. Answer only what the user asks.
2. Retrieve values from the requested period(s) and category(ies).
3. If multiple periods are requested, present them in a simple comparison table.
4. When applicable, calculate and show:
   • Difference ($)
   • Percentage change (%)
5. Do not provide full compensation-cycle analysis unless explicitly requested.
6. Do not include categories that were not requested.
7. If a requested category does not exist for a period, state "No value available".
8. When comparing periods, summarize in one concise sentence whether the value increased, decreased, or remained unchanged.
9. Keep responses brief and data-focused.
10. Base all responses only on the supplied data.

Examples:

User: "Show Standard Commission for current and previous month."

Response:
| Period | Standard Commission |Transactions
|----------|----------|----|
| Current Month | $X |X|
| Previous Month | $Y |Y|

Standard Commission increased/decreased by $Z (A%) because of increase/decrease by Z (B%)

---

User: "What were the reward values for previous month?"

Response:
| Reward Category | Amount |
|----------|----------|
| CalTech/JPL | $X |
| Retro-GA Override | $Y |
| Total Rewards | $Z |

---

User: "Compare Medicare FMO across all three periods."

Response:
| Period | Medicare FMO |
|----------|----------|
| Current Month | $X |
| Previous Month | $Y |
| Previous Year Same Month | $Z |

Current Month is ↑/↓ X% vs Previous Month and ↑/↓ Y% vs Previous Year. `}
  else if (requestType == 'trueUp_Summary') {
    paySummaryInstructions = `You will be provided with compensation data for given period.
  Populate below table with data provided in Style Tabular format:
  Ue the given data to populate below table columns and provide high level summary based on $ Sum and Credit typeID 
 
 Table Columns:  COMPENSATIONDATE |	EVENTTYPEID |	COUNT(DISTINCT SALESTRANSACTIONSEQ) |	SUM(VALUE)| CREDITTYPEID

MANDATORY RULE: All Amount should be shown as $

FORMATTING RULES:
- CompensationDate should be in yyyy-MM-dd. DO NOT Include Time.
`

  }
  else if (requestType == "out_of_scope") {
    paySummaryInstructions = `Out of Scope details Requested.Could not process them. Do Not provide the JSON metadata as response`
  }
  let context = `
Given Input query: ${state.userPrompt}
Current Date: ${currentDate}
Use the Given Month, previous month, previous year of given month values from the data above.

Using the below given Compensation Summary details in JSON, 

 ${JSON.stringify(metadata)}

 Provide your analysis/summary based on below instructions.
 ${paySummaryInstructions}
`

  return context;
}



function formatRejectSummary(metadata, state) {
  if (!metadata) {
    return 'No Reject Amount Available';
  }
  const currentDate = new Date().toString();
  let context = `
Reject Summary (JSON):
   ${JSON.stringify(metadata.rejectSummary)}
Given Input query: ${state.userPrompt}
 Extracted Reject_type & Date Range: ${state.identifiers}
You are Summarizing the Reject results based on below details.
You will be provided with Pivot of fields value. 
Use the fields and category values and its total count to show the tabular view in Github style table. 

Output:
For the given <<Reject_type>> for the date Range provided, below is the summary of key field picked up automatically. 
<<Tabular View>>

Download URL: <<${metadata.rejectFileURL}>>


Strict Rule: Generate as per above format and do not provide additional details apart from template above unless explicitly asked. 


`

  return context;
}

function formatAgentArchivalSummary(metadata, state) {
  if (!metadata) {
    return 'No Request Generated';
  }
  const currentDate = new Date().toString();
  let context
  if (metadata.subcategory == "metrics") {
    context = `
    
  Role: You are Summarizing the Agent Archival Request results based on below details. Follow the Rules in generating the output
Strict Rule: 
1.Generate output in professional github styled format.
2. Do not provide additional details apart from template above unless explicitly asked.
3. Populate latest records in tabular format provided. 
4. Populate as NA for fields values if not available
5. Replace count of record

Given User Input query: ${state.userPrompt}
Total Archival records processed : ${metadata.recordCount}
If More than 5 Archival records are availabl then populate as:
  <Latest Top 5 request:>
Else Just Populate as:
    <Latest Records:>
   ${JSON.stringify(metadata.agentRecords)}

Expected Output Data to be provided as below:

So far <<count of records>> agent archival records processed. Below are latest request processed,

| RequestNumber | NPN | Brokers to Remove| JIRA ID |
|---------------|-----|------------------|---------|
|  |    |    |    | 

FORMATTING RULES:
IF Request number is NA, do not populate the row and do not account them
`
  }
  else {
    context = `
  Role: You are Summarizing the Agent Archival Request results based on below details. Follow the Rules in generating the output
Formatting Strict Rule: 
1.Generate output in professional styled format template provided.
2. Do not provide additional details apart from template below unless explicitly asked.
3. If emailSubject says request already exist, then start with response as "Request already exist. Please find details as below"
4. If emailSubject says Given Broker is not Mapped to the NPN, then start with responses as "No Mapping Broker exist. Hence No action taken",
5. JIRA Link should be rendered as HyperLink with JIRA ID provided. 
6. If there are No Mapping Broker Exist, Exclude first two summary statements on the output. Mark columns values as NA for requestNumber,broker and JIRA
7. Bold request ID and JIRA ID
8. Make JIRA link as Hyperlink
9. Give spacing between each lines
 
Agent Archival Data (JSON):
   ${JSON.stringify(metadata)}
Given User Input query: ${state.userPrompt}
Extracted Agent NPN and Broker to Retain/Remove : ${state.identifiers}


Expected Output Data to be provided as below:

From Agent Archival Data, if emailSubject says "Give Broker is not Mapped to the NPN. Hence No action taken", 
then skip below template content and response user with details extracted as NPN, Broker to Remove and Broker to Retain.
Broker ID to remove is not already remove/Not Mapped to the NPN. Hence No action taken.

Output Template (If Broker to Remove exists):
- Request to archive agent <<submitted/already exists>> with below details.
- Email is shared withh details

| RequestNumber | NPN | Brokers to Remove| JIRA ID |Email subject|
|---------------|-----|------------------|---------|---------|
|  <<requestNumber>> | <<NPN>>   |  <<Broker to remove>>  |  https://jira-aes.kp.org/browse/${metadata.jiraID}  | <<emailSubject>>




`
  }
  return context;
}

function formatReactivateUser(metadata, state) {
  if (!metadata) {
    return 'No Request Generated';
  }
  const currentDate = new Date().toString();
  let context = `
Summary (JSON):
   ${JSON.stringify(metadata)}
Given Input query: ${state.userPrompt}
 Extracted User ID to reactivate : ${state.identifiers}
You are Summarizing the User reactivation Request results based on below details.

Output: WITH PROFESIONAL STYLED. Bold Request Number and EmailSubject
Request to Reactivate user submitted with request #  <<requestNumber>>. 
Email is sent you with details. You can find with email subject:
<<emailSubject>>

Strict Rule: Generate as per above format  and do not provide additional details apart from template above unless explicitly asked. 


`

  return context;
}

function formatKPIFSummary(metadata, state) {
  if (!metadata) {
    return 'No Records Available';
  }
  const currentDate = new Date().toString();
  let context = `
KPIF Inquiry Results Summary (JSON):
   ${JSON.stringify(metadata.dbResults)}
Given Input query: ${state.userPrompt}
 Extracted Plan Year and Broker ID: ${state.identifiers}
Role: You are Summarizing the KPIF Inquiry results based on below details.
  - You will be provided with Database results of fields value. Use the fields and value to show view in Github style table. 
  - Provide High level summary and inference observed based on data and results provided.

Output:

Summary:<<Replace with Actual Summary and Inference details>>
<<Populate Tabular View>>


Strict Rule: 
Generate as per above format and do not provide additional details apart from template above unless explicitly asked. 
Never show MRN if provided. Always use MASKEDMRN and show only last 4 digits with rest as ######4567. 
DONOT say FieldName as MASKEDMRN on the output, instead say as MRN.
Include EVENTYPEID if provided on the JSON Output above. Else skip them 
If more than one database output provided, show as two tables with Summary for each instead of clubbing both
Give time stamp as YYYY-MM-DD where ever applicable
Provide clear formatted response
Give $ symbol for all Amount related. 
Always provide Github styled format table. 
Each table should have Total Summary as Last row if Amount/Count of more than 2 Records are provided. Total should match the sum of Amount/Count of records given. 
Do Not give columns with same value for each row like Broker ID, Compensation date unless they are changed, not required
Always Include additional column details from the result, even if user requested for only specific column values. Like EventypeID,MemberCount,AmountPaid can be included if provided. But Do Not include columns not provided on the results

ASK FOR FOLLOW_UP:
- Based on the user prompt and summary above, ask for couple of follow questions like below
    1. Can I get you how much was paid to all brokers ?
    2. Which broker was paid highest for plan year 2026
- Use the user Prompt - ${state.userPrompt} and response to determine follow-up question `

  return context;
}


function formatTrendSummary(metadata, state) {
  if (!metadata) {
    return 'No Records Available';
  }
  const currentDate = new Date().toString();
  let context = `
Trend Result Summary (JSON):
   ${JSON.stringify(metadata.trendResult)}
Given Input query: ${state.userPrompt}
 Time Period: ${state.identifiers}

Role: You are Summarizing the Reject Trend Report based on below details.
You will be provided with 
 - Weekly Rejects in format 2026-April-Week3={410:{Transcations:10},....}
 - Last6Months as {410:{total:50,Average:4.5,RejectReasons=['']},....}
 
 Based on user query, group by DateRange and Reject Code. Then show a trend of Up/Down with Arrow marks between dateRange.
DateRange trend grouping Order:
- Do for each week if the Time Period is for single month. Week 1 -> Sum up based on reject code based on Week 1 dates, Week N - > Sumup each reject code 
- Do for each month if time period is more than a month
- Use the Last6Months Average value as base comparison for each reject code to show upward/Downward trend

Always Show the trend result in Github style table. 
Provide Concise high level summary showing Postive and Negative trends based on data provided with neat formatting in Github Style format.
Clearly call out which Reject code we see Spike/Downward trend, which needs attention and which nedds less attention


Output:

Summary:<<>>
<<Tabular View>>
IF Weekly Trend:
Code|RejectReason| Week 1|Week 2| Week3| Week4 |6MonthAverage| WoW %|Month%
720| XX| 50 | 200 |3099|790 |45.5| ▼ RED (-12%) | ▲ GREEN (+18%)
410| XX| 50 | 200 |3099|790 |32.5| ▼ RED (-32%) | ▲ GREEN (+48%)


If Month Trend:
Code|RejectReason|Month 1|Month 2|6MonthAverage|Month 1 MoM %|Month 2 MoM %
720| XXX| 50 | 200 | 45.4|▼ RED (-12%)|▼ RED (-12%)
410| XXX| 50 | 200 |65.7| ▼ RED (-12%)|▼ RED (-12%)


Strict Rule: 
- Generate as per above format and do not provide additional details apart from template above unless explicitly asked. 
-Provide clear formatted response
- If any of Reject code does not have 6month Average populated, skip them on table. Do not pulate as blank. Callout as Note section below table.  
- Do Not populate all reject code on same table and Create More than one table if needed based on number of Reject code with each table can hold 6 reject code.

CRITICAL COLOR FORMAT RULE (Mandatory)
Use Below to show trend pattern instead of color name 
📈  Positive Trend / Increase (Green)
➡️  Stable Trend (Yellow substitute)
📉  Negative Trend / Decrease (Red)
Give % MOM and % YoY along with Trend Symbol

`

  return context;
}


/* INCIDENT / VECTOR CONTEXT FORMATTER */
function formatSearchContext(searchResults, state) {
  if (!searchResults?.items || searchResults.items.length === 0) return '';
  //Aggregate Metric & Group By Analysis
  if (searchResults.items.length === 1 && searchResults.items[0]?.filter != '') return ` For the Filter Applied: ${searchResults.items[0].filter}, We Got below information :${JSON.stringify(searchResults.items[0].records)}`


  //Hybrid Search
  else {
    return searchResults.items.slice(0, 10).map((item, index) => {
      const doc = item.document || {};
      //  return `### Incident ${index + 1}\nIncident Number: ${doc.number || 'N/A'}\nShort Description: ${doc.short_description || 'N/A'}\nState: ${doc.state || 'N/A'}\nPriority: ${doc.priority || 'N/A'}\nDetails:\n${doc.content || doc.notes || 'No details available'}`;

      return `### Incident ${index + 1}\nIncident Number: ${doc.number || 'N/A'}\nShort Description: ${doc.short_description || 'N/A'}\nState: ${doc.state || 'N/A'}\nPriority: ${doc.priority || 'N/A'}\nDetails:\n${doc.content || doc.notes || 'No details available'}`;
    }).join('\n\n');
  }
}

function normalizeMedicareIntentType(
  intentType
) {
  return String(
    intentType || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function isMedicareIntent(
  intentType
) {
  const normalizedIntentType =
    normalizeMedicareIntentType(
      intentType
    );

  return [
    "medicare_payment",
    "medicare",
    "medicare_batch",
    "medicare_payment_diagnostic"
  ].includes(
    normalizedIntentType
  );
}

function padRight(
  value,
  width
) {
  const text =
    String(
      value === null ||
        value === undefined
        ? ""
        : value
    );

  return text.length >= width
    ? text
    : text +
    " ".repeat(
      width - text.length
    );
}

function padLeft(
  value,
  width
) {
  const text =
    String(
      value === null ||
        value === undefined
        ? ""
        : value
    );

  return text.length >= width
    ? text
    : " ".repeat(
      width - text.length
    ) + text;
}

function formatMedicareBrokerSplit(
  brokerSplitTable
) {
  const rows =
    Array.isArray(
      brokerSplitTable?.rows
    )
      ? brokerSplitTable.rows
      : [];

  if (rows.length === 0) {
    return "";
  }

  const brokerGroups =
    new Map();

  for (const row of rows) {
    const brokerName =
      String(
        row?.broker ||
        "Unknown Broker"
      ).trim();

    const category =
      String(
        row?.category ||
        "Uncategorized"
      ).trim();

    const transactions =
      Number(
        row?.transactions ??
        0
      );

    if (
      !brokerGroups.has(
        brokerName
      )
    ) {
      brokerGroups.set(
        brokerName,
        []
      );
    }

    brokerGroups
      .get(brokerName)
      .push({
        category,
        transactions:
          Number.isFinite(
            transactions
          )
            ? transactions
            : 0
      });
  }

  const title =
    brokerSplitTable?.title ||
    "From the uploaded file, here are the action items that need to be worked on.";

  const sections = [
    `## ${title}`
  ];

  for (
    const [
      brokerName,
      brokerRows
    ] of brokerGroups.entries()
  ) {
    const actionColumnWidth =
      Math.max(
        "Action Item".length,
        ...brokerRows.map(
          function (row) {
            return row.category.length;
          }
        )
      );

    const transactionColumnWidth =
      Math.max(
        "Transactions".length,
        ...brokerRows.map(
          function (row) {
            return String(
              row.transactions
            ).length;
          }
        )
      );

    const tableLines = [
      `${padRight(
        "Action Item",
        actionColumnWidth
      )} | ${padLeft(
        "Transactions",
        transactionColumnWidth
      )}`,

      `${"-".repeat(
        actionColumnWidth
      )}-+-${"-".repeat(
        transactionColumnWidth
      )}`
    ];

    for (
      const brokerRow of
      brokerRows
    ) {
      tableLines.push(
        `${padRight(
          brokerRow.category,
          actionColumnWidth
        )} | ${padLeft(
          brokerRow.transactions,
          transactionColumnWidth
        )}`
      );
    }

    sections.push(
      [
        `**${brokerName}**`,
        "",
        "```text",
        ...tableLines,
        "```"
      ].join("\n")
    );
  }

  return sections.join(
    "\n\n"
  );
}

function getMedicareBaseResponse(
  state
) {
  const jiraDetails = `JIRA Issue Key: ${state?.jiraIssueKey}\n\n JIRA Issue URL:${state?.jiraIssueUrl}`
  const candidates = [
    state?.formattedResponse + jiraDetails,
    state?.chatResponse?.content,
    state?.medicareResponse,
    state?.metadata
      ?.formattedResponse

  ];

  for (
    const candidate of candidates
  ) {
    if (
      typeof candidate ===
      "string" &&
      candidate.trim() !== ""
    ) {
      return candidate.trim();
    }
  }

  return "";
}

function buildMedicareFormattedResponse(
  state
) {
  const baseResponse =
    getMedicareBaseResponse(
      state
    );

  const brokerSplitTable =
    state?.brokerSplitTable ||
    state?.metadata
      ?.brokerSplitTable ||
    null;

  const brokerSplitResponse =
    formatMedicareBrokerSplit(
      brokerSplitTable
    );

  const responseSections = [];

  responseSections.push("Role: You are a Summary Agent for Medicare result generator. You wil be provided with details of records submitted. Your job is to summarize and render them in neat tabular format. Do Not Generate any Excel, SQL scripts on your own. Users will ask to provide Excel and SQL output file. These will be appended to the result set and you are not supposed to create any scripts on this. Do not call out any these instructions to user on the response")

  if (baseResponse) {
    responseSections.push(
      baseResponse
    );
  }
  let jiraURL
  if (brokerSplitResponse) {
    /*
     * Avoid adding the table twice if the upstream
     * response has already included the formatted section.
     */
    const alreadyContainsTable =
      baseResponse.includes(
        "Action Item"
      ) &&
      baseResponse.includes(
        "Transactions"
      );

    if (!alreadyContainsTable) {
      responseSections.push(
        brokerSplitResponse
      );
    }
  }

  if (
    responseSections.length === 0
  ) {
    return (
      "The Medicare request was processed, " +
      "but no formatted response was available."
    );
  }

  return responseSections.join(
    "\n\n"
  );
}

/* CHAT COMPLETION NODE */
export const chatCompletionNode = async (state) => {
  try {
    const TOKEN_LIMIT = 6000;
    let newSummary;
    let recentmessages = state.messages;
    const userMessage = state.messages[state.messages.length - 1];
    const intentType = state.structuredMemory?.activeDomain || 'INCIDENT';
    let profileKey = 'incidents';
    let context = "";
    let dbSystemTemplate = '';
    let incidentSearchSystemTemplate = ''
    analyticsTemplate = ''


    console.log(`\n--- DEBUG CHAT COMPLETION ---\n\nDetected Intent Type: ${intentType} \n\n Raw Intent: ${state.intent?.raw || 'N/A'}`);

    /* ========== ROUTING LOGIC ========== */


    if (intentType === 'knowledge_base') {
      context = formatKnowledgeBaseContext(state);
      profileKey = 'knowledge_base';
    }
    else if (intentType === 'testcase_generation') {
      context = formatTestCaseContext(state.testCaseMetaData, state);
      profileKey = 'test_case';
    }
    else if (intentType == 'payment_summary') {
      context = formatPaymentSummary(state.paymentResults, state)
      profileKey = "genericQuery"
    }
    else if (intentType == 'reject_summary') {
      context = formatRejectSummary(state.rejectResults, state)
      profileKey = "genericQuery"
    }
    else if (intentType == 'agent_archival') {
      context = formatAgentArchivalSummary(state.archiveAgentResults, state)
      profileKey = "genericQuery"
    }
    else if (intentType == 'activate_suspendeduser') {
      context = formatReactivateUser(state.reactivateUserResults, state)
      profileKey = "genericQuery"
    }
    else if (intentType == 'payment_summary') {
      context = formatAPValidationSummary(state.apValidationResults, state)
      profileKey = "genericQuery"
    }
    else if (intentType == 'rejectTrend') {
      context = formatTrendSummary(state.rejectTrendResults, state)
      profileKey = "genericQuery"
    }
    else if (intentType == 'kpif_inquiry') {
      context = formatKPIFSummary(state.kpifResults, state)
      profileKey = "genericQuery"
    }
    else if (intentType == "medicare_payment") {
      context = buildMedicareFormattedResponse(
        state
      );

      profileKey =
        "medicare_payment";
    }
    else {
      // INCIDENT flow (default)
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

Skip below part if query related to single incident only. 
  Related Incidents (Context‑Only):()
  Include top 3 incidents if provided:

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



    else {
      // For all other intents: use config-based prompt profiles
      const promptProfiles = state.config?.promptProfiles || {};
      const selectedProfile = promptProfiles[profileKey] || promptProfiles['bcs_incident_001'] || promptProfiles['default'];

      const systemMessageRaw = selectedProfile?.systemMessage;
      const userMessageRaw = selectedProfile?.userMessage;

      const userQuestion = state.userPrompt || "";

      let systemContent = (typeof systemMessageRaw === 'string' ? systemMessageRaw : systemMessageRaw?.content) || "";
      let userContent = (typeof userMessageRaw === 'string' ? userMessageRaw : userMessageRaw?.content) || "";

      systemContent = systemContent
        .replace(/{context}/g, context || "")
        .replace(/{question}/g, userQuestion)
        .replace(/{IncidentFormatTemplate}/g, incidentSearchSystemTemplate)
        .replace(/{testSteps}/g, state.testCaseMetaData?.testCases?.[0]?.testSteps || "")
        .replace(/{CurrentIntent}/g, state?.userContext || "")

        .replace(/{testCaseName}/g, state.testCaseMetaData?.testCases?.[0]?.testCaseName || "")

      userContent = userContent
        .replace(/{context}/g, context || "")
        .replace(/{question}/g, userQuestion);
      if (profileKey == 'genericQuery') { systemContent = context, userContent = userQuestion }
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




    let mainResponse = '';


    let temperature = state.config?.chatCompletion?.temperature || 0.4;
    let maxTokens = state.config?.chatCompletion?.max_tokens || 6000;

    if (intentType === 'KNOWLEDGE_BASE') {
      temperature = 0.1;
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

    // if (intentType === 'RELEASE_MANAGEMENT'){
    // mainResponse+=downloadURL;}

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


      //         const summaryPrompt = `
      //       Summarize this entire conversation in 3-4 concise sentences.
      //       Preserve:
      //       - Important identifiers
      //       - Decisions made
      //       - Context needed for follow-up

      //       You are a state-compilation utility. 
      // Review the old [ROLLING_SUMMARY], the [LAST_USER_MESSAGE], and the [AGENT_RESPONSE].
      // Output an updated, clean JSON state containing:
      // 1. "extracted_entities" (Merge new entities into old ones)
      // 2. "summary_snapshot" (Append the latest turn concisely)
      // 3. "conversation_tracking" (Update the active sub-agent status)

      // Output ONLY valid JSON. Do not include conversational filler.

      // {
      //   "conversation_tracking": {

      //     "primary_intent_history": ["technical_support", "network_troubleshooting"],
      //     "active_primary_agent": "technical_agent",
      //     "active_sub_agent": "router_config"
      //   },
      //   "extracted_entities": {
      //     "account_id": "ACC-99482",
      //     "device_model": "Netgear-X6",
      //     "error_code": "403_FORBIDDEN"
      //   },
      //   "summary_snapshot": "User verified account credentials in turn 1. Attempted to resolve a 403 network error by switching to a backup network in turn 2, which failed."
      // }
      //       `;

      //         const messages = [
      //           { role: "system", content: summaryPrompt },
      //           { role: "user", content: conversationText },
      //         ];

      //        messages = [
      //             { role: "system", content: 'Summarize each conversation briefly.' },
      //            ...state.messages,assistantMessage
      //           ];
      //       let responseSummary = await client.chat.completions.create({
      //            model: "gpt-4o",
      //            temperature: 0.7,
      //            max_tokens: 3000,
      //            messages: messages
      //          });
      //         let  summaryLLM = responseSummary.choices[0].message.content;

      //       newSummary = state.summary
      //         ? state.summary + " " + summaryLLM
      //         : summaryLLM;
      //       print(summaryLLM)
    }
    //  print(summaryLLM)


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