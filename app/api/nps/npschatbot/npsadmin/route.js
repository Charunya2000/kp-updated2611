import { NextResponse } from 'next/server';
import { isTeamAdmin } from "@/app/services/teamRoleService";
import { getNpsAdminText, saveNpsAdminText } from '@/app/services/npsAdminServerService';

export async function POST(request) {
  try {
    const isAdmin = await isTeamAdmin('nps');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const result = await saveNpsAdminText(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const isAdmin = await isTeamAdmin('nps');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const nuid = searchParams.get('nuid');
    if (!nuid) {
      return NextResponse.json({ success: false, error: 'Missing nuid parameter' }, { status: 400 });
    }
    const result = await getNpsAdminText(nuid);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
