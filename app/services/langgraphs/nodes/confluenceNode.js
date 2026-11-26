'use server';

import { searchIndex } from '../searchVectorDataService';

const createMessagesFromConfliuenceIndex = (designIndexes) => {
  const messages = [];

  designIndexes.forEach(designIndexArray => {
    designIndexArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: Confluence Index - ${result.document.space}/${result.document.title}, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

export const confluenceNode = async (state) => {
  const nearestNeighbors = state.nearestNeighborsSettings['confluenceNode'] || 3;
  const confluenceResult = await searchIndex({
    searchIndex: 'kpmc-confluence-002',
    selectFields: ["space", "title", "content"],
    searchEmbedding: state.promptEmbedding,
    nearestNeighbors: nearestNeighbors
  });
  const confluenceSearchResults = createMessagesFromConfliuenceIndex([confluenceResult]);
  return { confluenceSearchResults };
};
