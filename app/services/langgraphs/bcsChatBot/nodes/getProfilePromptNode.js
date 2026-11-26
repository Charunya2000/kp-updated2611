'use server';

const PROMPT_PROFILES = {
  nps_incident_001: {
    systemMessage: {
      role: "system",
      content: `You are an expert IT support agent specializing in incident resolution.
                Rely ONLY on the provided incident-history context.
                Always include the context information provided as well as the answer`
    },
    userMessage: {
      role: "user",
      content: `INCIDENT-RESOLUTION QUERY

                CONTEXT (historical incidents):
                ---------------------
                {context}
                ---------------------
                
                USER QUESTION:
                {question}
                
                INSTRUCTIONS TO MODEL:
                • Respond with a concise, technical solution or diagnostic steps.
                • If multiple steps, number them 1-N.
                • If the answer is not fully in context, admit it exactly as instructed above.
                
                ANSWER:`
    }
  },
  service_request_index: {
    systemMessage: {
      role: "system",
      content: `You are a Service-Request specialist.
                Answer ONLY from the Service Request knowledge base in the context.
                Do NOT hallucinate missing steps or approvals.`
    },
    userMessage: {
      role: "user",
      content: `SERVICE-REQUEST QUERY
                CONTEXT (approved workflows & examples):
                ---------------------
                {context}
                ---------------------
                
                USER QUESTION:
                {question}
                
                INSTRUCTIONS TO MODEL:
                • Provide the precise request path (e.g., form name, required approvals, SLAs).
                • If the context lacks the needed detail, answer:
                  "I don't have enough information in the retrieved service-request documents to answer that."
                
                ANSWER:`
    }
  },
  process_reference_index: {
    systemMessage: {
      role: "system",
      content: `You are a Process-Reference assistant.
                Use ONLY the official process documentation in the context.
                Never cite unreferenced steps.`
    },
    userMessage: {
      role: "user",
      content: `PROCESS-REFERENCE QUERY

                CONTEXT (official SOP / policies):
                ---------------------
                {context}
                ---------------------
                
                USER QUESTION:
                {question}
                
                INSTRUCTIONS TO MODEL:
                • Summarize the exact process or policy sections that answer the question.
                • Quote key thresholds or rules verbatim when possible.
                • If context is missing, respond:
                  "I don't have enough information in the retrieved process documents to answer that."
                
                ANSWER:`
    }
  },
  test_scenario_index: {
    systemMessage: {
      role: "system",
      content: `You are a QA Test-Scenario assistant.
                Base your answer ONLY on the retrieved test-case repository.
                Do not fabricate test steps or expected results.`
    },
    userMessage: {
      role: "user",
      content: `TEST-SCENARIO QUERY
                
                CONTEXT (existing test cases):
                ---------------------
                {context}
                ---------------------
                
                USER QUESTION:
                {question}
                
                INSTRUCTIONS TO MODEL:
                • Provide test steps, data setup, and expected results found in context.
                • Format multi-step answers as a numbered list.
                • If the scenario is not covered in context, respond:
                  "I don't have enough information in the retrieved test-scenario documents to answer that."
                
                ANSWER:`
    }
  },
  github: {
    systemMessage: {
      role: "system",
      content: `You are a technical documentation assistant.
                Provide answers based ONLY on the GitHub repository content provided.
                If information is incomplete or missing, say so directly.`
    },
    userMessage: {
      role: "user",
      content: `GITHUB DOCUMENTATION QUERY
                
                CONTEXT (repository content):
                ---------------------
                {context}
                ---------------------
                
                USER QUESTION:
                {question}
                
                INSTRUCTIONS TO MODEL:
                • Reference specific file sections or code when possible
                • If the answer requires information not in the context, say:
                  "I don't have enough information in the retrieved documentation to answer that."
                • Keep technical accuracy as the top priority
                
                ANSWER:`
    }
  },
  default: {
    systemMessage: {
      role: "system",
      content: `You are an expert IT support agent specializing in incident resolution, service requests, and technical documentation.
                Provide answers based ONLY on the context provided.
                If information is insufficient, say so clearly.`
    },
    userMessage: {
      role: "user",
      content: `TECHNICAL QUERY
                
                CONTEXT:
                ---------------------
                {context}
                ---------------------
                
                USER QUESTION:
                {question}
                
                INSTRUCTIONS TO MODEL:
                • Provide clear, specific answers based only on the context
                • If multiple steps are needed, number them
                • If the context lacks needed information, say:
                  "I don't have enough information in the retrieved documents to answer that."
                
                ANSWER:`
    }
  }
};

export const getProfilePromptNode = async (state) => {
  try {
    // Check if we have search results from Azure Search
    if (state.searchResults?.items?.length > 0) {
      // Get the index name from the search results
      const { indexName } = state.searchResults;

      // Get the corresponding prompt profile
      const normalizedIndexName = indexName.replace(/-/g, "_");
      const profile = PROMPT_PROFILES[normalizedIndexName] || PROMPT_PROFILES.default;

      return {
        ...state,
        promptProfile: profile,
        promptSuccess: true
      };
    }

    // Check if we have GitHub metadata
    if (state.githubMetadata?.fileFound) {
      return {
        ...state,
        promptProfile: PROMPT_PROFILES.github,
        promptSuccess: true
      };
    }

    // If no valid search results or GitHub metadata, use default profile
    return {
      ...state,
      promptProfile: PROMPT_PROFILES.default,
      promptSuccess: true
    };

  } catch (error) {
    console.error('Error in getProfilePromptNode:', error);
    return {
      ...state,
      promptProfile: PROMPT_PROFILES.default,
      promptSuccess: false,
      error: error.message
    };
  }
};
