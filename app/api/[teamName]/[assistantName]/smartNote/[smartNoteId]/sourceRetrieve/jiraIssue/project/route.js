'use server';

import { NextResponse } from 'next/server';
import { getJiraProjectsByAssistant } from '@services/jiraIntegrationService';

export async function GET(_) {
  try {
    const projects = await getJiraProjectsByAssistant();
    return NextResponse.json(projects, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
