'use server';

import { selectRelatedSavedResponses } from '@services/actualSourcesService.js';
import { searchIndex } from './searchVectorDataService.js';

const createMessagesFromSavedResponses = (savedResponses) => {
  const messages = [];

  savedResponses.forEach(savedResponseArray => {
    savedResponseArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: Saved Response, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

export const savedResponsesNode = async (state) => {

  const foundSavedResponses = await selectRelatedSavedResponses(state.smartNoteId);
  const filteredSavedResponses = foundSavedResponses.filter(savedResponse =>
    state.actualSources.some(actualSource => actualSource.sourceId === savedResponse.id)
  );
  const savedResponseSearchResults = await Promise.all(
    filteredSavedResponses.map(async (savedResponse) => {
      const filter = `smartnote_id eq '${savedResponse.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredSavedResponseSearchResults = createMessagesFromSavedResponses(savedResponseSearchResults);

  return { filteredSavedResponseSearchResults }
};
