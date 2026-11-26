import { NextResponse } from 'next/server';
import { createChat, selectChats, deleteChats } from '@services/chatService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;

    const query = { type: 'Chat', parentId: chatHistoryId };
    const chats = await selectChats(query, teamName);
    return NextResponse.json(chats, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'Chat') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await createChat(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId, chatHistoryId } = await params;

    const query = { type: 'Chat', parentId: smartNoteId };
    if (!query.type || query.type !== 'Chat') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await deleteChats(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
