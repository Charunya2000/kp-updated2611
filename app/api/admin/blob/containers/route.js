import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { listContainers } from '@/app/services/blobStorageService';

export async function GET() {
  const adminCheck = await isAppAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const containers = await listContainers();
    return NextResponse.json({ containers }, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET /api/admin/blob/containers',
        detail: { error: error?.message || 'Failed to list blob containers' }
      }
    }));
    return NextResponse.json({ error: 'Failed to list blob containers' }, { status: 500 });
  }
}
