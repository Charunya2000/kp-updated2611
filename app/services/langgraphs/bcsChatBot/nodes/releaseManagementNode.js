'use server';

import { chatCompletion } from "@/app/services/chatCompletionService2";
import { connectToDatabase } from '@/db/connection';

import * as cheerio from 'cheerio/slim';
import ExcelJS from 'exceljs-hardened';
import sql from 'mssql';
import {
  writeFileBufferToBlobStorage,
  generateTemporaryDownloadLink,
  getBlockBlobClient
} from '@/app/services/blobStorageService'; // Update path if necessary
const envName = process.env['envName'];
let CONFLUENCE_BASE_URL = 'https://confluence-aes.kp.org';
let CONFLUENCE_TOKEN = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`];
let JIRA_BASE_URL = 'https://jira-aes.kp.org';
let JIRA_TOKEN = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.jira.api.key`];
let GITHUB_API_BASE = `https://github.kp.org/api/v3`;
let GITHUB_ACCESS_TOKEN = process.env[`host.${envName}-aiportal-web-2.github.secret`];
//async function extractReleaseIdentifiers(userPrompt, client) {
async function extractReleaseIdentifiers(state, userPrompt) {
  const prompt = `
    Extract the Confluence Page ID, Jira Fix Version, and Change Record Number (e.g., CHG0840494, CHG0867543) from the user query. 
    If an item is not mentioned, return null for it. Return ONLY valid JSON.
    Examples:
    Fix Version : 
        - R032026 (March '26 Release)
        - R122025 (Dec '25 Release)
    Confluence Page ID:
        - 1575556541
        - 1522085620
    Change Record Number:
        - CHG0840494
         -CHG0867543
    CRITICAL RULE FOR FIX VERSION: If the user provides a fix version with parentheses, you MUST extract the entire string exactly as written (e.g., "R022026 (Feb '26 Release)"). Do not cut it short.

    User Query: "${userPrompt}"
    Extract: { "page_id": string | null, "fix_version": string | null, "chg_number": string | null }
    `;


  const completionConfig = {
    temperature: 0,
    max_tokens: 500,
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    teamName: state?.teamName,
    assistantName: state?.assistantName,
    nuid: state?.nuid
  };


  const response = await chatCompletion(completionConfig);

  // const response = await client.chat.completions.create({
  //     model: "gpt-4o-aisvc", temperature: 0, messages: [{ role: "user", content: prompt }]
  // });

  try {
    const content = response.trim()//.choices[0].message.content.trim();
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/(\{[\s\S]*\})/);
    return JSON.parse(jsonMatch ? jsonMatch[1] : content);
  } catch (e) {
    return { page_id: null, fix_version: null, chg_number: null };
  }
}

// =====================================================================
// ---> FLOW 1: DEPLOYMENT PLAN HELPERS (UNCHANGED) <---
// =====================================================================

export async function fetchAndParseConfluence(pageId) {
  const url = `${CONFLUENCE_BASE_URL}/rest/api/content/${pageId}?expand=body.storage`;
  const response = await fetch(url, { headers: { "Authorization": `Bearer ${CONFLUENCE_TOKEN}` } });
  if (!response.ok) throw new Error("Failed to fetch Confluence page");
  const data = await response.json();
  const html = data.body.storage.value;
  const $ = cheerio.load(html);
  let targetTable = null;

  $('table').each((i, tbl) => {
    const text = $(tbl).text();
    if (text.includes('Team Name') && text.includes("PR's")) {
      targetTable = tbl;
      return false;
    }
  });

  if (!targetTable) return [];
  const teamMap = {};
  let currentTeam = "Unknown Team";

  $(targetTable).find('tr').each((i, row) => {
    if ($(row).parents('table').length > 1) return;
    const cols = $(row).find('> td, > th');
    if (cols.length === 0) return;

    const firstCellText = $(cols[0]).text().trim();
    if (firstCellText.toLowerCase().includes("team name")) return;
    if (firstCellText.includes("Approved Platform") || firstCellText.includes("Library Name")) return false;

    const isLabel = firstCellText.includes("PR's") || firstCellText.includes("Jira numbers");
    if (firstCellText && !isLabel) currentTeam = firstCellText;
    if (!teamMap[currentTeam]) teamMap[currentTeam] = { team: currentTeam, prs: new Set(), scrapedJiraIds: new Set() };

    // Scrape GitHub Links
    $(row).find('a').each((j, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('github.kp.org') && href.includes('/pull/')) teamMap[currentTeam].prs.add(href);
    });

    // 1. Clone the row and aggressively nuke crossed-out items
    const rowClone = $(row).clone();
    rowClone.find('del, s, strike, [style*="line-through"], span[style*="line-through"]').remove();

    // 2. Extract combined raw HTML and Text
    const combinedData = (rowClone.html() || "") + " " + (rowClone.text() || "");

    // 3. Match any Jira-looking pattern
    const rawMatches = combinedData.toUpperCase().match(/[A-Z]{2,}[0-9]*-[0-9]+/g) || [];

    // 4. STRICT FILTER: Only accept real project IDs, and fix the 'ENPG' HTML artifact
    rawMatches.forEach(id => {
      let cleanId = id;
      // If HTML appended a weird 'E', strip it off so it becomes NPG...
      if (cleanId.startsWith('ENPG')) cleanId = cleanId.replace('ENPG', 'NPG');

      // Only add it if it belongs to your actual Jira projects (NPG or FFC)
      if (cleanId.startsWith('NPG') || cleanId.startsWith('FFC')) {
        teamMap[currentTeam].scrapedJiraIds.add(cleanId);
      }
    });

    console.log(`[DEBUG SCRAPER] Team: ${currentTeam} | Found Valid Jira IDs:`, Array.from(teamMap[currentTeam].scrapedJiraIds));

  }); // <-- Closes the $(targetTable).find('tr').each loop

  return Object.values(teamMap).map(t => ({ team: t.team, prs: Array.from(t.prs), scrapedJiraIds: Array.from(t.scrapedJiraIds) }));
}

