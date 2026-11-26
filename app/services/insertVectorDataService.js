'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { vectorize } from "./vectorizeDataService";
import { getJobById, updateJob } from "./backgroundJobService";
import { smartNoteStatus } from "@/utils/constants";

let searchClients = {};

function getSearchClient(indexName) {
  if (!searchClients[indexName]) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
    searchClients[indexName] = new SearchClient(
      searchEndpoint,
      indexName,
      new AzureKeyCredential(searchAPIKey)
    )
  }
  return searchClients[indexName];
}

// Utility: detect 429 Too Many Requests across common error shapes
function isRateLimitError(error) {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.code;
  const name = error?.name;
  const message = error?.message ?? '';
  return status === 429 || name === 'TooManyRequests' || /429|Too\s*Many\s*Requests/i.test(message);
}

// Utility: sleep for ms
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Vectorize with retry and exponential backoff on 429 errors
async function vectorizeWithRetry(params, maxRetries = 5, initialDelayMs = 4000) {
  let attempt = 0;
  let delay = initialDelayMs;
  // Keep trying until success or retries exceeded
  // Note: Only retries on 429; other errors fail fast
  // Attempts count is number of retries performed (not including the first call)
  while (true) {
    try {
      return await vectorize(params);
    } catch (error) {
      if (isRateLimitError(error)) {
        attempt += 1;
        if (attempt > maxRetries) {
          console.error(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "vectorizeWithRetry", detail: { message: "Exceeded max retries for 429", attempts: attempt, params: { nuid: params?.nuid } } } }));
          throw error;
        }
        console.warn(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "vectorizeWithRetry", detail: { message: "429 received; backing off", attempt: attempt, delayMs: delay, params: { nuid: params?.nuid } } } }));
        await sleep(delay);
        delay *= 2; // exponential backoff: wait twice as long next time
        continue;
      }
      // Non-429 error: fail immediately
      throw error;
    }
  }
}

async function insertVectorData({ nuid, smartNoteId, id, smartNoteType, content, contentVector }) {
  try {
    const searchClient = getSearchClient('smartnote-001');
    const documents = [{ id: id, nuid: nuid, smartnote_id: smartNoteId, smart_type: smartNoteType, content: content, content_vector: contentVector }];
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

/**
 * Clones documents from one index to another with modified fields.
 *
 * @param {string} indexName - The name of the index to clone documents from.
 * @param {string} newNuid - The new NUID of the user cloning the documents.
 * @param {string} searchParam - The search parameters to find the original documents (required if no filter).
 * @param {Array<string>} selection - The fields to select from the original documents.
 * @param {string} filter - The filter to apply when searching for original documents (required if no searchParam).
 * @param {string} vectorFieldName - The name of the vector field to populate in the cloned documents.
 * @param {Function} mappingFunction - A function used to map new field values onto the cloned documents.
 * @returns {Promise<any>} - The response from the search client after uploading the cloned documents.
 */
async function cloneIndexDocuments(indexName, newNuid, searchParam = null, selection, filter = null, vectorFieldName, mappingFunction, jobId, smartNoteId, teamName) {
  try {
    if (!searchParam && !filter) {
      throw new Error('Either searchParam or filter must be provided');
    }
    const searchClient = getSearchClient(indexName);

    // Retrieve the original document(s)
    const searchResults = await searchClient.search(searchParam, {
      select: selection,
      filter: filter
    });

    // Check if document exists
    let originalDocs = [];
    for await (const result of searchResults.results) {
      originalDocs.push(result.document);
    }

    if (originalDocs.length === 0) {
      console.warn(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "cloneIndexDocuments", detail: { message: `No results for searchParam: ${searchParam} with filter: ${filter}`, searchParam, selection, filter, nuid: newNuid } } }));
      return;
    }

    // Create a clone with new values
    const clonedDocs = originalDocs.map(mappingFunction);

    // update Job
    await updateJob(
      teamName,
      jobId,
      {
        indexDocumentsCloned: 0,
        indexDocumentsTotal: clonedDocs.length
      }
    );

    // recreate the vectorized content
    const batch = [];
    const totalDocs = clonedDocs.length;
    let processedDocs = 0;
    // Determine the progress step for ~5% increments (at least 1)
    const progressStep = Math.max(1, Math.floor(totalDocs * 0.05));
    for (const doc of clonedDocs) {
      const contentVector = await vectorizeWithRetry({ nuid: newNuid, content: doc.content }, 5, 4000);

      batch.push({
        '@search.action': 'upload',
        ...doc,
        [vectorFieldName]: contentVector
      });

      // Update job progress every ~10%
      processedDocs += 1;
      const isMilestone = (processedDocs % progressStep === 0) || (processedDocs === totalDocs);
      if (isMilestone) {
        // Check for cancellation at each milestone
        const jobStatus = await getJobById(teamName, jobId);
        if (jobStatus?.status === smartNoteStatus.Canceled) {
          throw new Error('Job canceled');
        }

        await updateJob(
          teamName,
          jobId,
          {
            indexDocumentsCloned: processedDocs,
            indexDocumentsTotal: totalDocs
          }
        );
      }
    }

    console.log(JSON.stringify({ kpmsg: { id: "AI_PORTAL_NOTEBOOK", name: "cloneIndexDocuments", detail: { message: `Cloned ${clonedDocs.length} documents in index ${indexName}`, searchParam, selection, filter, nuid: newNuid } } }));
    const response = await searchClient.uploadDocuments(batch);
    return response;
  } catch (error) {
    console.error('Error cloning document:', error);
    throw error;
  }
}

async function insertVectorDataPlain(newIndexName, document) {
  try {
    const searchClient = getSearchClient(newIndexName);
    const documents = [document];
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
    const searchClient = getSearchClient('smartnote-001');
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
    const searchClient = getSearchClient('smartnote-001');

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
  insertVectorDataPlain,
  deleteAllDocuments,
  deleteDocument,
  cloneIndexDocuments
}