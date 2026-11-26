'use server';

import { NextResponse } from 'next/server';
import { addSavedResponse, deleteSavedResponse } from '@services/addSavedResponseToIndex';

export async function POST(req) {
  try {
    const document = await req.json();
    if (!document.type || document.type !== 'SavedResponse') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    await addSavedResponse(document);
    const response = { result: 'added' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const savedResponseId = await params.savedResponseId;
    await deleteSavedResponse(savedResponseId);
    const response = { result: 'deleted' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
