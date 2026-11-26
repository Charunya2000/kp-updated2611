import { NextResponse } from 'next/server';
import { baseChatBotGraphStream } from '@services/langgraphs/baseChatBot/baseChatbotService';
import { validateApiKey, createUnauthorizedResponse } from '../../../utils/apiKeyAuth';

export async function POST(request) {
  try {
    const validKey = process.env['BCS_API_KEY'];
    if (!validateApiKey(request, validKey)) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { nuid, text, sessionId } = body;

    if (!nuid || !text || !sessionId) {
      return NextResponse.json({ success: false, error: `Missing required parameter. Your request must include nuid, text, and sessionId` }, { status: 400 });
    }

    // Pass both nuid and text to the chatbot service
    const result = await baseChatBotGraphStream({ userMessage: text, metadata: { nuid ,attachmentName:
                      body.attachmentName,

                  attachmentContent:
                      body.attachmentContent}, sessionId: sessionId, teamName: 'bcschatbot' });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in BCS POST handler:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
