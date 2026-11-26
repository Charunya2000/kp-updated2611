'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

// Cache for search clients
let searchClients = {};

function getSearchClient(searchIndex) {
  if (!searchClients[searchIndex]) {
    const envName = process.env['envName'] || 'dev';
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

    if (!searchEndpoint || !searchAPIKey) {
      throw new Error('Azure Search credentials not found in environment variables');
    }

    searchClients[searchIndex] = new SearchClient(
      searchEndpoint,
      searchIndex,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClients[searchIndex];
}

export const searchIndexNode1 = async (state) => {
  try {
    // Extract index metadata and embedding from state
    const { indexMetadata, promptEmbedding } = state;

    if (!indexMetadata) {
      throw new Error('Index metadata not provided in state');
    }

    // Always pull indexName and artifactNumber (generalized from incidentNumber)
    const indexName = indexMetadata.indexName;
    const artifactNumber = indexMetadata.artifactNumber || indexMetadata.incidentNumber;

    // Dynamically infer all other parameters, defaulting to undefined if not present
    const selectedFields = indexMetadata.selectedFields || undefined;
    const searchFields = indexMetadata.searchFields || undefined;
    let filter = indexMetadata.filter || undefined;
    // Patch: auto-format Edm.DateTimeOffset filters to use plain ISO format (no datetime'...)
    if (filter && typeof filter === 'string') {
      // Handles eq, ne, gt, ge, lt, le
      filter = filter.replace(/(resolved)\s*(eq|ne|gt|ge|lt|le)\s*'([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)'/g,
        (match, field, op, dateStr) => `${field} ${op} ${dateStr}`
      );
    }
    // Inferred search query string: prefer indexMetadata.searchQueryString, fallback to semanticString, userPrompt, or '*'
    const searchQueryString = indexMetadata.searchQueryString || indexMetadata.semanticString || indexMetadata.userPrompt || "*";
    const semanticString = indexMetadata.semanticString || undefined;
    const semanticConfiguration = indexMetadata.semanticConfiguration || indexMetadata.semanticSearch?.configuration || 'default';
    // Use inferred top value from indexMetadata
    const top = (typeof indexMetadata.top === 'number' && indexMetadata.top <= 10) ? indexMetadata.top : 10;
    const orderBy = indexMetadata.orderBy || undefined;
    const includeTotalCount = indexMetadata.count === true || indexMetadata.includeTotalCount === true;

    // Vector search options (flexible, LM-driven)
    const vectorSearch = indexMetadata.vectorSearch || {};
    const vectorField = vectorSearch.field || 'content_vector';
    let nearestNeighbors = 5;
    if (typeof vectorSearch.nearestNeighbors === 'number' && vectorSearch.nearestNeighbors <= 10) {
      nearestNeighbors = vectorSearch.nearestNeighbors;
    } else if (typeof vectorSearch.kNearestNeighbors === 'number' && vectorSearch.kNearestNeighbors <= 10) {
      nearestNeighbors = vectorSearch.kNearestNeighbors;
    }
    const vectorAlgorithm = vectorSearch.algorithm || 'incident-vector-search';
    const vectorDimensions = vectorSearch.dimensions || 1536;

    // Robust to missing/partial metadata
    if (!indexName || !promptEmbedding) {
      throw new Error('Required parameters missing: indexName and promptEmbedding are required for vector search');
    }

    // Get the cached search client
    const searchClient = getSearchClient(indexName);

    // Determine if this is a full-text search (searchFields present, no semanticSearch)
    const isFullTextSearch = searchFields && (!indexMetadata.semanticSearch?.enabled);

    // Prepare base search options, all LM-inferred and flexible
    const searchOptions = {
      includeTotalCount,
      top
    };
    // Only add select if not a count-only query and not a full-text count query
    if (!includeTotalCount || top > 0) {
      if (selectedFields) searchOptions.select = selectedFields;
    }
    if (searchFields) {
      searchOptions.searchFields = searchFields;
    }
    // Only add orderBy if semantic search is NOT enabled
    if (!(indexMetadata.semanticSearch?.enabled)) {
      if (orderBy) searchOptions.orderBy = orderBy;
    }
    // Add semantic search options if enabled and not a full-text search
    if (indexMetadata.semanticSearch?.enabled && !isFullTextSearch) {
      searchOptions.queryType = 'semantic';
      searchOptions.semanticSearchOptions = {
        configurationName: semanticConfiguration,
        answers: "extractive"
      };
      searchOptions.queryLanguage = indexMetadata.semanticSearch.queryLanguage || 'en-us';
    }

    // Add vector search options if enabled
    if (vectorSearch.enabled && promptEmbedding) {
      searchOptions.vectorSearchOptions = {
        queries: [{
          kNearestNeighborsCount: nearestNeighbors,
          fields: [vectorField],
          kind: "vector",
          vector: promptEmbedding,
          algorithm: vectorAlgorithm,
          dimensions: vectorDimensions
        }]
      };
    }

    // Perform the search using the inferred query string
    const searchResults = await searchClient.search(
      searchQueryString,
      searchOptions
    );

    // Transform results into a more usable format
    const results = [];
    let totalCount = 0;

    // Use for-await to process results
    for await (const result of searchResults.results) {
      results.push({
        score: result.score,
        document: result.document,
        highlights: result.highlights || {},
        captions: result.captions || [],
        rerankerScore: result.rerankerScore,
        semanticScore: result.semanticScore,
        vectorScore: result.vectorScore
      });
    }

    let filteredResults;

    if (
      (vectorSearch.enabled || indexMetadata.semanticSearch?.enabled) &&
      filteredResults?.length > 10
    ) {
      filteredResults = results.filter(
        r =>
          (typeof r.vectorScore !== 'number' || r.vectorScore >= 0.7) &&
          (typeof r.semanticScore !== 'number' || r.semanticScore >= 0.7)
      );

      // If more than 10 results, return top 10 ordered by vectorScore descending
      filteredResults = filteredResults
        .sort((a, b) => (b.vectorScore ?? 0) - (a.vectorScore ?? 0))
        .slice(0, 10);
    } else {
      // Filter results by score descending and take only the top 10
      filteredResults = results
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 10);
    }

    // Get the total count if available
    totalCount = searchResults.count !== undefined ? searchResults.count : results.length;

    // Return results in state, with all query parameters for traceability
    return {
      ...state,
      searchResults: {
        totalCount,
        items: filteredResults,
        indexName,
        artifactNumber,
        searchType: semanticString ? (vectorSearch.enabled ? 'hybrid' : 'semantic') : 'vector',
        semanticConfiguration: semanticString ? semanticConfiguration : undefined,
        vectorField,
        vectorAlgorithm,
        vectorDimensions,
        timestamp: new Date().toISOString(),
        query: {
          searchQueryString,
          semanticString,
          vectorEnabled: !!vectorSearch.enabled,
          filter,
          selectedFields,
          nearestNeighbors,
          vectorField,
          vectorAlgorithm,
          vectorDimensions,
          orderBy
        }
      },
      searchSuccess: true
    };

  } catch (error) {
    console.error('Error in searchIndexNode:', error);
    return {
      ...state,
      searchResults: {
        totalCount: 0,
        items: [],
        indexName: state.indexMetadata?.indexName,
        artifactNumber: state.indexMetadata?.artifactNumber || state.indexMetadata?.incidentNumber,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      searchSuccess: false
    };
  }
};
