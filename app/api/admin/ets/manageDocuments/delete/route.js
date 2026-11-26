import { NextResponse } from 'next/server';
import { deleteETSDocumentsByFileName } from '@/app/ets/admin/update-ets-index-data/services/etsDocumentManagementService';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const DELETE = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE, { teamName: 'ets' })(deleteHandler);

async function deleteHandler(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    const result = await deleteETSDocumentsByFileName(fileName);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in delete ETS documents endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
