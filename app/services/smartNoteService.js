import { selectDocument, selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument, updateDocuments } from '@db/updateDocument';
import { deleteDocument, deleteDocuments, deleteSmartNoteDocuments } from '@db/deleteDocument';
import { deleteFromIndex } from '@services/deleteFromVectorDataService';
import { getServerSession } from '@utils/getSession';
import { recordSmartNoteCreated } from '@services/statisticsService';
import { v4 } from 'uuid';
import { cloneSources } from './sourceService';
import { cloneUploadedDocument } from './uploadedDocumentService';
import { cloneDesignIndex } from './designIndexService';
import { cloneJiraIssue } from './jiraIssueService';
import { cloneDesignReference } from './designReferenceService';
import { cloneSavedNote } from './savedNoteService';
import { cloneSavedResponse } from './savedResponseService';
import { cloneWebsiteURL } from './websiteURLService';
import { cloneSharePointFile } from './sharePointService';
import { prepDocument } from '../clientServices/insertDocument';
import { validateBasicMulti } from './validation';
import { cloneIndexDocuments } from '@services/insertVectorDataService';
import { v4 as uuidv4 } from "uuid";
import { listAllIndexes } from './aiSearchIndexService';
import { smartNoteStatus } from '@/utils/constants';
import { updateJob } from './backgroundJobService';
import { deleteSmartNoteFilesFromBlob } from './blobStorageService';

export async function createSmartNote(document, teamName, assistantName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  document.parentId = null;
  document.createdNUID = nuid;
  document.assistantName = assistantName;
  document.teamName = teamName;
  recordSmartNoteCreated(nuid, null, teamName, assistantName);
  return await insertDocument(document, null, `team-${teamName}-db`);
}

export async function selectSmartNote(query, teamName) {
  let document = null;
  try {
    const { nuid } = await getServerSession();
    query.nuid = nuid;
    document = await selectDocument(query, `team-${teamName}-db`);
  } catch (error) {
    console.error(error);
  }
  return document;
}

export async function updateSmartNote(document, teamName) {
  const { nuid } = await getServerSession();
  document.nuid = nuid;
  return await updateDocument(document, null, null, `team-${teamName}-db`);
}

export async function updateSmartNotes(req, teamName) {
  const { nuid } = await getServerSession();
  const document = await req.json();
  document.nuid = nuid;
  return await updateDocuments(document, null, `team-${teamName}-db`);
}

export async function deleteSmartNote(query, teamName) {
  const { nuid } = await getServerSession();
  query.nuid = nuid;
  const childQuery = { smartNoteId: query.id, nuid: nuid };

  // Check if SmartNote has uploaded documents with blob storage locations
  const uploadedDocsQuery = {
    type: 'UploadedDocument',
    parentId: query.id,  // ✅ Changed from smartNoteId to parentId
    nuid: nuid
  };

  try {
    const uploadedDocuments = await selectDocumentsExt(uploadedDocsQuery, validateBasicMulti, {}, `team-${teamName}-db`);

    if (uploadedDocuments && uploadedDocuments.length > 0) {
      // Check if any documents have blob storage locations
      const docsWithBlobStorage = uploadedDocuments.filter(doc => doc.blobStorageLocation);

      if (docsWithBlobStorage.length > 0) {
        // Get assistantName from query parameter (passed from route) or from uploaded documents
        const assistantName = query.assistantName || uploadedDocuments[0]?.assistantName;

        if (!assistantName) {
          console.error(JSON.stringify({
            kpmsg: {
              id: 'AI_PORTAL_NOTEBOOK',
              name: 'deleteSmartNote - Missing AssistantName',
              detail: {
                smartNoteId: query.id,
                error: 'assistantName not available, cannot delete blobs'
              }
            }
          }));
        } else {
          // Delete all blobs for this SmartNote
          const blobDeletionResult = await deleteSmartNoteFilesFromBlob(teamName, assistantName, query.id);

          console.log(JSON.stringify({
            kpmsg: {
              id: 'AI_PORTAL_NOTEBOOK',
              name: 'deleteSmartNote - Blob Deletion Result',
              detail: {
                smartNoteId: query.id,
                assistantName,
                teamName,
                ...blobDeletionResult
              }
            }
          }));
        }
      }
    } else {
      // Still attempt to delete blobs in case there are orphaned files
      if (query.assistantName) {
        const blobDeletionResult = await deleteSmartNoteFilesFromBlob(teamName, query.assistantName, query.id);
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'deleteSmartNote - Error Checking UploadedDocuments',
        detail: {
          smartNoteId: query.id,
          error: error.message,
          stack: error.stack
        }
      }
    }));
    // Continue with deletion even if blob check/deletion fails
  }

  // Delete all child documents from MongoDB
  await deleteSmartNoteDocuments(childQuery, `team-${teamName}-db`);

  // Delete from AI Search indexes
  const indexes = await listAllIndexes();
  const requireDeletion = [];
  for (const index of indexes) {
    if (index?.fields?.find(field => field.name === 'smartnote_id')) {
      requireDeletion.push({ indexName: index.name });
    }
  }

  for (const index of requireDeletion) {
    await deleteFromIndex({ searchIndex: index.indexName, filter: `smartnote_id eq '${childQuery.smartNoteId}'` });
  }

  // Finally, delete the SmartNote itself from MongoDB
  return await deleteDocument(query, null, `team-${teamName}-db`);
}

