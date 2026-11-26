'use server';

import { NextResponse } from 'next/server';
import { createSmartNote } from '@services/smartNoteService';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const document = await req.json();
    const result = await createSmartNote(document, teamName, assistantName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
