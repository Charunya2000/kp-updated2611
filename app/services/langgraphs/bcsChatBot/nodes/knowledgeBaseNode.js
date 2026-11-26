'use server';

/**
 * KNOWLEDGE BASE NODE
 * Prepares metadata for Azure AI Search using the bcs-knowledge-001 index.
 */
export async function getKnowledgeBase(state, config) {
  // Logic: Pull 'topk' from config if they exist, else use defaults
  const limit = config?.configurable?.knowledgeBase?.topk || 5;

  try {
    console.log(`[getKnowledgeBase] Preparing Azure Search metadata for index: nps-knowledge-001`);

    /**
     * We now define the indexMetadata to match your new Azure Index Schema.
     * This allows the searchIndexNode to execute a Vector Search against the correct fields.
     */
    let indexName = "nps-knowledge-001"

    const indexMetadata = {
      indexName: indexName, // Your new Azure Index
      searchQueryString: state.userPrompt || "*",
      // Selecting fields defined in your schema
      selectedFields: [
        "id",
        "content",
        "file_name",
        "file_type",
        "sheet_name",
        "source_path"
      ],
      vectorSearch: {
        enabled: true,
        field: "content_vector", // Matches your schema vectorize field
        nearestNeighbors: limit,
        dimensions: 1536 // Matches text-embedding-ada-002 dimensions
      }
    };

    // Returning the state with indexMetadata for the searchIndexNode to process
    return {
      ...state,
      indexMetadata: indexMetadata,
      knowledgeBaseMetaData: {
        // Initializing to ensure object structure exists
        records: [],
        recordCount: 0,
        recordFound: false,
        timestamp: new Date().toISOString()
      }
    };

  } catch (kbError) {
    console.error('[getKnowledgeBase] Critical Error:', kbError.message);
    return {
      ...state,
      knowledgeBaseMetaData: {
        records: [],
        recordCount: 0,
        recordFound: false,
        error: kbError.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}