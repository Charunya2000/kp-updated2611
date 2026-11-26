'use server';

import { insertVectorData } from './insertVectorDataService';
import { vectorize } from './vectorizeDataService';

function annotateChatInteraction(prompt, response) {
  return `Conversation prompt: ${prompt} and response: ${response}`;
}

async function addInteraction({ nuid, id, parentId: smartNoteId, prompt, response }) {
  try {
    const content = annotateChatInteraction(prompt, response);
    const contentVector = vectorize({ nuid, content });
    const smartNoteType = 'ChatInteraction';
    const results = await insertVectorData({ nuid, smartNoteId, id, smartNoteType, content, contentVector })
    return results;
  } catch (error) {
    console.error(error)
    throw error;
  }
}

export {
  addInteraction
}