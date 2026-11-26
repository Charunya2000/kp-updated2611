import { selectCurrentChat } from '@services/chatService';
import { NextResponse } from 'next/server';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;
    if (!smartNoteId) {
      console.error(error);
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const query = { type: 'Chat', parentId: smartNoteId, current: true };
    const smartNotes = await selectCurrentChat(query, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}