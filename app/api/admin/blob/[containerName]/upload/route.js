import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { uploadBlobToContainer } from '@/app/services/blobStorageService';

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB

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
    const formData = await req.formData();
    const file = formData.get('file');
    const blobPath = formData.get('blobPath');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'A file is required' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds maximum size of 200 MB` },
        { status: 400 }
      );
    }

    const blobName = blobPath?.trim() || file.name;

    if (!blobName) {
      return NextResponse.json({ error: 'File name could not be determined' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';

    const success = await uploadBlobToContainer(containerName, blobName, buffer, contentType);

    if (!success) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'POST /api/admin/blob/[containerName]/upload',
        detail: { containerName, blobName, size: file.size }
      }
    }));

    return NextResponse.json({ success: true, blobName, containerName }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'POST /api/admin/blob/[containerName]/upload',
        detail: { containerName, error: error?.message || 'Failed to upload blob' }
      }
    }));
    return NextResponse.json({ error: 'Failed to upload blob' }, { status: 500 });
  }
}
