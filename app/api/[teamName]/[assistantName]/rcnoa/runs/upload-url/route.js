import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';
import { reserveRcnoaUpload } from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../../routeUtils';

export const POST = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const { fileName } = await req.json();
    const result = await reserveRcnoaUpload(fileName, await getCurrentUserNuid());
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to reserve RCNOA upload');
  }
}