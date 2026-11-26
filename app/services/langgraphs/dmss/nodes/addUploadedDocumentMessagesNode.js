import { selectRelatedUploadedDocuments } from "@/app/services/actualSourcesService";
import { searchIndex } from "@/app/services/searchVectorDataService";

export const addUploadedDocumentMessagesNode = async (state) => {
  const foundUploadedDocuments = await selectRelatedUploadedDocuments(state.smartNoteId, state.teamName);
  const filteredUploadedDocuments = foundUploadedDocuments.filter(uploadedDocument =>
    state.actualSources.some(actualSource => actualSource.sourceId === uploadedDocument.id)
  );
  const uploadedDocumentSearchResults = await Promise.all(
    filteredUploadedDocuments.map(async (uploadedDocument) => {
      let indexName = 'smartnote-file-002';
      let selectFields = ["smart_file_name", "content"];
      let filter = `smartnote_id eq '${uploadedDocument.parentId}' and smart_file_name eq '${uploadedDocument.fileName}'`;
      let n = 10;

      const extension = uploadedDocument.fileName.split('.').pop().toLowerCase();
      if (extension === 'xlsx' || extension === 'xls') {
        indexName = 'excel_idx';
        selectFields = ["content", "document_name", "id", "sheet", "rowNum", "smartnote_id"];
        filter = `smartnote_id eq '${uploadedDocument.parentId}' and document_name eq '${uploadedDocument.fileName}'`;
        n = 100;
      }

      const result = await searchIndex({
        searchIndex: indexName,
        selectFields: selectFields,
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: n,
        filter
      });

      return result;
    })
  );
  const filteredUploadedDocumentSearchResults = createMessagesFromUploadedDocuments(uploadedDocumentSearchResults);

  const totalMessages = [
    ...(Array.isArray(state.totalMessages) ? state.totalMessages : []),
    ...filteredUploadedDocumentSearchResults
  ];

  return { totalMessages };
}

const createMessagesFromUploadedDocuments = (uploadedDocuments) => {
  const messages = [];

  uploadedDocuments.forEach(uploadedDocumentArray => {
    uploadedDocumentArray.forEach(result => {
      let message;

      if (result.document.smart_file_name) {
        message = {
          role: 'assistant',
          content: `source: ${result.document.smart_file_name}, content: ${result.document.content}`
        };
      } else {
        message = {
          role: 'assistant',
          content: `source: ${result.document.document_name ? result.document.document_name : 'unknown'}, content: ${result.document.content}, sheet: ${result.document.sheet}, row: ${result.document.rowNum}, smartnote_id: ${result.document.smartnote_id}`
        };
      }

      messages.push(message);
    });
  });
  return messages;
};