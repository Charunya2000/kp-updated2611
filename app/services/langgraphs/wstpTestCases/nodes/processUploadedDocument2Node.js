import { searchIndex } from '@services/searchVectorDataService.js';
import { selectJustSources, selectRelatedUploadedDocuments } from '@services/actualSourcesService.js';

const createMessagesFromUploadedDocuments = (uploadedDocuments) => {
  const contents = [];

  uploadedDocuments.forEach(uploadedDocumentArray => {
    uploadedDocumentArray.forEach(result => {
      contents.push(result.document.content);
    });
  });

  return contents.join(' ');
};

export const processUploadedDocument2Node = async (state) => {

  const foundUploadedDocuments = await selectRelatedUploadedDocuments(state.smartNoteId, state.teamName);
  const actualSources = await selectJustSources(state.smartNoteId, state.teamName);

  const filteredUploadedDocuments = foundUploadedDocuments.filter(uploadedDocument =>
    actualSources?.some(actualSource => actualSource.sourceId === uploadedDocument.id)
  );

  const uploadedDocumentSearchResults = await Promise.all(
    filteredUploadedDocuments.map(async (uploadedDocument) => {
      const filter = `smartnote_id eq '${uploadedDocument.parentId}' and smart_file_name eq '${uploadedDocument.fileName}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-file-002',
        selectFields: ["smart_file_name", "content", "smart_file_type"],
        searchEmbedding: state.originalPromptEmbedding,
        nearestNeighbors: 50,
        filter
      });
      return result;
    })
  );

  const filteredUploadedFilesSearchResults = createMessagesFromUploadedDocuments(uploadedDocumentSearchResults);

  return { filteredUploadedFilesSearchResults };
};
