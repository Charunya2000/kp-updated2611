import { NextResponse } from 'next/server';
import { updateETSDocumentsByFileName } from '@/app/ets/admin/update-ets-index-data/services/etsDocumentManagementService';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const PUT = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE, { teamName: 'ets' })(putHandler);

async function putHandler(req, { params }) {
  try {
    const body = await req.json();
    const { fileName, projectId, projectName, tag } = body;

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    if (!projectId || !projectName) {
      return NextResponse.json(
        { error: 'Project ID and Project Name are required' },
        { status: 400 }
      );
    }

    const result = await updateETSDocumentsByFileName(fileName, {
      projectId,
      projectName,
      tag: tag || ''
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in update ETS documents endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
