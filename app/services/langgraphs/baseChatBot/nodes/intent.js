'use server';
import { chatCompletion, sendChatCompletionWithImage2 } from "@/app/services/chatCompletionService2";
//import { testUpload } from "./testUpload";
/**
 * Detect user intent and classify into one of 5 categories
 */


async function extractTextFromImage(state) {


  const messages = [
    {
      role: "system",
      content: "You will be provided with image of email screenshot for Agent Archival process. Extract all visible text in structured format"
    },
    {
      role: "user",
      content: [
        { type: "text", text: `Analyze and extract all text` },
        { type: "image_url", image_url: { url: state.metadata.attachmentContent } }
      ]
    }
  ];

  const completionConfig = {
    temperature: 0,
    max_tokens: 4000,
    model: "gpt-4o",
    messages: messages,
    teamName: state?.teamName,
    assistantName: state?.assistantName,
    nuid: state?.nuid
  };

  const response = await chatCompletion(completionConfig);
  return response


}



export async function detectIntent(state) {
  // try{


  // let re=await testUpload(state.userPrompt)}
  // catch(error){console.log(error.message)}
  //let response_=await getSAPRecords();
  const config = state.config || {};

  let structuredMemory = {};
  let summary = "";
  let messages = [];

  if (!state.messages) { messages = [], state.messages = [] }
  if (!state.summary) { state.summary = ''; }
  if (!state.tokenCount) { state.tokenCount = 0 }
  if (!state.structuredMemory) {
    state.structuredMemory = {};
    structuredMemory = state.structuredMemory
  }

  // const sqlQuery=""
  // const baseUrl="http://localhost:3000"
  // const dbResponse = await fetch(`${baseUrl}/api/splunk`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ sql: sqlQuery })
  // });

  let activeDomain = state.structuredMemory?.activeDomain;
  let detectedIdentifier = ''
  // const activeDomain = state.structuredMemory?.activeDomain;
  let domainMemory = state.structuredMemory?.domains || {};
  let domainData =
    activeDomain && state.structuredMemory?.domains?.[activeDomain]
      ? state.structuredMemory.domains[activeDomain]
      : null;


  //Check for image attachment
  let imageContent
  if (state.metadata.attachmentContent.includes('data:image/')) {
    imageContent = await extractTextFromImage(state)

  }



  // Comprehensive intent detection system message
  //2/6/26 - Final Updated Intent classification.
  let identifierString = JSON.parse(JSON.stringify(domainData?.lastIdentifier ?? '{"result":"Not Records"}'))
  // identifierString=JSON.prase().replace('\','')
  const currentDate = new Date().toString();
  const defaultSystemMessage = `You are an intent classification expert for an enterprise IT conversational agent.

Your responsibilities are to:
1. Identify the user’s CURRENT intent
2. Determine whether the request is NEW or a FOLLOW_UP
3. Classify the REQUEST SCOPE (instance vs generic vs trend)
4. Determine whether identifiers are required
5. Respond strictly in the defined JSON format

----------------------------------------------------------------
ACTIVE CONTEXT (ALWAYS EVALUATE FIRST)
----------------------------------------------------------------
Previous Active Intent: ${activeDomain ?? "None"}
Previous Identifier for Active Intent: ${JSON.stringify(identifierString)}
Current Date: ${currentDate}. Current Date is considered as Today
Active Context Rules (STRICT RULE):
- Always evaluate whether the current request is a FOLLOW_UP using the Previous Active Intent.
- Never reuse identifiers across different intents.
- If the request is a FOLLOW_UP,  reuse the previous identifier if no new identifier is required/ provided -> Mandatory for Follow-up 
- If the request is a FOLLOW_UP but introduces a new instance requiring identification, set identifier_needed to yes.
- If the topic clearly changes, treat as NEW.

----------------------------------------------------------------
INTENT CATEGORIES (CHOOSE EXACTLY ONE)
----------------------------------------------------------------

1. incident_management
- Incidents, errors, failures, alerts, outages
- Root cause analysis (RCA)
- Logs, transactions, quotes, RQRs, work items
- Recurring issues or patterns
- Incident summaries or problem analysis

Examples:
- "What happened with INC12345?"
- "Why is quote failing?"
- "Analyze rating issue"
- "Find recurring authentication failures"
- "Summarize incidents related to memory issue"
- "Can you give me number of incidents raised in last 2 weeks"
-" How many incidnets related to rating error"
-" "How many incident raised in Jan 2026 and tgroup them by assignemetn group
---------------------------------------------------------------

2. testcase_generation
- Manual test cases
- Test scenarios or validation steps

Examples:
- "Generate test cases for login"
- "Create negative test cases for password reset"

3. testscript_generation
- Automation scripts
- UFT, API, or automation code

Examples:
- "Create UFT Automation script for login"
- "Generate automation for checkout flow"

4. knowledge_base
- Concept explanations
- How‑to or best practices
- Process or system documentation

Examples:
- where can i place the Input file for REGED Cost Report Job?
- Explain about rejection logic
- What is commission valdiation


5.payment_summary
- Generate Summary for Compensation cycle for Week 3
- Get me Week 5 summary for payment or Adhoc Payment summary
- Generate trueup Summary for July Week 3 or Currnet Week
- Payment Cycle date inquiry


6.reject_summary
- Reject Summary for  Commerical, Medicare, KPIF for a given day or specific period

7. greetings:
User says Hello, Hi, Any Greeetings like How are you, What can you help with

8. out_of_scope:
Any other questions which does not fall under above 7 categories are marked as out_of_Scope
-Example: What is weather today, who is President, what date is today, can i get current news

9. getservicenowRecords: User When asks for
- Provide latest incidents assigned to them or team
- Get me incidents tagged to me or team
- How many open incidents are there
- Get me list of incidents tagged 

10. medicare_payment:
- Processing Medicare payment batch files or return result Excel files
- Medicare payment diagnostic calculations or validation queries
- Analyzing Medicare processed result files or Medicare batch execution

Examples:
- "Please process this Medicare payment batch file return result excel"
- "Analyze Medicare payment batch file result"
- "Process Medicare return result file"

11. agent_archival:
-  Please archive/delete this agent in Amerilife. The agent stays with Integrity.
- Terminate the Agent

12. activate_suspendeduser:
- Activateuser who lost his access or suspended user

13. kpif_inquiry:
- Get me total termed or active or renewal member for a plan year for the given broker 
- Get me amount paid for given broker for a plan year  or compensation period
- Member payment done for given broker for a plan year or compensation period
- Monthly Payments done for broker

14. apValidations:
- Generate AP Validation for July Week 5 or Last month Week 3 or Week 2 of April
- Get me Total Credit held incentive for July Week 3
- Generate Total Credit/Deposit held incentive for August Week 2

15. rejectTrend:
- Compare reject trend for last 3 months
- Get me reject summary for June month


----------------------------------------------------------------
IDENTIFIER EXTRACTION RULES
----------------------------------------------------------------

A) If intent = incident_management:

   - If query related to identifer called out on excamples,  = INSTANCE_LEVEL:
       - Identifier is REQUIRED
       - Examples: INC, Quote ID, RQR, Work Item, RQR_ID, base_instruction
       - If missing → identifier_needed = Yes

   - If query is generic issue:
       - Identifier is NOT required
       - identifier_needed = No
  
   - If scope = TREND_OR_RCA:
       - Identifier is NOT required
       - Extract date range if present

B) If intent=payment_summary or intent=apValidations:
  - identifier will be
    - Week, Month and Year to be extracted from input like June 2026 Wk 3 or July 2026 Wk 3
    - Say User mentioned as Current month/ Current year then use current date value to generate identifier with format of "Month Year Week" as "June 2026 Wk 3", where Week to be said as WK
    - If user requested for payment cycle dates, no identifier is needed.
  - identifier_needed:Yes
      If user not provided any month/year related details.
      Add above two identifier context on the follow up question to refer on the format

C) If intent=reject_summary:
  - identifier will be in JSON format as {"start_date":"","end_date":"","reject_type":""}
    - Exact Date or Date Range to be provided in format as  (TO_DATE('?', 'MM/DD/YYYY') ) . Replace ? with date
    - use current date to determine date range if user says last 2 weeks or last 3 months or last 20 days. Subtract from current date in those cases to get date range.
    - Type of Rejects - Commerical, Medicare, KPIF and it will be under reject_type
  - identifier_needed:Yes
      If user not provided any date / range of dates and type of reject details.
      Do Not ask Again if user already provided reject_type or date range. Only missing from any othese two should be asked

D) If intent = testcase_generation or intent=testscript_generation:
   - JIRA ID (BASE-***) is required only if feature or acceptance criteria details are not provided. If already provided, use them. Else ask the user
   - JIRA ID Example - BASE-14567 , BCS-45679, BASE-***, BCS-***
   If user has provided feature or acceptance criteria details, JIRA ID not required. 

E) if intent= knowledge_base
    - Provide the entire user input query to the  identifier

F) If intent=kpif_inquiry:
  - identifier will be in JSON format {"plan_year":"","broker_id":[],"mrn":"","compensation_period":""}
    - plan of year to be provided by the user if query related to it. It can be only "year" or "plan year" on input query
    - Broker ID will be one or more and to be extracted as list
    - MRN is required if user wants to check for any MRN related
    - compensation_period to be provided is user asks for query based on compensation
    - If compensation_period is provided, then plan of year is optional. Same way if plan of year is provided, compensation_perios is optional.
    - Either Broker ID or plan Year to be provided. So on of them is Optional if other is provided
    - Do Not ask for user to provide Broker list if Plan year is provided. 
    
    Examples:
    - how much was paid to broker zzz for plan year yyy based on compensation period. Here use plan of year, so compensation_period not completed 
    - Get me payment for MRN XXXXXX5647 for plan year 2026-> Here Plan year is provided. 

G) If intent=agent_archival:
  - identifier should be Strict JSON format only {"npn_id":"","broker_remove":[],"broker_retain":[],"subcategory":""}
    - NPN ID of the agent to be removed. NPN along with Agent Name also can be provided.
    - Agent to be removed from Broker should be provided. E.g. Agent to be archived with "HPONE" and "APITA"
    - Agent to be retained with Broker can be provided (Optional). E.g Agent stays with "EHEALTH" and "GOHEALTH"
    - Can be more than one broker names for retain or remove can be provided and to be extracted as List
    - If Agent to be terminated, only NPN is needed. 
    - Always populate the identifier keys in JSON format provided.
    - if requested for number of request submitted/processed,populate blank value for identifier Keys in same JSON
    - if request related to 
        -archival request, then subcategory will be "archival"
        -number of requests processed, then subcategory is "metrics"
  - identifier_needed:Yes
      If user not provided NPN. Broker name to be removed is not needed for Agent termination, else mandatory to provide

H) If intent=activate_suspendeduser:
  - identifier will be
    - userid to be activated {"userid":""}

I) If intent=rejectTrend:
  - identifier will be JSON format {"timeperiod":""}
    - timeperiod to be provided.
    - Last 2 months or June Month

J) All other intents:
   - No identifiers required


STRICT PAYMENT ROUTING:
- Do not classify a request as 'payment_summary' merely because it contains "payment". Requests for payment/payment amount by year, plan year,compensation period, month, or broker belong to kpif_inquiry.
- Use 'payment_summary' only when the latest user request explicitly refers to Week 3, Week 5, True-up, Adhoc Payment, Payment Cycle Date, or explicitly asks for a payment/compensation cycle summary.
- This rule applies to both standalone and follow-up requests. The latest explicit scope overrides the previous conversational intent.
Example:
"Get me payment for year 2026" -> kpif_inquiry
"Give me Week 3 payment summary" -> payment_summary


----------------------------------------------------------------
OUTPUT FORMAT (STRICT)
----------------------------------------------------------------
Respond ONLY in the following JSON format.
Do NOT include explanations or extra text.

{
  "intent": "",
  "context": "NEW|FOLLOW_UP",
  "identifier_needed": "Yes|No",
  "identifier": "",
  "identifier_question": "",
  "continueFlow":true|false
}

Identifier Extraction:
Always refer the previous identifier field for identifier extraction in addition to current user context.
Do not overwrite previous identifier values if any of them are not provided. 
 

Rules:
- identifier_needed = "Yes" ONLY if required but missing
- identifier_question must be populated ONLY when identifier_needed = "Yes"
- identifier - populate with provided data even when identifier_needed='No'
- If multiple identifiers are required, request all in one question
- continueFlow - This will be false for Greetings and OutOfScope. Rest of categories wit will be true
- If User asks for FOLLOW_UP request for intent=incident_management, like get me RCA, give me resolution, preventive actions, how can i resolve, what steps needs to solve -> No identifier needed
`




  // Use config system message if available, otherwise use default
  const systemMessage = {
    role: "system",
    content: defaultSystemMessage, ...(summary
      ? [
        {
          role: "system",
          content: `Conversation Summary:\n${summary}`
        }
      ]
      : []),

    ...messages.slice(-20)
  } // last 20 only;
  let userMessage
  if (imageContent != '') { userMessage = { role: "user", content: `Extracted Content From Image: ${imageContent}. User input: ${state.userPrompt}` }; }
  else { userMessage = { role: "user", content: `User input: ${state.userPrompt}` }; }

  const messagesSummary = [
    //{ role: "system", content:prompt},// "You extract database identifiers from user queries. Return only valid JSON." },
    systemMessage,
    userMessage]

  const completionConfig = {
    temperature: 0,
    max_tokens: 2500,
    model: "gpt-4o",
    messages: [
      systemMessage,
      userMessage
    ],
    teamName: state?.teamName,
    assistantName: state?.assistantName,
    nuid: state?.nuid
  };

  const response = await chatCompletion(completionConfig);

  try {
    const intentResponse = response//.choices[0].message.content
    const cleanedJsonResponse = intentResponse
      .replace(/```json|```/g, "")
      .trim();

    const parsedJsonSummary = JSON.parse(cleanedJsonResponse);
    const content = parsedJsonSummary.intent.trim();
    const userContext = parsedJsonSummary.context.trim();
    const identifiers = parsedJsonSummary.identifier;
    const identifier_needed = parsedJsonSummary.identifier_needed;
    const identifier_question = parsedJsonSummary.identifier_question;
    const continueFlow = parsedJsonSummary.continueFlow
    if (identifier_needed == 'No') { detectedIdentifier = identifiers }
    // Validate and normalize the intent
    const validIntents = [
      'incident_management',
      'problem_management',
      'testcase_generation',
      'testscript_generation',
      'knowledge_base',
      "payment_summary",
      "reject_summary",
      "greetings",
      "out_of_scope",
      "getservicenowRecords",
      "medicare_payment",
      "agent_archival",
      "activate_suspendeduser",
      "kpif_inquiry",
      "apValidations",
      "rejectTrend"

    ];

    // Find matching intent
    let intent = 'knowledge_base'; // Default fallback
    for (const validIntent of validIntents) {
      if (content.includes(validIntent.replace('_', '')) || content.includes(validIntent)) {
        intent = validIntent;
        break;
      }
    }

    // Direct match check
    if (validIntents.includes(content)) {
      intent = content;
    }
    const intentRaw = intent;
    console.log(`[detectIntent] User prompt: "${state.userPrompt.substring(0, 80)}..." -> Intent: ${intent}`);
    if (intent !== activeDomain) {
      // switching domain
      activeDomain = intent;
    }

    let formattedResponse;
    if (!continueFlow && intentRaw == "out_of_scope") {

      formattedResponse = "Sorry, I am trained to respond only for BCS related Queries"
    }
    else if (!continueFlow) {

      formattedResponse = `Hello! How can I help you today? 
You can ask me any questions related to BCS incidents, the knowledge base, DevOps release management, test cases, or application performance trends.`
    }


    const updatedStructuredMemory = {
      activeDomain: intent ?? activeDomain,

      domains: {
        ...domainMemory,
        [intent]: {
          lastIdentifier:
            detectedIdentifier ??
            domainMemory?.[intent]?.lastIdentifier ??
            null
        }
      }
    };


    return {
      ...state, intentRaw, identifiers, identifier_needed, userContext, identifier_question, continueFlow, formattedResponse,
      messages: [...state.messages,
      { role: "user", content: state.userPrompt }
      ],

      identifier:
        detectedIdentifier ??
        domainMemory?.[intent]?.lastIdentifier ??
        null,
      structuredMemory: updatedStructuredMemory
    };
  } catch (e) {
    console.warn('[detectIntent] Failed to detect intent:', e.message);
    return {
      ...state,
      intentRaw: 'knowledge_base',// Default fallback
      identifiers: '',
      identifier_needed: "No",
      userContext: ''
    };
  }
}