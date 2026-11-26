/**
 * Usage Report Script - Exports past 6 months of usage data to Excel
 *
 * Connects to MongoDB across DEV, Preprod, and UAT (via KP Config) and collects:
 *   1. Total logins (UserAuth in aisvc_userdb/statistics)
 *   2. Unique users (from aisvc_userdb/statistics)
 *   3. Per-team unique users and prompt counts (team-{name}-db/statistics)
 *   4. Per-team daily unique users and prompt counts
 *
 * Connections are managed by ./usageReportDbConnection.js.
 *
 * Usage:
 *   1. Set env vars (run env17.bat or source .env.local)
 *   2. node --experimental-vm-modules scripts/usage-reports/generate-excel-report.js
 *
 * Output: usage-report-YYYY-MM-DD.xlsx in project root
 */

import ExcelJS from 'exceljs-hardened';
import { connectToEnvironmentDatabase, listTeamDatabases, closeMigrationConnections } from './usageReportDbConnection.js';

const TARGET_ENVS = ['dev', 'pp', 'uat'];
const SIX_MONTHS_AGO = new Date();
SIX_MONTHS_AGO.setMonth(SIX_MONTHS_AGO.getMonth() - 6);
SIX_MONTHS_AGO.setHours(0, 0, 0, 0);

const DELAY_BETWEEN_TEAMS_MS = 500;

/**
 * Retry a Cosmos DB operation on 429 TooManyRequests, using RetryAfterMs from the error.
 */
async function withRetry(fn, maxRetries = 5) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            const isRateLimit = err?.code === 16500 || err?.codeName === 'RequestRateTooLarge';
            if (isRateLimit && attempt < maxRetries) {
                const retryAfterMs = extractRetryAfterMs(err) ?? Math.min(1000 * 2 ** attempt, 30000);
                console.warn(`    Rate limited. Waiting ${retryAfterMs}ms before retry ${attempt + 1}/${maxRetries}...`);
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 1. Get all UserAuth logins from aisvc_userdb/statistics (past 6 months)
 */
async function getAppLogins(env) {
    const db = await connectToEnvironmentDatabase(env, 'aisvc_userdb');
    const collection = db.collection('statistics');

    const filter = {
        type: 'Statistic',
        variant: 'UserAuth',
        date: { $gte: SIX_MONTHS_AGO },
    };

    const totalLogins = await withRetry(() => collection.countDocuments(filter));
    const uniqueNuids = await withRetry(() => collection.distinct('nuid', filter));

    return {
        totalLogins,
        uniqueUsers: uniqueNuids.length,
    };
}

/**
 * 3. For each team DB, get unique users and prompt counts from statistics
 */
async function getTeamStats(env, teamDbName) {
    const db = await connectToEnvironmentDatabase(env, teamDbName);
    const collection = db.collection('statistics');

    const baseFilter = { type: 'Statistic', date: { $gte: SIX_MONTHS_AGO } };

    const uniqueNuids = await withRetry(() => collection.distinct('nuid', baseFilter));
    const totalPrompts = await withRetry(() => collection.countDocuments({ ...baseFilter, variant: { $in: ['AssistantPromptSubmitted', 'AssistantPromptSubmittedViaAPI'] } }));

    return {
        teamDbName,
        teamName: teamDbName.replace(/^team-/, '').replace(/-db$/, ''),
        uniqueUsers: uniqueNuids.length,
        totalPrompts,
    };
}

/**
 * 4. For each team DB, get unique users and prompt counts grouped by day
 */
async function getTeamStatsByDate(env, teamDbName) {
    const db = await connectToEnvironmentDatabase(env, teamDbName);
    const collection = db.collection('statistics');

    const pipeline = [
        {
            $match: {
                type: 'Statistic',
                variant: { $in: ['AssistantPromptSubmitted', 'AssistantPromptSubmittedViaAPI'] },
                date: { $gte: SIX_MONTHS_AGO },
            },
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                },
                uniqueNuids: { $addToSet: '$nuid' },
                totalPrompts: { $sum: 1 },
            },
        },
        { $sort: { '_id.date': 1 } },
    ];

    const results = await withRetry(() => collection.aggregate(pipeline).toArray());
    return results.map(r => ({
        date: r._id.date,
        teamName: teamDbName.replace(/^team-/, '').replace(/-db$/, ''),
        uniqueUsers: r.uniqueNuids.length,
        totalPrompts: r.totalPrompts,
    }));
}

