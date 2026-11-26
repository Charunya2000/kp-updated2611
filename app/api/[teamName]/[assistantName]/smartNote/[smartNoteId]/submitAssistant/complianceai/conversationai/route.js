'use server';

import { NextResponse } from 'next/server';
import { getServerSession } from '@utils/getSession';
import { runComplianceConversationWithRouting } from '@/app/services/langgraphs/compliance/complianceRuntimeRouterService';

export async function POST(req, { params }) {
  try {
    const request = await req.json();
    const routeParams = await params;
    const teamName = request?.teamName || routeParams?.teamName;
    const assistantName = request?.assistantName || routeParams?.assistantName;
    const smartNoteId = request?.smartNoteId || routeParams?.smartNoteId;
    const { nuid } = await getServerSession();

    const normalizedRequest = {
      ...request,
      teamName,
      assistantName,
      smartNoteId,
      chatId: request?.chatId || request?.chatInteraction?.parentId || request?.geisingerConversation?.chatId,
      chatInteractionId: request?.chatInteractionId || request?.chatInteraction?.id || request?.geisingerConversation?.chatInteractionId,
      prompt: request?.prompt || request?.chatInteraction?.prompt,
      geisingerConversation: {
        ...(request?.geisingerConversation || {}),
        teamName: request?.geisingerConversation?.teamName || teamName,
        assistantName: request?.geisingerConversation?.assistantName || assistantName,
      },
    };

    const result = await runComplianceConversationWithRouting({ nuid, request: normalizedRequest });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    const status = Number(error?.statusCode) || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}