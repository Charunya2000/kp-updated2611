import { NextResponse } from 'next/server';
import { bcsChatBotGraphStream } from '@services/langgraphs/bcsChatBot/bcsChatbotService2';
import { validateApiKey, createUnauthorizedResponse } from '../../../utils/apiKeyAuth';

export async function POST(request) {
  try {
    const validKey = process.env['NPS_API_KEY'];
    if (!validateApiKey(request, validKey)) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const { nuid, text, sessionId } = body;

    if (!nuid || !text || !sessionId) {
      return NextResponse.json({ success: false, error: `Missing required parameter. Your request must include nuid, text, and sessionId` }, { status: 400 });
    }

    // Pass both nuid and text to the chatbot service
    const result = await bcsChatBotGraphStream({ userMessage: text, metadata: { nuid }, sessionId: sessionId, teamName: 'bcschatbot' });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in NPS POST handler:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
