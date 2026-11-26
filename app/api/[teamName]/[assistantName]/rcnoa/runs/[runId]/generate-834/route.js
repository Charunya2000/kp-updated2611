import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { generate834ForRcnoaRun } from '@/app/services/rcnoa/rcnoaOperationsService';
import { getCurrentUserNuid } from '@/utils/getSession';
import { rcnoaErrorResponse, rcnoaParams } from '../../../routeUtils';

export const POST = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    const { runId } = await rcnoaParams(params);
    const run = await generate834ForRcnoaRun(runId, await getCurrentUserNuid());
    return NextResponse.json({ success: true, run });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to generate 834 file');
  }
}