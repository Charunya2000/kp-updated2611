'use server';

import { NextResponse } from 'next/server';
import { selectSmartNotes } from '@/app/services/smartNotesService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName } = await params;
    const smartNotes = await selectSmartNotes(teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
