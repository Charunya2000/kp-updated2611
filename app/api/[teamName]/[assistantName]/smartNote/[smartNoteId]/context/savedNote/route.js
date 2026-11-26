'use server';

import { NextResponse } from 'next/server';
import { addSavedNote, deleteSavedNote } from '@services/addSavedNoteToIndex';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'SavedNote') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    console.log('Adding saved note to index with document:', document);
    await addSavedNote(document, teamName, assistantName);
    const response = { result: 'added' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const document = await req.json();
    if (!document.type || document.type !== 'SavedNote') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    await deleteSavedNote(document);
    const response = { result: 'added' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
