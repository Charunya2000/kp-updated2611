"use server";
import { getJiraIssuesByJQL } from '@services/jiraIntegrationService';
import { NextResponse } from 'next/server';

export async function POST(request, { params }) {
  try {
    const { smartNoteId } = await params;
    const { jql, startAt, maxResults } = await request.json();

    if (!jql || jql.trim() === '' || !smartNoteId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const issues = await getJiraIssuesByJQL(jql, startAt, maxResults);
    return NextResponse.json(issues);
  } catch (error) {
    console.error('Error in POST /jiraQuery:', error);
    return NextResponse.json({ error: 'Error processing JQL' }, { status: 500 });
  }
}