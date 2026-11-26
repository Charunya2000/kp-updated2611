export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";
import { parseOffice } from 'officeparser';
import { getOfficeParserConfig } from '@services/officeParserConfig';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const SP_SITE_URL = 'https://sp-cloud.kp.org/sites/NPS_BCS_GenAI';
const SP_FOLDER = '/sites/NPS_BCS_GenAI/Shared Documents/General/KnowledgeBase';
const KNOWLEDGE_INDEX = 'nps-knowledge-001';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const CHUNK_MAX_CHARS = 6000;
const CHUNK_OVERLAP = 500;
const UPLOAD_BATCH_SIZE = 25;
const EMBEDDING_DELAY_MS = 150;

const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'doc', 'xlsx', 'xlsm', 'xls', 'pptx', 'ppt', 'txt', 'csv', 'md', 'json'];
const SKIP_EXTENSIONS = ['doc', 'ppt', 'xls']; // old binary formats

// ═══════════════════════════════════════════════════════════════
// ENV HELPERS
// ═══════════════════════════════════════════════════════════════

function getSharePointCredentials() {
  const env = process.env['envName'] || 'dev';
  const prefix = `host.${env}-aiportal-web-2.aisvc.aksnp.azure.kp.org.sharepoint`;

  const clientId = process.env[`${prefix}.clientid`] || '';
  const tenantId = process.env[`${prefix}.tenantId`] || '';
  const thumbprint = process.env[`${prefix}.thumbprint`] || '';
  let privateKey = process.env[`${prefix}.privatekey`] || '';
  if (privateKey && !privateKey.includes('\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const clientSecret = process.env['SP_CLIENT_SECRET'] || '';
  const spUser = process.env['SP_USER'] || '';
  const spPassword = process.env['SP_PASSWORD'] || '';

  return { clientId, tenantId, thumbprint, privateKey, clientSecret, spUser, spPassword, envName: env };
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
function getFileExtension(name) { return (name || '').split('.').pop().toLowerCase(); }

function getYesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString();
}

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATION — Three strategies with fallback
// ═══════════════════════════════════════════════════════════════

function buildJwtAssertion(clientId, tenantId, privateKeyPem, thumbprint) {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const b64url = (buf) => buf.toString('base64url');
  const b64urlObj = (obj) => b64url(Buffer.from(JSON.stringify(obj)));
  const thumbBuf = Buffer.from(thumbprint.replace(/:/g, ''), 'hex');

  const header = { alg: 'RS256', typ: 'JWT', x5t: b64url(thumbBuf) };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: tokenEndpoint, iss: clientId, sub: clientId, jti: crypto.randomUUID(), nbf: now, exp: now + 600 };
  const unsigned = `${b64urlObj(header)}.${b64urlObj(payload)}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKeyPem, 'base64url');
  return `${unsigned}.${signature}`;
}

async function getTokenViaCertificate(creds) {
  const tokenUrl = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
  const assertion = buildJwtAssertion(creds.clientId, creds.tenantId, creds.privateKey, creds.thumbprint);
  const siteHost = new URL(SP_SITE_URL).origin;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
    scope: `${siteHost}/.default`
  });

  const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || data.error || 'Certificate auth failed');
  return data.access_token;
}

async function getTokenViaClientSecret(creds) {
  const tokenUrl = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
  const siteHost = new URL(SP_SITE_URL).origin;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: `${siteHost}/.default`
  });

  const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || data.error || 'Client secret auth failed');
  return data.access_token;
}

async function getTokenViaROPC(creds) {
  const tokenUrl = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
  const siteHost = new URL(SP_SITE_URL).origin;

  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: creds.clientId,
    username: creds.spUser,
    password: creds.spPassword,
    scope: `${siteHost}/.default`
  });

  const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || data.error || 'ROPC auth failed');
  return data.access_token;
}

async function authenticateSharePoint() {
  const creds = getSharePointCredentials();
  const attempts = {};

  // Strategy 1: Client Secret (simplest, add SP_CLIENT_SECRET to .env.local)
  //   if (creds.clientSecret) {
  //     try { return { token: await getTokenViaClientSecret(creds), method: 'client_secret' }; }
  //     catch (e) { attempts.client_secret = e.message.substring(0, 300); }
  //   } else {
  //     attempts.client_secret = 'SP_CLIENT_SECRET not set in environment';
  //   }

  // Strategy 2: Certificate
  if (creds.privateKey && creds.thumbprint && creds.clientId && creds.tenantId) {
    try { return { token: await getTokenViaCertificate(creds), method: 'certificate' }; }
    catch (e) { attempts.certificate = e.message.substring(0, 300); }
  } else {
    attempts.certificate = 'Incomplete certificate credentials in KP Config';
  }

  //   // Strategy 3: ROPC (password)
  //   if (creds.spUser && creds.spPassword) {
  //     try { return { token: await getTokenViaROPC(creds), method: 'password' }; }
  //     catch (e) { attempts.password = e.message.substring(0, 300); }
  //   } else {
  //     attempts.password = 'SP_USER and SP_PASSWORD not set in environment';
  //   }

  const details = Object.entries(attempts).map(([k, v]) => `  ${k}: ${v}`).join('\n');
  throw new Error(
    `SharePoint authentication failed. All methods tried:\n${details}\n\n` +
    `To fix: Add SP_CLIENT_SECRET to .env.local (recommended), OR renew the expired certificate in Azure AD, OR set SP_USER + SP_PASSWORD.`
  );
}

// ═══════════════════════════════════════════════════════════════
// SHAREPOINT REST API
// ═══════════════════════════════════════════════════════════════

function encodeSpPath(p) {
  return p.split('/').map(s => encodeURIComponent(s)).join('/');
}

async function spGet(token, apiPath) {
  const url = `${SP_SITE_URL}/_api/${apiPath}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json;odata=verbose' } });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text.substring(0, 500) };
  try { return { ok: true, data: JSON.parse(text) }; }
  catch { return { ok: true, body: text.substring(0, 500) }; }
}

async function spDownloadFile(token, serverRelativeUrl) {
  const url = `${SP_SITE_URL}/_api/web/GetFileByServerRelativeUrl('${encodeSpPath(serverRelativeUrl)}')/$value`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${serverRelativeUrl}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Recursively collect all files from folder and subfolders */
async function scanFolderRecursive(token, folderPath, sinceDate, log) {
  const allFiles = [];
  const encoded = encodeSpPath(folderPath);

  // Get files in current folder
  const filesResult = await spGet(token, `web/GetFolderByServerRelativeUrl('${encoded}')/Files`);
  if (filesResult.ok) {
    const raw = filesResult.data?.d?.results || filesResult.data?.value || [];
    for (const f of raw) {
      const name = f.Name || f.name;
      const size = parseInt(f.Length || f.size || 0, 10);
      const lastModified = f.TimeLastModified || f.timeLastModified || '';
      const serverRelativeUrl = f.ServerRelativeUrl || f.serverRelativeUrl;
      const ext = getFileExtension(name);

      // Filter by date
      if (sinceDate && lastModified) {
        const fileDate = new Date(lastModified);
        const filterDate = new Date(sinceDate);
        if (fileDate < filterDate) continue;
      }

      // Filter by size
      if (size > MAX_FILE_SIZE_BYTES) {
        log.push(`⏭️ Skipping (>50MB): ${name} (${Math.round(size / 1024 / 1024)}MB)`);
        continue;
      }

      // Filter by extension
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        log.push(`⏭️ Skipping (unsupported type): ${name}`);
        continue;
      }

      allFiles.push({ name, size, lastModified, serverRelativeUrl, ext, folderPath });
    }
  }

  // Get subfolders and recurse
  const foldersResult = await spGet(token, `web/GetFolderByServerRelativeUrl('${encoded}')/Folders`);
  if (foldersResult.ok) {
    const raw = foldersResult.data?.d?.results || foldersResult.data?.value || [];
    const subfolders = raw.filter(f => !['Forms', '_vti_cnf'].includes(f.Name || f.name));
    for (const sf of subfolders) {
      const sfUrl = sf.ServerRelativeUrl || sf.serverRelativeUrl;
      log.push(`📁 Scanning subfolder: ${sf.Name || sf.name}`);
      const subFiles = await scanFolderRecursive(token, sfUrl, sinceDate, log);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT TEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════

async function extractText(buffer, ext, fileName) {
  try {
    switch (ext) {
      case 'txt':
      case 'csv':
      case 'md':
      case 'json':
        return buffer.toString('utf-8');

      case 'pdf':
      case 'docx': {
        const ast = await parseOffice(buffer, getOfficeParserConfig());
        return (ast.toText() || '').trim();
      }

      case 'xlsx':
      case 'xlsm': {
        const ExcelJS = await import('exceljs-hardened');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const parts = [];

        for (const worksheet of workbook.worksheets) {
          const rows = [];

          worksheet.eachRow({ includeEmpty: true }, (row) => {
            // row.values is 1-based → skip index 0
            const values = row.values.slice(1).map(v => v ?? '');
            rows.push(values);
          });

          if (rows.length === 0) continue;

          // Header row
          const headers = rows[0].map(
            (h, i) => String(h || `Column${i + 1}`)
          );

          const rowTexts = [];

          for (let r = 1; r < rows.length; r++) {
            const cells = rows[r];

            const pairs = cells.map(
              (cell, i) => `${headers[i] || `Col${i + 1}`}: ${cell ?? ''}`
            );

            const rowText = pairs
              .filter(p => !p.endsWith(': '))
              .join('; ');

            if (rowText.trim()) rowTexts.push(rowText);
          }

          if (rowTexts.length > 0) {
            parts.push(`[Sheet: ${worksheet.name}]\n${rowTexts.join('\n')}`);
          }
        }

        return parts.join('\n\n');
      }

      case 'pptx': {
        const ast = await parseOffice(buffer, getOfficeParserConfig());
        return (ast.toText() || '').trim();
      }

      case 'doc':
      case 'ppt':
      case 'xls':
        return `[UNSUPPORTED OLD FORMAT] File "${fileName}" is in legacy binary format (.${ext}). Please convert to .${ext}x format for extraction.`;

      default:
        return '';
    }
  } catch (err) {
    console.error(`[extractText] Error extracting ${fileName}: ${err.message}`);
    return `[EXTRACTION ERROR] Could not extract text from "${fileName}": ${err.message}`;
  }
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
// VECTORIZE + UPLOAD TO INDEX
// ═══════════════════════════════════════════════════════════════

async function processAndUpload(files, token, searchClient, log) {
  const result = { uploaded: 0, failed: 0, skipped: 0, totalChunks: 0, errors: [] };

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    log.push(`\n📄 [${fi + 1}/${files.length}] Processing: ${file.name} (${Math.round(file.size / 1024)}KB)`);

    if (SKIP_EXTENSIONS.includes(file.ext)) {
      log.push(`  ⚠️ Skipped: legacy .${file.ext} format`);
      result.skipped++;
      continue;
    }

    // Download
    let buffer;
    try {
      buffer = await spDownloadFile(token, file.serverRelativeUrl);
      log.push(`  ✅ Downloaded (${Math.round(buffer.length / 1024)}KB)`);
    } catch (dlErr) {
      log.push(`  ❌ Download failed: ${dlErr.message}`);
      result.failed++;
      result.errors.push({ file: file.name, stage: 'download', error: dlErr.message });
      continue;
    }

    // Extract text
    let text;
    try {
      text = await extractText(buffer, file.ext, file.name);
      if (!text || text.trim().length < 10) {
        log.push(`  ⏭️ No meaningful text extracted`);
        result.skipped++;
        continue;
      }
      log.push(`  ✅ Extracted ${text.length} chars`);
    } catch (extErr) {
      log.push(`  ❌ Extraction failed: ${extErr.message}`);
      result.failed++;
      result.errors.push({ file: file.name, stage: 'extraction', error: extErr.message });
      continue;
    }

    // Chunk
    const chunks = chunkText(text);
    log.push(`  📦 Split into ${chunks.length} chunk(s)`);
    result.totalChunks += chunks.length;

    // Determine sheet name for Excel files
    const sheetName = (file.ext === 'xlsx' || file.ext === 'xlsm') ? 'AllSheets' : '';

    // Vectorize and upload in batches
    const docs = [];
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunkContent = chunks[ci].trim();
      if (!chunkContent) continue;

      try {
        const content_vector = await vectorizePromptNode(chunkContent.substring(0, 8000));
        await sleep(EMBEDDING_DELAY_MS);

        docs.push({
          id: sanitizeId(`${file.name}_chunk_${ci}`),
          file_name: file.name,
          file_type: file.ext,
          sheet_name: sheetName,
          source_path: file.serverRelativeUrl || file.folderPath,
          chunk_index: ci + 1,
          total_chunks: chunks.length,
          content: chunkContent,
          content_vector
        });
      } catch (vecErr) {
        result.failed++;
        result.errors.push({ file: file.name, chunk: ci, stage: 'embedding', error: vecErr.message });
      }

      // Upload in batches
      if (docs.length >= UPLOAD_BATCH_SIZE) {
        await uploadBatch(docs, searchClient, result);
        docs.length = 0;
      }
    }

    // Upload remaining
    if (docs.length > 0) {
      await uploadBatch(docs, searchClient, result);
    }

    log.push(`  ✅ File complete`);
  }

  return result;
}

async function uploadBatch(docs, searchClient, result) {
  try {
    const uploadRes = await searchClient.mergeOrUploadDocuments(docs);
    for (const r of uploadRes.results) {
      if (r.succeeded) result.uploaded++;
      else {
        result.failed++;
        result.errors.push({ id: r.key, stage: 'upload', error: r.errorMessage });
      }
    }
  } catch (e) {
    result.failed += docs.length;
    result.errors.push({ stage: 'batch_upload', error: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// GET — Scan SharePoint folder (diagnostic, no data load)
// ═══════════════════════════════════════════════════════════════

export async function validateDataLoad() {
  const log = [];
  try {
    log.push('── Authenticating to SharePoint ──');
    const { token, method } = await authenticateSharePoint();
    log.push(`✅ Authenticated via: ${method}`);

    log.push(`\n── Scanning folder: ${SP_FOLDER} ──`);
    const files = await scanFolderRecursive(token, SP_FOLDER, null, log);

    log.push(`\n═══ SCAN COMPLETE ═══`);
    log.push(`Total eligible files: ${files.length}`);

    return {
      success: true,
      authMethod: method,
      siteUrl: SP_SITE_URL,
      folderPath: SP_FOLDER,
      totalFiles: files.length,
      files: files.map(f => ({
        name: f.name,
        extension: f.ext,
        sizeKB: Math.round(f.size / 1024),
        lastModified: f.lastModified,
        folder: f.folderPath
      })),
      log,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    log.push(`❌ Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      log,
      remediation: [
        '1. Add SP_CLIENT_SECRET to .env.local (recommended for expired cert)',
        '2. OR renew the expired certificate in Azure AD and update KP Config',
        '3. OR set SP_USER and SP_PASSWORD in .env.local (requires ROPC, no MFA)'
      ],
      timestamp: new Date().toISOString()
    }, { status: 500 };
  }
}

// ═══════════════════════════════════════════════════════════════
// POST — Full data load: scan → download → extract → chunk → vectorize → upload
// ═══════════════════════════════════════════════════════════════

export async function sharepointDataLoad({ sinceDate }) {
  const t0 = Date.now();
  const log = [];

  try {

    if (!sinceDate) { sinceDate = getYesterdayISO() }
    //
    log.push(`[sharepointDataLoad] START – sinceDate=${sinceDate}`);

    // 1. Authenticate
    log.push('\n── Step 1: Authenticate ──');
    const { token, method } = await authenticateSharePoint();
    log.push(`✅ Auth via: ${method}`);

    // 2. Scan
    log.push('\n── Step 2: Scan folders ──');
    const files = await scanFolderRecursive(token, SP_FOLDER, sinceDate, log);
    log.push(`Found ${files.length} file(s) modified since ${sinceDate}`);

    if (files.length === 0) {
      return {
        success: true,
        message: `No new/modified files found since ${sinceDate}`,
        data: { sinceDate, totalFiles: 0, uploaded: 0 },
        log
      };
    }

    // 3. Process & Upload
    log.push('\n── Step 3: Download, extract, vectorize & upload ──');
    const searchClient = getSearchClient();
    const result = await processAndUpload(files, token, searchClient, log);

    // 4. Verify
    let totalInIndex = -1;
    try {
      const verifyRes = await searchClient.search('*', { top: 0, includeTotalCount: true });
      totalInIndex = verifyRes.count ?? -1;
    } catch { /* ignore */ }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    return {
      success: true,
      message: `SharePoint data load completed in ${elapsed}s`,
      data: {
        sinceDate,
        authMethod: method,
        filesProcessed: files.length,
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
      errors: result.errors.slice(0, 25),
      log
    };

  } catch (error) {
    console.error('[sharepointDataLoad] FATAL:', error);
    return {
      success: false,
      error: error.message,
      log,
      timestamp: new Date().toISOString()
    }, { status: 500 };
  }
}