export async function fetchGitHubData(prUrl) {
  const match = prUrl.match(/github\.kp\.org\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (!match) return null;
  const [_, org, repo, prNumber] = match;
  const headers = { "Authorization": `Bearer ${GITHUB_ACCESS_TOKEN}`, "Accept": "application/vnd.github.v3+json" };

  try {
    const prRes = await fetch(`${GITHUB_API_BASE}/repos/${org}/${repo}/pulls/${prNumber}`, { headers });
    const prData = await prRes.json();
    const isMerged = prData.merged === true;

    const reviewRes = await fetch(`${GITHUB_API_BASE}/repos/${org}/${repo}/pulls/${prNumber}/reviews`, { headers });
    const reviews = await reviewRes.json();
    const hasApprovalReview = Array.isArray(reviews) && reviews.some(r => r.state === 'APPROVED');

    const filesRes = await fetch(`${GITHUB_API_BASE}/repos/${org}/${repo}/pulls/${prNumber}/files`, { headers });
    const files = await filesRes.json();
    const fileNames = Array.isArray(files) ? files.map(f => f.filename) : [];

    return { prUrl, isApproved: isMerged || hasApprovalReview, fileNames };
  } catch (e) {
    return { prUrl, error: "Failed to fetch from GitHub API" };
  }
}

export async function fetchJiraStories(scrapedIdsArray) {
  // If the team had no valid Jira IDs written on the page, skip the API call!
  if (!scrapedIdsArray || scrapedIdsArray.length === 0) return [];
  console.log(`[DEBUG JIRA] No explicitly tagged stories found to search.`);
  // Build JQL to fetch ONLY the exact keys scraped from Confluence
  const keys = scrapedIdsArray.join(',');
  const jql = `issueKey IN (${keys})`;
  console.log(`[DEBUG JIRA] Fetching explicitly tagged stories: ${jql}`);

  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/2/search`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${JIRA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jql: jql, maxResults: 50, fields: ["summary", "description", "status"] })
    });
    if (!response.ok) return [];
    const data = await response.json();

    return data.issues.map(i => {
      let desc = i.fields.description || "No description provided.";
      if (typeof desc !== 'string') desc = JSON.stringify(desc);
      desc = desc.replace(/\s+/g, ' ').trim();

      return {
        key: i.key,
        summary: i.fields.summary,
        status: i.fields.status.name,
        description: desc
      };
    });
  } catch (error) { return []; }
}

// =====================================================================
// ---> FLOW 3: PLAYBACK CHECKLIST & EXCEL GENERATOR (ISOLATED) <---
// =====================================================================

async function executeDbQuery_Flow3(sqlQuery) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/db2`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: sqlQuery })
    });
    if (res.ok) {
      const dbData = await res.json();
      const rawResults = dbData.data || dbData.results || dbData || [];
      return Array.isArray(rawResults) ? rawResults : [rawResults];
    }
    return [];
  } catch (error) { return []; }
}