export async function deleteSmartNotes(req, teamName) {
  const { nuid } = await getServerSession();
  const query = await req.json();
  query.nuid = nuid;
  return await deleteDocuments(query, `team-${teamName}-db`);
}

export async function cloneSmartNoteTemplate(templateQuery, teamName) {
  const template = await selectDocumentExt(templateQuery, validateBasicMulti, {}, `team-${teamName}-db`);
  if (!template) {
    return null;
  }

  const { nuid } = await getServerSession();
  const id = v4();
  const newSmartNote = {
    type: "SmartNote",
    app: template.app,
    id: id,
    nuid: nuid,
    parentId: template.id,
    createdNUID: nuid,
    smartNoteId: id,
    prelude: template.prelude || '',
    selectedUserAssistant: template.selectedUserAssistant,
    assistantName: template.assistantName,
    title: template.title ? template.title + ' (Copy)' : 'Untitled Smart Note',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: smartNoteStatus.Cloning,
    teamName: teamName
  };


  recordSmartNoteCreated(nuid, null, teamName, template?.assistantName);
  const insertedDocument = await insertDocument(newSmartNote, null, `team-${teamName}-db`);

  // chat history and chat are required for a SmartNote to work
  const chatHistory = prepDocument({
    type: 'ChatHistory',
    nuid: nuid,
    smartNoteId: newSmartNote.id,
    parentId: newSmartNote.id,
    current: true
  });
  await insertDocument(chatHistory, null, `team-${teamName}-db`);

  const chat = prepDocument({
    type: 'Chat',
    nuid: nuid,
    smartNoteId: newSmartNote.id,
    parentId: chatHistory.id,
    current: true
  });
  await insertDocument(chat, null, `team-${teamName}-db`);

  insertedDocument.oldSmartNoteId = template.smartNoteId;
  return insertedDocument;
}

/**
 * Retry a function with exponential backoff for 429 errors
 * @param {Function} fn - The async function to retry
 * @param {number} maxAttempts - Maximum number of attempts (default: 5)
 * @param {number} initialDelay - Initial delay in milliseconds (default: 2000ms)
 * @returns {Promise} - Result of the function
 */
