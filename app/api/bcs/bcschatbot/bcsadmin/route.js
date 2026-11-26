import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from "@/app/config/permissions";

import { getBcsAdminText, saveBcsAdminText } from '@/app/services/bcsAdminServerService';


export const POST = withTeamPermissionGuard(PERMISSIONS.BCS_ADMIN_MANAGE, { teamName: 'bcs' })(postHandler);
export const GET = withTeamPermissionGuard(PERMISSIONS.BCS_ADMIN_MANAGE, { teamName: 'bcs' })(getHandler);

async function postHandler(request) {
  try {

    const body = await request.json();
    const result = await saveBcsAdminText(body);
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
    const result = await getBcsAdminText(nuid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