/**
 * Build Excel workbook
 */
async function buildExcel(dataByEnv) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GenAI Portal Usage Report';
    workbook.created = new Date();

    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFF' }, size: 11 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
    };

    const cellBorder = {
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { vertical: 'top', wrapText: true },
    };

    // ========== Sheet 1: Summary ==========
    // Layout: Metric | DEV | Preprod | UAT  (one column per env)
    const ENV_DISPLAY = { dev: 'DEV', uat: 'UAT', pp: 'Preprod' };

    // Data row fill per env key (null = no fill)
    const ENV_DATA_FILL = {
        dev: 'FFB7DDE8', // light blue #B7DDE8
        uat: 'FFD7E3BC', // light green #D7E3BC
        pp: null,       // no fill
    };

    const summarySheet = workbook.addWorksheet('Summary');

    // Build column definitions dynamically based on present envs
    const envKeys = dataByEnv.map(d => d.env);
    summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 42 },
        ...envKeys.map(e => ({ header: ENV_DISPLAY[e] ?? e.toUpperCase(), key: e, width: 18 })),
    ];

    // Style header row — navy blue background, white text
    summarySheet.getRow(1).eachCell((cell) => {
        Object.assign(cell, {
            font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        });
    });

    // Build one row per metric, with all env values in the same row
    const envDataMap = Object.fromEntries(dataByEnv.map(({ env, appData, teamStatsList }) => {
        const totalTeamPrompts = teamStatsList.reduce((sum, t) => sum + t.totalPrompts, 0);
        const totalTeamUniqueUsers = teamStatsList.reduce((sum, t) => sum + t.uniqueUsers, 0);
        return [env, { appData, totalTeamPrompts, totalTeamUniqueUsers, teamStatsList }];
    }));

    const period = `${SIX_MONTHS_AGO.toISOString().slice(0, 10)} to ${new Date().toISOString().slice(0, 10)}`;
    const summaryMetrics = [
        { metric: 'Report Period', getValue: d => period },
        { metric: 'Total # of Logins (UserAuth events)', getValue: d => d.appData.totalLogins },
        { metric: 'Unique Users (app-level logins)', getValue: d => d.appData.uniqueUsers },
        { metric: 'Unique Users Across All Teams', getValue: d => d.totalTeamUniqueUsers },
        { metric: 'Total # of Prompts (all teams)', getValue: d => d.totalTeamPrompts },
        { metric: 'Number of Active Teams', getValue: d => d.teamStatsList.filter(t => t.uniqueUsers > 0).length },
    ];

    for (const { metric, getValue } of summaryMetrics) {
        const row = { metric };
        for (const env of envKeys) {
            row[env] = envDataMap[env] ? getValue(envDataMap[env]) : '';
        }
        summarySheet.addRow(row);
    }

    summarySheet.eachRow((row, i) => {
        if (i > 1) {
            row.eachCell((cell, colNumber) => {
                // Apply border to all data cells
                cell.border = cellBorder.border;
                cell.alignment = cellBorder.alignment;

                if (colNumber === 1) {
                    // Metric column — light beige/orange #FDEADA
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDEADA' } };
                    cell.font = { bold: true, color: { argb: 'FF000000' } };
                } else {
                    const env = envKeys[colNumber - 2];
                    const fillArgb = ENV_DATA_FILL[env];
                    if (fillArgb) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
                    }
                }
            });
        }
    });

    // ========== Sheet 2: Usage by Team ==========
    const teamSheet = workbook.addWorksheet('Usage by Team');
    teamSheet.columns = [
        { header: 'Env', key: 'env', width: 12 },
        { header: 'Team Name', key: 'teamName', width: 35 },
        { header: 'Unique Users', key: 'uniqueUsers', width: 18 },
        { header: 'Total Prompts', key: 'totalPrompts', width: 18 },
    ];

    for (const { env, teamStatsList } of dataByEnv) {
        const sorted = [...teamStatsList].sort((a, b) => b.totalPrompts - a.totalPrompts);
        const startRow = teamSheet.lastRow ? teamSheet.lastRow.number + 1 : 2;

        for (let i = 0; i < sorted.length; i++) {
            const team = sorted[i];
            teamSheet.addRow({
                env: i === 0 ? (ENV_DISPLAY[env] ?? env.toUpperCase()) : '',
                teamName: team.teamName,
                uniqueUsers: team.uniqueUsers,
                totalPrompts: team.totalPrompts,
            });
        }

        // Merge env column for this env group
        if (sorted.length > 1) {
            const endRow = startRow + sorted.length - 1;
            teamSheet.mergeCells(startRow, 1, endRow, 1);
        }

        // Style the merged env cell
        const envCell = teamSheet.getCell(startRow, 1);
        envCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        envCell.font = { bold: true };
    }

    teamSheet.getRow(1).eachCell(cell => { Object.assign(cell, headerStyle); });
    teamSheet.eachRow((row, i) => { if (i > 1) row.eachCell(cell => { Object.assign(cell, cellBorder); }); });

    // ========== Sheet 3: Usage by Date ==========
    const dateSheet = workbook.addWorksheet('Usage by Date');
    dateSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Environment', key: 'env', width: 15 },
        { header: 'Team Name', key: 'teamName', width: 35 },
        { header: 'Unique Users', key: 'uniqueUsers', width: 18 },
        { header: 'Total Prompts', key: 'totalPrompts', width: 18 },
    ];

    for (const { env, dailyStatsList } of dataByEnv) {
        for (const row of dailyStatsList) {
            dateSheet.addRow({
                date: row.date,
                env: env.toUpperCase(),
                teamName: row.teamName,
                uniqueUsers: row.uniqueUsers,
                totalPrompts: row.totalPrompts,
            });
        }
    }

    dateSheet.getRow(1).eachCell(cell => { Object.assign(cell, headerStyle); });
    dateSheet.eachRow((row, i) => { if (i > 1) row.eachCell(cell => { Object.assign(cell, cellBorder); }); });

    return workbook;
}

