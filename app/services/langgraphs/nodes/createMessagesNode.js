'use server';

import { selectRelatedDesignReferences, selectRelatedSavedResponses } from '@services/actualSourcesService.js';
import { createMessagesFromDesignReferences } from '@services/submitPromptService2.js';

export const createMessagesNode = async (state) => {
  const filteredMessages = state.filteredSearchResults.map(result => {
    const message = {
      role: 'assistant',
      content: `source category: ${result.document.smart_type}, content: ${result.document.content}`
    };
    return message;
  });

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

  const foundSavedResponses = await selectRelatedSavedResponses(state.smartNoteId);
  const filteredSavedResponses = foundSavedResponses.filter(savedResponse =>
    state.actualSources.some(actualSource => actualSource.sourceId === savedResponse.id)
  );
  const savedResponseSearchResults = await Promise.all(
    filteredSavedResponses.map(async (savedResponse) => {
      const filter = `smartnote_id eq '${savedResponse.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredSavedResponseSearchResults = createMessagesFromSavedResponses(savedResponseSearchResults);

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

  let confluenceSearchResults = [];

  const confluenceResult = await searchIndex({
    searchIndex: 'kpmc-confluence-002',
    selectFields: ["space", "title", "content"],
    searchEmbedding: state.promptEmbedding,
    nearestNeighbors: 3
  });
  confluenceSearchResults = createMessagesFromConfliuenceIndex([confluenceResult]);

  const foundWebsiteURLs = await selectRelatedWebsiteURLs(state.smartNoteId);
  const filteredWebsiteURLs = foundWebsiteURLs.filter(websiteURL =>
    state.actualSources.some(actualSource => actualSource.sourceId === websiteURL.id)
  );
  const websiteURLsSearchResults = await Promise.all(
    filteredWebsiteURLs.map(async (websiteURL) => {
      const filter = `smart_type eq 'WebsiteURL' and smartnote_id eq '${websiteURL.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 10,
        filter
      });
      return result;
    })
  );
  const filteredWebsiteURLsSearchResults = createMessagesFromWebsiteURLs(websiteURLsSearchResults);

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

  const foundSharePointFiles = await selectRelatedSharePointFiles(state.smartNoteId);
  const filteredSharePointFiles = foundSharePointFiles.filter(sharePointFile =>
    state.actualSources.some(actualSource => actualSource.sourceId === sharePointFile.id)
  );
  const SharePointFilesearchResults = await Promise.all(
    filteredSharePointFiles.map(async (sharePointFile) => {
      const filter = `smartnote_id eq '${sharePointFile.parentId}' and file_name eq '${sharePointFile.fileName}' and  site_name eq '${sharePointFile.siteName}'`;
      const result = await searchIndex({
        searchIndex: 'sharepoint-uploads',
        selectFields: ["file_name", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredSharePointFilesearchResults = createMessagesFromSharePointFiles(SharePointFilesearchResults);

  let totalMessages;

  totalMessages = [
    ...filteredMessages,
    ...filteredDesignReferenceSearchResults,
    ...filteredSavedResponseSearchResults,
    ...filteredDesignIndexSearchResults,
    ...confluenceSearchResults,
    ...filteredUploadedDocumentSearchResults,
    ...filteredSharePointFilesearchResults,
    ...filteredWebsiteURLsSearchResults
  ];

  return { totalMessages };
};
