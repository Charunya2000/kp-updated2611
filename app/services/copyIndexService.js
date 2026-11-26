const { SearchIndexClient, AzureKeyCredential } = require("@azure/search-documents");

const endpoint = "<YOUR_SEARCH_SERVICE_ENDPOINT>";
const apiKey = "<YOUR_ADMIN_API_KEY>";
const indexName = "<EXISTING_INDEX_NAME>";

const client = new SearchIndexClient(endpoint, new AzureKeyCredential(apiKey));

async function exportIndex() {
  const index = await client.getIndex(indexName);
  return index;
}

exportIndex();


const newIndexName = "<NEW_INDEX_NAME>";
index.name = newIndexName;



async function createNewIndex(newIndexDefinition) {
  await client.createIndex(newIndexDefinition);
}

createNewIndex(index);


const { SearchClient } = require("@azure/search-documents");

const searchClient = new SearchClient(endpoint, indexName, new AzureKeyCredential(apiKey));
const newSearchClient = new SearchClient(endpoint, newIndexName, new AzureKeyCredential(apiKey));

async function copyData() {
  const results = searchClient.search("*"); // Retrieve all documents
  for await (const result of results.results) {
    await newSearchClient.uploadDocuments([result]);
  }
}

copyData();
