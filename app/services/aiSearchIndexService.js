import { SearchIndexClient, AzureKeyCredential } from '@azure/search-documents'

let searchIndexClient = null;

function getSearchIndexClient() {
  if (!searchIndexClient) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];

    searchIndexClient = new SearchIndexClient(
      searchEndpoint,
      new AzureKeyCredential(searchAPIKey)
    )
  }
  return searchIndexClient;
}

/**
 * Retrieves metadata for a specific Azure AI Search index
 * @param {string} indexName The name of the index to retrieve metadata for
 * @returns {Promise<object>} The index metadata
 */
export async function getIndexMetadata(indexName) {
  try {
    const searchClient = getSearchIndexClient();
    // Get the index by name
    const indexMetadata = await searchClient.getIndex(indexName);
    return indexMetadata;
  } catch (error) {
    console.error(`Error retrieving index metadata for '${indexName}': ${error.message}`);
    throw error;
  }
}

/**
 * Retrieves a list of all indexes in the search service
 * @returns {Promise<Array>} List of all indexes
 */
export async function listAllIndexNames() {
  try {
    const searchClient = getSearchIndexClient();
    const allIndexNames = [];

    // Get an async iterator for the paginated results
    const iterator = searchClient.listIndexesNames().byPage();

    // Process all pages
    let pageResponse = await iterator.next();
    while (!pageResponse.done) {
      allIndexNames.push(...pageResponse.value);
      pageResponse = await iterator.next();
    }

    return allIndexNames;
  } catch (error) {
    console.error(`Error listing index names: ${error.message}`);
    throw error;
  }
}

export async function createIndex(indexDefinition) {
  try {
    const searchClient = getSearchIndexClient();
    // Create the index
    const createdIndex = await searchClient.createIndex(indexDefinition);
    return createdIndex;
  } catch (error) {
    console.error(`Error creating index: ${error.message}`);
    throw error;
  }
}

export async function listAllIndexes() {
  try {
    const searchClient = getSearchIndexClient();
    const allIndexes = [];

    // Get an async iterator for the paginated results
    const iterator = searchClient.listIndexes().byPage();

    // Process all pages
    let pageResponse = await iterator.next();
    while (!pageResponse.done) {
      allIndexes.push(...pageResponse.value);
      pageResponse = await iterator.next();
    }

    return allIndexes;
  } catch (error) {
    console.error(`Error listing indexes: ${error.message}`);
    throw error;
  }
}