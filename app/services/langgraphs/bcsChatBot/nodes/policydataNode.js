'use server';

/**
 * Policy Data NODE
 * 
 */
export async function getpolicyData(state, config) {
    // Logic: Pull 'topk' from config if they exist, else use defaults
    const limit = config?.configurable?.knowledgeBase?.topk || 5;

    try {
        console.log(`[getpolicyNode] Preparing Azure Search metadata for index: nps-policy-001`);

        /**
         * We now define the indexMetadata to match your new Azure Index Schema.
         * This allows the searchIndexNode to execute a Vector Search against the correct fields.
         */
        let indexName = "nps-policy-001"

        const indexMetadata = {
            indexName: indexName, // Your new Azure Index
            searchQueryString: state.userPrompt || "*",
            // Selecting fields defined in your schema
            selectedFields: [
                "id",
                "content",
                "document_name",
                "total_chunks",

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
            policyMetadata: {
                // Initializing to ensure object structure exists
                records: [],
                recordCount: 0,
                recordFound: false,
                timestamp: new Date().toISOString()
            }
        };

    } catch (policyError) {
        console.error('[getPolicyNode] Critical Error:', policyError.message);
        return {
            ...state,
            policyMetadata: {
                records: [],
                recordCount: 0,
                recordFound: false,
                error: policyError.message,
                timestamp: new Date().toISOString()
            }
        };
    }
}