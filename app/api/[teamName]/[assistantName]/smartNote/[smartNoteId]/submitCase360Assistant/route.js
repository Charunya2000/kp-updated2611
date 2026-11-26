'use server';

import { NextResponse } from 'next/server';
import { callCase360EndpointService } from '@/app/services/orchestrationAssistantsConversationService';

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await callCase360EndpointService(body);
    const response = NextResponse.json(result);
    if (result?.orchestrationBaseUrl) {
      response.headers.set('x-orchestration-base-url', result.orchestrationBaseUrl);
    }
    return response;
  } catch (error) {
    console.error('Error calling Case360 endpoint service:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}