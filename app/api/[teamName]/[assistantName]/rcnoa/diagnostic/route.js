import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { diagnoseRcnoaRow } from '@/app/services/rcnoa/rcnoaDiagnosticService';
import { rcnoaErrorResponse, rcnoaParams } from '../routeUtils';

export const POST = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const body = await req.json();
    const diagnostic = await diagnoseRcnoaRow(body?.rcnoRow);
    return NextResponse.json(
      { success: true, diagnostic },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const response = rcnoaErrorResponse(error, 'Failed to diagnose RCNO row');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
