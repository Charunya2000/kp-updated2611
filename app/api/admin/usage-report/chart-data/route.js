import { NextResponse } from 'next/server';
import { withAppAdminGuard } from '@/app/api/guards';
import { connectToDatabase, listDatabaseNames } from '@/db/connection';
import { connectToEnvironmentDatabase, listTeamDatabases } from '@/scripts/usage-reports/usageReportDbConnection.js';
import { getTargetEnvs, ENV_DISPLAY_NAMES } from '../envConfig.js';

export const GET = await withAppAdminGuard(getHandler);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 5;

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

/** Connect to a database - uses multi-env connection if env specified, otherwise current env */
function getDb(dbName, env) {
    if (env) return connectToEnvironmentDatabase(env, dbName);
    return connectToDatabase(dbName);
}

/**
 * GET /api/admin/usage-report/chart-data?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Returns JSON with daily usage data for rendering charts.
 */
async function getHandler(req) {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const envParam = searchParams.get('env');
    // Validate env against allowed envs for this deployment
    const allowedEnvs = getTargetEnvs();
    const targetEnv = envParam && allowedEnvs.includes(envParam) ? envParam : null;

    if (envParam && !targetEnv) {
        return NextResponse.json({ error: `Environment '${envParam}' is not available in this deployment.` }, { status: 403 });
    }

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
        const paced = targetEnv === 'pp';

        const dailyLogins = await getDailyLogins(startDate, endDate, targetEnv);
        const teamDbs = await discoverTeamDatabases(targetEnv);
        const dailyTeamPrompts = await getDailyTeamPrompts(teamDbs, startDate, endDate, targetEnv, paced);
        const appLogins = await getAppLogins(startDate, endDate, targetEnv, paced);
        const teamStatsList = await getTeamStatsList(teamDbs, startDate, endDate, targetEnv, paced);

        // All discovered team names (even those with no data in range)
        const allTeamNames = teamDbs
            .map((name) => name.replace(/^team-/, '').replace(/-db$/, ''))
            .sort();

        // Merge into a single daily array
        const loginsByDate = {};
        for (const row of dailyLogins) {
            loginsByDate[row.date] = row;
        }

        const promptsByDate = {};
        for (const row of dailyTeamPrompts) {
            promptsByDate[row.date] = row;
        }

        const allDates = new Set([
            ...dailyLogins.map((r) => r.date),
            ...dailyTeamPrompts.map((r) => r.date),
        ]);

        const daily = [...allDates].sort().map((date) => {
            const login = loginsByDate[date] || { logins: 0, uniqueUsers: 0 };
            const prompt = promptsByDate[date] || { totalPrompts: 0, totalUniqueUsers: 0, teams: {} };
            return {
                date,
                logins: login.logins,
                uniqueLoginUsers: login.uniqueUsers,
                totalPrompts: prompt.totalPrompts,
                totalPromptUsers: prompt.totalUniqueUsers,
                teams: prompt.teams,
            };
        });

        const totalTeamPrompts = teamStatsList.reduce((sum, t) => sum + t.totalPrompts, 0);
        const totalTeamUniqueUsers = teamStatsList.reduce((sum, t) => sum + t.uniqueUsers, 0);
        const activeTeams = teamStatsList.filter((t) => t.uniqueUsers > 0).length;

        return NextResponse.json({
            startDate: startDateParam,
            endDate: endDateParam,
            environment: targetEnv ? ENV_DISPLAY_NAMES[targetEnv] : (process.env['envName'] || 'unknown').toUpperCase(),
            teamNames: allTeamNames,
            daily,
            summary: {
                totalLogins: appLogins.totalLogins,
                uniqueUsers: appLogins.uniqueUsers,
                totalTeamUniqueUsers,
                totalTeamPrompts,
                activeTeams,
                totalTeams: teamDbs.length,
            },
        });
    } catch (err) {
        console.error(JSON.stringify({
            kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'usageReport_chartData_error',
                detail: { error: err.message },
            },
        }));
        return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
    }
}

async function getDailyLogins(startDate, endDate, env) {
    const db = await getDb('aisvc_userdb', env);
    const collection = db.collection('statistics');

    return withRetry(() => collection.aggregate([
        {
            $match: {
                type: 'Statistic',
                variant: 'UserAuth',
                date: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                logins: { $sum: 1 },
                uniqueUsers: { $addToSet: '$nuid' },
            },
        },
        {
            $project: {
                _id: 0,
                date: '$_id',
                logins: 1,
                uniqueUsers: { $size: '$uniqueUsers' },
            },
        },
        { $sort: { date: 1 } },
    ]).toArray());
}

async function discoverTeamDatabases(env) {
    if (env) return listTeamDatabases(env);
    const names = await listDatabaseNames();
    return names.filter((name) => /^team-.+-db$/.test(name)).sort();
}

async function getDailyTeamPrompts(teamDbs, startDate, endDate, env, paced = false) {
    const dailyMap = {};

    for (const teamDbName of teamDbs) {
        const teamName = teamDbName.replace(/^team-/, '').replace(/-db$/, '');
        try {
            const db = await getDb(teamDbName, env);
            const collection = db.collection('statistics');

            const results = await withRetry(() => collection.aggregate([
                {
                    $match: {
                        type: 'Statistic',
                        variant: { $in: ['AssistantPromptSubmitted', 'AssistantPromptSubmittedViaAPI'] },
                        date: { $gte: startDate, $lte: endDate },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                        prompts: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$nuid' },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        date: '$_id',
                        prompts: 1,
                        uniqueUsers: { $size: '$uniqueUsers' },
                    },
                },
                { $sort: { date: 1 } },
            ]).toArray());
            if (paced) await sleep(300);

            for (const row of results) {
                if (!dailyMap[row.date]) {
                    dailyMap[row.date] = { date: row.date, totalPrompts: 0, totalUniqueUsers: 0, teams: {} };
                }
                dailyMap[row.date].totalPrompts += row.prompts;
                dailyMap[row.date].totalUniqueUsers += row.uniqueUsers;
                dailyMap[row.date].teams[teamName] = { prompts: row.prompts, uniqueUsers: row.uniqueUsers };
            }
        } catch (err) {
            // skip failing team DBs
        }
    }

    return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
}

async function getAppLogins(startDate, endDate, env, paced = false) {
    const db = await getDb('aisvc_userdb', env);
    const collection = db.collection('statistics');

    const filter = {
        type: 'Statistic',
        variant: 'UserAuth',
        date: { $gte: startDate, $lte: endDate },
    };

    const totalLogins = await withRetry(() => collection.countDocuments(filter));
    if (paced) await sleep(300);
    const uniqueNuids = await withRetry(() => collection.distinct('nuid', filter));

    return { totalLogins, uniqueUsers: uniqueNuids.length };
}

async function getTeamStatsList(teamDbs, startDate, endDate, env, paced = false) {
    const results = [];
    for (const teamDbName of teamDbs) {
        try {
            const db = await getDb(teamDbName, env);
            const collection = db.collection('statistics');
            const baseFilter = { type: 'Statistic', date: { $gte: startDate, $lte: endDate } };

            const uniqueNuids = await withRetry(() => collection.distinct('nuid', baseFilter));
            if (paced) await sleep(300);
            const totalPrompts = await withRetry(() => collection.countDocuments({
                ...baseFilter,
                variant: { $in: ['AssistantPromptSubmitted', 'AssistantPromptSubmittedViaAPI'] },
            }));
            if (paced) await sleep(300);

            results.push({ uniqueUsers: uniqueNuids.length, totalPrompts });
        } catch (err) {
            // skip failing team DBs
        }
    }
    return results;
}
