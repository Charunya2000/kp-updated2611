export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const CONFLUENCE_BASE_URL = 'https://confluence-aes.kp.org';
const KNOWLEDGE_INDEX = 'nps-knowledge-001';
const CHUNK_MAX_CHARS = 6000;
const CHUNK_OVERLAP = 500;
const UPLOAD_BATCH_SIZE = 25;
const EMBEDDING_DELAY_MS = 150;
const MAX_PAGES_PER_ROOT = 500;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getConfluenceToken() {
  const envName = process.env['envName'] || 'dev';
  const token = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.confluence.api.key`];
  if (!token) throw new Error('Confluence API key not found in environment. Ensure KP Config has been loaded.');
  return token;
}

function getSearchClient() {
  const envName = process.env['envName'] || 'dev';
  const endpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
  const apiKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
  if (!endpoint || !apiKey) throw new Error('Azure Search credentials missing');
  return new SearchClient(endpoint, KNOWLEDGE_INDEX, new AzureKeyCredential(apiKey));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sanitizeId(str) { return str.replace(/[^a-zA-Z0-9_=-]/g, '_').substring(0, 128); }

// ═══════════════════════════════════════════════════════════════
// HTML CONTENT EXTRACTION (replicates Python extract_confluence_blocks)
// ═══════════════════════════════════════════════════════════════

function stripTags(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

function extractConfluenceBlocks(html) {
  if (!html) return { paragraphs: null, lists: null, tables: [] };

  // ── Paragraphs ──
  const paragraphLines = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (text) paragraphLines.push(text);
  }

  // ── Lists ──
  const listLines = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  while ((m = liRegex.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (text) listLines.push(`• ${text}`);
  }

  // ── Tables ──
  const tableBlocks = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  while ((m = tableRegex.exec(html)) !== null) {
    const tableHtml = m[1];

    // Extract headers from first <tr> that has <th>
    const headers = [];
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch;
    while ((thMatch = thRegex.exec(tableHtml)) !== null) {
      headers.push(stripTags(thMatch[1]));
    }

    // Extract data rows
    const rowTexts = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowIdx = 0;
    while ((thMatch = trRegex.exec(tableHtml)) !== null) {
      // Skip header row if headers were found
      if (rowIdx === 0 && headers.length > 0) { rowIdx++; continue; }

      const cells = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      while ((cellMatch = tdRegex.exec(thMatch[1])) !== null) {
        cells.push(stripTags(cellMatch[1]));
      }

      if (cells.length > 0) {
        const rowParts = cells.map((cell, i) => {
          const header = i < headers.length ? headers[i] : `Column${i + 1}`;
          return `${header}: ${cell}`;
        });
        rowTexts.push(rowParts.join('; '));
      }
      rowIdx++;
    }

    if (rowTexts.length > 0) tableBlocks.push(rowTexts.join('\n'));
  }

  return {
    paragraphs: paragraphLines.length > 0 ? paragraphLines.join('\n') : null,
    lists: listLines.length > 0 ? listLines.join('\n') : null,
    tables: tableBlocks
  };
}

function blocksToText(blocks) {
  const parts = [];
  if (blocks.paragraphs) parts.push(blocks.paragraphs);
  if (blocks.lists) parts.push(blocks.lists);
  if (blocks.tables.length > 0) parts.push(blocks.tables.join('\n\n'));
  return parts.join('\n\n');
}

// ═══════════════════════════════════════════════════════════════
// CONFLUENCE API
// ═══════════════════════════════════════════════════════════════

async function confluenceGet(apiPath, token) {
  const url = `${CONFLUENCE_BASE_URL}${apiPath}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Confluence API ${res.status}: ${text.substring(0, 300)}`);
  }
  return res.json();
}

/** Validate a root page ID – returns page info or error */
async function validatePage(pageId, token) {
  try {
    const data = await confluenceGet(`/rest/api/content/${pageId}?expand=space,children.page`, token);
    const childCount = data.children?.page?.size || 0;
    return {
      pageId,
      title: data.title || 'Unknown',
      spaceKey: data.space?.key || 'Unknown',
      spaceName: data.space?.name || 'Unknown',
      status: 'valid',
      directChildPages: childCount,
      url: `${CONFLUENCE_BASE_URL}/pages/viewpage.action?pageId=${pageId}`
    };
  } catch (error) {
    return {
      pageId,
      status: 'invalid',
      error: error.message
    };
  }
}

/** Recursively get all child page IDs under a root page */
async function getAllChildPages(rootPageId, token, depth = 0) {
  if (depth > 10) return []; // safety limit

  const pages = [];
  let start = 0;
  const limit = 100;

  while (true) {
    try {
      const data = await confluenceGet(
        `/rest/api/content/${rootPageId}/child/page?start=${start}&limit=${limit}&expand=body.storage`,
        token
      );
      const results = data.results || [];
      if (results.length === 0) break;

      for (const page of results) {
        const contentHtml = page.body?.storage?.value || '';
        pages.push({
          pageId: page.id,
          title: page.title || '',
          contentHtml,
          parentId: rootPageId
        });

        // Recurse into children
        if (pages.length < MAX_PAGES_PER_ROOT) {
          const childPages = await getAllChildPages(page.id, token, depth + 1);
          pages.push(...childPages);
        }
      }

      const totalSize = data.size || results.length;
      if (start + results.length >= (data.totalSize || totalSize) || results.length < limit) break;
      start += limit;
    } catch (err) {
      console.error(`[confluenceDataLoad] Error fetching children of ${rootPageId}: ${err.message}`);
      break;
    }
  }

  return pages;
}

/** Fetch full page content if not already expanded */
async function fetchPageContent(pageId, token) {
  const data = await confluenceGet(`/rest/api/content/${pageId}?expand=body.storage`, token);
  return data.body?.storage?.value || '';
}

// ═══════════════════════════════════════════════════════════════
// CHUNKING
// ═══════════════════════════════════════════════════════════════

function chunkText(text, maxChars = CHUNK_MAX_CHARS, overlap = CHUNK_OVERLAP) {
  if (!text || text.length === 0) return [];
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.substring(start, end));
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

// ═══════════════════════════════════════════════════════════════
// POST HANDLER
// Body:
//   { rootPageIds: ["12345", "67890"], validate: true }   → validate only
//   { rootPageIds: ["12345", "67890"] }                   → full data load
// ═══════════════════════════════════════════════════════════════

export async function confluenceDataLoad({rootPageIds,validate}) {
  const t0 = Date.now();

  try {
    

    if (!rootPageIds || !Array.isArray(rootPageIds) || rootPageIds.length === 0) {
      return (
        { success: false, error: 'rootPageIds is required and must be a non-empty array of Confluence page IDs' },
        { status: 400 }
      );
    }

    const cleanIds = rootPageIds.map(id => String(id).trim()).filter(Boolean);
    const token = getConfluenceToken();

    // ── VALIDATE MODE ──
    if (validate) {
      const validations = [];
      let totalChildEstimate = 0;

      for (const pageId of cleanIds) {
        const info = await validatePage(pageId, token);
        validations.push(info);
        if (info.status === 'valid') totalChildEstimate += info.directChildPages;
      }

      const validCount = validations.filter(v => v.status === 'valid').length;
      const invalidCount = validations.filter(v => v.status === 'invalid').length;

      return ({
        success: true,
        validation: validations,
        summary: {
          totalProvided: cleanIds.length,
          valid: validCount,
          invalid: invalidCount,
          estimatedDirectChildPages: totalChildEstimate
        },
        message: invalidCount === 0
          ? `✅ All ${validCount} root page(s) validated. ~${totalChildEstimate} direct child pages found. Ready to load.`
          : `⚠️ ${invalidCount} page(s) invalid. Fix those before loading.`,
        timestamp: new Date().toISOString()
      });
    }

    // ── FULL LOAD MODE ──
    console.log(`[confluenceDataLoad] Starting load for ${cleanIds.length} root page(s)`);

    // Step 1: Validate all pages first
    const validations = [];
    for (const pageId of cleanIds) {
      const info = await validatePage(pageId, token);
      validations.push(info);
    }

    const invalidPages = validations.filter(v => v.status === 'invalid');
    if (invalidPages.length > 0) {
      return ({
        success: false,
        error: `${invalidPages.length} page(s) are invalid. Validate first.`,
        invalidPages,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Step 2: Collect all child pages
    console.log('[confluenceDataLoad] Step 1/3 – Collecting child pages …');
    const allPages = [];
    for (const pageId of cleanIds) {
      const rootInfo = validations.find(v => v.pageId === pageId);
      console.log(`  Scanning root: ${rootInfo.title} (${pageId}) in space ${rootInfo.spaceKey}`);
      const children = await getAllChildPages(pageId, token);
      console.log(`  Found ${children.length} descendant pages`);
      allPages.push(...children);
    }

    console.log(`[confluenceDataLoad] Total pages to process: ${allPages.length}`);

    if (allPages.length === 0) {
      return ({
        success: true,
        message: 'No child pages found under the provided root page(s)',
        data: { totalPages: 0, uploaded: 0 }
      });
    }

    // Step 3: Extract, chunk, vectorize, upload
    console.log('[confluenceDataLoad] Step 2/3 – Extract, chunk, vectorize & upload …');
    const searchClient = getSearchClient();
    const result = { uploaded: 0, failed: 0, skipped: 0, totalChunks: 0, errors: [] };

    for (let pi = 0; pi < allPages.length; pi++) {
      const page = allPages[pi];

      // Get content if not already available
      let contentHtml = page.contentHtml;
      if (!contentHtml) {
        try {
          contentHtml = await fetchPageContent(page.pageId, token);
        } catch (err) {
          result.failed++;
          result.errors.push({ pageId: page.pageId, title: page.title, stage: 'fetch', error: err.message });
          continue;
        }
      }

      // Extract text blocks
      const blocks = extractConfluenceBlocks(contentHtml);
      const text = blocksToText(blocks);

      if (!text || text.trim().length < 10) {
        result.skipped++;
        continue;
      }

      // Chunk
      const chunks = chunkText(text);
      result.totalChunks += chunks.length;

      // Vectorize and upload
      const docs = [];
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunkContent = chunks[ci].trim();
        if (!chunkContent) continue;

        try {
          const content_vector = await vectorizePromptNode(chunkContent.substring(0, 8000));
          await sleep(EMBEDDING_DELAY_MS);

          docs.push({
            id: sanitizeId(`confluence_${page.pageId}_chunk_${ci}`),
            file_name: page.title || `Page_${page.pageId}`,
            file_type: 'confluence',
            sheet_name: '',
            source_path: `${CONFLUENCE_BASE_URL}/pages/viewpage.action?pageId=${page.pageId}`,
            chunk_index: ci + 1,
            total_chunks: chunks.length,
            content: chunkContent,
            content_vector
          });
        } catch (vecErr) {
          result.failed++;
          result.errors.push({ pageId: page.pageId, chunk: ci, stage: 'embedding', error: vecErr.message });
        }

        // Batch upload
        if (docs.length >= UPLOAD_BATCH_SIZE) {
          try {
            const uploadRes = await searchClient.mergeOrUploadDocuments(docs);
            for (const r of uploadRes.results) {
              if (r.succeeded) result.uploaded++;
              else { result.failed++; result.errors.push({ id: r.key, stage: 'upload', error: r.errorMessage }); }
            }
          } catch (e) {
            result.failed += docs.length;
            result.errors.push({ stage: 'batch_upload', error: e.message });
          }
          docs.length = 0;
        }
      }

      // Upload remaining docs
      if (docs.length > 0) {
        try {
          const uploadRes = await searchClient.mergeOrUploadDocuments(docs);
          for (const r of uploadRes.results) {
            if (r.succeeded) result.uploaded++;
            else { result.failed++; result.errors.push({ id: r.key, stage: 'upload', error: r.errorMessage }); }
          }
        } catch (e) {
          result.failed += docs.length;
          result.errors.push({ stage: 'batch_upload', error: e.message });
        }
      }

      if ((pi + 1) % 20 === 0) {
        console.log(`[confluenceDataLoad] Processed ${pi + 1}/${allPages.length} pages`);
      }
    }

    // Step 4: Verify
    console.log('[confluenceDataLoad] Step 3/3 – Verification …');
    let totalInIndex = -1;
    try {
      const verifyRes = await searchClient.search('*', { top: 0, includeTotalCount: true });
      totalInIndex = verifyRes.count ?? -1;
    } catch { /* ignore */ }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    return {
      success: true,
      message: `Confluence data load completed in ${elapsed}s`,
      data: {
        rootPageIds: cleanIds,
        rootPages: validations.map(v => ({ pageId: v.pageId, title: v.title, spaceKey: v.spaceKey })),
        totalChildPages: allPages.length,
        totalChunks: result.totalChunks,
        uploaded: result.uploaded,
        failed: result.failed,
        skipped: result.skipped,
        elapsedSeconds: parseFloat(elapsed),
        timestamp: new Date().toISOString()
      },
      verification: {
        indexName: KNOWLEDGE_INDEX,
        totalDocumentsInIndex: totalInIndex,
        status: result.failed === 0 ? 'SUCCESS' : (result.uploaded > 0 ? 'PARTIAL_SUCCESS' : 'FAILED'),
        message: `${result.uploaded} chunks uploaded. Index has ${totalInIndex} total documents.`
      },
      errors: result.errors.slice(0, 25)
    };

  } catch (error) {
    console.error('[confluenceDataLoad] FATAL:', error);
    return { success: false, error: error.message, timestamp: new Date().toISOString() }, { status: 500 };
  }
}