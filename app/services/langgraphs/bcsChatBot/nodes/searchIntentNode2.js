'use server';


import { chatCompletion } from "@/app/services/chatCompletionService2";

import { detectIntent } from './intent.js';


// Constants
let incidentIndexName = "nps-incident-001"
let knowledgeIndexName = "nps-knowledge-001"
let userStoryIndexName = "nps-userstory-001"




const INCIDENT_RESOLUTION_INDEX = incidentIndexName;
const KNOWLEDGE_BASE_INDEX = knowledgeIndexName;
const USER_STORY_INDEX = userStoryIndexName;

// =========================================================
// INTENT-TO-TYPE MAPPING
// =========================================================
function mapRawIntentToType(rawIntent) {
  switch (rawIntent) {
    case 'incident_management':
      return 'INCIDENT';
    case 'testcase_generation':
      return 'TEST_CASE';
    case 'testscript_generation':
      return 'TEST_SCRIPT';
    case 'knowledge_base':
      return 'KNOWLEDGE_BASE';
    case 'jira_summarization':
      return 'JIRA_SUMMARIZATION';
    case 'ai_scorecard_analysis':
      return 'AI_SCORECARD';
    case 'release_management':
      return 'RELEASE_MANAGEMENT';
    case 'getservicenowRecords':
      return 'getservicenowRecords';
    case 'testscript_withoutreference':
      return 'testscript_withoutreference';

    default:
      return 'INCIDENT';
  }
}

function getIndexForIntent(intentType) {
  switch (intentType) {
    case 'INCIDENT':
      return INCIDENT_RESOLUTION_INDEX;
    case 'KNOWLEDGE_BASE':
      return KNOWLEDGE_BASE_INDEX;
    case 'TEST_CASE':
    case 'TEST_SCRIPT':
    case 'JIRA_SUMMARIZATION':
      return USER_STORY_INDEX;
    case 'AI_SCORECARD':
      return null; // Uses MongoDB, not Azure Search
    default:
      return INCIDENT_RESOLUTION_INDEX;
  }
}