async function retryWithBackoff(fn, maxAttempts = 5, initialDelay = 2000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if it's a 429 error (rate limit)
      const is429Error =
        error?.status === 429 ||
        error?.code === 429 ||
        error?.statusCode === 429 ||
        error?.message?.includes('429') ||
        error?.message?.includes('Too Many Requests') ||
        error?.message?.includes('rate limit');

      if (!is429Error || attempt === maxAttempts) {
        // If it's not a 429 error or we've exhausted attempts, throw the error
        throw error;
      }

      // Calculate delay with exponential backoff: 2s, 4s, 8s, 16s, 32s
      const delay = initialDelay * Math.pow(2, attempt - 1);

      console.warn(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'retryWithBackoff',
          detail: {
            attempt,
            maxAttempts,
            delay,
            error: error?.message || 'Unknown error'
          }
        }
      }));

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export async function cloneSmartNoteFromTemplate(templateId, teamName) {
  const templateQuery = { type: 'SmartNoteTemplate', id: templateId };
  const smartNote = await cloneSmartNoteTemplate(templateQuery, teamName);
  const sources = await cloneSources({ type: 'Source', parentId: smartNote.oldSmartNoteId }, smartNote.id, teamName);

  // for each sourceType, clone the sources with that sourceType
  // Wrap each operation with retry logic to handle 429 errors
  await Promise.all(
    sources.map(async (source) => {
      await retryWithBackoff(async () => {
        switch (source.sourceType) {
          case 'SavedNote': // smartnote-001
            await cloneSavedNote({ type: 'SavedNote', parentId: smartNote.oldSmartNoteId, id: source.oldSourceId }, smartNote.id, source.sourceId, teamName);
            break;
          case 'JiraIssue': // smartnote-001
            await cloneJiraIssue({ type: "JiraIssue", parentId: smartNote.oldSmartNoteId, id: source.oldSourceId }, smartNote.id, source.sourceId, teamName);
            break;
          case 'DesignReference': // does not require clone, search is filter by source/document_name
            await cloneDesignReference({ type: 'DesignReference', parentId: smartNote.oldSmartNoteId, id: source.oldSourceId }, smartNote.id, source.sourceId, teamName);
            break;
          case 'UploadedDocument': // smartnote-file-002
            // TODO: Save documents with the index they're uploaded to, so we can clone from the correct index
            await cloneUploadedDocument({ type: "UploadedDocument", parentId: smartNote.oldSmartNoteId, id: source.oldSourceId }, smartNote.id, source.sourceId, teamName);
            break;
          case 'DesignIndex': // does not require clone, search is based on config of index itself
            await cloneDesignIndex({ type: "DesignIndex", parentId: smartNote.oldSmartNoteId, id: source.oldSourceId }, smartNote.id, source.sourceId, teamName);
            break;
          case 'SavedResponse': // smartnote-001
            await cloneSavedResponse({ type: 'SavedResponse', parentId: smartNote.oldSmartNoteId, id: source.oldSourceId }, smartNote.id, source.sourceId, teamName);
            break;
          case 'WebsiteURL': // smartnote-001
            await cloneWebsiteURL({ type: 'WebsiteURL', parentId: smartNote.oldSmartNoteId, id: source.oldSourceId }, smartNote.id, source.sourceId, teamName);
            break;
          case 'SharePointFile': // sharepoint-uploads
            await cloneSharePointFile({ type: 'SharePointFile', parentId: smartNote.oldSmartNoteId, id: source.oldSourceId }, smartNote.id, source.sourceId, teamName);
            break;
          default:
            console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'cloneSmartNoteFromTemplate', detail: { source, message: `Failed to clone: ${source.sourceType} for ${source.sourceId}` } } }));
            break;
        }
      });
    })
  );

  return smartNote;
}

export async function cloneIndexDataForSmartNote(smartNote, jobId) {
  // Find out which indexes have smartnote_id field
  // get the name of the vector field for those indexes
  // get the selectable fields for those indexes
  // call cloneIndexDocuments for those indexes to copy documents from old smartnote_id to new smartnote_id
  let searchIndexes = await listAllIndexes();

  let designIndexesToCopy = [];
  for (const searchIndex of searchIndexes) {
    if (searchIndex?.fields?.find(field => field.name === 'smartnote_id')) {
      const vectorField = searchIndex.fields.find(field => field.type === 'Collection(Edm.Single)' && field.vectorSearchProfileName);
      if (!vectorField) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'cloneSmartNoteFromTemplate', detail: { index: searchIndex, message: `Index ${searchIndex.name} does not have a vector field` } } }));
        continue;
      }

      const selection = searchIndex.fields.filter(field => !field.hidden).map(field => field.name);
      designIndexesToCopy.push({ indexName: searchIndex.name, vectorField: vectorField.name, selection });
    }
  }

  let indexesCloned = 0;
  for (const designIndex of designIndexesToCopy) {
    await cloneIndexDocuments(
      designIndex.indexName,
      smartNote.nuid,
      null,
      designIndex.selection,
      `smartnote_id eq '${smartNote.oldSmartNoteId}'`,
      designIndex.vectorField,
      (doc) => {
        if (designIndex.selection.includes('nuid')) {
          return {
            ...doc,
            id: uuidv4(),
            nuid: smartNote.nuid,
            smartnote_id: smartNote.id
          };
        } else {
          return {
            ...doc,
            id: uuidv4(),
            smartnote_id: smartNote.id
          };
        }
      },
      jobId,
      smartNote.id,
      smartNote.teamName
    );

    indexesCloned++;
    await updateJob(
      smartNote.teamName,
      jobId,
      {
        indexesCloned: indexesCloned,
        indexesTotal: designIndexesToCopy.length
      }
    );
  }

  return smartNote;
}