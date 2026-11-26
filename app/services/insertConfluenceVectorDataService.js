'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

let searchClient = null;

function getSearchClient() {
  if (!searchClient) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
    const smartNoteIndexName = 'smartnote-001';
    searchClient = new SearchClient(
      searchEndpoint,
      smartNoteIndexName,
      new AzureKeyCredential(searchAPIKey)
    )
  }
  return searchClient;
}

async function insertVectorData({ id, nuid, smartNoteId, smartType, content, contentVector }) {
  try {
    const searchClient = getSearchClient();
    const documents = [{
      id: id,
      nuid: nuid,
      smartnote_id: smartNoteId,
      smart_type: smartType,
      content: content,
      content_vector: contentVector
    }];
    const batch = documents.map(doc => ({
      '@search.action': 'upload',
      ...doc
    }));
    const response = await searchClient.uploadDocuments(batch);
    return response;
  } catch (error) {
    console.error('Error inserting vector data:', error);
    throw error;
  }
}

async function deleteDocument(id) {
  try {
    const searchClient = getSearchClient();
    const batch = [{
      '@search.action': 'delete',
      id: id
    }];
    await searchClient.uploadDocuments(batch);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}

async function deleteAllDocuments() {
  try {
    const searchClient = getSearchClient();

    // Retrieve all document keys
    const documentKeys = [];
    const searchResults = await searchClient.search("*", {
      select: ["id"], // Assuming 'id' is the key field
      top: 1000, // Adjust the number of documents to retrieve per request
    });

    for await (const result of searchResults.results) {
      documentKeys.push(result.document.id);
    }

    // Delete documents in batches
    const batchSize = 100; // Adjust the batch size as needed
    for (let i = 0; i < documentKeys.length; i += batchSize) {
      const batch = documentKeys.slice(i, i + batchSize).map(id => ({
        '@search.action': 'delete',
        id: id
      }));
      await searchClient.uploadDocuments(batch);
    }

  } catch (error) {
    console.error('Error deleting all documents:', error);
    throw error;
  }
}

export {
  insertVectorData,
  deleteAllDocuments,
  deleteDocument
}