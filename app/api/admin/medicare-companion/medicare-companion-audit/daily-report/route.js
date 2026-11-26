import { NextResponse } from 'next/server';
import { withTeamPermissionGuard } from '@/app/api/guards';
import { PERMISSIONS } from '@/app/config/permissions';

const resolveOrchestrationBaseUrl = () => {
  const localUrl = (process.env.ORCHESTRATION_APP_LOCAL_URL || 'http://0.0.0.0:8080').trim();
  const configuredUrl = (process.env.ORCHESTRATION_APP_URL || '').trim();
  const useLocal = process.env.ORCHESTRATION_APP_USE_LOCAL === 'true';

  const selected = useLocal
    ? localUrl
    : (configuredUrl || (process.env.NODE_ENV === 'development' ? localUrl : ''));

  return selected.replace(/\/+$/, '');
};

const BACKEND_URL = resolveOrchestrationBaseUrl();

export const GET = withTeamPermissionGuard(PERMISSIONS.MEDICARE_COMPANION_AUDIT_VIEW, { teamName: 'medicare-companion' })(getHandler);

async function getHandler(req) {
    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const assistantName = searchParams.get('assistantName');

        if (!startDate && !endDate) {
            return NextResponse.json(
                { error: 'At least one of startDate or endDate is required' },
                { status: 400 }
            );
        }

        if (!BACKEND_URL) {
            console.error(JSON.stringify({
                kpmsg: {
                    id: 'AI_PORTAL_NOTEBOOK',
                    name: 'getMedicareCompanionSummaryReport',
                    detail: { error: 'Orchestration backend URL is not configured. Set ORCHESTRATION_APP_URL or enable ORCHESTRATION_APP_USE_LOCAL.' }
                }
            }));
            return NextResponse.json(
                { error: 'Orchestration backend URL is not configured. Set ORCHESTRATION_APP_URL or enable ORCHESTRATION_APP_USE_LOCAL.' },
                { status: 500 }
            );
        }

        const params = new URLSearchParams();
        if (startDate && endDate) {
            params.append('from_date', startDate);
            params.append('to_date', endDate);
        } else {
            params.append('date', startDate || endDate);
        }

        const url = `${BACKEND_URL}/api/medicare/medicare-companion/medicare-companion-audit/daily-report?${params.toString()}`;

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'getMedicareCompanionSummaryReport',
                detail: { startDate, endDate, backendUrl: BACKEND_URL, url }
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
                    name: 'getMedicareCompanionSummaryReport',
                    detail: { startDate, endDate, error: errorText, status: response.status, backendUrl: BACKEND_URL, url }
                }
            }));
            return NextResponse.json(
                { error: `BFF returned ${response.status} for ${url}: ${errorText || '(empty body)'}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            return NextResponse.json(data);
        }

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
                name: 'getMedicareCompanionSummaryReport',
                detail: { error: error.message }
            }
        }));
        return NextResponse.json(
            { error: error.message || 'Failed to generate report' },
            { status: 500 }
        );
    }
}
