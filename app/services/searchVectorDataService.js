'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

let searchClients = {};

const cache = {
  kpmcDocNames: null,
  cmsDocSources: null,
  hppdmDocNames: null,
  piPlanningDocNames: null,
  medicaidDocNames: null,
  kpmcCRDocNames: null,
  lastUpdated: null
};

function getSearchClient(searchIndex) {
  if (!searchClients[searchIndex]) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];
    searchClients[searchIndex] = new SearchClient(
      searchEndpoint,
      searchIndex,
      new AzureKeyCredential(searchAPIKey)
    )
  }
  return searchClients[searchIndex];
}

async function searchIndexWithVectorField({ searchIndex, selectFields, searchEmbedding, nearestNeighbors, filter, vectorField }) {
  try {
    const searchClient = getSearchClient(searchIndex);
    const searchResults = await searchClient.search(null, {
      includeTotalCount: true,
      filter: filter,
      select: selectFields,
      vectorSearchOptions: {
        queries: [{
          kNearestNeighborsCount: nearestNeighbors,
          fields: [vectorField],
          kind: "vector",
          vector: searchEmbedding
        }]
      }
    });

    const searchMessages = []

    for await (const result of searchResults.results) {
      searchMessages.push(result);
    }

    return searchMessages;
  } catch (error) {
    console.error('Error creating completion:', error);
    throw error;
  }
}

async function searchIndex({ searchIndex, selectFields, searchEmbedding, nearestNeighbors, filter, contentVectorField = "content_vector" }) {
  try {
    const searchClient = getSearchClient(searchIndex);
    const searchResults = await searchClient.search(null, {
      includeTotalCount: true,
      filter: filter,
      select: selectFields,
      vectorSearchOptions: {
        queries: [{
          kNearestNeighborsCount: nearestNeighbors,
          fields: [contentVectorField],
          kind: "vector",
          vector: searchEmbedding
        }]
      }
    });

    const searchMessages = []

    for await (const result of searchResults.results) {
      searchMessages.push(result);
    }

    return searchMessages;
  } catch (error) {
    console.error('Error creating completion:', error);
    throw error;
  }
}

async function semanticSearchIndex({ searchIndex, selectFields, searchText, filter, top = 10, semanticConfiguration = null }) {
  try {
    const searchClient = getSearchClient(searchIndex);

    // Basic search options without semantic search
    const searchOptions = {
      includeTotalCount: true,
      filter: filter,
      select: selectFields,
      top: top
    };

    // Only add semantic search options if a configuration name is provided
    if (semanticConfiguration) {
      searchOptions.queryType = 'semantic';
      searchOptions.semanticSearchOptions = {
        configurationName: semanticConfiguration,
        answers: "extractive"
      };
    }

    const searchResults = await searchClient.search(searchText, searchOptions);

    const searchMessages = []

    for await (const result of searchResults.results) {
      searchMessages.push(result);
    }

    return searchMessages;
  } catch (error) {
    console.error('Error performing search:', error);
    // If it's specifically a semantic search error, try again with regular search
    if (error.message && error.message.includes("semantic")) {
      return semanticSearchIndex({
        searchIndex,
        selectFields,
        searchText,
        filter,
        top,
        semanticConfiguration: null // Force regular search
      });
    }
    throw error;
  }
}

async function getDistinctFieldValues(searchIndex, fieldName, additionalField) {
  try {
    const searchClient = getSearchClient(searchIndex);
    const searchResults = await searchClient.search('*', {
      select: [fieldName, additionalField],
      top: 1000 // Adjust the number of documents to retrieve as needed
    });

    const distinctValuesMap = new Map();
    for await (const result of searchResults.results) {
      const fieldValue = result.document[fieldName];
      const additionalFieldValue = result.document[additionalField] || '';
      if (fieldValue && !distinctValuesMap.has(fieldValue)) {
        distinctValuesMap.set(fieldValue, { document_name: fieldValue, source_url: additionalFieldValue });
      }
    }

    const distinctValues = Array.from(distinctValuesMap.values());
    return distinctValues;
  } catch (error) {
    console.error('Error retrieving distinct field values:', error);
    throw error;
  }
}

function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

async function getDistinctValuesFromIndexes() {
  const today = new Date();

  if (cache.lastUpdated && isSameDay(today, cache.lastUpdated)) {
    return {
      kpmcDocNames: cache.kpmcDocNames,
      cmsDocSources: cache.cmsDocSources,
      hppdmDocNames: cache.hppdmDocNames,
      piPlanningDocNames: cache.piPlanningDocNames,
      medicaidDocNames: cache.medicaidDocNames,
      kpmcCRDocNames: cache.kpmcCRDocNames
    };
  }

  try {
    const kpmcDocNames = await getDistinctFieldValues('kpmc-doc-001', 'document_name', 'source_url');
    const cmsDocSources = await getDistinctFieldValues('cms-doc-001', 'source', 'source_url');
    const hppdmDocNames = await getDistinctFieldValues('hppdm-doc-001', 'document_name', '');
    const piPlanningDocNames = await getDistinctFieldValues('pi-planning-001', 'document_name', '');
    const medicaidDocNames = await getDistinctFieldValues('medicaid-002', 'document_name', 'source_url');
    const kpmcCRDocNames = await getDistinctFieldValues('kpmc-cr-001', 'document_name', 'source_url');


    cache.kpmcDocNames = kpmcDocNames;
    cache.cmsDocSources = cmsDocSources;
    cache.hppdmDocNames = hppdmDocNames;
    cache.piPlanningDocNames = piPlanningDocNames;
    cache.medicaidDocNames = medicaidDocNames;
    cache.kpmcCRDocNames = kpmcCRDocNames;
    cache.lastUpdated = today;

    return {
      kpmcDocNames,
      cmsDocSources,
      hppdmDocNames,
      piPlanningDocNames,
      medicaidDocNames,
      kpmcCRDocNames
    };
  } catch (error) {
    console.error('Error retrieving distinct values from indexes:', error);
    throw error;
  }
}

export {
  searchIndex,
  semanticSearchIndex,
  searchIndexWithVectorField,
  getDistinctFieldValues,
  getDistinctValuesFromIndexes
}