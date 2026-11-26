'use server';

import { NextResponse } from 'next/server';
import { getJiraIssuesByFilterId } from '@services/jiraIntegrationService';

export async function GET(request, { params }) {
  try {
    const { teamName, assistantName, filterId } = await params;
    const url = new URL(request.url);
    const startAt = parseInt(url.searchParams.get('startAt')) || 0;
    const maxResults = parseInt(url.searchParams.get('maxResults')) || 5;
    const jiraIssues = await getJiraIssuesByFilterId(filterId, startAt, maxResults);
    return NextResponse.json(jiraIssues, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}