'use server';

import { NextResponse } from 'next/server';
import { deleteUploadedDocumentFromIndex } from '@services/uploadedDocumentService';

export async function DELETE(req) {
  try {
    const query = await req.json();
    const response = await deleteUploadedDocumentFromIndex(query);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
