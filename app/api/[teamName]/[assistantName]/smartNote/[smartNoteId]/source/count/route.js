'use server';

import { NextResponse } from 'next/server';
import { getSmartNoteSourceCounts } from '@/app/services/smartNotesService';

export async function GET(_, { params }) {
  try {
    const { smartNoteId, teamName, assistantName } = await params;

    const counts = await getSmartNoteSourceCounts(smartNoteId, teamName);
    return NextResponse.json(counts, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
