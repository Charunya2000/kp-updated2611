'use server';
import { chatCompletion } from "@/app/services/chatCompletionService2";


/**
 * Detect user intent and classify into one of 5 categories
 */
export async function detectIntent(state) {
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


  // Comprehensive intent detection system message
  //2/6/26 - Final Updated Intent classification.
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
Previous Identifier for Active Intent: ${domainData?.lastIdentifier ?? "Not Provided"}

Active Context Rules:
- Always evaluate whether the current request is a FOLLOW_UP using the Previous Active Intent.
- Never reuse identifiers across different intents.
- If the request is a FOLLOW_UP and no new identifier is required, reuse the previous identifier. If incident_management was the intent and user asked as follow-up for RCA, resolution or any query related to incident, no identifier is needed.
- If the request is a FOLLOW_UP but introduces a new instance requiring identification, set identifier to null.
- If the topic clearly changes, treat as NEW.

----------------------------------------------------------------
INTENT CATEGORIES (CHOOSE EXACTLY ONE)
----------------------------------------------------------------

1. qa_review
Use when the user asks about:
- review the question and response

---------------------------------------------------------------

2. intake_assignment
Use when the user wants:
- route the RFP to PC

---------------------------------------------------------------

3. scoring_rubric
Use when the user wants:
- score the RFP

4. greetings:
User says Hello, Hi, Any Greeetings like How are you, What can you help with

5. out_of_scope:
Any other questions which does not fall under above 3 categories are marked as out_of_Scope
-Example: What is weather today, who is President, what date is today, can i get current news
----------------------------------------------------------------
REQUEST SCOPE CLASSIFICATION (CRITICAL)
----------------------------------------------------------------
Classify the request scope as EXACTLY ONE:

1. INSTANCE_LEVEL
   - Refers to ONE specific incident or transaction
   - Requires an identifier
   - Examples:
     - "INC12345 RCA"
     - "Why did quote 32069717 fail?"
     - "Check logs for RQR99887"
     - "Rating Error due to RQR - 123345"
     - "Rating Error due to RQR ID- 123345"
     - "System issue RQR_ID 4354343"
     - "Critical issue or Rating error RQR_ID - 43453"
     - "System error base_instruction_id -45gghjkkk68568"


2. GENERIC_ISSUE
   - Refers to a category or type of problem
   - No specific instance implied
   - Examples:
     - "Analyze rating issue"
     - "Quote not found error"
     - "Memory issue in pricing service"

3. TREND_OR_RCA
   - Analysis across multiple incidents or time periods
   - Examples:
     - "Recurring rating issues"
     - "RCA for authentication failures last week"
     - "Incidents raised in last 5 days"

----------------------------------------------------------------
INTENT DECISION RULES
----------------------------------------------------------------
- Instance‑specific OR generic issues OR trends → incident_management
- Manual tests → testcase_generation
- Automation scripts → testscript_generation
- General explanation → knowledge_base
- greetings -> greetings
- Out of Scope ->out_of_scope
- Incidents opened -> getservicenowRecords
- List of Issues -> getSplunkLogs
- If unsure → knowledge_base

----------------------------------------------------------------
CONTEXT DETERMINATION (NEW vs FOLLOW_UP)
----------------------------------------------------------------
Determine request context using Previous Active Intent and user language.

NEW:
- Topic differs from previous intent
- No reference to prior discussion
- Same intent but a completely new question

FOLLOW_UP:
- Continues same topic or intent
- Uses references like "this", "that", "previous", "add more", "explain further"
- Builds on prior response
- For AI Score card , User may ask based on report generated what is trend anticipated for next few weeks or anamolies or corrective action

CRITICAL NOTE: If intent is knowledge_base, consider all as NEW. Only if the context of current user Query and the previous user query from "Previous Identifier for Active Intent" are follow-up, then consider it is FOLLOW_UP

{
  "context_type_examples": {
    "NEW": [
      {
        "user_input": "Summarize the incident",
        "intent": "incident_management",
        "context": "NEW",
        "identifier_needed": "Yes",
        "identifier": "",
        "identifier_question": "Kindly provide the Incident ID to proceed."
      },
      {
        "user_input": "Can you find RCA on rating issues?",
        "intent": "incident_management",
        "context": "NEW",
        "identifier_needed": "No",
        "identifier": "",
        "identifier_question": ""
      },
       {
        "user_input": "Can you find RCA on rating issues RQR 35564?",
        "intent": "incident_management",
        "context": "NEW",
        "identifier_needed": "No",
        "identifier": "RQR -35564",
        "identifier_question": ""
      },
      {
        "user_input": "Can you get resolution time of incident?",
        "intent": "incident_management",
        "context": "NEW",
        "identifier_needed": "Yes",
        "identifier": "",
        "identifier_question": "Kindly provide the Incident ID to get the resolution time."
      }
    ],
    "FOLLOW_UP": [
      {
        "previous_active_intent": "incident_management",
        "previous_identifier": "INC12345",
        "user_input": "What is the RCA performed on the incident?",
        "intent": "incident_management",
        "context": "FOLLOW_UP",
        "identifier_needed": "No",
        "identifier": "INC12345",
        "identifier_question": ""
      }
    ]
  }
}

----------------------------------------------------------------
IDENTIFIER EXTRACTION RULES
----------------------------------------------------------------

A) If intent = incident_management:

   - If scope = INSTANCE_LEVEL:
       - Identifier is REQUIRED
       - Examples: INC, Quote ID, RQR, Work Item, RQR_ID, base_instruction
       - If missing → identifier_needed = Yes

   - If scope = GENERIC_ISSUE:
       - Identifier is NOT required
       - identifier_needed = No
  
   - If scope = TREND_OR_RCA:
       - Identifier is NOT required
       - Extract date range if present
    
  

D) If intent = testcase_generation or intent=testscript_generation:
   - JIRA ID (NPG*-***) is required only if feature or acceptance criteria details are not provided. If already provided, use them. Else ask the user
   - JIRA ID Example - NPG1-14567 , NPG2-45679, NPG3-12347, NPGPSUP-56788, NPG***-***
   If user has provided feature or acceptance criteria details, JIRA ID not required. 

E) if intent= knowledge_base
    - Provide the entire user input query to the  identifier

E) All other intents:
   - No identifiers required

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

Rules:
- identifier_needed = "Yes" ONLY if required but missing
- identifier_question must be populated ONLY when identifier_needed = "Yes"
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
  const userMessage = { role: "user", content: `User input: ${state.userPrompt}` };


  const messagesSummary = [
    //{ role: "system", content:prompt},// "You extract database identifiers from user queries. Return only valid JSON." },
    systemMessage,
    userMessage]

  const completionConfig = {
    temperature: 0,
    max_tokens: 500,
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
      'qa_review',
      'intake_assignment',
      'scoring_rubric',
      "greetings",
      "out_of_scope",


    ];

    // Find matching intent
    let intent = 'qa_review'; // Default fallback
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