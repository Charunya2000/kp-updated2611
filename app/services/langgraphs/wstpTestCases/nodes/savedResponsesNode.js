'use server';

import { searchIndex } from '@services/searchVectorDataService';
import { selectRelatedSavedResponses } from '@services/actualSourcesService';

const createMessagesFromSavedResponses = (savedResponses) => {
  const contentArray = [];

  savedResponses.forEach(savedResponseArray => {
    savedResponseArray.forEach(result => {
      contentArray.push(result.document.content);
    });
  });

  return contentArray.join(' ');
};

export const savedResponsesNode = async (state) => {
  const foundSavedResponses = await selectRelatedSavedResponses(state.smartNoteId, state.teamName);
  const filteredSavedResponses = foundSavedResponses.filter(savedResponse =>
    state.actualSources.some(actualSource => actualSource.sourceId === savedResponse.id)
  );
  const savedResponseSearchResults = await Promise.all(
    filteredSavedResponses.map(async (savedResponse) => {
      const filter = `smart_type eq 'SavedResponse' and smartnote_id eq '${savedResponse.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.originalPromptEmbedding,
        nearestNeighbors: 3,
        filter
      });
      return result;
    })
  );
  const filteredSavedResponseSearchResults = createMessagesFromSavedResponses(savedResponseSearchResults);
  return { filteredSavedResponseSearchResults };
};