import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getRcnoaRunFailures } from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../../../routeUtils';

export const GET = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(getHandler);

async function getHandler(req, { params }) {
  try {
    const { runId } = await rcnoaParams(params);
    const query = req.nextUrl.searchParams;
    const items = await getRcnoaRunFailures(runId, {
      page: query.get('page'),
      pageSize: query.get('pageSize'),
    });
    return NextResponse.json({ success: true, ...items });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to load RCNOA row failures');
  }
}