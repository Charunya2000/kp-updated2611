'use server';

import { searchIndex } from '../searchVectorDataService';
import { selectRelatedDesignIndexes, addMissingDesignIndexes } from '../actualSourcesService';

const createMessagesFromDesignIndexes = (designIndexes) => {
  const messages = [];

  designIndexes.forEach(designIndexArray => {
    designIndexArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: ${result.document.document_name}, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

const designIndexesNode = async (state) => {
  const foundDesignIndexes = await selectRelatedDesignIndexes(state.smartNoteId);
  const filteredDesignIndexes = foundDesignIndexes.filter(designIndex =>
    state.actualSources.some(actualSource => actualSource.sourceId === designIndex.id)
  );
  const filteredDesignIndexesAdded = await addMissingDesignIndexes(filteredDesignIndexes, state.smartNoteId);
  const designIndexSearchResults = await Promise.all(
    filteredDesignIndexesAdded.map(async (designIndex) => {
      const nearestNeighbors = state.nearestNeighborsSettings['designIndexesNode'] || 2;
      const result = await searchIndex({
        searchIndex: designIndex.indexName,
        selectFields: ["document_name", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: nearestNeighbors
      });
      return result;
    })
  );
  const filteredDesignIndexSearchResults = createMessagesFromDesignIndexes(designIndexSearchResults);
  return { filteredDesignIndexSearchResults };
};

export default designIndexesNode;