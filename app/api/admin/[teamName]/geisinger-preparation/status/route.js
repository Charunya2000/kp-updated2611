import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { getGeisingerPreparationStatus } from '@/app/services/geisingerPreparationService';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.REGULATORY_PREPARATION_MANAGE)(getHandler);

async function getHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const jobId = req.nextUrl.searchParams.get('jobId');

    const status = await getGeisingerPreparationStatus(teamName, jobId || null);
    if (!status) {
      return NextResponse.json({ success: false, error: 'Preparation job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job: status }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to get preparation status' }, { status: 500 });
  }
}
