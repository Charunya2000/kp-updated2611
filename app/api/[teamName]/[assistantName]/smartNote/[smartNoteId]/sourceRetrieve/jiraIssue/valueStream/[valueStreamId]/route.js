'use server';

import { NextResponse } from 'next/server';
import { getJiraIssuesByValueStream } from '@services/jiraIntegrationService';

export async function GET(request, { params, query }) {
  try {
    const { valueStreamId } = await params;
    const url = new URL(request.url);
    const filterKey = url.searchParams.get('filterKey');
    const filterText = url.searchParams.get('filterText');
    const alignmentString = url.searchParams.get('alignmentString');
    const startAt = parseInt(url.searchParams.get('startAt')) || 0;
    const maxResults = parseInt(url.searchParams.get('maxResults')) || 5;
    const jiraIssues = await getJiraIssuesByValueStream(valueStreamId, filterKey, filterText, alignmentString, startAt, maxResults);
    return NextResponse.json(jiraIssues, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}