import { interrupt } from "@langchain/langgraph";

import { chatCompletion } from "@/app/services/chatCompletionService2";




async function maskMRN(inpText) {


  const mrnRegex = /(?:00|11)-\d{6}(\d{4})/g;
  //first 9 matched characters with a fixed-length mask,  then append the last 4 digits 

  return inpText.replace(mrnRegex, "XX-XXXXXX$1");
}

export async function validationNode(state) {
  let activeDomain = state.structuredMemory?.activeDomain;

  let domainData =
    activeDomain && state.structuredMemory?.domains?.[activeDomain]
      ? state.structuredMemory.domains[activeDomain]
      : null;
  let identifierString = JSON.parse(JSON.stringify(domainData?.lastIdentifier ?? '{"result":"Not Records"}'))
  if (state.userResponse) {
    const defaultSystemMessage = {
      role: "system",
      content: `
    Role:You are an Identifier Validation and Extraction Agent.Your job is to determine whether the user has provided all required identifiers needed to proceed, based strictly on the current question and already-known identifiers.
Inputs (Provided at Runtime)

Identifier Question: ${state.identifier_question}
User Initial Query: ${state.userPrompt}



Previous Active Intent: ${activeDomain ?? "None"}
Previous Identifier for Active Intent: ${JSON.stringify(identifierString)}

STRICT VALIDATION RULES (Must Follow Exactly):

Never show MRN if provided. Always use MASKEDMRN and show only last 4 digits with rest as ######4567. 
Identify Required Identifiers


A) If intent = incident_management:

   - identifier will be
       - Examples: INCXXX
       
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


- Use each intent identifiers to determine how many identifiers are required based on the intent type.
- Compare against identifiers already provided by the user.

Idnetifiers:
{
"incident_management":{"INCXXX"},
"payment_summary":{"June 2026 Wk 3"},
"reject_summary":{"start_date":"","end_date":"","reject_type":""}
"kpif_inquiry":{"plan_year":"","broker_id":[],"mrn":"","compensation_period":""}
"agent_archival":{"npn_id":"","broker_remove":[],"broker_retain":[],"subcategory":""}
"activate_suspendeduser":{"timeperiod":""}
"rejectTrend":{"userid":""}
}

Critical Identifier Extraction Rules:
- Always refer the previous identifier field for identifier extraction in addition to current user context.
- Do not overwrite previous identifier values if any of them are not provided. 
-If the user provides a valid identifier (any type), extract it verbatim.
-If the user provides a different identifier type than requested, still extract it and treat it as sufficient.
- Always append/update existing identifiers based on confirmation from user.
- It should be in JSON format as per structure provided

Missing Identifier Logic:

-If any required identifier is missing, then:
    -"identifier_needed": "Yes"
- Ask only for missing identifiers in identifier_question

- Do not proceed until all required identifiers are present.

Generic / No-Identifier Scenarios:
If the user explicitly says any of the following:

  “Do it generically”
  “No identifier needed”
  “Proceed without identifier”

Then:

"identifier": null
"identifier_needed": "No"
"identifier_question": ""


Fallback Logic (Mandatory)
ScenarioBehavior: User says no identifier neededidentifier = null, identifier_needed = NoUser gives a different identifier than askedExtract it, identifier_needed = NoUser wants generic searchidentifier = null, identifier_needed = NoPartial identifiers providedAsk only for missing ones

OUTPUT RULES (ABSOLUTE)

✅ Return ONLY valid JSON
✅ Always return ALL 3 keys
❌ No markdown
❌ No explanation
❌ No extra text
✅ Key names must match EXACTLY


STRICT FINAL OUTPUT SCHEMA should be only be in below JSON (Must Match Exactly):
- Output RAW JSON ONLY.
- Do NOT include json, markdown, backticks, or quotes.
- The response must start with { and end with }.

{
"identifier": "extracted identifier value or null", 
"identifier_needed": "Yes or No", 
"identifier_question": "I am sorry, Can you please provide the <<missing identifier(s)>> to proceed."
}
    
    
Identifier Question Construction Rules:
- If multiple identifiers are missing, list all of them clearly.
- If identifier_needed = "No", then:
    "identifier_question": ""

Examples (For Understanding Only – NOT for Output):
Example 1 – Missing Identifier:
 {  "identifier": null,  "identifier_needed": "Yes",  "identifier_question": "I am sorry, Can you please provide the Incident ID to proceed."}
Example 2 – Different Identifier Provided:
 {  "identifier": "RQR ID-134567",  "identifier_needed": "No",  "identifier_question": ""}
Example 3 – Generic Request:
 {  "identifier": null,  "identifier_needed": "No",  "identifier_question": ""}
`
    };

    const systemMessage = defaultSystemMessage;
    const userMessage = { role: "user", content: `User input: ${state.userResponse}` };


    const messages = [
      //{ role: "system", content:prompt},// "You extract database identifiers from user queries. Return only valid JSON." },
      systemMessage,
      userMessage];

    const response = await chatCompletion({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 500,
      messages: messages,
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    });

    let identifiers = '';
    const intentResponse = response;
    const cleanedJsonResponse = intentResponse
      .replace(/```json|```/g, "")
      .trim();

    const parsedJsonSummary = JSON.parse(cleanedJsonResponse);
    identifiers = parsedJsonSummary.identifier;
    const identifier_needed = parsedJsonSummary.identifier_needed;
    state.identifiers = identifiers;
    state.identifier_needed = identifier_needed;
    state.identifier_question = parsedJsonSummary.identifier_question;
    if (state.structuredMemory.activeDomain == state.intentRaw && state.identifiers != '') {
      state.structuredMemory.domains[state.intentRaw].lastIdentifier = identifiers;
      state.userPrompt = state.userPrompt + "-" + identifiers;
      state.messages = [...state.messages,
      { role: "user", content: identifiers }
      ];
      //   if(state.indexMetadata){
      //     state.indexMetadata.searchQueryString=state.userPrompt;
      //   }
    }

  }

  if (state.identifier_needed == 'Yes') {
    let identiferquestion = await maskMRN(state.identifier_question)


    return interrupt({

      message: `
${identiferquestion}
        `.trim()

    });
  }

  return { ...state }; // continue normally
}
