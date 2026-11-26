// API Route: List qTest projects (lightweight)
import { hasTeamAccess } from '@/app/services/userAccessService.js';
import { NextResponse } from 'next/server';

export async function GET() {
  const isAuthorized = await hasTeamAccess('ets');
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const ORCHESTRATION_APP_URL = process.env.ORCHESTRATION_APP_URL;
    const resp = await fetch(`${ORCHESTRATION_APP_URL}/api/qtest/qtest-details`);
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to fetch qTest projects' }, { status: resp.status });
    }
    const data = await resp.json();
    // Backend returns { success, total_projects, projects: [ {id,name} ] }
    return NextResponse.json(data.projects || []);
  } catch (e) {
    console.error('qTest projects error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}