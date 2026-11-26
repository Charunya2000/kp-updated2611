import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { getPreparationConfigSnapshotV1 } from '@/app/services/geisingerPreparationService';
import { PERMISSIONS } from '@/app/config/permissions';

export const GET = withTeamPermissionGuard(PERMISSIONS.REGULATORY_PREPARATION_MANAGE)(getHandler);

async function getHandler() {
  try {
    const snapshot = await getPreparationConfigSnapshotV1();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET /api/admin/[teamName]/compliance/preparation-v1-config',
        detail: {
          error: error?.message || 'Failed to resolve preparation v1 config snapshot',
        },
      },
    }));

    return NextResponse.json({ error: 'Failed to resolve preparation v1 config snapshot' }, { status: 500 });
  }
}
