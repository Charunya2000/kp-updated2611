'use server';

import { NextResponse } from 'next/server';
import { addJiraIssue } from '@services/addJiraIssueToIndex';
import { updateJiraIssue } from '@/app/services/jiraIssueService';

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName } = await params;

    const document = await req.json();
    if (!document.type || document.type !== 'JiraIssue') {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    addJiraIssue(document, teamName, assistantName)
      .then(() => {
        document.status = 'INDEXED';
        updateJiraIssue(document, teamName);
      })
      .catch((error) => {
        document.status = 'ERROR';
        updateJiraIssue(document, teamName);
      });
    const response = { result: 'added' };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
