export const runtime = "nodejs";


import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";

// ── Configuration ────────────────────────────────────────────────────────────
const USER_STORY_INDEX = 'nps-userstory-001';
const UPLOAD_BATCH_SIZE = 50;
const EMBEDDING_DELAY_MS = 150;
const INDEX_LOOKUP_BATCH_SIZE = 20;

const AC_FIELD_NAMES = [
  'customfield_10004',
  'customfield_10001',
  'customfield_10207',
  'customfield_10300'
];

// ── Env-based Config ─────────────────────────────────────────────────────────

function getJiraConfig() {
  const envName = process.env['envName'] || 'dev';
  const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.jira.api.key`];
  if (!token) throw new Error('JIRA API key not found. Ensure KP Config has loaded via configActions.js.');
  return {
    baseUrl: 'https://jira-aes.kp.org',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
}

function getSearchClient() {
  const envName = process.env['envName'] || 'dev';
  const endpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const apiKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
  if (!endpoint || !apiKey) throw new Error('Azure Search credentials not found in environment');
  return new SearchClient(endpoint, USER_STORY_INDEX, new AzureKeyCredential(apiKey));
}

// ── Utilities ────────────────────────────────────────────────────────────────

/** Returns yesterday in JIRA date format YYYY/MM/DD */
function getYesterdayJiraDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/** Sanitize string for use as Azure Search document ID */
function sanitizeId(str) {
  return str.replace(/[^a-zA-Z0-9_=-]/g, '_');
}

function extractAcceptanceCriteria(fields) {
  for (const name of AC_FIELD_NAMES) {
    if (fields[name]) return String(fields[name]);
  }
  return '';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Fast MD5 hash for content comparison (not crypto-security, just equality check) */
// function contentHash(text) {
//   return crypto.createHash('md5').update(text || '').digest('hex');
// }

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1: Fetch user stories from JIRA
//
//  Key decision: use `updatedDate >=` instead of `createdDate >=`
//   • Catches brand-new stories (createdDate == updatedDate on create)
//   • Catches stories whose description/AC were edited after creation
//   • Both cases need re-indexing; "unchanged" ones are filtered in Step 3
// ══════════════════════════════════════════════════════════════════════════════

async function fetchUserStories(sinceDate) {
  const jira = getJiraConfig();

  const jql = `project in ("NPG Team 1","NPG Team 2","NPG Team 3","NPS2 PROD SUPPORT") ` +
    `AND type = 'Story' ` +
    `AND updatedDate >= '${sinceDate}' ` +
    `AND description is not EMPTY`;

  console.log(`[userStoryDataLoad] JQL: ${jql}`);

  const stories = [];
  let startAt = 0;
  const maxResults = 100;
  const fieldList = ['key', 'summary', 'description', 'created', 'updated', ...AC_FIELD_NAMES].join(',');

  while (true) {
    const url = `${jira.baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=${fieldList}`;
    const res = await fetch(url, { method: 'GET', headers: jira.headers });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`JIRA ${res.status}: ${txt.substring(0, 500)}`);
    }

    const data = await res.json();
    const issues = data.issues || [];
    const total = data.total || 0;

    for (const issue of issues) {
      const f = issue.fields || {};
      const description = f.description || '';
      const acceptanceCriteria = extractAcceptanceCriteria(f);
      const content = [description, acceptanceCriteria].filter(Boolean).join('\n\nAcceptance Criteria:\n');

      stories.push({
        userStoryID: issue.key,
        description,
        acceptanceCriteria,
        content,
        
        jiraCreated: f.created || null,
        jiraUpdated: f.updated || null
      });
    }

    console.log(`[userStoryDataLoad] Fetched ${Math.min(startAt + issues.length, total)}/${total} from JIRA`);
    if (startAt + issues.length >= total || issues.length === 0) break;
    startAt += maxResults;
  }

  return stories;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2: Look up which stories already exist in the index
//
//  Uses Azure Search `getDocument(key)` which is an O(1) lookup by document key.
//  Batched with Promise.all for parallelism, with small delays to avoid throttling.
//  Returns a Map of userStoryID → { existingContentHash }
// ══════════════════════════════════════════════════════════════════════════════

async function lookupExistingStories(searchClient, stories) {
  const existingMap = new Map();

  for (let i = 0; i < stories.length; i += INDEX_LOOKUP_BATCH_SIZE) {
    const batch = stories.slice(i, i + INDEX_LOOKUP_BATCH_SIZE);

    const lookupPromises = batch.map(async (story) => {
      const docId = sanitizeId(story.userStoryID);
      try {
        const doc = await searchClient.getDocument(docId);
        return {
          id: story.userStoryID,
          found: true,
          existingContent: (doc.content || '')
        };
      } catch (err) {
        // 404 / RestError = document not found → genuinely new
        if (err.statusCode === 404 || err.code === 'ResourceNotFound' ||
          (err.message && err.message.includes('404'))) {
          return { id: story.userStoryID, found: false };
        }
        // Any other error – treat as "unknown, try to upload anyway"
        console.warn(`[lookupExisting] Error checking ${story.userStoryID}: ${err.message}`);
        return { id: story.userStoryID, found: false, lookupError: err.message };
      }
    });

    const results = await Promise.all(lookupPromises);
    for (const r of results) {
      if (r.found) {
        existingMap.set(r.id, { content: r.existingContent });
      }
    }

    // Brief pause between lookup batches
    if (i + INDEX_LOOKUP_BATCH_SIZE < stories.length) {
      await sleep(100);
    }
  }

  return existingMap;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3: Categorize stories into new / updated / unchanged
//
//  • NEW        – not found in index → must embed + upload
//  • UPDATED    – found in index but content hash differs → must re-embed + upload
//  • UNCHANGED  – found in index with identical content hash → skip entirely
//
//  This avoids wasting embedding API calls on stories whose content is identical.
//  mergeOrUploadDocuments (upsert) ensures no duplicates at the index level.
// ══════════════════════════════════════════════════════════════════════════════

function categorizeStories(stories, existingMap) {
  const newStories = [];
  const updatedStories = [];
  const unchangedIds = [];

  for (const story of stories) {
    const existing = existingMap.get(story.userStoryID);

    if (!existing) {
      // Not in index at all
      newStories.push(story);
    } else if (existing.content !== story.content) {
      // In index but content has changed (description/AC was edited)
      updatedStories.push(story);
    } else {
      // In index with identical content – skip
      unchangedIds.push(story.userStoryID);
    }
  }

  return { newStories, updatedStories, unchangedIds };
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 4: Vectorize and upload (only the stories that actually need it)
//
//  Uses mergeOrUploadDocuments (upsert):
//   • If doc with same `id` exists → updates all fields
//   • If doc doesn't exist → creates it
//  This is the final safety net against duplicates.
// ══════════════════════════════════════════════════════════════════════════════

async function vectorizeAndUpload(stories, searchClient, label) {
  const result = { uploaded: 0, failed: 0, skippedEmpty: 0, errors: [] };

  for (let i = 0; i < stories.length; i += UPLOAD_BATCH_SIZE) {
    const batch = stories.slice(i, i + UPLOAD_BATCH_SIZE);
    const docs = [];

    for (const story of batch) {
      const textToEmbed = (story.content || '').trim();
      if (textToEmbed.length === 0) {
        result.skippedEmpty++;
        continue;
      }

      try {
        const content_vector = await vectorizePromptNode(textToEmbed.substring(0, 8000));
        await sleep(EMBEDDING_DELAY_MS);

        docs.push({
          id: sanitizeId(story.userStoryID),
          userstory_id: story.userStoryID,
          description: story.description,
          acceptance_criteria: story.acceptanceCriteria,
          content: story.content,
          content_vector
        });
      } catch (vecErr) {
        console.error(`[${label}] Embedding failed for ${story.userStoryID}: ${vecErr.message}`);
        result.failed++;
        result.errors.push({ id: story.userStoryID, stage: 'embedding', error: vecErr.message });
      }
    }

    if (docs.length === 0) continue;

    try {
      const uploadRes = await searchClient.mergeOrUploadDocuments(docs);
      for (const r of uploadRes.results) {
        if (r.succeeded) result.uploaded++;
        else {
          result.failed++;
          result.errors.push({ id: r.key, stage: 'upload', error: r.errorMessage });
        }
      }
      console.log(`[${label}] Batch ${Math.floor(i / UPLOAD_BATCH_SIZE) + 1}: ${docs.length} docs sent`);
    } catch (batchErr) {
      console.error(`[${label}] Batch upload error: ${batchErr.message}`);
      result.failed += docs.length;
      result.errors.push({ batch: Math.floor(i / UPLOAD_BATCH_SIZE) + 1, stage: 'upload', error: batchErr.message });
    }
  }

  return result;
}

// ── Index verification ───────────────────────────────────────────────────────

async function verifyIndex(searchClient) {
  try {
    const res = await searchClient.search('*', { top: 0, includeTotalCount: true });
    return res.count ?? -1;
  } catch { return -1; }
}

async function getSampleDocuments(searchClient, count = 5) {
  const samples = [];
  try {
    const res = await searchClient.search('*', {
      top: count,
      select: ['userstory_id', 'description', 'acceptance_criteria']
    });
    for await (const r of res.results) {
      samples.push({
        userStoryID: r.document.userstory_id,
        descriptionLength: (r.document.description || '').length,
        hasAcceptanceCriteria: !!(r.document.acceptance_criteria),
        score: r.score
      });
    }
  } catch { /* ignore */ }
  return samples;
}

// ══════════════════════════════════════════════════════════════════════════════
// POST handler
//
//  Body (all optional):
//    { sinceDate: "2025/06/01" }         → custom date
//    {}                                  → defaults to yesterday
//    { fullRefresh: true }               → skip dedup, re-embed everything
//
//  Flow:
//    1. Fetch from JIRA (updatedDate >= sinceDate)
//    2. Look up existing stories in index
//    3. Categorize: new / updated / unchanged
//    4. Vectorize + upload ONLY new & updated (unchanged are skipped)
//    5. Verify final index state
// ══════════════════════════════════════════════════════════════════════════════

export async function userStoryDataLoad({sinceDate,fullRefresh}) {
  const t0 = Date.now();

  try {
    
    if(!sinceDate){sinceDate=getYesterdayISO()}
    //const fullRefresh = body.fullRefresh === true;

    //console.log(`\n${'='.repeat(65)}`);
    console.log(`[userStoryDataLoad] START`);
    console.log(`  sinceDate   = ${sinceDate}`);
    console.log(`  fullRefresh = ${fullRefresh}`);
   // console.log(`${'='.repeat(65)}`);

    // ── 1. Fetch from JIRA ──────────────────────────────────────
    console.log('[userStoryDataLoad] Step 1/5 – Fetching from JIRA …');
    const stories = await fetchUserStories(sinceDate);
    console.log(`[userStoryDataLoad] Fetched ${stories.length} stories (created/updated since ${sinceDate})`);

    if (stories.length === 0) {
      return {
        success: true,
        message: `No user stories created or updated since ${sinceDate}`,
        data: {
          sinceDate,
          totalFetchedFromJira: 0,
          newStories: 0,
          updatedStories: 0,
          unchangedSkipped: 0,
          uploaded: 0,
          embeddingCallsSaved: 0,
          timestamp: new Date().toISOString()
        }
      };
    }

    // ── 2. Deduplication check ───────────────────────────────────
    let newStories, updatedStories, unchangedIds;

    if (fullRefresh) {
      console.log('[userStoryDataLoad] Step 2/5 – Full refresh mode: skipping dedup check');
      newStories = stories;
      updatedStories = [];
      unchangedIds = [];
    } else {
      console.log('[userStoryDataLoad] Step 2/5 – Checking existing stories in index …');
      const searchClient = getSearchClient();
      const existingMap = await lookupExistingStories(searchClient, stories);
      console.log(`[userStoryDataLoad] Found ${existingMap.size} of ${stories.length} stories already in index`);

      // ── 3. Categorize ────────────────────────────────────────────
      ({ newStories, updatedStories, unchangedIds } = categorizeStories(stories, existingMap));
    }

    console.log(`[userStoryDataLoad] Step 3/5 – Categorized:`);
    console.log(`  🆕 New:       ${newStories.length}`);
    console.log(`  🔄 Updated:   ${updatedStories.length}`);
    console.log(`  ✅ Unchanged: ${unchangedIds.length} (skipped – saves ${unchangedIds.length} embedding calls)`);

    // ── 4. Vectorize and upload ──────────────────────────────────
    const storiesToProcess = [...newStories, ...updatedStories];
    let uploadResult = { uploaded: 0, failed: 0, skippedEmpty: 0, errors: [] };

    if (storiesToProcess.length > 0) {
      console.log(`[userStoryDataLoad] Step 4/5 – Vectorize & upload ${storiesToProcess.length} stories …`);
      const searchClient = getSearchClient();
      uploadResult = await vectorizeAndUpload(storiesToProcess, searchClient, 'userStoryDataLoad');
    } else {
      console.log('[userStoryDataLoad] Step 4/5 – Nothing to upload (all stories unchanged)');
    }

    // ── 5. Verify ────────────────────────────────────────────────
    console.log('[userStoryDataLoad] Step 5/5 – Verification …');
    const searchClient = getSearchClient();
    const totalInIndex = await verifyIndex(searchClient);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    // ── Build response ───────────────────────────────────────────
    const overallStatus = uploadResult.failed === 0
      ? (storiesToProcess.length === 0 ? 'NO_CHANGES' : 'SUCCESS')
      : (uploadResult.uploaded > 0 ? 'PARTIAL_SUCCESS' : 'FAILED');

    let statusMessage;
    if (storiesToProcess.length === 0) {
      statusMessage = `All ${unchangedIds.length} fetched stories already exist in index with identical content. No uploads needed. Index has ${totalInIndex} total documents.`;
    } else if (uploadResult.failed === 0) {
      statusMessage = `${uploadResult.uploaded} stories uploaded (${newStories.length} new + ${updatedStories.length} updated). ${unchangedIds.length} unchanged skipped. Index has ${totalInIndex} total documents.`;
    } else {
      statusMessage = `${uploadResult.uploaded} uploaded, ${uploadResult.failed} failed. ${unchangedIds.length} unchanged skipped. Index has ${totalInIndex} documents.`;
    }

    const response = {
      success: true,
      message: `User story data load completed in ${elapsed}s`,
      data: {
        sinceDate,
        fullRefresh,
        totalFetchedFromJira: stories.length,
        newStories: newStories.length,
        updatedStories: updatedStories.length,
        unchangedSkipped: unchangedIds.length,
        uploaded: uploadResult.uploaded,
        failed: uploadResult.failed,
        skippedEmptyContent: uploadResult.skippedEmpty,
        embeddingCallsSaved: unchangedIds.length,
        elapsedSeconds: parseFloat(elapsed),
        timestamp: new Date().toISOString()
      },
      details: {
        newStoryIds: newStories.map(s => s.userStoryID),
        updatedStoryIds: updatedStories.map(s => s.userStoryID),
        unchangedStoryIds: unchangedIds,
        jqlUsed: `updatedDate >= '${sinceDate}'`
      },
      verification: {
        indexName: USER_STORY_INDEX,
        totalDocumentsInIndex: totalInIndex,
        status: overallStatus,
        message: statusMessage
      },
      errors: uploadResult.errors.slice(0, 25)
    };

    console.log(`[userStoryDataLoad] DONE – New: ${newStories.length}, Updated: ${updatedStories.length}, Unchanged: ${unchangedIds.length}, Uploaded: ${uploadResult.uploaded}, Failed: ${uploadResult.failed}`);
    return response;

  } catch (error) {
    console.error('[userStoryDataLoad] FATAL:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET handler – Index status and diagnostics (no data modification)
// ══════════════════════════════════════════════════════════════════════════════

export async function validateUserStory() {
  try {
    const client = getSearchClient();
    const total = await verifyIndex(client);
    const samples = await getSampleDocuments(client, 5);

    return {
      success: true,
      indexName: USER_STORY_INDEX,
      totalDocuments: total,
      sampleDocuments: samples,
      defaultSinceDate: getYesterdayJiraDate(),
      jqlTemplate: `project in ("NPG Team 1",...) AND type = 'Story' AND updatedDate >= '<sinceDate>' AND description is not EMPTY`,
      deduplicationStrategy: {
        method: 'content-hash-comparison',
        description: 'Before vectorizing, each story\'s content is MD5-hashed and compared against the existing document in the index. Only new stories (not in index) and updated stories (content hash differs) are vectorized and uploaded. Unchanged stories are skipped entirely, saving embedding API calls.',
        indexUpsert: 'mergeOrUploadDocuments ensures no duplicates at the index level (same id = update, not insert)',
        dateFilter: 'Uses updatedDate >= to catch both newly created and recently edited stories'
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return { success: false, error: error.message }, { status: 500 };
  }
}