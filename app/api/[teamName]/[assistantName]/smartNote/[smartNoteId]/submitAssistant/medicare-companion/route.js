import { NextResponse } from 'next/server';
import { callMedicareCompanionEndpointService } from '@/app/services/orchestrationAssistantsConversationService';

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await callMedicareCompanionEndpointService(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling Medicare Companion endpoint service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}