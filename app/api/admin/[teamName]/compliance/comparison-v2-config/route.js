import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { getComparisonConfigSnapshotV2 } from '@/app/services/langgraphs/compliance/complianceComparisonService2';

export async function GET() {
  const adminCheck = await isAppAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const snapshot = await getComparisonConfigSnapshotV2();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET /api/admin/[teamName]/compliance/comparison-v2-config',
        detail: {
          error: error?.message || 'Failed to resolve comparison v2 config snapshot',
        },
      },
    }));

    return NextResponse.json({ error: 'Failed to resolve comparison v2 config snapshot' }, { status: 500 });
  }
}
