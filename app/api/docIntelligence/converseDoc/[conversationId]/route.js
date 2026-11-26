'use server';

import { NextResponse } from 'next/server';
// import { findGeisingerConversationById } from '@/app/services/langgraphs/compliance/docConveresationService2.js';
import { findGeisingerConversationById } from '@/app/services/langgraphs/compliance/docConversationService3.js';

export async function GET(_, { params }) {
  try {
    // Extract conversationId from the URL
    const { conversationId } = await params;
    const url = new URL(_.url);
    const teamName = String(url.searchParams.get('teamName') || '').trim();
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing required query parameter: conversationId' }, { status: 400 });
    }
    if (!teamName) {
      return NextResponse.json({ error: 'Missing required query parameter: teamName' }, { status: 400 });
    }
    const result = await findGeisingerConversationById(conversationId, { teamName });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
