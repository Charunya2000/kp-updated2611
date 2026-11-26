'use server';

import { NextResponse } from 'next/server';
import { createUploadedDocument, selectUploadedDocuments } from '@services/uploadedDocumentService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const query = { type: 'UploadedDocument', parentId: smartNoteId }
    const sources = await selectUploadedDocuments(query, teamName);
    return NextResponse.json(sources, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'UploadedDocument') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await createUploadedDocument(document, teamName, assistantName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
