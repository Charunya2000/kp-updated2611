// API Route: Get qTest test case details
import { hasTeamAccess } from '@/app/services/userAccessService.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const isAuthorized = await hasTeamAccess('ets');
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { test_case_ids, project_id } = body || {};
    if (!Array.isArray(test_case_ids) || test_case_ids.length === 0) {
      return NextResponse.json({ error: 'test_case_ids required' }, { status: 400 });
    }
    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }
    const payload = { test_case_ids, project_id };
    const ORCHESTRATION_APP_URL = process.env.ORCHESTRATION_APP_URL;
    const response = await fetch(`${ORCHESTRATION_APP_URL}/api/qtest/testcase-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch test case details' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in qTest test case details API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}