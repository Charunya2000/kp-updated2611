import { getSourceBySearchIndexConfigId } from '@/app/services/sourceService';
import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.ASSISTANT_SETTINGS_MANAGE, { scope: 'assistantName' })(getHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName, assistantName, id } = await params;

    // Get all sources associated with search index config ID
    const sources = await getSourceBySearchIndexConfigId(teamName, assistantName, id);
    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error fetching sources by config ID:', error);
    return NextResponse.json({ error: error.message });
  }
}