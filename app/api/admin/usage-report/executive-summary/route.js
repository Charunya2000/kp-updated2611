import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { connectToEnvironmentDatabase, listTeamDatabases } from '@/scripts/usage-reports/usageReportDbConnection.js';
import { getTargetEnvs, ENV_DISPLAY_NAMES } from '../envConfig.js';

export const GET = await withAppAdminGuard(getHandler);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRIES = 5;

/**
 * Retry a Cosmos DB operation on 429 TooManyRequests, using RetryAfterMs from the error.
 */
async function withRetry(fn) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            const isRateLimit = err?.code === 16500 || err?.codeName === 'RequestRateTooLarge';
            if (isRateLimit && attempt < MAX_RETRIES) {
                const retryAfterMs = extractRetryAfterMs(err) ?? Math.min(1000 * 2 ** attempt, 30000);
                await sleep(retryAfterMs);
                attempt++;
            } else {
                throw err;
            }
        }
    }
}

function extractRetryAfterMs(err) {
    const msg = err?.errorResponse?.errmsg ?? err?.message ?? '';
    const match = msg.match(/RetryAfterMs=(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * GET /api/admin/usage-report/executive-summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Returns summary metrics for all environments (dev, pp, uat).
 */
async function getHandler(req) {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const TARGET_ENVS = getTargetEnvs();

    if (!startDateParam || !endDateParam) {
        return NextResponse.json({ error: 'startDate and endDate query parameters are required (YYYY-MM-DD)' }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    if (startDate > endDate) {
        return NextResponse.json({ error: 'startDate must be before endDate.' }, { status: 400 });
    }

    try {
        const summaries = {};

        // Non-pp envs run in parallel; pp runs sequentially with pacing (CosmosDB rate limits)
        const nonPpEnvs = TARGET_ENVS.filter((e) => e !== 'pp');
        const includePp = TARGET_ENVS.includes('pp');

        const parallelResults = await Promise.allSettled(
            nonPpEnvs.map((env) => getEnvSummary(env, startDate, endDate, startDateParam, endDateParam))
        );
        nonPpEnvs.forEach((env, i) => {
            const r = parallelResults[i];
            summaries[env] = r.status === 'fulfilled' ? r.value : { displayName: ENV_DISPLAY_NAMES[env], error: r.reason?.message };
        });

        if (includePp) {
            try {
                summaries.pp = await getEnvSummary('pp', startDate, endDate, startDateParam, endDateParam, true);
            } catch (err) {
                summaries.pp = { displayName: ENV_DISPLAY_NAMES.pp, error: err.message };
            }
        }

        return NextResponse.json({ environments: TARGET_ENVS, summaries });
    } catch (err) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'executiveSummary_error',
                detail: { error: err.message },
            },
        }));
        return NextResponse.json({ error: 'Failed to fetch executive summary' }, { status: 500 });
    }
}

async function getEnvSummary(env, startDate, endDate, startDateParam, endDateParam, paced = false) {
    const appData = await getAppLogins(env, startDate, endDate, paced);
    const teamDbs = await listTeamDatabases(env);
    const teamStats = await getTeamStatsAggregated(env, teamDbs, startDate, endDate, paced);

    return {
        displayName: ENV_DISPLAY_NAMES[env],
        reportPeriod: `${startDateParam} to ${endDateParam}`,
        totalLogins: appData.totalLogins,
        uniqueUsers: appData.uniqueUsers,
        totalTeamUniqueUsers: teamStats.totalUniqueUsers,
        totalTeamPrompts: teamStats.totalPrompts,
        activeTeams: teamStats.activeTeams,
    };
}

async function getAppLogins(env, startDate, endDate, paced = false) {
    const db = await connectToEnvironmentDatabase(env, 'aisvc_userdb');
    const collection = db.collection('statistics');

    const filter = {
        type: 'Statistic',
        variant: 'UserAuth',
        date: { $gte: startDate, $lte: endDate },
    };

    const totalLogins = await withRetry(() => collection.countDocuments(filter));
    if (paced) await sleep(500);
    const uniqueNuids = await withRetry(() => collection.distinct('nuid', filter));

    return { totalLogins, uniqueUsers: uniqueNuids.length };
}

async function getTeamStatsAggregated(env, teamDbs, startDate, endDate, paced = false) {
    let totalUniqueUsers = 0;
    let totalPrompts = 0;
    let activeTeams = 0;

    for (const teamDbName of teamDbs) {
        try {
            const db = await connectToEnvironmentDatabase(env, teamDbName);
            const collection = db.collection('statistics');
            const baseFilter = { type: 'Statistic', date: { $gte: startDate, $lte: endDate } };

            const uniqueNuids = await withRetry(() => collection.distinct('nuid', baseFilter));
            if (paced) await sleep(500);
            const prompts = await withRetry(() => collection.countDocuments({
                ...baseFilter,
                variant: { $in: ['AssistantPromptSubmitted', 'AssistantPromptSubmittedViaAPI'] },
            }));
            if (paced) await sleep(500);

            totalUniqueUsers += uniqueNuids.length;
            totalPrompts += prompts;
            if (uniqueNuids.length > 0) activeTeams++;
        } catch (err) {
            // skip failing team DBs
        }
    }

    return { totalUniqueUsers, totalPrompts, activeTeams };
}
