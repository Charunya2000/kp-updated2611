import { NextResponse } from 'next/server';

import { isTeamAdmin } from "@/app/services/teamRoleService";
import { serviceNowDataLoad } from '@/app/services/langgraphs/bcsChatBot/serviceNowDataLoad';


export async function POST(request) {


  try {
    const isAdmin = await isTeamAdmin('nps');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }


    const body = await request.json().catch(() => ({}));
    const result = await serviceNowDataLoad(body)
    return NextResponse.json(result);

  } catch (err) {

    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}