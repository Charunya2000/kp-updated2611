import { NextResponse } from 'next/server';
import { npsCmatChatBotGraphStream } from '@services/langgraphs/npsCmatChatBot/npsCmatChatbotService';
import { validateApiKey, createUnauthorizedResponse } from '../../../utils/apiKeyAuth';

export async function POST(request) {
  try {
    const validKey = process.env['NPSCMAT_API_KEY'];
    if (!validateApiKey(request, validKey)) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { nuid, text, sessionId } = body;

    if (!nuid || !text || !sessionId) {
      return NextResponse.json({ success: false, error: `Missing required parameter. Your request must include nuid, text, and sessionId` }, { status: 400 });
    }

    // Pass both nuid and text to the chatbot service
    const result = await npsCmatChatBotGraphStream({ userMessage: text, metadata: { nuid }, sessionId: sessionId, teamName: 'npscmatchatbot' });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in CMAT POST handler:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
