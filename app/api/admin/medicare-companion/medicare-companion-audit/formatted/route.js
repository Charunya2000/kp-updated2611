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
        const userId = searchParams.get('nuid') || '';
        const mrn = searchParams.get('mrn') || '';
        const fromDate = searchParams.get('startDate') || '';
        const toDate = searchParams.get('endDate') || '';
        const assistantName = searchParams.get('assistantName');

        if (!userId || !mrn) {
            return NextResponse.json(
                { error: 'Both NUID and MRN are required' },
                { status: 400 }
            );
        }

        if (!BACKEND_URL) {
            console.error(JSON.stringify({
                kpmsg: {
                    id: 'AI_PORTAL_NOTEBOOK',
                    name: 'getMedicareCompanionChatHistoryFormatted',
                    detail: { error: 'Orchestration backend URL is not configured. Set ORCHESTRATION_APP_URL or enable ORCHESTRATION_APP_USE_LOCAL.' }
                }
            }));
            return NextResponse.json(
                { error: 'Orchestration backend URL is not configured. Set ORCHESTRATION_APP_URL or enable ORCHESTRATION_APP_USE_LOCAL.' },
                { status: 500 }
            );
        }

        const params = new URLSearchParams();
        if (userId) params.append('user_id', userId);
        if (mrn) params.append('mrn', mrn);
        if (fromDate) params.append('from_date', fromDate);
        if (toDate) params.append('to_date', toDate);

        const url = `${BACKEND_URL}/api/medicare/medicare-companion/medicare-companion-audit/formatted?${params.toString()}`;

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'getMedicareCompanionChatHistoryFormatted',
                detail: { userId, mrn, fromDate, toDate, backendUrl: BACKEND_URL, url }
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
                    name: 'getMedicareCompanionChatHistoryFormatted',
                    detail: { error: errorText, status: response.status, backendUrl: BACKEND_URL, url }
                }
            }));
            return NextResponse.json(
                { error: `BFF returned ${response.status} for ${url}: ${errorText || '(empty body)'}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'getMedicareCompanionChatHistoryFormatted',
                detail: { error: error.message }
            }
        }));
        return NextResponse.json(
            { error: error.message || 'Failed to fetch chat history' },
            { status: 500 }
        );
    }
}
