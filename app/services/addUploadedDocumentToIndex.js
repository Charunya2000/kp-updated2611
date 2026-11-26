'use server';

import { vectorizeAndIndexDocument } from '@services/insertChunckedFileIntoVectorDataService';

async function addUploadedDocument({ nuid, id, parentId: smartNoteId, fileName, fileContent }) {
  try {
    const results = await vectorizeAndIndexDocument({ nuid, smartNoteId, id, fileName, fileContent })
    return results;
  } catch (error) {
    console.error(error)
    throw error;
  }
}

export {
  addUploadedDocument
}