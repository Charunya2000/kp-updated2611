'use server';

import { searchIndex } from '../searchVectorDataService';
import { selectRelatedDesignReferences } from '../actualSourcesService';

const createMessagesFromDesignReferences = (designReferences) => {
  const messages = [];

  designReferences.forEach(designReferenceArray => {
    designReferenceArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: ${result.document.document_name}, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

const designReferencesNode = async (state) => {
  const nearestNeighbors = state.nearestNeighborsSettings['designIndexesNode'] || 30;
  const foundDesignReferences = await selectRelatedDesignReferences(state.smartNoteId);
  const filteredDesignReferences = foundDesignReferences.filter(designReference =>
    state.actualSources.some(actualSource => actualSource.sourceId === designReference.id)
  );
  const designReferenceSearchResults = await Promise.all(
    filteredDesignReferences.map(async (designReference) => {
      const nameRef = designReference.indexName === 'cms-doc-001' ? 'source' : 'document_name';
      const filter = `${nameRef} eq '${designReference.name}'`;
      const result = await searchIndex({
        searchIndex: designReference.indexName,
        selectFields: [nameRef, "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: nearestNeighbors,
        filter
      });
      return result;
    })
  );
  const filteredDesignReferenceSearchResults = createMessagesFromDesignReferences(designReferenceSearchResults);
  return { filteredDesignReferenceSearchResults };
};

export default designReferencesNode;