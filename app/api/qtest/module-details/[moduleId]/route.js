// API Route: Get qTest module details
import { hasTeamAccess } from '@/app/services/userAccessService.js';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  // Only allow access for 'ets' team
  const isAuthorized = await hasTeamAccess('ets');
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const { moduleId } = await params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }
    const ORCHESTRATION_APP_URL = process.env.ORCHESTRATION_APP_URL;

    // Build backend URL with optional project_id for minimal change
    const backendUrl = `${ORCHESTRATION_APP_URL}/api/qtest/module-details/${moduleId}?project_id=${encodeURIComponent(projectId)}`;

    const response = await fetch(backendUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch module details' },
        { status: response.status }
      );
    }

    const data = await response.json(); 
    
    // Remove duplicates by ID from children array
    if (data.children && Array.isArray(data.children)) {
      const seenIds = new Set();
      data.children = data.children.filter(child => {
        if (seenIds.has(child.id)) {
          return false; // Skip duplicate
        }
        seenIds.add(child.id);
        return true; // Keep first occurrence
      });
      data.children_count = data.children.length;
    }
    
    return NextResponse.json(data);


  } catch (error) {
    console.error('Error in qTest module details API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}