// ========== Main ==========
async function main() {
    try {
        const dataByEnv = [];

        for (const env of TARGET_ENVS) {
            console.log(`\n--- ${env.toUpperCase()} ---`);

            console.log('  Querying aisvc_userdb for logins...');
            const appData = await getAppLogins(env);
            console.log(`  Total logins: ${appData.totalLogins}, Unique users: ${appData.uniqueUsers}`);

            console.log('  Discovering team databases...');
            const teamDbs = await listTeamDatabases(env);
            console.log(`  Found ${teamDbs.length} team databases`);

            console.log('  Querying team databases...');
            const teamStatsList = [];
            const dailyStatsList = [];
            for (const teamDbName of teamDbs) {
                try {
                    const stats = await getTeamStats(env, teamDbName);
                    teamStatsList.push(stats);
                    console.log(`    ${stats.teamName}: ${stats.uniqueUsers} users, ${stats.totalPrompts} prompts`);
                    const dailyStats = await getTeamStatsByDate(env, teamDbName);
                    dailyStatsList.push(...dailyStats);
                } catch (err) {
                    console.warn(`    Skipping ${teamDbName}: ${err.message}`);
                }
                await sleep(DELAY_BETWEEN_TEAMS_MS);
            }

            dataByEnv.push({ env, appData, teamStatsList, dailyStatsList });
        }

        console.log('\nBuilding Excel report...');
        const workbook = await buildExcel(dataByEnv);
        const fileName = `usage-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
        await workbook.xlsx.writeFile(fileName);
        console.log(`\nReport saved: ${fileName}`);
    } catch (err) {
        console.error('Report failed:', err);
        process.exit(1);
    } finally {
        await closeMigrationConnections();
    }
}

main();
