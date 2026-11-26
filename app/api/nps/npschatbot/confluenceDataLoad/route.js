
import { NextResponse } from 'next/server';

import { isTeamAdmin } from "@/app/services/teamRoleService";
import { confluenceDataLoad } from '@/app/services/langgraphs/bcsChatBot/confluenceDataLoad';

export async function POST(request) {

  try {
    const isAdmin = await isTeamAdmin('nps');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const body = await request.json();
    const result = await confluenceDataLoad(body)
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}