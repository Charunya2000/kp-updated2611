import { NextResponse } from 'next/server';
import { searchETSDocuments } from '@/app/ets/admin/update-ets-index-data/services/etsDocumentManagementService';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE, { teamName: 'ets' })(getHandler);

async function getHandler(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    const result = await searchETSDocuments(fileName, page, pageSize);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in search ETS documents endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
