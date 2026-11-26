'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

let searchClient = null;
let indexName = null;

function getSearchClient(searchIndex) {
  if (!searchClient || (indexName !== searchIndex)) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
    indexName = searchIndex;
    searchClient = new SearchClient(
      searchEndpoint,
      searchIndex,
      new AzureKeyCredential(searchAPIKey)
    )
  }
  return searchClient;
}

async function deleteFromIndex({ searchIndex, filter }) {
  try {
    const searchClient = getSearchClient(searchIndex);

    // Fetch documents to delete based on the filter
    const searchResults = await searchClient.search(null, {
      filter: filter,
      select: ['id'] // Assuming 'id' is the key field
    });

    const documentsToDelete = [];
    for await (const result of searchResults.results) {
      documentsToDelete.push({ id: result.document.id });
    }

    if (documentsToDelete.length > 0) {
      await searchClient.deleteDocuments(documentsToDelete);
      console.log(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "deleteFromIndex", detail: { message: `Deleted ${documentsToDelete.length} documents from index ${searchIndex}`, filter } } }));
    } else {
    }

    return { deletedCount: documentsToDelete.length };
  } catch (error) {
    console.error('Error creating completion:', error);
    throw error;
  }
}

export {
  deleteFromIndex
}