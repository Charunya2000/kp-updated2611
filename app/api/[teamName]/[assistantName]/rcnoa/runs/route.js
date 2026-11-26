import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getRcnoaAdminState } from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../routeUtils';

export const GET = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(getHandler);

async function getHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const query = req.nextUrl.searchParams;
    const state = await getRcnoaAdminState({
      page: query.get('page'),
      pageSize: query.get('pageSize'),
      status: query.get('status'),
      mode: query.get('mode'),
      from: query.get('from'),
      to: query.get('to'),
    });
    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to load RCNOA runs');
  }
}