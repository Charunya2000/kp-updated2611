'use server';

import { searchIndex } from '@/app/services/searchVectorDataService';
import { selectRelatedDesignIndexes, selectJustSources } from '@services/actualSourcesService';
import { getIndexConfigById } from '@services/aiSearchConfigService';

const createMessagesFromDesignIndexes = async (designIndexes, state) => {
  const contentParts = [];
  let indexConfig, previousIndexName = '';
  for (const designIndexArray of designIndexes) {
    for (const result of designIndexArray) {

      if (!result || !result.document) {
        continue;
      }
      // avoid unnecessary calls to getIndexByName if the index name hasn't changed
      if (previousIndexName !== designIndexArray.indexName) {
        previousIndexName = designIndexArray.indexName;
        indexConfig = await getIndexConfigById(designIndexArray.searchIndexConfigId, state.teamName);
      }

      try {
        let content = '';
        if (!indexConfig || !indexConfig.template) {

          // build a generic template
          content = Object.keys(result.document)
            .map(key => `${key}: ${result.document[key]}`)
            .join(', ');
        } else {
          const templateFunction = new Function(...Object.keys(result.document), `return \`${indexConfig.template}\`;`);
          content = templateFunction(...Object.values(result.document));
        }

        contentParts.push(content);
      } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'createMessagesFromDesignIndexes', detail: { indexSettings: indexConfig, designIndexFields: result.document } } }));

        throw error;
      }
    }
  }
  return contentParts.join(' ');
};

const designIndexesNode = async (state) => {
  const actualSources = await selectJustSources(state.smartNoteId, state.teamName);
  const foundDesignIndexes = await selectRelatedDesignIndexes(state.smartNoteId, state.teamName);
  const filteredDesignIndexes = foundDesignIndexes.filter(designIndex =>
    actualSources.some(actualSource => actualSource.sourceId === designIndex.id)
  );

  let designIndexSearchResults = await Promise.all(
    filteredDesignIndexes.map(async (designIndex) => {

      const indexConfig = await getIndexConfigById(designIndex.searchIndexConfigId, state.teamName);
      if (!indexConfig) {
        return null;
      }

      const result = await searchIndex({
        searchIndex: designIndex.indexName || 'ets-001',
        selectFields: indexConfig?.selectFields || ["doc_name", "doc_type", "project_id", "project_name", "content"],
        searchEmbedding: state.originalPromptEmbedding,
        nearestNeighbors: indexConfig?.nearestNeighbors || 5,
        filter: indexConfig?.filter || null
      });
      return result;
    })
  );

  designIndexSearchResults = designIndexSearchResults.filter(result => result !== null);

  const filteredDesignIndexSearchResults = await createMessagesFromDesignIndexes(designIndexSearchResults, state);
  return { filteredDesignIndexSearchResults };
};

export default designIndexesNode;