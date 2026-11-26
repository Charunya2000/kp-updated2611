import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { deleteBlobFromContainer } from '@/app/services/blobStorageService';

export async function POST(req, { params }) {
  const adminCheck = await isAppAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { containerName } = await params;

  if (!containerName || !containerName.trim()) {
    return NextResponse.json({ error: 'Container name is required' }, { status: 400 });
  }

  try {
    const { blobName } = await req.json();

    if (!blobName || !blobName.trim()) {
      return NextResponse.json({ error: 'Blob name is required' }, { status: 400 });
    }

    await deleteBlobFromContainer(containerName, blobName);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'POST /api/admin/blob/[containerName]/delete',
        detail: { containerName, error: error?.message || 'Failed to delete blob' }
      }
    }));
    return NextResponse.json({ error: error?.message || 'Failed to delete blob' }, { status: 500 });
  }
}
