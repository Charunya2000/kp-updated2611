import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

export const GET = withTeamPermissionGuard(PERMISSIONS.INSIGHT360_AUDIT_VIEW, { teamName: 'kpif-ma' })(getHandler);

async function getHandler(req) {
  try {

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('nuid') || '';
    const mrn = searchParams.get('mrn') || '';
    const fromDate = searchParams.get('startDate') || '';
    const toDate = searchParams.get('endDate') || '';

    if (!userId || !mrn) {
      return NextResponse.json(
        { error: 'Both NUID and MRN are required' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (mrn) params.append('mrn', mrn);
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);

    const url = `${BACKEND_URL}/api/case360/chat/history/formatted?${params.toString()}`;

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getChatHistoryFormatted',
        detail: { userId, mrn, fromDate, toDate }
      }
    }));

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'getChatHistoryFormatted',
          detail: { error: errorText, status: response.status }
        }
      }));
      return NextResponse.json(
        { error: `BFF returned ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getChatHistoryFormatted',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}
