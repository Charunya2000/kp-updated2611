import { selectRelatedDesignReferences } from "@/app/services/actualSourcesService";
import { searchIndex } from "@/app/services/searchVectorDataService";

export const addDesignReferenceMessagesNode = async (state) => {
  const foundDesignReferences = await selectRelatedDesignReferences(state.smartNoteId, state.teamName);
  const filteredDesignReferences = foundDesignReferences.filter(designReference =>
    state.actualSources.some(actualSource => actualSource.sourceId === designReference.id)
  );
  const designReferenceSearchResults = await Promise.all(
    filteredDesignReferences.map(async (designReference) => {
      const filter = `document_name eq '${designReference.name}'`;
      const result = await searchIndex({
        searchIndex: designReference.indexName,
        selectFields: ["source_url", 'document_name', "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 30,
        filter
      });
      return result;
    })
  );
  const filteredDesignReferenceSearchResults = createMessagesFromDesignReferences(designReferenceSearchResults);

  const totalMessages = [
    ...(Array.isArray(state.totalMessages) ? state.totalMessages : []),
    ...filteredDesignReferenceSearchResults
  ]

  return { totalMessages };
}

const createMessagesFromDesignReferences = (designReferences) => {
  const messages = [];

  designReferences.forEach(designReferenceArray => {
    designReferenceArray.forEach(result => {
      const content = `source category: ${result.document.document_name}${result.document.source_url && (' , at source_url: ' + result.document.source_url)}, content: ${result.document.content}`;

      const message = {
        role: 'assistant',
        content: content
      };
      messages.push(message);
    });
  });
  return messages;
};