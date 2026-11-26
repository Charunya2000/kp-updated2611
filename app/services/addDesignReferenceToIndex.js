'use server';

import { insertVectorData } from './insertVectorDataService';
import { vectorize } from './vectorizeDataService';
import { recordDesignReference } from './statisticsService';

function annotateDesignReference(indexName, fileName, uri) {
  return `Design reference in index: ${indexName} with fileName: ${fileName} at uri: ${uri}`;
}

async function addDesignDocument({ nuid, id, parentId: smartNoteId, indexName, fileName, uri }, teamName, assistantName = null) {
  try {
    const content = annotateDesignReference(indexName, fileName, uri);
    const contentVector = vectorize({ nuid, content });
    const smartNoteType = 'DesignReference';
    recordDesignReference(nuid, null, teamName, assistantName);
    const results = await insertVectorData({ nuid, smartNoteId, id, smartNoteType, content, contentVector })
    return results;
  } catch (error) {
    console.error(error)
    throw error;
  }
}

export {
  addDesignDocument
}