'use server';

import { NextResponse } from 'next/server';
import { getJiraFiltersByAssistant } from '@services/jiraIntegrationService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const filters = await getJiraFiltersByAssistant(smartNoteId, teamName);
    return NextResponse.json(filters, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
