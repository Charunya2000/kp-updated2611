import { getAssistantNews } from '@/app/services/newsService';
import { getTeamAccess } from '@/app/services/permissionsService';
import { getCurrentUserNuid } from '@/utils/getSession';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { teamName, assistantName } = await params;

  let nuid;
  try {
    nuid = await getCurrentUserNuid();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await getTeamAccess(teamName, nuid);
  if (!access?.isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const news = await getAssistantNews(teamName, assistantName);
  return NextResponse.json(news, { status: 200 });
}
