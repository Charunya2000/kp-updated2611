// 1. Database Connection
import { connectToDatabase } from '@/db/connection';
//import { checkDatabaseData } from './checkMongoDB';
import {
    fetchAndParseConfluence,
    fetchGitHubData,
    fetchJiraStories,
    fetchAllFixVersionIssues,
    fetchDeploymentPlanConfluence
} from './nodes/releaseManagementNode'
let log = [];
const envName = process.env['envName'];
let CONFLUENCE_BASE_URL = 'https://confluence-aes.kp.org';
let CONFLUENCE_TOKEN = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`];
let JIRA_BASE_URL = 'https://jira-aes.kp.org';
let JIRA_TOKEN = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.jira.api.key`];


async function saveDeploymentDataToDB(pageId, pageTitle, appsData) {
    try {
        const db = await connectToDatabase('team-nps-db');
        const collection = db.collection('NPS_Deployment_Plan');

        // Extract a clean date string from the title if possible (e.g., "03/06 '25")
        let deploymentDateTag = "Unknown";
        const dateMatch = pageTitle.match(/(\d{2}\/\d{2})\s*[']?(\d{2,4})/);
        if (dateMatch) {
            deploymentDateTag = dateMatch[0]; // Captures "03/06 '25" or "03/06 2025"
        }

        const document = {
            confluencePageId: String(pageId),
            pageTitle: pageTitle,
            chgNumber: appsData.chgNumber || "UNKNOWN",
            startingState: appsData.startingState || null, // <--- NEW LINE: Save the Time Machine date!
            deploymentDateTag: deploymentDateTag,
            last_updated: new Date().toISOString(),
            appsData: appsData
        };

        // Upsert: Update if exists, Insert if new
        await collection.updateOne(
            { confluencePageId: String(pageId) },
            { $set: document },
            { upsert: true }
        );

        log.push(`[DB UPLOAD] Successfully saved Playback Plan: ${pageTitle} (Page: ${pageId})`);
    } catch (error) {
        console.error(`[DB UPLOAD ERROR] Error saving page ${pageId}:`, error.message);
    }
}

// --- Main Pipeline Logic ---
async function deploymentPlanDataLoad(sinceDate) {



    try {
        // Ancestor ID 173514874 = "Playback Checklist" parent folder. 
        // We look for any page with "Playback" in the title modified in the last 180 days to build our DB.
        const cqlUrl = `${CONFLUENCE_BASE_URL}/rest/api/content/search?cql=space="HPBIONPS" AND ancestor="173514874" AND title ~ "Playback" AND lastmodified >= ${sinceDate} AND type="page"`;

        log.push(`[ INFO] Fetching Playback pages from Confluence...`);
        const response = await fetch(cqlUrl, {
            headers: { "Authorization": `Bearer ${CONFLUENCE_TOKEN}` }
        });

        if (!response.ok) throw new Error(`Confluence API returned ${response.status}`);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            log.push("[ INFO] No Playback pages found in the specified timeframe.");
            return;
        }

        log.push(`[ INFO] Found ${data.results.length} Playback pages. Processing...`);

        // Loop through each page and run your scraper
        for (const page of data.results) {
            log.push(`\n[ PROCESSING] Started Page: ${page.title} (ID: ${page.id})`);

            try {
                // Run your exact Flow 3 extraction logic!
                const appsData = await fetchDeploymentPlanConfluence(page.id);

                if (appsData && appsData.deployedApps && appsData.deployedApps.length > 0) {
                    await saveDeploymentDataToDB(page.id, page.title, appsData);
                } else {
                    log.push(`[ WARNING] No valid App versions found on ${page.title}. Skipping DB upload.`);
                }
            } catch (pageError) {
                console.error(`[ ERROR] Failed to process ${page.title}:`, pageError.message);
            }
        }


    } catch (error) {
        console.error("\n[ FATAL ERROR]:", error);
    }
}

// ============================================================================
// ---> HELPER 1: JIRA CONSENSUS CHECK (Get Release Name)
// ============================================================================
async function getReleaseNameFromJira(jiraIdsArray) {
    if (!jiraIdsArray || jiraIdsArray.length === 0) return null;

    // Check the first 3 Jira IDs to find a valid fixVersion safely
    const idsToCheck = jiraIdsArray.slice(0, 3);
    const keys = idsToCheck.join(',');
    const jql = `issueKey IN (${keys})`;

    try {
        const response = await fetch(`${JIRA_BASE_URL}/rest/api/2/search`, {
            method: 'POST',
            headers: { "Authorization": `Bearer ${JIRA_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ jql: jql, maxResults: 3, fields: ["fixVersions"] })
        });

        if (response.ok) {
            const data = await response.json();
            for (const issue of data.issues) {
                if (issue.fields.fixVersions && issue.fields.fixVersions.length > 0) {
                    return issue.fields.fixVersions[0].name; // e.g., "R032026 (March '26 Release)"
                }
            }
        }
    } catch (e) {
        log.push("[JIRA RELEASE NAME ERROR]:", e.message);
    }
    return null;
}

// ============================================================================
// ---> HELPER 2: DATABASE UPSERT
// ============================================================================
async function saveReleaseDataToDB(pageId, releaseName, finalReleaseData, excelUrl) {
    try {
        const db = await connectToDatabase('team-nps-db');
        const collection = db.collection('NPS_Release_Management');

        const operation = {
            updateOne: {
                filter: { confluencePageId: pageId },
                update: {
                    $set: {
                        releaseName: releaseName,
                        confluencePageId: pageId,
                        teamData: finalReleaseData,
                        excelDownloadUrl: excelUrl,
                        last_updated: new Date()
                    }
                },
                upsert: true // Creates new or updates existing safely
            }
        };

        await collection.bulkWrite([operation]);
        log.push(`[DB UPLOAD] Successfully saved Page ${pageId} for release: ${releaseName}`);
        return true;
    } catch (error) {
        log.push(`[DB UPLOAD ERROR] Error saving page ${pageId}:`, error.message);
        return false;
    }
}

// ============================================================================
// ---> MAIN: THE DAILY ORCHESTRATOR
// ============================================================================
export async function releaseNotesDataLoad({ sinceDate }) {
    //await checkDatabaseData();
    if (!sinceDate) { sinceDate = getYesterdayISO() }
    //
    log.push(`[releaseNotesDataLoad] START – sinceDate=${sinceDate}`);
    try {
        log.push("[Release Notes Data Load] Started");
        const loadDate = new Date(sinceDate).toISOString().split("T")[0];
        // 1. Query Confluence API for pages updated in the last 24 hours in HPBIONPS space
        // const cqlUrl = `${process.env.CONFLUENCE_BASE_URL}/rest/api/content/search?cql=space="HPBIONPS" AND lastmodified >= now("-1d") AND type="page"`;
        // This tells Confluence: Look ONLY in HPBIONPS, ONLY inside the UAT folder (317024524), and edited in the last 30 days
        const cqlUrl = `${CONFLUENCE_BASE_URL}/rest/api/content/search?cql=space="HPBIONPS" AND ancestor="317024524" AND lastmodified >= ${loadDate} AND type="page"`;
        const cqlResponse = await fetch(cqlUrl, {
            headers: { "Authorization": `Bearer ${CONFLUENCE_TOKEN}` }
        });

        if (!cqlResponse.ok) throw new Error("Failed to query Confluence API for updated pages.");

        const cqlData = await cqlResponse.json();
        const updatedPages = cqlData.results.map(p => p.id);

        if (updatedPages.length === 0) {
            log.push("[SUMMARY] No pages updated today. Pipeline finished gracefully.");
            return;
        }

        log.push(`[INFO] Found ${updatedPages.length} updated pages:`, updatedPages);

        // 2. Process every updated page found
        for (const pageId of updatedPages) {
            log.push(`\n[ PROCESSING] Started Page ID: ${pageId}`);

            // A. Scrape the page using your existing function
            const scrapedData = await fetchAndParseConfluence(pageId);
            if (!scrapedData || scrapedData.length === 0) {
                log.push(`[ WARNING] No valid team data found on page ${pageId}. Skipping.`);
                continue;
            }

            // B. Find the Release Name from Jira
            let allPageJiraIds = [];
            scrapedData.forEach(team => allPageJiraIds.push(...team.scrapedJiraIds));

            const releaseName = await getReleaseNameFromJira(allPageJiraIds);
            if (!releaseName) {
                log.push(`[ WARNING] Could not determine Release Name for page ${pageId}. Skipping.`);
                continue;
            }

            // C. Fetch GitHub & Jira Live Statuses using your existing functions
            const finalReleaseData = await Promise.all(scrapedData.map(async (teamData) => {
                const githubResults = await Promise.all(teamData.prs.map(pr => fetchGitHubData(pr)));
                const jiraResults = await fetchJiraStories(teamData.scrapedJiraIds);
                return {
                    team: teamData.team,
                    pageSource: pageId,
                    github: githubResults.filter(Boolean), // Removes null/failed PRs
                    jira: jiraResults
                };
            }));

            // D. Generate the Excel File using your existing function
            const taggedStoriesSet = new Set(allPageJiraIds.map(id => id.toUpperCase()));
            const allIssuesArray = await fetchAllFixVersionIssues(releaseName);
            let excelUrl = null;
            // if (allIssuesArray.length > 0) {
            //     excelUrl = await generateExcel_Flow1(releaseName, taggedStoriesSet, allIssuesArray, finalReleaseData);
            // }

            // E. Save to MongoDB
            await saveReleaseDataToDB(pageId, releaseName, finalReleaseData, excelUrl);
        }

        log.push("[Release Notes Data Load] Completed");

        log.push("[Deployment Plan Data Load] Started");
        await deploymentPlanDataLoad(loadDate);
        log.push("[Deployment Plan Data Load] Completed");

        return ({
            success: true,
            message: 'Successfully Completed',
            log
        });

    } catch (error) {
        console.error("\n[ FATAL ERROR]:", error);
        return ({ success: false, error: error.message, log }, { status: 500 });
    }
}
