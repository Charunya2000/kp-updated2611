
import { NextResponse } from 'next/server';

import { isTeamAdmin } from "@/app/services/teamRoleService";
import { userStoryDataLoad } from '@/app/services/langgraphs/bcsChatBot/userStoryDataLoad';

export async function POST(request) {
  const t0 = Date.now();

  try {
    const isAdmin = await isTeamAdmin('nps');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const result = await userStoryDataLoad(body)

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

