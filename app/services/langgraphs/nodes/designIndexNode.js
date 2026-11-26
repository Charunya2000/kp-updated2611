'use server';

import { selectRelatedDesignIndexes } from '@services/actualSourcesService.js';
import { searchIndex } from './searchVectorDataService.js';
import { getIndexByName } from "./aiSearchConfigService.js";

const addMissingDesignIndexes = async (foundDesignIndexes, smartNoteId) => {

  const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId }
  const smartNote = await selectSmartNote(query);
  const additionalIndexes = [];

  if (smartNote.selectedUserAssistant === 'kpmc-assistant') {
    switch (smartNote.persona) {
      case 'Planning':
        additionalIndexes.push({
          type: 'DesignIndex',
          smartNoteId: smartNoteId,
          title: 'PI Planning Index',
          indexName: 'pi-planning-001'
        });
        break;
      case 'Change Request':
        additionalIndexes.push({
          type: 'DesignIndex',
          smartNoteId: smartNoteId,
          title: 'Change Request Index',
          indexName: 'kpmc-cr-001'
        });
        break;
    }
  }

  additionalIndexes.forEach(index => {
    if (!foundDesignIndexes.some(designIndex => designIndex.indexName === index.indexName)) {
      foundDesignIndexes.push(index);
    }
  });

  return foundDesignIndexes;
};

export const createMessagesFromDesignIndexes = async (state) => {
  const foundDesignIndexes = await selectRelatedDesignIndexes(state.smartNoteId);

  const filteredDesignIndexes = foundDesignIndexes.filter(designIndex =>
    state.actualSources.some(actualSource => actualSource.sourceId === designIndex.id)
  );

  const filteredDesignIndexesAdded = await addMissingDesignIndexes(filteredDesignIndexes, state.smartNoteId);

  const designIndexSearchResults = await Promise.all(
    filteredDesignIndexesAdded.map(async (designIndex) => {
      let filter;
      const integerCheck = /\d+/;
      if ((designIndex.indexName === 'kpmc-cr-001') && integerCheck.test(state.chatInteraction.prompt) && (state.chatInteraction.prompt.match(integerCheck) || []).length === 1) {
        const numberString = state.chatInteraction.prompt.match(integerCheck)[0];
        filter = `cr_id eq '${numberString}'`;
      }

      const index = await getIndexByName(designIndex.indexName);

      const result = await searchIndex({
        searchIndex: designIndex.indexName,
        selectFields: index?.selectFields,
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: index?.nearestNeighbors || 5,
        filter: filter || index?.filter
      });

      result.indexName = designIndex.indexName;
      return result;
    })
  );

  const filteredDesignIndexSearchResults = await createMessagesFromDesignIndexes(designIndexSearchResults);

  return { filteredDesignIndexSearchResults };
};
