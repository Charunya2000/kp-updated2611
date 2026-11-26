'use server';

import { NextResponse } from 'next/server';
import { createUploadedDocument, updateUploadedDocument } from '@services/uploadedDocumentService';
import { vectorizeAndIndexDocument, vectorizeWithExternalService } from '@services/insertChunckedFileIntoVectorDataService';
import { supportedFileExtensions } from '@/utils/constants';
import { EventEmitter } from 'events';
import { uploadFileToBlob } from '@/app/services/blobStorageService';

// Configure global event emitter with higher limit
// Increase the default maximum number of listeners globally to avoid warnings
// This is a more robust approach than setting it per-instance
EventEmitter.defaultMaxListeners = 100;

// Store clients in a more manageable way with a Map for O(1) lookups by ID
// Map provides better performance for frequent add/remove operations
const clients = new Map();
let nextClientId = 1;

// Assistants with specific file types required external vectorization with the python service
const externalVectorizationConfig = {
  'kpif': ['xlsx', 'pptx', 'ppt'],
  'products': ['xlsx', 'pptx', 'ppt'],
  'document-management-shared-service': ['xlsx', 'docx']
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const formData = await req.formData();
    const fileName = formData.get('fileName');
    const file = formData.get('file');
    const type = formData.get('type');
    const parentId = formData.get('parentId');
    const id = formData.get('id');
    const createdAt = formData.get('createdAt');
    const updatedAt = formData.get('updatedAt');
    const relativeUrl = formData.get('relativeUrl');

    const parts = fileName.split('.');
    const fileExtension = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    if (!supportedFileExtensions.find(ext => ext === fileExtension)) {
      return NextResponse.json({ error: `File format not supported. Supported formats: ${supportedFileExtensions.join(', ')}` }, { status: 415 });
    }

    if (!file || !file.name || !file.arrayBuffer) {
      return NextResponse.json({ error: 'No file uploaded or invalid file' }, { status: 400 });
    }

    // Convert the file to a buffer in a way that avoids the experimental buffer.File API
    const arrayBuffer = await file.arrayBuffer();
    let fileContent = Buffer.from(arrayBuffer);
    if (fileExtension === 'txt') {
      fileContent = fileContent.toString('utf8');
    }

    // Upload file to blob storage
    let blobStorageLocation = null;
    try {
      const fileBuffer = Buffer.from(arrayBuffer);
      await uploadFileToBlob(teamName, assistantName, smartNoteId, fileName, fileBuffer);

      const containerName = `uploadeddocuments-${teamName.toLowerCase()}`;
      blobStorageLocation = {
        container: containerName,
        directory: `${assistantName}/${smartNoteId}`,  // ✅ Include smartNoteId
        fileName: fileName
      };
    } catch (blobError) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'POST - Upload Document to Blob Storage',
          detail: {
            error: blobError?.message || 'Failed to upload to blob storage',
          }
        }
      }));
      // Continue with document creation even if blob storage fails
    }

    const uploadedDocument = {
      type,
      parentId,
      id,
      fileName,
      createdAt,
      updatedAt,
      status: 'PENDING',
      ...(blobStorageLocation && { blobStorageLocation })
    };

    let clientAction = 'uploadedDocument';
    if (relativeUrl) {
      uploadedDocument.relativeUrl = relativeUrl;
      clientAction = 'uploadedSharePointFile';
    }

    createUploadedDocument(uploadedDocument, teamName, assistantName);

    // Call vectorizeAndIndexDocument in promise form to avoid blocking the response
    // This allows the client to receive updates without waiting for the indexing to complete
    const externalConfig = externalVectorizationConfig[assistantName];
    if (externalConfig && externalConfig.find(fileType => fileType === fileExtension)) {
      vectorizeWithExternalService({ ...uploadedDocument }, file, teamName, assistantName)
        .then((_) => {
          const indexedUploadedDocument = { ...uploadedDocument, status: 'INDEXED' };
          updateUploadedDocument(indexedUploadedDocument, teamName)
        })
        .catch(error => {
          console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'vectorizeWithExternalService', detail: { message: `Error with external vectorization service: ${error.message}`, error: error } } }));
          // Update document with error status
          const erroredDocument = { ...uploadedDocument, status: 'ERROR' };
          updateUploadedDocument(erroredDocument, teamName)
        });
    } else {
      vectorizeAndIndexDocument({ ...uploadedDocument, fileContent }, teamName, assistantName)
        .then((_) => {
          const indexedUploadedDocument = { ...uploadedDocument, status: 'INDEXED' };
          updateUploadedDocument(indexedUploadedDocument, teamName)
        })
        .catch(error => {
          console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'vectorizeAndIndexDocument', detail: { message: `Error with external vectorization service: ${error.message}`, error: error } } }));
          // Update document with error status
          const erroredDocument = { ...uploadedDocument, status: 'ERROR' };
          updateUploadedDocument(erroredDocument, teamName)
        });
    }

    const response = { result: 'added' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}