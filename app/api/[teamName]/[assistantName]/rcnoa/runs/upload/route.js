import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';
import { RCNOA_DEFAULTS } from '@/app/services/rcnoa/rcnoaCore';
import { uploadRcnoaFile } from '@/app/services/rcnoa/rcnoaOperationsService';
import { getCurrentUserNuid } from '@/utils/getSession';
import { rcnoaErrorResponse, rcnoaParams } from '../../routeUtils';

export const POST = withTeamPermissionGuard(PERMISSIONS.RCNOA_PROCESSING_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    await rcnoaParams(params);
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') throw new Error('An RCNO file is required');
    if (file.size <= 0 || file.size > RCNOA_DEFAULTS.maxUploadBytes) {
      throw new Error(`Uploaded RCNO file must be between 1 byte and ${RCNOA_DEFAULTS.maxUploadBytes} bytes`);
    }

    const run = await uploadRcnoaFile({
      fileName: file.name,
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'text/plain',
    }, await getCurrentUserNuid());
    return NextResponse.json({ success: true, run }, { status: 201 });
  } catch (error) {
    return rcnoaErrorResponse(error, 'Failed to upload RCNO file');
  }
}