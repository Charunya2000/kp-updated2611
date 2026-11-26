'use server';

import { selectDocument } from "@db/selectDocument";
import { searchIndex } from "@services/searchVectorDataService";

export const processUploadedDocumentNode = async (state) => {
  // Get the uploaded document info from the state
  const { uploadedDocumentId, smartNoteId, promptEmbedding, teamName } = state;

  if (!uploadedDocumentId) {
    return { documentContent: null, documentType: null, documentName: null };
  }

  if (!promptEmbedding) {
    return {
      documentContent: null,
      documentType: null,
      documentName: null,
      error: 'No prompt embedding available for semantic search'
    };
  }

  try {
    // Get user session only if needed (we're not actually using it here anymore)
    // The nuid should already be in the state and used by the vectorizePromptNode

    // Fetch the uploaded document from the database
    const uploadedDocument = await selectDocument({ id: uploadedDocumentId }, `team-${teamName}-db`);

    if (!uploadedDocument) {
      console.error(`Uploaded document with ID ${uploadedDocumentId} not found`);
      return {
        documentContent: null,
        documentType: null,
        documentName: null,
        error: `Uploaded document with ID ${uploadedDocumentId} not found`
      };
    }

    const documentName = uploadedDocument.fileName;
    const documentType = uploadedDocument.fileName.split('.').pop().toLowerCase();

    // Different handling based on document type
    let documentContent = null;

    // Search in the smartnote-file-002 index for all document types (including Excel)
    // This matches the pattern in uploadedDocumentsNode.js which doesn't handle Excel files separately
    const indexName = 'smartnote-file-002';
    const selectFields = ["smart_file_name", "content"];
    const filter = `smartnote_id eq '${smartNoteId}' and smart_file_name eq '${documentName}'`;

    try {
      const result = await searchIndex({
        searchIndex: indexName,
        selectFields: selectFields,
        searchEmbedding: promptEmbedding,
        nearestNeighbors: 5, // Match with uploadedDocumentsNode
        filter
      });

      if (result && result.length > 0) {
        // For all document types, combine content from all chunks
        documentContent = result.map(item => item.document.content).join('\n\n');
      } else {

        // Try a more permissive search just to see if the document exists at all
        const fallbackResult = await searchIndex({
          searchIndex: indexName,
          selectFields: selectFields,
          searchEmbedding: promptEmbedding,
          nearestNeighbors: 5,
          filter: `smartnote_id eq '${smartNoteId}'` // Just filter by smartnote_id
        });

        if (fallbackResult && fallbackResult.length > 0) {
        } else {
        }
      }
    } catch (searchError) {
      console.error('Error searching index:', searchError);
      return {
        documentContent: null,
        documentType,
        documentName,
        error: `Error searching for document content: ${searchError.message}`
      };
    }

    if (!documentContent) {
      return {
        documentContent: null,
        documentType,
        documentName,
        error: `No content found for document ${documentName}`
      };
    }

    return { documentContent, documentType, documentName };
  } catch (error) {
    console.error('Error processing uploaded document:', error);
    return {
      documentContent: null,
      documentType: null,
      documentName: null,
      error: `Error processing document: ${error.message}`
    };
  }
};
