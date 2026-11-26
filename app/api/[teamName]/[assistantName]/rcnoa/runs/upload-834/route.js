import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { RCNOA_DEFAULTS } from '@/app/services/rcnoa/rcnoaCore';
import { deliverUploaded834 } from '@/app/services/rcnoa/rcnoaOperationsService';
import { getCurrentUserNuid } from '@/utils/getSession';
import { rcnoaErrorResponse, rcnoaParams } from '../../routeUtils';

export const POST = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') throw new Error('An 834 file is required');
    if (file.size <= 0 || file.size > RCNOA_DEFAULTS.maxUploadBytes) {
      throw new Error(`Uploaded 834 file must be between 1 byte and ${RCNOA_DEFAULTS.maxUploadBytes} bytes`);
    }
    const run = await deliverUploaded834({
      fileName: file.name,
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'application/edi-x12',
    }, await getCurrentUserNuid());
    return NextResponse.json({ success: true, run }, { status: 201 });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to deliver uploaded 834 file');
  }
}