'use server';

/**
 * KNOWLEDGE BASE NODE
 * Prepares metadata for Azure AI Search using the bcs-knowledge-001 index.
 */

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";



let searchClient = null;
function getSearchClient(indexName) {
  if (!searchClient) {
    const envName = process.env['envName'] || 'dev';
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`];

    if (!searchEndpoint || !searchAPIKey) {
      throw new Error('Azure Search credentials not found in environment variables');
    }

    searchClient = new SearchClient(
      searchEndpoint,
      indexName,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClient;
}

export async function getKnowledgeBase(state, config) {
  // Logic: Pull 'topk' from config if they exist, else use defaults
  const limit = config?.configurable?.knowledgeBase?.topk || 5;

  try {
    console.log(`[getKnowledgeBase] Preparing Azure Search metadata for index: bcs-knowledge-001`);

    /**
     * We now define the indexMetadata to match your new Azure Index Schema.
     * This allows the searchIndexNode to execute a Vector Search against the correct fields.
     */

    let filter = ''
    let indexName = "bcs-knowledge-001"
    let topK = 5
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


    const searchOptions = {
      top: topK,
      filter: filter || undefined,
      includeTotalCount: true,
      select: ["content", "file_name", "file_type", "sheet_name", "source_path"],
      vectorSearchOptions: {
        queries: [
          {
            kind: "vector",
            vector: state.promptEmbedding,
            fields: ["content_vector"],
            kNearestNeighborsCount: 50
          }
        ]
      }
    };


    const searchClient = getSearchClient(indexName);
    const searchResults = await searchClient.search('*', searchOptions);
    const records = [];
    const total_records = await searchResults.count
    for await (const r of searchResults.results) {
      records.push({
        score: r.score,
        rerankerScore: r.rerankerScore,
        vectorScore: r.vectorScore,
        document: r.document
      });

    }



    // Returning the state with indexMetadata for the searchIndexNode to process
    return {
      ...state,
      indexMetadata: indexMetadata,
      knowledgeBaseMetaData: {
        // Initializing to ensure object structure exists
        records: records,
        recordCount: total_records,
        recordFound: true,
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