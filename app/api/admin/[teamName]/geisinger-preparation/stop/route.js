import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { requestStopGeisingerPreparationJob } from '@/app/services/geisingerPreparationService';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.REGULATORY_PREPARATION_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const body = await req.json().catch(() => ({}));

    const status = await requestStopGeisingerPreparationJob(teamName, body?.jobId || null, {
      resetToNotPrepared: !!body?.resetToNotPrepared,
    });
    if (!status) {
      return NextResponse.json({ success: false, error: 'Preparation job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job: status }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to stop preparation job' }, { status: 500 });
  }
}
