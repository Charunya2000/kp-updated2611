'use server';

import { NextResponse } from 'next/server';
import { createJiraIssue, selectJiraIssues } from '@services/jiraIssueService';

export async function GET(_, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    if (!smartNoteId) {
      console.error(error);
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const query = { type: 'JiraIssue', parentId: smartNoteId }
    const sources = await selectJiraIssues(query, teamName);
    return NextResponse.json(sources, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'JiraIssue') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = createJiraIssue(document, teamName, assistantName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
