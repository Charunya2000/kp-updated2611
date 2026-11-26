'use server';

import { NextResponse } from 'next/server';
import { deleteSavedNote } from '@services/addSavedNoteToIndex';

export async function DELETE(_, { params }) {
  try {
    const { savedNoteId } = await params;
    await deleteSavedNote(savedNoteId);
    const response = { result: 'deleted' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
