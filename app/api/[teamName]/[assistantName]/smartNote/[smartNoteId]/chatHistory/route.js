'use server';

import { NextResponse } from 'next/server';
import { createChatHistory, selectChatHistorys, deleteChatHistorys } from '@services/chatHistoryService';

export async function GET(_, { params }) {
  const { teamName, smartNoteId } = await params;
  try {
    if (!smartNoteId) {
      console.error(error);
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const query = { type: 'ChatHistory', parentId: smartNoteId };
    const smartNotes = await selectChatHistorys(query, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { teamName } = await params;
  try {
    const document = await req.json();
    if (!document.type || document.type !== 'ChatHistory') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await createChatHistory(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  const { teamName, smartNoteId } = await params;
  if (!smartNoteId) {
    console.error(error);
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }
  try {
    const query = { type: 'ChatHistory', parentId: smartNoteId };
    if (!query.type || query.type !== 'ChatHistory') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = await deleteChatHistorys(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
