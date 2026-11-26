import { NextResponse } from 'next/server';
import { getServerSession } from '@utils/getSession';
import { connectToDatabase } from '@/db/connection';
import { getFeatureFlag } from '@/app/services/featureFlagService';

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeTextArray(value) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeText(item)).filter(Boolean);
    }

    const normalized = normalizeText(value);
    return normalized ? [normalized] : [];
}

function normalizeEpdsFilterRecord(record = {}, submittedAt = null) {
    const normalized = {
        exchangeSubscriberId: normalizeText(record.exchangeSubscriberId),
        policyId: normalizeText(record.policyId),
        exchange: normalizeText(record.exchange),
        coverageYear: normalizeTextArray(record.coverageYear),
        startFileReceiveDate: normalizeText(record.startFileReceiveDate),
        endFileReceiveDate: normalizeText(record.endFileReceiveDate),
        fileTypes: normalizeTextArray(record.fileTypes),
    };

    if (submittedAt !== null) {
        normalized.submittedAt = submittedAt;
    } else if (record?.submittedAt) {
        normalized.submittedAt = String(record.submittedAt);
    }

    return normalized;
}

async function isEpdsFeatureEnabled() {
    const useEpdsFlag = await getFeatureFlag('use-epds');

    return Boolean(useEpdsFlag?.enabled);
}

export async function POST(req) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!(await isEpdsFeatureEnabled())) {
            return NextResponse.json({ error: 'EPDS is disabled for this environment' }, { status: 403 });
        }

        const formData = await req.formData();

        const query = formData.get('query');
        const smartNoteId = formData.get('smart_note_id');
        const teamName = formData.get('teamName');
        const assistantName = formData.get('assistantName');

        if (!query || !smartNoteId || !teamName) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Parse the query to extract EPDS filters
        let epdsFilters = {};
        try {
            const queryObj = JSON.parse(query);
            epdsFilters = queryObj.criteria || queryObj;
        } catch (e) {
            epdsFilters = { queryText: query };
        }

        const normalizedFilter = normalizeEpdsFilterRecord(epdsFilters);

        const hasSubscriptionId = Boolean(normalizedFilter.exchangeSubscriberId);
        const hasPolicyId = Boolean(normalizedFilter.policyId);
        if (!hasSubscriptionId && !hasPolicyId) {
            return NextResponse.json(
                { error: 'Either Subscription ID or Policy ID is required' },
                { status: 400 }
            );
        }

        // Add timestamp
        const submittedAt = new Date().toISOString();
        const normalizedFilterWithTimestamp = normalizeEpdsFilterRecord(normalizedFilter, submittedAt);

        // Update the smart note with the EPDS filter
        const queryObj = {
            type: 'SmartNote',
            id: smartNoteId,
            teamName: 'kpif-ma',
            assistantName,
        };

        const dbName = 'team-kpif-ma-db';
        const db = await connectToDatabase(dbName);
        const updateResult = await db.collection('user_collection').updateOne(
            queryObj,
            {
                $set: {
                    epdsFilters: normalizedFilterWithTimestamp,
                    updatedAt: new Date(),
                },
            }
        );

        if (updateResult.matchedCount === 0) {
            return NextResponse.json(
                {
                    error: 'SmartNote not found in team-kpif-ma-db',
                    detail: { smartNoteId, teamName: 'kpif-ma', assistantName }
                },
                { status: 404 }
            );
        }

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'submitEpdsFilter',
                detail: { smartNoteId, teamName: 'kpif-ma', assistantName, dbName }
            }
        }));

        return NextResponse.json(
            {
                success: true,
                message: 'EPDS filter submitted successfully',
                dbName,
                matchedCount: updateResult.matchedCount,
                modifiedCount: updateResult.modifiedCount,
                epds_filters: normalizedFilterWithTimestamp,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'submitEpdsFilter',
                detail: { error: error.message }
            }
        }));

        return NextResponse.json(
            { error: error.message || 'Failed to submit EPDS filter' },
            { status: 500 }
        );
    }
}

export async function DELETE(req) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!(await isEpdsFeatureEnabled())) {
            return NextResponse.json({ error: 'EPDS is disabled for this environment' }, { status: 403 });
        }

        const body = await req.json();
        const { smartNoteId } = body;

        if (!smartNoteId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Clear EPDS filters from the smart note
        const queryObj = {
            type: 'SmartNote',
            id: smartNoteId,
            teamName: 'kpif-ma',
        };

        const dbName = 'team-kpif-ma-db';
        const db = await connectToDatabase(dbName);
        await db.collection('user_collection').updateOne(
            queryObj,
            {
                $set: {
                    epdsFilters: [],
                    updatedAt: new Date(),
                },
            }
        );

        console.log(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'clearEpdsFilter',
                detail: { smartNoteId, teamName: 'kpif-ma', dbName }
            }
        }));

        return NextResponse.json(
            { success: true, message: 'EPDS filter cleared successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'clearEpdsFilter',
                detail: { error: error.message }
            }
        }));

        return NextResponse.json(
            { error: error.message || 'Failed to clear EPDS filter' },
            { status: 500 }
        );
    }
}
