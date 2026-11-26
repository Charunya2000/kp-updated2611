import { NextResponse } from 'next/server';
import { scorecardDataLoad } from '@/app/services/langgraphs/bcsChatBot/scorecardDataLoad';
import { isTeamAdmin } from "@/app/services/teamRoleService";

export async function POST(request) {
  try {
    const isAdmin = await isTeamAdmin('nps');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await scorecardDataLoad();
    return NextResponse.json(result);

  } catch (error) {
    console.error('[scorecard/upload] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
