'use server';

import { NextResponse } from 'next/server';
import { selectJiraIssue, updateJiraIssue, deleteJiraIssue } from '@services/jiraIssueService';

export async function GET(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const smartNotes = await selectJiraIssue(req, teamName);
    return NextResponse.json(smartNotes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'JiraIssue') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = updateJiraIssue(document, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;

    const query = await req.json();
    if (!query.type || query.type !== 'JiraIssue') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const result = deleteJiraIssue(query, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
