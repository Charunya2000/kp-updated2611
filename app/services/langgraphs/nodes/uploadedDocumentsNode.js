'use server';

import { searchIndex } from '../searchVectorDataService';
import { selectRelatedUploadedDocuments } from '../actualSourcesService';

const createMessagesFromUploadedDocuments = (uploadedDocuments) => {
  const messages = [];

  uploadedDocuments.forEach(uploadedDocumentArray => {
    uploadedDocumentArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: ${result.document.smart_file_name}, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

export const uploadedDocumentsNode = async (state) => {
  const foundUploadedDocuments = await selectRelatedUploadedDocuments(state.smartNoteId);
  const filteredUploadedDocuments = foundUploadedDocuments.filter(uploadedDocument =>
    state.actualSources.some(actualSource => actualSource.sourceId === uploadedDocument.id)
  );
  const uploadedDocumentSearchResults = await Promise.all(
    filteredUploadedDocuments.map(async (uploadedDocument) => {
      const filter = `smartnote_id eq '${uploadedDocument.parentId}' and smart_file_name eq '${uploadedDocument.fileName}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-file-002',
        selectFields: ["smart_file_name", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredUploadedDocumentSearchResults = createMessagesFromUploadedDocuments(uploadedDocumentSearchResults);
  return { filteredUploadedDocumentSearchResults };
};
