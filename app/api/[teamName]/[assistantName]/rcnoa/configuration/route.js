import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { getCurrentUserNuid } from '@/utils/getSession';
import { getRcnoaBusinessConfiguration } from '@/app/services/rcnoa/rcnoaRepositoryService';
import { publicRcnoaBusinessConfiguration } from '@/app/services/rcnoa/rcnoaBusinessConfigurationService';
import { updateRcnoaBusinessConfiguration } from '@/app/services/rcnoa/rcnoaOperationsService';
import { rcnoaErrorResponse, rcnoaParams } from '../routeUtils';

export const GET = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(getHandler);
export const PUT = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(putHandler);

async function getHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const configuration = publicRcnoaBusinessConfiguration(
      await getRcnoaBusinessConfiguration(),
    );
    return NextResponse.json({ success: true, businessConfiguration: configuration });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to load RCNOA business configuration');
  }
}

async function putHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const businessConfiguration = await updateRcnoaBusinessConfiguration(
      await req.json(),
      await getCurrentUserNuid(),
    );
    return NextResponse.json({ success: true, businessConfiguration });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to update RCNOA business configuration');
  }
}