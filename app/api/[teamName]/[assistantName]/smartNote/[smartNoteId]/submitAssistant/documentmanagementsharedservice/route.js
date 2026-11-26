'use server';

import { NextResponse } from 'next/server';
import { getServerSession } from '@utils/getSession';
import { submitPromptDMSS } from '@/app/services/langgraphs/dmss/dmssAssistantGraphService';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { sources, chatInteraction } = await req.json();
    const { nuid } = await getServerSession();

    const stream = await submitPromptDMSS({
      nuid,
      smartNoteId,
      sources,
      chatInteraction,
      teamName,
      assistantName,
      formData: {},
      isWorkflow: false
    });

    // Ensure only the markdown response and suggested prompts are returned
    return new NextResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}