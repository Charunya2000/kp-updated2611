import { NextResponse } from 'next/server';

/**
 * GET /api/pts/sessions
 * Fetches all PTS sessions from the backend orchestration service
 * Returns an array of sessions with metadata including ownership information
 * Supports date filtering with query parameters:
 * - startDate: ISO date string for filtering sessions created after this date
 * - endDate: ISO date string for filtering sessions created before this date
 * - Default filter: sessions from last week if no dates provided
 */
export async function GET(request) {
    try {
        const BACKEND_URL = process.env.ORCHESTRATION_APP_URL;

        // Parse query parameters for date filtering
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');

        // Build backend URL with date filters
        const backendUrl = new URL(`${BACKEND_URL}/api/pts/sessions`);
        if (startDate) {
            backendUrl.searchParams.set('startDate', startDate);
        }
        if (endDate) {
            backendUrl.searchParams.set('endDate', endDate);
        }

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'getPTSSessions',
                detail: {
                    endpoint: backendUrl.toString(),
                    filters: { startDate, endDate }
                }
            }
        }));

        const resp = await fetch(backendUrl.toString());

        if (!resp.ok) {
            console.error(JSON.stringify({
                kpmsg: {
                    id: 'AI_PORTAL_NOTEBOOK',
                    name: 'getPTSSessions',
                    detail: { error: `Backend returned status ${resp.status}` }
                }
            }));
            return NextResponse.json({ error: 'Failed to fetch sessions from backend' }, { status: resp.status });
        }

        let data = await resp.json();
        // Apply client-side date filtering if backend doesn't support it
        if (Array.isArray(data) && (startDate || endDate)) {
            const filterStartDate = startDate ? new Date(startDate) : null;
            const filterEndDate = endDate ? new Date(endDate) : null;

            console.log('🔍 [DATE FILTER] Applying client-side filtering:', {
                startDate,
                endDate,
                filterStartDate: filterStartDate?.toISOString(),
                filterEndDate: filterEndDate?.toISOString(),
                totalSessionsBeforeFilter: data.length,
                sampleSessionDates: data.slice(0, 3).map(s => ({
                    id: s.session_id,
                    created_at: s.created_at,
                    updated_at: s.updated_at
                }))
            });

            const originalLength = data.length;

            data = data.filter(session => {
                // Use updated_at as primary date field for filtering
                const sessionDateStr = session.updated_at || session.created_at || session.createdAt || session.lastAccessed;

                if (!sessionDateStr) {
                    console.log('⚠️ [DATE FILTER] No date found for session:', session.session_id || 'unknown');
                    return false; // Exclude sessions without dates when filtering
                }

                const sessionDate = new Date(sessionDateStr);

                // Skip invalid dates
                if (isNaN(sessionDate.getTime())) {
                    console.log('⚠️ [DATE FILTER] Invalid date for session:', {
                        sessionId: session.session_id,
                        dateStr: sessionDateStr
                    });
                    return false;
                }

                // Apply date filters
                if (filterStartDate && sessionDate < filterStartDate) {
                    console.log('📅 [DATE FILTER] Session filtered out (too old):', {
                        sessionId: session.session_id,
                        sessionDate: sessionDate.toISOString(),
                        filterStartDate: filterStartDate.toISOString()
                    });
                    return false;
                }
                if (filterEndDate && sessionDate > filterEndDate) {
                    console.log('📅 [DATE FILTER] Session filtered out (too new):', {
                        sessionId: session.session_id,
                        sessionDate: sessionDate.toISOString(),
                        filterEndDate: filterEndDate.toISOString()
                    });
                    return false;
                }

                console.log('✅ [DATE FILTER] Session included:', {
                    sessionId: session.session_id,
                    sessionDate: sessionDate.toISOString()
                });

                return true;
            });

            console.log('📊 [DATE FILTER] Filtering complete:', {
                originalCount: originalLength,
                filteredCount: data.length,
                excluded: originalLength - data.length
            });
        } console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'getPTSSessions',
                detail: {
                    sessionCount: Array.isArray(data) ? data.length : 'unknown',
                    filtered: !!(startDate || endDate)
                }
            }
        }));

        return NextResponse.json(data);
    } catch (e) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'getPTSSessions',
                detail: { error: e.message }
            }
        }));
        return NextResponse.json({ error: 'Internal server error', message: e.message }, { status: 500 });
    }
}
