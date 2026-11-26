'use server';

import { NextResponse } from 'next/server';
import { getServerSession } from '@utils/getSession';
import { ormbConfluenceKnowledgebaseGraphStream } from '@/app/services/ormbConfluenceKnowledgebaseService';

export async function POST(req, { params }) {
  try {
    console.log(`called submitAssistant/ormbconfluenceknowledgebase with body:`);
    const { teamName, assistantName, smartNoteId } = await params;
    const { sources, chatInteraction } = await req.json();
    const { nuid } = await getServerSession();

    const stream = await ormbConfluenceKnowledgebaseGraphStream({
      nuid,
      smartNoteId,
      sources,
      chatInteraction,
      teamName,
      assistantName
    });

    return new NextResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'OrmbConfluenceKnowledgebaseSubmitRouteFailed',
        detail: { error: error?.message || 'Unknown error' }
      }
    }));

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
