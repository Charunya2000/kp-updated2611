import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { listBlobsInContainer } from '@/app/services/blobStorageService';

export async function GET(req, { params }) {
  const adminCheck = await isAppAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { containerName } = await params;

  try {
    const files = await listBlobsInContainer(containerName);
    return NextResponse.json({ files }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET /api/admin/blob/[containerName]/files',
        detail: { containerName, error: error?.message || 'Failed to list blobs' }
      }
    }));
    return NextResponse.json({ error: 'Failed to list blobs in container' }, { status: 500 });
  }
}
