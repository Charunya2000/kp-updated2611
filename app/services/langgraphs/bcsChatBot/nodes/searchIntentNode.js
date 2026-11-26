'use server';

import { chatCompletion } from "@/app/services/chatCompletionService2.js";

// Index constants
let indexName = "nps-incident-001"

const INCIDENT_RESOLUTION_INDEX = indexName;
const SERVICE_REQUEST_INDEX = "service_request_index";
const PROCESS_REFERENCE_INDEX = "process_reference_index";
const TEST_SCENARIO_INDEX = "test_scenario_index";

export const parseUserIntentNode = async (state) => {
  // Log all state properties except 'completionsClient'
  const { completionsClient, ...stateWithoutClient } = state;
  const messages = [
    {
      role: "system",
      content: `You are tasked to decide if the user request requires a metadata search or an index search, and if it's an index search, what type of index is needed.

      Metadata search is identified by references to automation scripts or SQL. Here are some examples:
      - "Please create an automation script that can fix a page issue in production."
      - "Please apply the data fix SQL to correct the bad data created from an incident."
      - "What SQL is needed to fix batch errors for document generation."

      Index search is identified by references to different types of queries:
      
      1. Incident Resolution queries (use nps-incident-001). If possible extract incident id from prompt and use to filter index:
      - "How was incident 123 resolved?"
      - "What was the solution for the production outage last week?"
      - "Show me similar incidents to this error."

      2. Service Request queries (use service_request_index):
      - "What's the status of service request 12345?"
      - "How do I submit a new access request?"
      - "What's the process for requesting new hardware?"

      3. Process Reference queries (use process_reference_index):
      - "What's the process for creating an invoice?"
      - "Show me the deployment checklist."
      - "What are the steps for onboarding a new employee?"

      4. Test Scenario queries (use test_scenario_index):
      - "What test cases exist for the login feature?"
      - "Show me the test scenario for defect 54321."
      - "What are the acceptance criteria for user registration?"
      
      Your response must be a JSON object with three fields:
      {
        "searchPattern": "METADATA SEARCH" or "INDEX SEARCH",
        "indexType": "nps-incident-001" or "service_request_index" or "process_reference_index" or "test_scenario_index" (only required when searchPattern is "INDEX SEARCH"),
        "incidentNumber": "INC21744478" (only required when indexType is "nps-incident-001")
      }`
    },
    { role: "user", content: state.userPrompt }
  ];

  let intentResponse = "";

  if (!state.completionsClient) {
    throw new Error('OpenAI client not initialized. Make sure it is passed in the state.');
  }

  const completionConfig = {
    temperature: 0.7,
    max_tokens: 1000,
    model: "gpt-4o",
    messages: messages,
    teamName: state?.teamName,
    assistantName: state?.assistantName
  };

  intentResponse = await chatCompletion(completionConfig);

  // Parse JSON response, handle potential errors
  let searchPattern;
  try {
    // Extract JSON from the response using RegExp.exec()
    let jsonMatch = /```json\n([\s\S]*?)\n```/.exec(intentResponse);
    if (!jsonMatch) {
      jsonMatch = /({[\s\S]*})/.exec(intentResponse);
    }
    if (!jsonMatch) {
      jsonMatch = [null, intentResponse];
    }
    const jsonString = jsonMatch[1];
    const parsedSearchIntent = JSON.parse(jsonString);

    // Ensure we have all required properties with defaults
    searchPattern = parsedSearchIntent.searchPattern || "INDEX SEARCH";
    const indexType = parsedSearchIntent.indexType || INCIDENT_RESOLUTION_INDEX;
    const incidentNumber = parsedSearchIntent.incidentNumber || "";

    // Prepare index metadata for vector search against 'content' field
    const indexMetadata = {
      indexName: indexType,
      incidentNumber: incidentNumber,
      selectedFields: ['content'],
      filter: incidentNumber
        ? `number eq '${incidentNumber}'`
        : undefined,
      // semanticString: state.userPrompt,
      promptEmbedding: state.promptEmbedding,
      // semanticConfiguration: 'default',
      top: incidentNumber
        ? 1
        : 5,
      vectorSearch: {
        enabled: true,
        field: 'content_vector',
        algorithm: 'incident-vector-search', // Use your configured algorithm name
        dimensions: 1536 // Match your embedding model
      }
    };

    return {
      ...state,
      searchPattern,
      indexMetadata,
      parsedSearchIntent: {
        originalPrompt: state.userPrompt,
        searchType: searchPattern,
        indexType: indexType,
        incidentNumber: incidentNumber,
        timestamp: new Date().toISOString(),
        searchConfiguration: {
          selectedFields: indexMetadata.selectedFields,
          semanticConfiguration: indexMetadata.semanticConfiguration,
          vectorSearch: indexMetadata.vectorSearch
        }
      }
    };

  } catch (e) {
    console.error("Error parsing intent:", e);

    return {
      ...state,
      searchPattern: "INDEX SEARCH",
      indexMetadata: {
        indexName: INCIDENT_RESOLUTION_INDEX,
        selectedFields: ['content'],
        // semanticString: state.userPrompt,
        semanticConfiguration: 'default',
        top: 5,
        vectorSearch: {
          enabled: true,
          field: 'content_vector',
          algorithm: 'incident-vector-search',
          dimensions: 1536
        }
      },
      parsedSearchIntent: {
        originalPrompt: state.userPrompt,
        searchType: "INDEX SEARCH",
        indexType: INCIDENT_RESOLUTION_INDEX,
        error: e.message,
        timestamp: new Date().toISOString(),
        searchConfiguration: {
          selectedFields: ['content'],
          semanticConfiguration: 'default',
          vectorSearch: {
            enabled: true,
            field: 'content_vector',
            algorithm: 'incident-vector-search',
            dimensions: 1536
          }
        }
      }
    };
  }
};
