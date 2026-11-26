'use server';

import { NextResponse } from 'next/server';
import { selectCurrentChatHistory } from '@services/chatHistoryService';

export async function GET(_, { params }) {
  try {
    const { teamName, smartNoteId } = await params;
    const query = { type: 'ChatHistory', parentId: smartNoteId, current: true };
    const smartNotes = await selectCurrentChatHistory(query, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
