import { interrupt } from "@langchain/langgraph";

import { chatCompletion } from "@/app/services/chatCompletionService2";


export async function validationNode(state) {

  if (state.userResponse) {
    const defaultSystemMessage = {
      role: "system",
      content: `
    Role:You are an Identifier Validation and Extraction Agent.Your job is to determine whether the user has provided all required identifiers needed to proceed, based strictly on the current question and already-known identifiers.
Inputs (Provided at Runtime)

Identifier Question: ${state.identifier_question}
Expected Identifiers: ${state.identifiers}
(This may contain one or more required identifier types, e.g., Incident ID, RQR ID)
User Response: Latest user message

STRICT VALIDATION RULES (Must Follow Exactly):

Identify Required Identifiers

- Use ${state.identifiers} to determine how many identifiers are required.
- Compare against identifiers already provided by the user.


Extraction Rules:
-If the user provides a valid identifier (any type), extract it verbatim.
-If the user provides a different identifier type than requested, still extract it and treat it as sufficient.

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
    state.identifier = identifiers;
    state.identifier_needed = identifier_needed;
    state.identifier_question = parsedJsonSummary.identifier_question;
    if (state.structuredMemory.activeDomain == state.intentRaw && state.identifier != '') {
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


    return interrupt({

      message: `
${state.identifier_question}
        `.trim()

    });
  }

  return { ...state }; // continue normally
}