// =========================================================
// MAIN NODE
// =========================================================
export const parseUserIntentNode = async (state, config) => {
  try {
    if (state.userContext != 'NEW') return {}
    // =========================================================
    // STEP 1: Use detectIntent (from intent.js) for 6-category classification
    // =========================================================
    // const intentResult = await detectIntent(state);
    const intentResult = state.intentRaw;
    //const rawIntent = intentResult.intent || 'incident_management';
    const rawIntent = intentResult || 'incident_management';
    const finalIntentType = mapRawIntentToType(rawIntent);
    const indexName = getIndexForIntent(finalIntentType);

    console.log(`[parseUserIntentNode] detectIntent raw: "${rawIntent}" → type: "${finalIntentType}" → index: "${indexName}"`);

    // =========================================================
    // STEP 2: For intents that DON'T need index search, return early

    // =========================================================
    if (finalIntentType === 'AI_SCORECARD' || finalIntentType === 'JIRA_SUMMARIZATION') {
      console.log(`[parseUserIntentNode] ${finalIntentType} flow — skipping index search parameter extraction`);
      return {
        ...state,
        intent: {
          type: finalIntentType,
          raw: rawIntent,
          isIncident: false,
          isTestCase: false,
          isTestScript: false,
          isKnowledgeBase: false,
          isScorecard: finalIntentType === 'AI_SCORECARD',
          isJiraSummarization: finalIntentType === 'JIRA_SUMMARIZATION',
        },
        searchPattern: "NONE",
        indexMetadata: indexName ? { indexName } : {},
        parsedSearchIntent: {
          originalPrompt: state.userPrompt,
          searchType: "NONE",
          intentType: finalIntentType,
          rawIntent: rawIntent,
          timestamp: new Date().toISOString()
        }
      };
    }

    // =========================================================
    // STEP 3: For index-based intents, extract search parameters via LLM
    // =========================================================
    const systemPrompt = config?.configurable?.userIntent?.intentMessage?.content || `
You are a search parameter extraction assistant for an enterprise IT system.
The user intent has already been classified as: ${finalIntentType}

Your job is to extract search parameters from the user query.
Extract:
- searchQueryString: the main search text
- artifactNumber: any incident number (e.g., INC12345)
- rqr_id: any RQR ID mentioned
- quote_id: any Quote ID mentioned
- selectedFields: fields to return (default: ["content"])
- filter: any OData filter expression
- vectorSearch: vector search config
- semanticSearch: semantic search config

Return ONLY valid JSON with the extracted parameters.
`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: state.userPrompt },
    ];

    const responseMessage = await chatCompletion({
      model: "gpt-4o",
      messages,
      temperature: 0,
      max_tokens: 800,
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    });
    // Safe JSON parsing
    let parsedSearchIntent;
    try {
      const jsonMatch = /({[\s\S]*})/.exec(responseMessage);
      parsedSearchIntent = JSON.parse(jsonMatch[1]);
    } catch (catchErr) {
      parsedSearchIntent = {};
    }

    // =========================================================
    // PARAMETER EXTRACTION
    // =========================================================
    const artifactNumber = parsedSearchIntent.artifactNumber || null;
    const extractedRqrId = parsedSearchIntent.rqr_id || "";
    const extractedQuoteId = parsedSearchIntent.quote_id || "";

    const searchQueryString = `${parsedSearchIntent.searchQueryString || state.userPrompt} ${extractedRqrId} ${extractedQuoteId}`.trim();

    const selectedFields = parsedSearchIntent.selectedFields || ["content"];
    const searchFields = parsedSearchIntent.searchFields || undefined;
    const isFullTextSearch = searchFields && !parsedSearchIntent.semanticSearch?.enabled;
    const filter = parsedSearchIntent.filter || (artifactNumber ? `number eq '${artifactNumber}'` : undefined);
    const top = artifactNumber ? 1 : 5;
    const count = parsedSearchIntent.count === true || parsedSearchIntent.includeTotalCount === true;

    // Vector and Semantic Config
    const vectorSearch = parsedSearchIntent.vectorSearch || { enabled: true, field: "content_vector", algorithm: "incident-vector-search", dimensions: 1536 };
    const semanticSearch = parsedSearchIntent.semanticSearch || { enabled: true, fields: selectedFields, configuration: "default" };
    const orderBy = parsedSearchIntent.orderBy || undefined;

    const resolvedIndexName = indexName || INCIDENT_RESOLUTION_INDEX;

    const indexMetadata = {
      indexName: resolvedIndexName,
      searchQueryString,
      selectedFields,
      searchFields,
      filter,
      top,
      count,
      vectorSearch,
      semanticSearch: isFullTextSearch ? { enabled: false } : semanticSearch,
      orderBy
    };

    // =========================================================
    // FINAL RETURN
    // =========================================================
    return {
      ...state,
      // identifier:intentResult.identifier,
      //     identifier_needed:intentResult.identifier_needed,
      //     identifier_question:intentResult.identifier_question,
      //     identifiers:intentResult.identifiers,
      //     messages:intentResult.messages,
      //     structuredMemory:intentResult.structuredMemory,

      intent: {
        type: finalIntentType,
        raw: rawIntent,
        isIncident: finalIntentType === "INCIDENT",
        isTestCase: finalIntentType === "TEST_CASE",
        isTestScript: finalIntentType === "TEST_SCRIPT",
        isKnowledgeBase: finalIntentType === "KNOWLEDGE_BASE",
        isScorecard: false,
        isJiraSummarization: false,
      },
      searchPattern: "INDEX SEARCH",
      indexMetadata,
      parsedSearchIntent: {
        originalPrompt: state.userPrompt,
        searchType: "INDEX SEARCH",
        indexName: resolvedIndexName,
        intentType: finalIntentType,
        rawIntent: rawIntent,
        artifactNumber,
        rqr_id: extractedRqrId,
        quote_id: extractedQuoteId,
        timestamp: new Date().toISOString(),
        searchConfiguration: {
          searchQueryString,
          selectedFields,
          semanticSearch,
          vectorSearch,
          orderBy
        }
      }
    };

  } catch (e) {
    console.error("Error parsing intent in parseUserIntentNode:", e);
    return {
      ...state,
      intent: { type: "KNOWLEDGE_BASE", raw: "knowledge_base", isKnowledgeBase: true },
      searchPattern: "INDEX SEARCH",
      indexMetadata: {},
      parsedSearchIntent: {
        originalPrompt: state.userPrompt,
        error: e.message,
        timestamp: new Date().toISOString()
      }
    };
  }
};