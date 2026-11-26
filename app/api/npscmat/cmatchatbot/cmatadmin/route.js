import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from "@/app/config/permissions";

import { getAdminText, saveAdminText } from '@/app/services/npscmatAdminServerService';
import {AGENT_CONFIG, AGENT_KEYS } from '@app/api/npscmat/cmatchatbot/agentConfig';



export const POST = withTeamPermissionGuard(PERMISSIONS.NPS_ADMIN_MANAGE)(postHandler);
export const GET = withTeamPermissionGuard(PERMISSIONS.NPS_ADMIN_MANAGE)(getHandler);

async function postHandler(request) {
  try {

    const body = await request.json();
    const result = await saveAdminText(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function getHandler(request) {
  try {


    const { searchParams } = new URL(request.url);
    const nuid = searchParams.get('nuid');
    if (!nuid) {
      return NextResponse.json({ success: false, error: 'Missing nuid parameter' }, { status: 400 });
    }
    const result = await getAdminText(nuid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
