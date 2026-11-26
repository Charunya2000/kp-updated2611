import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';
import { processNextAdhocRcnoaRun } from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../../routeUtils';

export const maxDuration = 1800;
export const POST = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const { lookupSource = 'live' } = await req.json().catch(() => ({}));
    const run = await processNextAdhocRcnoaRun(await getCurrentUserNuid(), lookupSource);
    return NextResponse.json({ success: true, run });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to process queued RCNOA run');
  }
}