'use server';

import { NextResponse } from 'next/server';
import { getValueStreams } from '@services/jiraIntegrationService';

export async function GET(_) {
  try {
    const valueStreams = await getValueStreams();
    return NextResponse.json(valueStreams, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
