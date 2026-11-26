'use server';

import { NextResponse } from 'next/server';
import { selectUploadedDocument, updateUploadedDocument, deleteUploadedDocument, deleteUploadedDocumentFromIndex, getUploadedDocument } from '@services/uploadedDocumentService';
import { deleteFileFromBlob } from '@/app/services/blobStorageService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const smartNotes = await selectUploadedDocument(req, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'UploadedDocument') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await updateUploadedDocument(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, uploadedDocumentId } = await params;

    const query = await req.json();
    if (!query.type || query.type !== 'UploadedDocument') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    // First, fetch the document to get blob storage location
    const document = await getUploadedDocument(teamName, assistantName, smartNoteId, uploadedDocumentId);

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from blob storage if blobStorageLocation exists
    if (document.blobStorageLocation) {
      const { directory, fileName } = document.blobStorageLocation;
      // directory format is: "assistantName/smartNoteId"
      await deleteFileFromBlob(teamName, assistantName, smartNoteId, fileName);
    }

    // Delete from vector search index
    await deleteUploadedDocumentFromIndex({
      smartNoteId: document.parentId,
      fileName: document.fileName
    });

    // Delete from MongoDB
    const result = await deleteUploadedDocument(query, teamName);

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'DELETE - Uploaded Document',
        detail: {
          teamName,
          assistantName,
          smartNoteId,
          documentId: uploadedDocumentId,
          fileName: document.fileName
        }
      }
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'DELETE - Uploaded Document',
        detail: {
          error: error?.message || 'Failed to delete uploaded document'
        }
      }
    }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
