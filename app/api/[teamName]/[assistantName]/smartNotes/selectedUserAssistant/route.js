'use server';

import { NextResponse } from 'next/server';
import { selectSmartNotesByTeam } from '@/app/services/smartNotesService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const smartNotes = await selectSmartNotesByTeam(teamName, assistantName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
