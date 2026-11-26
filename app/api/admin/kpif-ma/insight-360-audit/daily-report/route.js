import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

export const GET = withTeamPermissionGuard(PERMISSIONS.INSIGHT360_AUDIT_VIEW, { teamName: 'kpif-ma' })(getHandler);

async function getHandler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate && !endDate) {
      return NextResponse.json(
        { error: 'At least one of startDate or endDate is required' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    if (startDate && endDate) {
      params.append('from_date', startDate);
      params.append('to_date', endDate);
    } else {
      params.append('date', startDate || endDate);
    }

    const url = `${BACKEND_URL}/api/case360/chat/daily-report?${params.toString()}`;

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getSummaryReport',
        detail: { startDate, endDate }
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
          name: 'getSummaryReport',
          detail: { startDate, endDate, error: errorText, status: response.status }
        }
      }));
      return NextResponse.json(
        { error: `Failed to generate report: ${errorText}` },
        { status: response.status }
      );
    }

    // Check content type to determine if it's a file download or JSON
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // For file downloads (e.g., CSV, Excel), stream the response back
    const blob = await response.arrayBuffer();
    const fileLabel = [startDate, endDate].filter(Boolean).join('_to_');
    const contentDisposition = response.headers.get('content-disposition') || `attachment; filename="summary_report_${fileLabel}.csv"`;

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getSummaryReport',
        detail: { error: error.message }
      }
    }));
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
