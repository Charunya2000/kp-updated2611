import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';
import { getRcnoaQueryConfiguration } from '@/app/services/rcnoa/rcnoaRepositoryService';
import { updateRcnoaQueryConfiguration } from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../routeUtils';

export const GET = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(putHandler);

async function getHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const queryConfiguration = await getRcnoaQueryConfiguration();
    return NextResponse.json({ success: true, queryConfiguration });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to load RCNOA queries');
  }
}

async function putHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const queryConfiguration = await updateRcnoaQueryConfiguration(
      await req.json(),
      await getCurrentUserNuid(),
    );
    return NextResponse.json({ success: true, queryConfiguration });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to update RCNOA queries');
  }
}