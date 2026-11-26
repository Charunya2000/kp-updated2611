// API Route: Get qTest project details
import { hasTeamAccess } from '@/app/services/userAccessService.js';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const isAuthorized = await hasTeamAccess('ets');
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const ORCHESTRATION_APP_URL = process.env.ORCHESTRATION_APP_URL;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const endpoint = projectId
      ? `${ORCHESTRATION_APP_URL}/api/qtest/project-details/${projectId}`
      : `${ORCHESTRATION_APP_URL}/api/qtest/project-details`;
    const response = await fetch(endpoint);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch project details' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in qTest project details API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}