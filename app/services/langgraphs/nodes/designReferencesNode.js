'use server';

import { selectRelatedDesignReferences } from '@services/actualSourcesService.js';
import { searchIndex } from './searchVectorDataService.js';

const createMessagesFromDesignReferences = (designReferences) => {
  const messages = [];

  designReferences.forEach(designReferenceArray => {
    designReferenceArray.forEach(result => {
      const content = `source category: ${result.document.document_name}${result.document.source_url && (' , at source_url: ' + result.document.source_url)}, content: ${result.document.content}`;
      console.log('content', content);

      const message = {
        role: 'assistant',
        content: content
      };
      messages.push(message);
    });
  });
  return messages;
};

export const designReferencesNode = async (state) => {
  const foundDesignReferences = await selectRelatedDesignReferences(state.smartNoteId);
  const filteredDesignReferences = foundDesignReferences.filter(designReference =>
    state.actualSources.some(actualSource => actualSource.sourceId === designReference.id)
  );
  const designReferenceSearchResults = await Promise.all(
    filteredDesignReferences.map(async (designReference) => {
      const nameRef = designReference.indexName === 'cms-doc-001' ? 'source' : 'document_name';
      const selectedFields = designReference.indexName === 'cms-doc-001' ? [nameRef, "content"] : ["source_url", nameRef, "content"];
      const filter = `${nameRef} eq '${designReference.name}'`;
      const result = await searchIndex({
        searchIndex: designReference.indexName,
        selectFields: selectedFields,
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 30,
        filter
      });
      return result;
    })
  );
  const filteredDesignReferenceSearchResults = createMessagesFromDesignReferences(designReferenceSearchResults);

  return { filteredDesignReferenceSearchResults };
}
