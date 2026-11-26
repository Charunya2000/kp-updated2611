import { NextResponse } from 'next/server';
import { uploadETSDocuments } from '@/app/ets/admin/update-ets-index-data/services/searchIndexDataUploadService';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

export const POST = withTeamPermissionGuard(PERMISSIONS.ETS_INDEX_MANAGE)(postHandler);

async function postHandler(req, { params }) {
  try {
    const formData = await req.formData();

    const projectId = formData.get('projectId');
    const projectName = formData.get('projectName');
    const tag = formData.get('tag');
    const files = formData.getAll('files');

    const result = await uploadETSDocuments(files, projectId, projectName, tag);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in ETS upload endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
