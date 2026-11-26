import { NextResponse } from 'next/server';
import { isAppAdmin } from '@/app/services/applicationRoleService';
import { getConversationConfigSnapshotV2 } from '@/app/services/langgraphs/compliance/complianceConversationService2';

export async function GET() {
  const adminCheck = await isAppAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const snapshot = await getConversationConfigSnapshotV2();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'GET /api/admin/[teamName]/compliance/conversation-v2-config',
        detail: {
          error: error?.message || 'Failed to resolve conversation v2 config snapshot',
        },
      },
    }));

    return NextResponse.json({ error: 'Failed to resolve conversation v2 config snapshot' }, { status: 500 });
  }
}
