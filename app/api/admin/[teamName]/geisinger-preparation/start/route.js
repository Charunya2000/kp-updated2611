import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { startGeisingerPreparationJob } from '@/app/services/geisingerPreparationService';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.REGULATORY_PREPARATION_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    const { teamName } = await params;
    const body = await req.json();

    const result = await startGeisingerPreparationJob(teamName, {
      documents: body?.documents,
      concurrency: body?.concurrency,
      reprocessPrepared: body?.reprocessPrepared,
      jobName: body?.jobName,
    });

    return NextResponse.json({ success: true, job: result }, { status: 200 });
  } catch (error) {
    const message = error?.message || 'Failed to start Geisinger preparation job';
    const status = message.includes('No valid documents') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
