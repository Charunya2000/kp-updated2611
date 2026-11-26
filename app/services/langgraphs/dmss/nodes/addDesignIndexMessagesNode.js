import { selectRelatedDesignIndexes } from "@/app/services/actualSourcesService";
import { getIndexConfigById } from "@/app/services/aiSearchConfigService";
import { searchIndex } from "@/app/services/searchVectorDataService";
import { createMessagesFromDesignIndexes } from "../../shared/functions/createMessagesFromDesignIndexs";

export const addDesignIndexMessagesNode = async (state) => {
  const foundDesignIndexes = await selectRelatedDesignIndexes(state.smartNoteId, state.teamName);
  const filteredDesignIndexes = foundDesignIndexes.filter(designIndex =>
    state.actualSources.some(actualSource => actualSource.sourceId === designIndex.id)
  );

  const designIndexSearchResults = await Promise.all(
    filteredDesignIndexes.map(async (designIndex) => {
      const indexConfig = await getIndexConfigById(designIndex.searchIndexConfigId, state.teamName);

      const result = await searchIndex({
        searchIndex: designIndex.indexName,
        selectFields: indexConfig?.selectFields,
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: indexConfig?.nearestNeighbors || 5,
        filter: indexConfig?.filter
      });

      result.indexName = designIndex.indexName;
      result.searchIndexConfigId = designIndex.searchIndexConfigId;
      return result;
    })
  );

  const filteredDesignIndexSearchResults = await createMessagesFromDesignIndexes(designIndexSearchResults);

  const totalMessages = [
    ...(Array.isArray(state.totalMessages) ? state.totalMessages : []),
    ...filteredDesignIndexSearchResults
  ];

  return { totalMessages };
}

