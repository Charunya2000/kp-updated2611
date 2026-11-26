import { recordGenericEvent } from '@services/statisticsService';
import { validateApiKey, createUnauthorizedResponse } from '../utils/apiKeyAuth';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const validKey = process.env['STATISTICS_LOGGING_API_KEY'];
  if (!validateApiKey(request, validKey)) {
    return createUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    recordGenericEvent(body.variant, body.nuid, new Date(), body.teamName, body?.assistantName);
    return NextResponse.json({ message: 'Success' });
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