function normalizeHtmlText(input) {
  if (!input) return input;

  const decodeOnce = (str) =>
    str.replace(/&amp;/g, "&");

  const decodedTwice = decodeOnce(decodeOnce(input));

  return decodedTwice
    .replace(/&#x?a0;|&nbsp;|\u00A0/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}



// Helper: Extract Repo and Version safely
// Helper: Extract Repo and Version safely



function parseAppString(appString) {
  // FIX: Convert HTML &nbsp; to normal spaces, remove extra spaces, and trim


  let appStringInp = normalizeHtmlText(appString)
  const cleanString = appStringInp.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

  // Regex looks for "any-text - number-number-number"
  const match = cleanString.match(/^(.+?)-(\d+(?:-\d+)+)$/);

  if (!match) {
    console.log(`[DEBUG FLOW 3] Regex skipped invalid app string: "${cleanString}"`);
    return null;
  }
  return {
    original: cleanString,
    repo: match[1],
    version: match[2].replace(/-/g, '.') // Convert 5-3-7 to 5.3.7
  };
}
async function fetchChangeTaskID(chgNumber) {
  console.log(`[DEBUG FLOW 3] Executing MS SQL Query for ${chgNumber}...`);
  let SNOWDB = 'SM_DW'
  const dbConfig = {
    user: process.env["kp.servicenow.reporting.database.user"],
    password: process.env["kp.servicenow.reporting.database.password"],
    server: process.env["kp.servicenow.reporting.database.host"],

    database: SNOWDB,
    port: 1433,
    options: { encrypt: true, trustServerCertificate: true },
    requestTimeout: 60000 // 60 seconds to prevent timeout crashes
  };


  // NEW: Added implementationName and testingName to the map
  let taskMap = {
    implementation: "N/A", epsApiSupport: "N/A", functionalValidation: "N/A",
    implementationName: "N/A", testingName: "N/A"
  };

  try {
    const dbQuery = `SELECT top 20 AssignmentGroup, AssignedToName, ChangeTaskIDSource, ChangeTaskType, 
        ShortDescription FROM dbo.changeTaskDetailHistory WHERE ChangeRequestIDSource='${chgNumber}'`;

    const pool = await sql.connect(dbConfig);

    const snowResults = await pool.request().query(dbQuery);
    await pool.close();


    const rawResults = snowResults.recordset || [];

    for (const row of rawResults) {
      const group = (row.AssignmentGroup || "").trim().toUpperCase();
      const desc = (row.ShortDescription || "").trim().toUpperCase();
      const type = (row.ChangeTaskType || "").trim().toUpperCase();
      const taskId = row.ChangeTaskIDSource || "N/A";
      const assignedTo = row.AssignedToName || "N/A";

      // Map SCTASKs AND AssignedToNames
      if (desc === 'IMPLEMENTATION') {
        taskMap.implementation = taskId;
        taskMap.implementationName = assignedTo; // Grabs Implementation Name
      }
      if (group === 'EPS API SUPPORT') taskMap.epsApiSupport = taskId;
      if (desc === 'FUNCTIONAL VALIDATION') taskMap.functionalValidation = taskId;

      if (type === 'TESTING') {
        taskMap.testingName = assignedTo; // Grabs Testing Name
      }
    }
  } catch (err) {
    console.error(`[DEBUG FLOW 3] MS SQL Database Error:`, err.message);
  } finally {
    sql.close();
  }
  return taskMap;
}
export async function fetchDeploymentPlanConfluence(pageId) {
  console.log(`[DEBUG FLOW 3] Scraping Confluence Page: ${pageId}...`);
  const url = `${CONFLUENCE_BASE_URL}/rest/api/content/${pageId}?expand=body.storage`;
  const response = await fetch(url, { headers: { "Authorization": `Bearer ${CONFLUENCE_TOKEN}` } });
  if (!response.ok) throw new Error("Failed to fetch Playback Confluence page");

  const data = await response.json();
  const $ = cheerio.load(data.body.storage.value);

  let deployedAppsRaw = [];
  let newAppsRaw = [];
  let scrapedChgNumber = null;
  let scrapedStartingState = null;

  // FIX: Safely loop through rows and clean aggressive HTML tags
  $('tr').each((i, row) => {
    const leftCell = $(row).find('td, th').first();
    const leftText = leftCell.text().trim();

    if (leftText.includes("App names/versions deployed")) {
      const rightCellHtml = $(row).find('td, th').eq(1).html() || "";
      // Replace <br>, <p>, and <li> with newlines, then strip remaining HTML
      deployedAppsRaw = rightCellHtml
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<li[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '').split('\n')
        .map(s => s.trim().replace(/^\d+\.\s*/, '')) // Remove "1. " prefixes
        .filter(Boolean);
    }

    if (leftText.includes("New app names/versions")) {
      const rightCellHtml = $(row).find('td, th').eq(1).html() || "";
      newAppsRaw = rightCellHtml
        .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<li[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '').split('\n')
        .map(s => s.trim().replace(/^\d+\.\s*/, ''))
        .filter(Boolean);
    }
    // ==========================================
    if (leftText.includes("Project team has opened a CRQ to cover deployment")) {
      const rightText = $(row).find('td, th').eq(1).text() || "";
      // Look for "CHG" followed by numbers
      const chgMatch = rightText.match(/(CHG\d+)/i);
      if (chgMatch) {
        scrapedChgNumber = chgMatch[1].toUpperCase();
      }
    }
    if (leftText.includes("Starting state of the environment")) {
      const rightText = $(row).find('td, th').eq(1).text().trim() || "";
      // Use Regex to grab ONLY the date format (e.g., extracts "08/20" from "08/20 Deployment")
      const stateMatch = rightText.match(/(\d{1,2}\/\d{1,2})/);
      if (stateMatch) {
        // Attach it directly to your apps/data object
        scrapedStartingState = stateMatch[1];
      }
    }

  });
  // 1. Extract both arrays safely
  const oldApps = deployedAppsRaw.map(parseAppString).filter(Boolean);
  const newApps = newAppsRaw.map(parseAppString).filter(Boolean);

  // 2. Create a Map to merge them (This automatically handles overwriting!)
  const masterMap = new Map();

  // First, add all the old apps to the Map
  oldApps.forEach(app => {
    masterMap.set(app.repo, app);
  });

  // Next, add the new apps. If the repo already exists (like nps-ui), it will OVERWRITE the old one with the new version!
  // If it's a brand new app (like rating-engine), it gets added to the list.
  newApps.forEach(app => {
    masterMap.set(app.repo, app);
  });

  // 3. Convert the merged Map back into a standard array
  const mergedDeployedApps = Array.from(masterMap.values());

  console.log(`[DEBUG FLOW 3] Merged ${oldApps.length} Old and ${newApps.length} New into a Master List of ${mergedDeployedApps.length} Apps.`);

  // Fallback: If the exact table row wasn't found, safely search the whole page
  if (!scrapedChgNumber) {
    const fallbackMatch = html.match(/(CHG\d{6,10})/i);
    if (fallbackMatch) scrapedChgNumber = fallbackMatch[1].toUpperCase();
  }

  console.log(`[DEBUG FLOW 3] Extracted CHG Number: ${scrapedChgNumber || "None"}`);
  // 4. Return the merged list AS 'deployedApps'. 
  // This tricks the rest of the application (GitHub Checker and UI) into using the Master List!
  return { deployedApps: mergedDeployedApps, newApps: newApps, chgNumber: scrapedChgNumber, startingState: scrapedStartingState };
}
async function checkGitHubVersions(deployedAppList) {
  console.log(`[DEBUG FLOW 3] Checking pom.xml for ${deployedAppList.length} applications...`);

  // Mapping for mismatched repository names
  const repoMapping = {
    'nps-ui': 'nps-ui-container'
  };

  const headers = {
    "Authorization": `Bearer ${GITHUB_ACCESS_TOKEN}`,
    "Accept": "application/vnd.github.v3+json"
  };

  let results = { updated: [], skipped: [] };

  // Process all GitHub calls concurrently
  await Promise.all(deployedAppList.map(async (app) => {
    try {
      // Determine the actual repository name using the map
      const actualRepo = repoMapping[app.repo] || app.repo;

      // Construct the URL using the mapped repository name
      const url = `${GITHUB_API_BASE}/repos/KPNPS/${actualRepo}/contents/pom.xml`;

      // Debugging the translation and final URL
      if (app.repo === 'nps-ui') {
        console.log(`[DEBUG MAPPING] Found mismatch. App: ${app.repo} -> GitHub Repo: ${actualRepo}`);
      }
      console.log(`[DEBUG FETCH] Requesting: ${url}`);

      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error(`[DEBUG ERROR] Fetch failed for ${actualRepo}. Status: ${response.status}`);
        throw new Error(`Status ${response.status}`);
      }

      const data = await response.json();

      // GitHub returns base64 content
      const decodedPom = Buffer.from(data.content, 'base64').toString('utf-8');

      // Grab the very first <version> tag
      const versionMatch = decodedPom.match(/<version>([^<]+)<\/version>/);
      const githubVersion = versionMatch ? versionMatch[1].trim() : "Unknown";

      // LOGIC: If the live GitHub version is DIFFERENT than the currently deployed version, it is an update!
      if (githubVersion !== "Unknown" && githubVersion !== app.version) {
        const dashedVersion = githubVersion.replace(/\./g, '-');
        const newFullString = `${app.repo}-${dashedVersion}`;
        results.updated.push({
          original: newFullString,
          repo: app.repo,
          oldVersion: app.version,
          newVersion: githubVersion
        });
      } else {
        // Version identical (No change)
        results.skipped.push({
          repo: app.repo,
          oldVersion: app.version,
          reason: "Version identical (No change)"
        });
      }
    } catch (error) {
      // Error handling for failed fetches
      results.skipped.push({
        repo: app.repo,
        oldVersion: app.version,
        reason: "Could not fetch pom.xml"
      });
    }
  }));

  return results;
}

async function generateExcelDP(updatedAppsList, taskIDs, chgNumber) {
  console.log(`[DEBUG FLOW 3] Generating Excel for ${chgNumber} via Blob Storage...`);
  const outputFileName = `DeploymentPlan_${chgNumber}_${Date.now()}.xlsx`;

  const containerName = 'npschatbot';
  const templateBlobName = 'create-template/Playback_Template.xlsx'; // Exact path from your screenshot
  const outputBlobName = `playback-checklists/${outputFileName}`;
  const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // 1. Fetch Template from Blob Storage into Memory
  console.log(`[DEBUG FLOW 3] Fetching template from Azure: ${templateBlobName}`);
  const templateClient = await getBlockBlobClient(containerName, templateBlobName);
  const templateBuffer = await templateClient.downloadToBuffer();

  // 2. Load the template into ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  // --- SHEET 1: PROD Implementation ---
  const appListText = updatedAppsList.map((app, idx) => `${idx + 1}. ${app.original}`).join('\n');
  const sheet1 = workbook.getWorksheet('PROD Implementation');
  if (!sheet1) console.log("❌ ERROR: Could not find a tab named 'PROD Implementation' in the template!");
  if (sheet1) {
    sheet1.getCell('B1').value = `${chgNumber} NPS 2.0 Application Release for `
    sheet1.getCell('B2').value = `Task Description
                                ${chgNumber}  NPS 2.0 Application Release for `
    sheet1.getCell('B13').value = `Deploy the following applications in PROD using prod service account\n${appListText}`;
    sheet1.getCell('B13').alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    sheet1.getCell('C11').value = taskIDs.implementation;
    sheet1.getCell('C18').value = taskIDs.implementation;
    sheet1.getCell('C15').value = taskIDs.epsApiSupport;
    sheet1.getCell('F11').value = taskIDs.implementationName;
    sheet1.getCell('F12').value = taskIDs.implementationName;
    sheet1.getCell('F13').value = taskIDs.implementationName;
    sheet1.getCell('F18').value = taskIDs.implementationName;
  }

  // --- SHEET 2: Backout ---
  const sheet2 = workbook.getWorksheet('Backout');
  if (!sheet2) console.log("❌ ERROR: Could not find a tab named 'Backout' in the template!");
  if (sheet2) {
    sheet2.getCell('B1').value = `${chgNumber} NPS 2.0 Application Release for `
    sheet2.getCell('B2').value = `Task Description
                                ${chgNumber}  NPS 2.0 Application Release for `
    sheet2.getCell('C9').value = taskIDs.implementation;
    sheet2.getCell('C15').value = taskIDs.epsApiSupport;
    sheet2.getCell('C21').value = taskIDs.functionalValidation;
    sheet2.getCell('D9').value = taskIDs.implementationName;
    sheet2.getCell('D17').value = taskIDs.implementationName;
    sheet2.getCell('D21').value = taskIDs.testingName;
  }

  // --- SHEET 3: Post Implementation Plan ---
  const sheet3 = workbook.getWorksheet('Post Implementation Plan');
  if (!sheet3) console.log("❌ ERROR: Could not find a tab named 'Post Implementation Plan' in the template!");
  if (sheet3) {
    sheet3.getCell('B1').value = `${chgNumber} NPS 2.0 Application Release for `
    sheet3.getCell('B2').value = `Task Description
                                ${chgNumber}  NPS 2.0 Application Release for `
    sheet3.getCell('C5').value = taskIDs.implementation;
    sheet3.getCell('C9').value = taskIDs.implementation;
    sheet3.getCell('C6').value = taskIDs.functionalValidation;
    sheet3.getCell('D5').value = taskIDs.implementationName;
    sheet3.getCell('D6').value = taskIDs.testingName;
    sheet3.getCell('D7').value = taskIDs.testingName;
  }

  // 3. Write populated workbook back to a memory Buffer
  // Convert Excel ArrayBuffer to a standard Node.js Buffer so Azure can read its exact length
  const rawBuffer = await workbook.xlsx.writeBuffer();
  const outputBuffer = Buffer.from(rawBuffer);

  // 4. Upload generated output to Azure Blob Storage
  console.log(`[DEBUG FLOW 3] Uploading output to Azure Blob: ${outputBlobName}`);
  const uploadSuccess = await writeFileBufferToBlobStorage(outputBuffer, containerName, outputBlobName, contentType);

  if (!uploadSuccess) throw new Error("Failed to upload Playback Checklist Excel to Azure Blob Storage.");

  // 5. Generate a 60-minute expiring SAS Link
  const sasUrl = await generateTemporaryDownloadLink(containerName, outputBlobName, 60);
  return sasUrl;
}
// =====================================================================
// ---> FLOW 1: MASTER FIX VERSION EXCEL GENERATOR <---
// =====================================================================
export async function fetchAllFixVersionIssues(fixVersion) {
  const jql = `fixVersion = "${fixVersion}"`;
  console.log(`[DEBUG FLOW 1] Fetching ALL issues for ${fixVersion}...`);
  try {
    const response = await fetch(`${JIRA_BASE_URL}/rest/api/2/search`, {
      method: 'POST',
      headers: { "Authorization": `Bearer ${JIRA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jql: jql, maxResults: 500, fields: ["summary"] }) // Get up to 500 issues
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.issues.map(i => ({ key: i.key, summary: i.fields.summary }));
  } catch (error) { return []; }
}
async function generateJiraSummary(description, state) {
  if (!description || description.trim() === "") return "No description provided.";

  try {
    // We only send the first 3000 characters to save tokens and keep it fast
    const safeDesc = description.substring(0, 3000);
    const prompt = `You are an JIRA Summarizer Agent. 
        CRITICAL EXECUTION RULES (NON-NEGOTIABLE):\n- Use the minimum number of tokens required.\n- Do NOT perform deep reasoning, chain-of-thought, step-by-step thinking, or internal analysis.\n- Do NOT elaborate, speculate, infer, or generalize.\n- Do NOT restate or paraphrase the user question.\n
        Summarize the following Jira ticket description into exactly 1 to 2 concise sentences explaining what this feature or fix does. Do NOT write more than 2 lines.\n\nDescription:\n${safeDesc}`;
    const completionConfig = {
      temperature: 0,
      max_tokens: 500,
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    };

    const response = await chatCompletion(completionConfig);


    return response.trim();
  } catch (error) {
    console.error("[DEBUG AI SUMMARIZER] AI Failed to summarize, using fallback.", error.message);
    // If the AI fails for any reason, safely fall back to the Javascript string slicer
    return description.replace(/<[^>]*>?/gm, '').replace(/[\r\n]+/g, ' ').substring(0, 250) + "...";
  }
}
export async function generateExcelRN(fixVersion, taggedStoriesSet, allIssuesArray, finalReleaseData, state) {
  console.log(`[DEBUG FLOW 1] Generating Master Fix Version Excel to Blob Storage...`);
  const safeFixVersion = fixVersion.replace(/[^a-zA-Z0-9]/g, '_');
  const outputFileName = `FixVersion_Audit_${safeFixVersion}_${Date.now()}.xlsx`;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Coverage Audit');

  sheet.getRow(1).values = ['All Issues in Fix Version', 'Tagged in Confluence', 'Not Tagged in Confluence'];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: 'center' };

  let rowIndex = 2;
  for (const issue of allIssuesArray) {
    const row = sheet.getRow(rowIndex);
    const formattedText = `${issue.key} | ${issue.summary}`;

    row.getCell(1).value = formattedText;
    if (taggedStoriesSet.has(issue.key.toUpperCase())) {
      row.getCell(2).value = formattedText;
      row.getCell(3).value = "";
    } else {
      row.getCell(2).value = "";
      row.getCell(3).value = formattedText;
    }
    rowIndex++;
  }

  sheet.getColumn(1).width = 60;
  sheet.getColumn(2).width = 60;
  sheet.getColumn(3).width = 60;
  // ====================================================================
  // ---> NEW: CREATE PULL REQUESTS SHEET <---
  if (finalReleaseData && finalReleaseData.length > 0) {
    const prSheet = workbook.addWorksheet('Pull Requests');

    // Add headers
    prSheet.addRow(['Confluence Page', 'Team', 'Status', 'PR URL', 'Impacted Files']);
    prSheet.getRow(1).font = { bold: true };

    // Loop through all pages, teams, and PRs
    finalReleaseData.forEach(pageData => {
      // Remove the "(Page: X)" artifact if it exists in the team name string
      const cleanTeamName = pageData.team.split(' (Page:')[0];

      if (pageData.github && pageData.github.length > 0) {
        pageData.github.forEach(pr => {
          const statusStr = pr.isApproved ? 'Approved' : 'Not Approved';
          const filesStr = pr.fileNames && pr.fileNames.length > 0 ? pr.fileNames.join(',\n') : 'None';
          prSheet.addRow([pageData.pageSource, cleanTeamName, statusStr, pr.prUrl, filesStr]);
        });
      }
    });

    // Format column widths nicely
    prSheet.getColumn(1).width = 20;
    prSheet.getColumn(2).width = 20;
    prSheet.getColumn(3).width = 15;
    prSheet.getColumn(4).width = 60;
    prSheet.getColumn(5).width = 100;
    prSheet.getColumn(5).alignment = { wrapText: true };
  }
  // ==========================================
  const coverageSheet = workbook.addWorksheet('Functionality Coverage');

  // Set up the columns
  coverageSheet.columns = [
    { header: 'Confluence Page ID', key: 'page', width: 20 },
    { header: 'Team Name', key: 'team', width: 20 },
    { header: 'Jira ID', key: 'jiraKey', width: 15 },
    { header: 'Functionality Description', key: 'desc', width: 100 }
  ];

  // Make the header row bold
  coverageSheet.getRow(1).font = { bold: true };

  // Loop through the FULL data and paste it into the rows

  // 2. Loop through the FULL data using for...of (so we can await the AI!)
  for (const teamData of finalReleaseData) {
    if (teamData.jira && teamData.jira.length > 0) {
      for (const ticket of teamData.jira) {

        console.log(`[DEBUG FLOW 1] Extracting Summary from Jira: ${ticket.key}...`);

        // 3. Ask the AI to write the 1-2 line summary!
        //const aiCoverageText = await generateJiraSummary(ticket.description,state);

        coverageSheet.addRow({
          page: teamData.pageSource,
          team: teamData.team,
          jiraKey: ticket.key,
          desc: ticket.description //aiCoverageText <--- Pastes the AI's smart summary directly into Excel!
        });
      }
    }
  }
  // ==========================================
  // ====================================================================
  // 1. Write the Excel file to a memory buffer instead of local storage
  const rawBuffer = await workbook.xlsx.writeBuffer();
  const fileBuffer = Buffer.from(rawBuffer);

  // 2. Upload to Azure Blob Storage
  const containerName = 'npschatbot';
  const blobName = `deployment-plans/${outputFileName}`;
  const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  console.log(`[DEBUG FLOW 1] Uploading to Azure Blob: ${blobName}`);
  const uploadSuccess = await writeFileBufferToBlobStorage(fileBuffer, containerName, blobName, contentType);

  if (!uploadSuccess) throw new Error("Failed to upload Deployment Plan Excel to Azure Blob Storage.");

  // 3. Generate a 60-minute expiring SAS Link
  const sasUrl = await generateTemporaryDownloadLink(containerName, blobName, 60);
  return sasUrl;
}
// =====================================================================
// --- MAIN NODE EXPORT (ROUTER) ---
// =====================================================================

export const releaseManagementNode = async (state) => {
  // const client = await getCompletionsClient();
  //const { page_id, fix_version, chg_number } = await extractReleaseIdentifiers(state.userPrompt, client);
  let identifier = ''
  let previousIdentifier = ''
  if (state.structuredMemory.activeDomain == 'release_management') { previousIdentifier = state.structuredMemory.domains['release_management'].lastIdentifier }

  // const { page_id, fix_version, chg_number } = await extractReleaseIdentifiers(state, state.userPrompt);
  let intent = previousIdentifier.split(":")[0]
  identifier = previousIdentifier.split(":")[1]
  //const parsed = await extractReleaseIdentifiers(state.userPrompt, client);
  // const { intent, page_ids, fix_version, chg_number, timeframe } = parsed;

  // let targetPageId = page_ids.length > 0 ? page_ids[0] : null;

  // if (page_ids.length === 0 && !fix_version && !chg_number && !timeframe) {
  //     return { ...state, searchSuccess: false, releaseMetadata: { error: "Missing Confluence Page ID, Fix Version, CHG Number, or Timeframe." } };
  // }

  try {
    // =========================================================================
    // FLOW 3: DEPLOYMENT PLAN (Powered by MongoDB + Natural Language)
    // =========================================================================
    if (intent === 'DEPLOYMENT_PLAN') {
      let chg_number = identifier;
      console.log(`[DEBUG ROUTER] Intent: Deployment Plan. Target SCTASK: ${chg_number}`);

      if (!chg_number) {
        throw new Error("A Change Number (e.g., CHG0840494) is required to fetch a Deployment Plan.");
      }

      let appsData = null;
      let targetPageTitle = null;
      let targetPageId = null;

      // 1. Connect to MongoDB
      const db = await connectToDatabase('team-nps-db');
      const collection = db.collection('NPS_Deployment_Plan');

      // 2. PRIMARY KEY LOOKUP: Search strictly by CHG Number!
      console.log(`[DEBUG DB] Fetching exact plan for SCTASK: ${chg_number}...`);
      let dbRecord = await collection.findOne({ chgNumber: chg_number });

      if (!dbRecord) {
        throw new Error(`I couldn't find a cached Deployment Plan for SCTASK ${chg_number}. Please ensure the Confluence page contains this CHG number and the background job has run.`);
      }

      // Capture original info for your debug logs
      let originalPageId = dbRecord.confluencePageId;
      let originalPageTitle = dbRecord.pageTitle;
      console.log(`[DEBUG DB] Found SCTASK ${chg_number} -> Maps to Original Page ID: ${originalPageId} ("${originalPageTitle}")`);

      // =========================================================================
      // 🕰️ THE TIME MACHINE (DEPENDENCY LOOKUP)
      // =========================================================================
      if (dbRecord.startingState) {
        console.log(`[DEBUG DB] Change ticket ${chg_number} relies on baseline state: "${dbRecord.startingState}".`);
        console.log(`[DEBUG DB] Searching DB for an older baseline page containing "${dbRecord.startingState}" in the title...`);

        // Do a second lookup: Find any page title that contains "08/20"
        const baselineRecord = await collection.findOne({
          pageTitle: { $regex: dbRecord.startingState, $options: "i" }
        });

        if (baselineRecord) {
          console.log(`[DEBUG DB] SUCCESS! Found Baseline Page ID: ${baselineRecord.confluencePageId} ("${baselineRecord.pageTitle}")`);
          console.log(`[DEBUG DB] SWAPPING DATA: Dropping Page ${originalPageId} and forcing bot to use apps from Page ${baselineRecord.confluencePageId}`);

          // Overwrite the current record with the old baseline record!
          dbRecord = baselineRecord;
        } else {
          console.log(`[DEBUG DB] WARNING: Baseline page for "${dbRecord.startingState}" not found in DB. Falling back to the original page.`);
        }
      } else {
        console.log(`[DEBUG DB] No startingState found for this SCTASK. Proceeding normally.`);
      }
      // =========================================================================

      appsData = dbRecord.appsData;
      targetPageId = dbRecord.confluencePageId;
      targetPageTitle = dbRecord.pageTitle;

      console.log(`[DEBUG DB] FINAL TARGET CONFIRMED -> Page ID: ${targetPageId} | Title: ${targetPageTitle}`);

      // 3. Run Real-Time SQL & GitHub Checks
      const taskIDs = await fetchChangeTaskID(chg_number);
      const githubResults = await checkGitHubVersions(appsData.deployedApps);
      const excelDownloadUrl = await generateExcelDP(appsData.deployedApps, taskIDs, chg_number);
      return {
        ...state,
        searchSuccess: true,
        releaseMetadata: {
          type: "PLAYBACK_CHECKLIST",
          pageId: targetPageId,
          pageTitle: targetPageTitle,
          chgNumber: chg_number,
          taskIDs: taskIDs,
          appsData: appsData,
          githubResults: githubResults,
          excelUrl: excelDownloadUrl
        }
      };
    }

    // =========================================================================
    // FLOW 1: RELEASE NOTES (Strict Fix Version Lookup + Data Sanitization)
    // =========================================================================
    else if (intent === 'RELEASE_NOTES') {
      let fix_version = identifier;
      console.log(`[DEBUG ROUTER] Intent: Release Notes. Target Fix Version: ${fix_version}`);

      if (!fix_version) {
        throw new Error("A Fix Version (e.g., R032026 (March '26 Release)) is required to generate Release Notes.");
      }

      let finalReleaseData = [];
      let allScrapedJiraIds = new Set();
      let matchedPageIds = [];

      // 1. Connect to the Release Notes Database
      const db = await connectToDatabase('team-nps-db');
      const collection = db.collection('NPS_Release_Management');

      console.log(`[DEBUG DB] Searching for all pages with Fix Version: "${fix_version}"...`);

      // 2. Fetch ALL records in the DB to find multiple matches
      const allReleases = await collection.find({ releaseName: fix_version }).toArray();


      const targetFixClean = fix_version.toLowerCase().replace(/\s+/g, ' ').trim();
      const matchedRecords = allReleases.filter(r =>
        r.releaseName && r.releaseName.toLowerCase().replace(/\s+/g, ' ').trim() === targetFixClean
      );

      if (matchedRecords.length === 0) {
        throw new Error(`I couldn't find any Release Notes in the database matching "${fix_version}". Please ensure the background job has run.`);
      }

      console.log(`[DEBUG DB] Found ${matchedRecords.length} pages for ${fix_version}. Combining data...`);

      // 3. COMBINE AND CLEAN DATA: Fix the JSON structure and bypass Azure filters!
      matchedRecords.forEach(record => {
        matchedPageIds.push(record.confluencePageId);

        if (record.teamData && Array.isArray(record.teamData)) {
          record.teamData.forEach(teamObj => {

            // Create a clean team object that exactly matches your old legacy structure
            let cleanTeam = {
              team: teamObj.team,
              pageSource: record.confluencePageId, // This fixes the "Confluence Page: undefined" error!
              github: teamObj.github || [],
              jira: []
            };

            // Strip descriptions from Jira tickets to shrink the payload and bypass Azure Content Filters
            if (teamObj.jira && Array.isArray(teamObj.jira)) {
              cleanTeam.jira = teamObj.jira.map(ticket => {
                allScrapedJiraIds.add(ticket.key); // Save ID for the Excel Audit
                return {
                  key: ticket.key,
                  summary: ticket.summary,
                  status: ticket.status,
                  description: ticket.description
                  // Notice: 'description' is completely deleted here!
                };
              });
            }

            finalReleaseData.push(cleanTeam);
          });
        }
      });

      // 4. Run Real-Time Jira Master Audit using the combined IDs
      console.log(`[DEBUG FLOW 1] Fetching live Jira issues for Master Audit: ${fix_version}`);
      const allFixVersionIssues = await fetchAllFixVersionIssues(fix_version);

      // 5. Generate the Excel File using the FULL data (Descriptions included!)
      let excelDownloadUrl = null;
      if (allFixVersionIssues && allFixVersionIssues.length > 0) {
        excelDownloadUrl = await generateExcelRN(fix_version, allScrapedJiraIds, allFixVersionIssues, finalReleaseData, state);
      }

      // 5. CREATE A LIGHTWEIGHT PAYLOAD FOR THE LLM UI
      // This strips out the heavy descriptions, but KEEPS the summary and status!
      const lightweightLlmData = finalReleaseData.map(teamObj => ({
        team: teamObj.team,
        pageSource: teamObj.pageSource,
        github: teamObj.github || [],
        jira: teamObj.jira ? teamObj.jira.map(ticket => ({
          key: ticket.key,
          summary: ticket.summary || "No summary provided",
          status: ticket.status || "Unknown"
          // Notice we still leave 'description' out of this list!
        })) : []
      }));

      return {
        ...state,
        searchSuccess: true,
        releaseMetadata: {
          type: "DEPLOYMENT_PLAN",
          pageId: matchedPageIds.join(", "),
          fixVersion: fix_version,
          data: lightweightLlmData, // Send this restored data to the UI!
          excelUrl: excelDownloadUrl
        }
      };
    }
    else {
      return { ...state, searchSuccess: false, releaseMetadata: { error: "Please provide either a Fix Version or a CHG Number along with the Page ID." } };
    }
  } catch (error) {
    console.error("Release Node Error:", error);
    return { ...state, searchSuccess: false, releaseMetadata: { error: error.message } };
  }
};