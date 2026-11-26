import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';
import { retryRcnoaRun } from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../../../routeUtils';

export const POST = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    const { runId } = await rcnoaParams(params);
    const run = await retryRcnoaRun(runId, await getCurrentUserNuid());
    return NextResponse.json({ success: true, run }, { status: 201 });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to retry RCNOA run');
  }
}