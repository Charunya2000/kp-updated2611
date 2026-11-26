import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';
import { getRcnoaSchedule } from '@/app/services/rcnoa/rcnoaRepositoryService';
import { updateRcnoaSchedule } from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../routeUtils';

export const GET = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(putHandler);

async function getHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    return NextResponse.json({ success: true, schedule: await getRcnoaSchedule() });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to load RCNOA schedule');
  }
}

async function putHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const schedule = await updateRcnoaSchedule(await req.json(), await getCurrentUserNuid());
    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to update RCNOA schedule');
  }
}