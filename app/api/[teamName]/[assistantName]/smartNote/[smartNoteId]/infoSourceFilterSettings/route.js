'use server';

import { NextResponse } from 'next/server';
import { createInfoSourceFilterSettings, selectInfoSourceFilterSettings } from '@services/infoSourceFilterSettingsService';

export async function GET(_, { params }) {
  try {
    const { teamName, smartNoteId } = await params;
    const query = { type: 'InfoSourceFilterSettings', parentId: smartNoteId };
    const documents = await selectInfoSourceFilterSettings(query, teamName);
    return NextResponse.json(documents, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName } = await params;
    const document = await req.json();
    if (!document.type || document.type !== 'InfoSourceFilterSettings') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await createInfoSourceFilterSettings(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}