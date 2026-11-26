'use server';

import { insertVectorData, deleteDocument } from './insertVectorDataService';
import { vectorize } from './vectorizeDataService';
import { getServerSession } from '@utils/getSession';

function annotateSavedResponse(responseTitle, responseContent) {
  return `Saved response with title: ${responseTitle} and content: ${responseContent}`;
}

async function addSavedResponse({ parentId: smartNoteId, id, responseTitle, responseMarkdown }) {
  try {
    const { nuid } = await getServerSession();
    const content = annotateSavedResponse(responseTitle, responseMarkdown);
    const contentVector = await vectorize({ nuid, content });
    const smartNoteType = 'SavedResponse';
    const results = await insertVectorData({ nuid, smartNoteId, id, smartNoteType, content, contentVector })
    return results;
  } catch (error) {
    console.error(error)
    throw error;
  }
}

async function deleteSavedResponse(savedResponseId) {
  try {
    const results = await deleteDocument(savedResponseId);
    return results;
  } catch (error) {
    console.error(error)
    throw error;
  }
}

export {
  addSavedResponse,
  deleteSavedResponse
}