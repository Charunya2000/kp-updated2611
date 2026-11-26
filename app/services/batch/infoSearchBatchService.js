// 'use server';

// import fs from 'fs';
// import { promises as fsPromises } from 'fs';
// import path from 'path';
// import { createReadStream } from 'fs';
// import { parse } from 'csv-parse';
// import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
// import pdfExtract from 'pdf-extraction';
// import { parseOfficeAsync } from 'officeparser';
// import { htmlToText } from 'html-to-text';
// import { v4 as uuidv4 } from 'uuid';
// import { pathToFileURL } from 'url';

// import { copyFileFromLinuxServer } from '../linuxServerAccessService.js';
// import { vectorize } from '../vectorizeDataService.js';
// import { extractImageText } from '../extractImageText.js';

// const KPMSG_ID = 'AI_PORTAL_NOTEBOOK';
// const DEFAULT_CHUNK_SIZE = 512;
// const RETRYABLE_STATUS = 429;
// const TEMP_ROOT = path.join(process.cwd(), '.tmp', 'infosource');
// const DEFAULT_BATCH_NUID = process.env.INFOSEARCH_BATCH_NUID || 'infosource_batch';
// const MAX_DELETE_BATCH = 1000;
// const PROCESSED_IDS_PATH = path.join(TEMP_ROOT, 'processed-unique-ids.json');
// const NOT_LOADED_ASSETS_PATH = path.join(process.cwd(), 'logs', 'cognitive-search-results', 'not_loaded_assets.json');
// // Lowered default concurrency to 1 to reduce memory usage and avoid heap out of memory errors
// const VECTORIZE_MAX_CONCURRENCY = Math.max(1, parseInt(process.env.INFOSEARCH_VECTORIZE_MAX_CONCURRENCY ?? '1', 10));
// const VECTORIZE_MIN_INTERVAL_MS = Math.max(10, parseInt(process.env.INFOSEARCH_VECTORIZE_MIN_INTERVAL_MS ?? '250', 10));

// const linuxConfig = {
//   host: requireEnv('LINUX_SERVER_HOST'),
//   username: requireEnv('LINUX_SERVER_USERNAME'),
//   password: process.env.LINUX_SERVER_PASSWORD,
//   privateKeyPath: process.env.LINUX_SERVER_KEY_PATH,
//   privateKey: process.env.LINUX_SERVER_PRIVATE_KEY,
//   rootFolder: normalizeRoot(requireEnv('LINUX_SERVER_ROOT_FOLDER'))
// };

// if (!linuxConfig.password && !linuxConfig.privateKey && !linuxConfig.privateKeyPath) {
//   throw new Error('LINUX_SERVER_PASSWORD or key configuration is required');
// }

// await fsPromises.mkdir(TEMP_ROOT, { recursive: true });

// const searchClients = {};
// let infoSearchLoggingEnabled = true;
// const vectorizeConcurrencyState = { current: 0, queue: [] };
// let vectorizeNextAvailableTime = Date.now();

// function setInfoSearchLogging(enabled) {
//   infoSearchLoggingEnabled = Boolean(enabled);
// }
// // Safe garbage collection trigger
// function forceGarbageCollection() {
//   if (global.gc) {
//     global.gc();
//     console.log('Forced garbage collection');
//   }
// }
// function parseCliArgs(args = []) {
//   const options = {};
//   for (let i = 0; i < args.length; i += 1) {
//     const arg = args[i];
//     if (arg === '--type') {
//       options.type = (args[i + 1] || '').toLowerCase();
//       i += 1;
//     } else if (arg === '--id' || arg === '--uniqueId') {
//       options.uniqueId = (args[i + 1] || '').trim();
//       i += 1;
//     } else if (arg === '--help') {
//       options.help = true;
//     }
//   }
//   return options;
// }

// function assertCliOptions(options) {
//   if (options.type && !['assets', 'pages'].includes(options.type)) {
//     throw new Error("Invalid --type value. Use 'assets' or 'pages'.");
//   }
//   if (options.uniqueId && options.uniqueId.length === 0) {
//     throw new Error('Unique Id filter cannot be empty.');
//   }
// }

// function showUsage() {
//   console.log('Usage: npm run infoSearchBatch -- [--type assets|pages] [--id <Unique Id>]');
//   console.log('Examples:');
//   console.log('  npm run infoSearchBatch -- --type assets');
//   console.log('  npm run infoSearchBatch -- --type pages --id ABC123');
// }

// function requireEnv(name) {
//   const value = process.env[name];
//   if (!value || !value.trim()) {
//     throw new Error(`Missing required env var ${name}`);
//   }
//   return value.trim();
// }

// function normalizeRoot(root) {
//   const trimmed = root.trim().replace(/\\/g, '/');
//   return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
// }

// function normalizeUniqueIdValue(value = '') {
//   const trimmed = value.trim();
//   return trimmed || null;
// }

// function toTrackingKey(value = '') {
//   const normalized = normalizeUniqueIdValue(value);
//   return normalized ? normalized.toLowerCase() : null;
// }

// function getAssetRowUniqueId(row = {}) {
//   return normalizeUniqueIdValue(row['Unique ID'] || row['Unique Id'] || '');
// }

// function getAssetRowDocumentPath(row = {}) {
//   return normalizeUniqueIdValue(row['Document Path'] || '');
// }

// function getPageRowUniqueId(row = {}) {
//   return normalizeUniqueIdValue(row['Unique Id'] || '');
// }

// async function loadProcessedUniqueIds() {
//   try {
//     const raw = await fsPromises.readFile(PROCESSED_IDS_PATH, 'utf-8');
//     const parsed = JSON.parse(raw);
//     return {
//       assets: new Set(parsed?.assets || []),
//       pages: new Set(parsed?.pages || [])
//     };
//   } catch (error) {
//     if (error.code === 'ENOENT') {
//       return { assets: new Set(), pages: new Set() };
//     }
//     throw error;
//   }
// }

// async function persistProcessedUniqueIds(trackers) {
//   const payload = {
//     assets: Array.from(trackers.assets || []),
//     pages: Array.from(trackers.pages || [])
//   };
//   await fsPromises.mkdir(path.dirname(PROCESSED_IDS_PATH), { recursive: true });
//   await fsPromises.writeFile(PROCESSED_IDS_PATH, JSON.stringify(payload, null, 2));
// }

// function getNotLoadedAssetKey(uniqueId, documentPath) {
//   const normalizedUniqueId = normalizeUniqueIdValue(uniqueId || '') || 'unknown';
//   const normalizedDocumentPath = normalizeUniqueIdValue(documentPath || '') || 'unknown';
//   return `${normalizedUniqueId}|${normalizedDocumentPath}`;
// }

// async function loadNotLoadedAssets() {
//   try {
//     const raw = await fsPromises.readFile(NOT_LOADED_ASSETS_PATH, 'utf-8');
//     const parsed = JSON.parse(raw);
//     const items = Array.isArray(parsed?.notLoadedAssets) ? parsed.notLoadedAssets : [];
//     const map = new Map();
//     for (const item of items) {
//       const key = getNotLoadedAssetKey(item?.unique_id, item?.document_path);
//       map.set(key, {
//         unique_id: item?.unique_id || 'unknown',
//         document_path: item?.document_path || 'unknown',
//         reason: item?.reason || 'unknown',
//         updatedAt: item?.updatedAt || new Date().toISOString()
//       });
//     }
//     return map;
//   } catch (error) {
//     if (error.code === 'ENOENT') {
//       return new Map();
//     }
//     throw error;
//   }
// }

// async function persistNotLoadedAssets(notLoadedAssetsMap) {
//   const payload = {
//     generatedAt: new Date().toISOString(),
//     total: notLoadedAssetsMap.size,
//     notLoadedAssets: Array.from(notLoadedAssetsMap.values())
//   };
//   await fsPromises.mkdir(path.dirname(NOT_LOADED_ASSETS_PATH), { recursive: true });
//   await fsPromises.writeFile(NOT_LOADED_ASSETS_PATH, JSON.stringify(payload, null, 2), 'utf-8');
// }

// function markAssetNotLoaded(notLoadedAssetsMap, row, reason) {
//   if (!notLoadedAssetsMap) {
//     return;
//   }
//   const uniqueId = getAssetRowUniqueId(row) || 'unknown';
//   const documentPath = getAssetRowDocumentPath(row) || 'unknown';
//   const key = getNotLoadedAssetKey(uniqueId, documentPath);
//   notLoadedAssetsMap.set(key, {
//     unique_id: uniqueId,
//     document_path: documentPath,
//     reason,
//     updatedAt: new Date().toISOString()
//   });
// }

// function clearAssetNotLoaded(notLoadedAssetsMap, row) {
//   if (!notLoadedAssetsMap) {
//     return;
//   }
//   const uniqueId = getAssetRowUniqueId(row) || 'unknown';
//   const documentPath = getAssetRowDocumentPath(row) || 'unknown';
//   const key = getNotLoadedAssetKey(uniqueId, documentPath);
//   notLoadedAssetsMap.delete(key);
// }

// async function getSearchClient(indexName) {
//   const envName = process.env.envName || 'dev';
//   const searchEndpoint = requireEnv(`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`);
//   const searchUploadKey = requireEnv(`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`);
//   if (!searchClients[indexName]) {
//     searchClients[indexName] = new SearchClient(
//       searchEndpoint,
//       indexName,
//       new AzureKeyCredential(searchUploadKey)
//     );
//   }
//   return searchClients[indexName];
// }

// function escapeODataString(value = '') {
//   return value.replace(/'/g, "''");
// }

// async function deleteDocumentsFromIndex(indexName, { filter, reason } = {}) {
//   const client = await getSearchClient(indexName);
//   const contextDetail = { indexName, filterApplied: Boolean(filter), reason };
//   logInfo('InfoSearch.indexDeleteStart', contextDetail);
//   let deleted = 0;
//   let batch = [];
//   try {
//     const iterator = await client.search('*', { filter, select: ['id'], top: MAX_DELETE_BATCH });
//     for await (const result of iterator.results) {
//       const docId = result?.document?.id;
//       if (!docId) {
//         continue;
//       }
//       batch.push(docId);
//       if (batch.length >= MAX_DELETE_BATCH) {
//         await client.deleteDocuments('id', batch);
//         deleted += batch.length;
//         batch = [];
//       }
//     }
//     if (batch.length) {
//       await client.deleteDocuments('id', batch);
//       deleted += batch.length;
//     }
//     logInfo('InfoSearch.indexDeleteComplete', { ...contextDetail, deleted });
//     return deleted;
//   } catch (error) {
//     logError('InfoSearch.indexDeleteFailed', contextDetail, error);
//     throw error;
//   }
// }

// async function deleteAssetsByUniqueId(uniqueId) {
//   if (!uniqueId) {
//     return 0;
//   }
//   const filter = `unique_id eq '${escapeODataString(uniqueId)}'`;
//   return deleteDocumentsFromIndex('infosource_assets', { filter, reason: 'uniqueIdRefresh' });
// }

// async function doesAssetUniqueIdExistInSearch(uniqueId) {
//   if (!uniqueId) {
//     return false;
//   }

//   const client = await getSearchClient('infosource_assets');
//   const filter = `unique_id eq '${escapeODataString(uniqueId)}'`;
//   const iterator = await client.search('*', {
//     filter,
//     select: ['id'],
//     top: 1
//   });

//   for await (const result of iterator.results) {
//     if (result?.document?.id) {
//       return true;
//     }
//   }
//   return false;
// }

// function isRateLimitError(error) {
//   const status = error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.code;
//   const message = error?.message ?? '';
//   return status === RETRYABLE_STATUS || /429|Too\s*Many\s*Requests/i.test(message);
// }

// async function sleep(ms) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// function acquireVectorizeSlot() {
//   return new Promise((resolve) => {
//     const tryAcquire = () => {
//       if (vectorizeConcurrencyState.current < VECTORIZE_MAX_CONCURRENCY) {
//         vectorizeConcurrencyState.current += 1;
//         resolve(() => {
//           vectorizeConcurrencyState.current -= 1;
//           const next = vectorizeConcurrencyState.queue.shift();
//           if (next) {
//             next();
//           }
//         });
//         return;
//       }
//       vectorizeConcurrencyState.queue.push(tryAcquire);
//     };
//     tryAcquire();
//   });
// }

// async function enforceVectorizeRateLimit() {
//   const now = Date.now();
//   const waitMs = Math.max(0, vectorizeNextAvailableTime - now);
//   vectorizeNextAvailableTime = Math.max(vectorizeNextAvailableTime, now) + VECTORIZE_MIN_INTERVAL_MS;
//   if (waitMs > 0) {
//     await sleep(waitMs);
//   }
// }

// async function vectorizeWithRetry(params, maxRetries = 5, initialDelayMs = 2000) {
//   const releaseSlot = await acquireVectorizeSlot();
//   let attempt = 0;
//   let delay = initialDelayMs;
//   try {
//     while (true) {
//       try {
//         await enforceVectorizeRateLimit();
//         return await vectorize(params);
//       } catch (error) {
//         if (!isRateLimitError(error) || attempt >= maxRetries) {
//           throw error;
//         }
//         attempt += 1;
//         console.warn(JSON.stringify({ kpmsg: { id: KPMSG_ID, name: 'InfoSearch.vectorizeRetry', detail: { attempt, delayMs: delay, nuid: params?.nuid } } }));
//         await sleep(delay);
//         delay *= 2;
//       }
//     }
//   } finally {
//     releaseSlot();
//   }
// }

// async function uploadWithRetry(indexName, documents, maxRetries = 5, initialDelayMs = 2000) {
//   const client = await getSearchClient(indexName);
//   let attempt = 0;
//   let delay = initialDelayMs;
//   while (true) {
//     try {
//       logInfo('InfoSearch.uploadStart', { indexName, documentCount: documents.length, attempt: attempt + 1 });
//       console.log(`Uploading ${documents.length} documents to index ${indexName}, attempt ${attempt + 1}`);
//       const logPath = path.join(process.cwd(), 'uploadLogs', `upload-${Date.now()}.json`);
//       await fsPromises.mkdir(path.dirname(logPath), { recursive: true });
//       await fsPromises.appendFile(logPath, JSON.stringify({ timestamp: new Date().toISOString(), indexName, documentCount: documents.length, documents }) + '\n');
//       await client.uploadDocuments(documents.map((doc) => ({ '@search.action': 'upload', ...doc })));
//       logInfo('InfoSearch.uploadSuccess', { indexName, documentCount: documents.length, attempt: attempt + 1 });
//       return;
//     } catch (error) {
//       logError('InfoSearch.uploadFailed', { indexName, documentCount: documents.length, attempt: attempt + 1 }, error);
//       if (!isRateLimitError(error) || attempt >= maxRetries) {
//         throw error;
//       }
//       attempt += 1;
//       console.warn(JSON.stringify({ kpmsg: { id: KPMSG_ID, name: 'InfoSearch.uploadRetry', detail: { attempt, delayMs: delay, indexName } } }));
//       await sleep(delay);
//       delay *= 2;
//     }
//   }
// }

// function chunkTextContent(text, chunkSize = DEFAULT_CHUNK_SIZE) {
//   if (!text) {
//     return [];
//   }
//   const normalized = text
//     .replace(/\r\n/g, '\n')
//     .split('\n')
//     .filter((line) => line.trim().length > 0)
//     .join(' ');

//   const chineseCharCount = (normalized.match(/[\u4e00-\u9fff]/g) || []).length;
//   const containsChinese = chineseCharCount > normalized.length * 0.1;

//   const chunks = [];
//   if (containsChinese) {
//     for (let i = 0; i < normalized.length; i += chunkSize) {
//       chunks.push(normalized.substring(i, i + chunkSize));
//     }
//     return chunks;
//   }

//   const words = normalized.split(/\s+/);
//   for (let i = 0; i < words.length; i += chunkSize) {
//     chunks.push(words.slice(i, i + chunkSize).join(' '));
//   }
//   return chunks;
// }

// function sanitizeList(value) {
//   if (!value) {
//     return [];
//   }
//   return value
//     .split(';')
//     .map((entry) => entry.trim())
//     .filter(Boolean);
// }

// function normalizeDate(value) {
//   if (!value) {
//     return null;
//   }
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) {
//     return null;
//   }
//   const iso = date.toISOString();
//   return `${iso.substring(0, 10)}T00:00:00Z`;
// }

// function stripLeadingSlash(value) {
//   return (value || '').replace(/^\/+/, '');
// }

// function mapAssetRemotePath(documentPath) {
//   const cleaned = stripLeadingSlash(documentPath ?? '');
//   const prefix = 'content/dam/kp/sdswe/site-contents/';
//   const relative = cleaned.startsWith(prefix) ? cleaned.substring(prefix.length) : cleaned;
//   return `${linuxConfig.rootFolder}/assets_clone/${relative}`;
// }

// function mapPageRemotePath(pagePath) {
//   const cleaned = stripLeadingSlash(pagePath ?? '');
//   const prefix = 'content/kp/sdswe/sales-workforce-experience/frontdoor/';
//   const relative = cleaned.startsWith(prefix) ? cleaned.substring(prefix.length) : cleaned;
//   return `${linuxConfig.rootFolder}/pages_clone/${relative}.html`;
// }

// async function downloadRemoteFile(remotePath, localPath) {
//   await fsPromises.mkdir(path.dirname(localPath), { recursive: true });
//   await copyFileFromLinuxServer({
//     host: linuxConfig.host,
//     username: linuxConfig.username,
//     password: linuxConfig.password,
//     privateKeyPath: linuxConfig.privateKeyPath,
//     privateKey: linuxConfig.privateKey,
//     remotePath,
//     localPath
//   });
//   return localPath;
// }

// async function extractTextFromBuffer(buffer, extension, options = {}) {
//   const ext = extension.toLowerCase();
//   if (ext === '.txt' || ext === '.csv' || ext === '.tsv' || ext === '.xml') {
//     return buffer.toString('utf-8');
//   }
//   if (ext === '.html' || ext === '.htm') {
//     return htmlToText(buffer.toString('utf-8'), { wordwrap: false });
//   }
//   if (ext === '.pdf') {
//     // TODO: For large PDFs, consider using a streaming parser to reduce memory usage.
//     try {
//       const skipPdfImages = Boolean(options.skipPdfImages);
//       const result = await extractImageText(
//         buffer,
//         options.fileName || 'asset.pdf',
//         { includeImageDescriptions: !skipPdfImages, skipPdfImages },
//         'infosource',
//         'batch'
//       );
//       return result?.enrichedText || '';
//     } catch (error) {
//       const fallback = await pdfExtract(buffer);
//       return fallback.text || '';
//     }
//   }
//   // NOTE: If you continue to see heap out of memory errors, run Node.js with a higher memory limit:
//   //   node --max-old-space-size=4096 yourscript.js
//   // Or set the environment variable: export NODE_OPTIONS=--max-old-space-size=4096
//   if (ext === '.docx') {
//     try {
//       const result = await extractImageText(buffer, options.fileName || 'asset.docx', { includeImageDescriptions: true }, 'infosource', 'batch');
//       return result?.enrichedText || '';
//     } catch (error) {
//       const raw = await parseOfficeAsync(buffer);
//       return raw || '';
//     }
//   }
//   if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tiff'].includes(ext)) {
//     const result = await extractImageText(buffer, options.fileName || 'asset-image', { includeImageDescriptions: true }, 'infosource', 'batch');
//     return result?.enrichedText || '';
//   }
//   const rawContent = await parseOfficeAsync(buffer);
//   return typeof rawContent === 'string' ? rawContent : '';
// }

// async function readCsvRows(filePath, onRow) {
//   const parser = parse({ columns: true, skip_empty_lines: true, bom: true, trim: true });
//   const stream = createReadStream(filePath).pipe(parser);
//   for await (const row of stream) {
//     await onRow(row);
//   }
// }

// function buildAssetDocument(row, chunkText, vector, chunkIndex, sourceUniqueId) {
//   const documentId = `${uuidv4()}-${chunkIndex}`;
//   return {
//     id: documentId,
//     unique_id: sourceUniqueId,
//     page_reference: row['Page Reference'] || null,
//     document_title: row['Document Title'] || null,
//     document_path: row['Document Path'] || null,
//     owner: row['Document Owner'] || null,
//     last_reviewed: normalizeDate(row['Last Reviewed/Updated']) || null,
//     keywords: sanitizeList(row['Keywords']),
//     market: row['Market'] || null,
//     category: sanitizeList(row['Category']),
//     status: row['Asset Status'] || null,
//     region: row['Market Owner'] || null,
//     section_title: chunkText,
//     section_text: chunkText,
//     section: vector
//   };
// }

// function buildPageDocument(row, chunkText, vector, chunkIndex) {
//   const documentId = `${uuidv4()}-${chunkIndex}`;
//   return {
//     id: documentId,
//     title: row['Title'] || null,
//     path: row['Path'] || null,
//     market: row['Market'] || null,
//     owner: row['Content Owner'] || null,
//     valid_thru: normalizeDate(row['Valid Through']) || null,
//     last_reviewed: normalizeDate(row['Last Reviewed/Updated']) || null,
//     section_title: chunkText,
//     section: vector
//   };
// }

// async function processAssetRow(row, summary, context = {}) {
//   const capturePreview = Boolean(context.capturePreview);
//   const previewChunks = capturePreview ? [] : null;
//   const fileTypeFilter = (context.fileTypeFilter || '').toLowerCase();
//   const skipPdfImages = Boolean(context.skipPdfImages);
//   const declaredUniqueId = (row['Unique Id'] || row['Unique ID'] || '').trim();
//   const uniqueId = declaredUniqueId || uuidv4();
//   const remotePath = mapAssetRemotePath(row['Document Path']);
//   const fileName = path.posix.basename(remotePath);
//   const fileExtension = (path.extname(fileName) || '').replace('.', '').toLowerCase();
//   // Log resolved fileTypeFilter and fileExtension for every row
//   logInfo('InfoSearch.assetFileTypeResolution', {
//     uniqueId,
//     fileName,
//     fileExtension,
//     fileTypeFilter,
//     contextFileTypeFilter: context.fileTypeFilter,
//     rowDocumentPath: row['Document Path']
//   });

//   if (fileTypeFilter && fileExtension !== fileTypeFilter) {
//     summary.assets.skipped += 1;
//     logInfo('InfoSearch.assetSkippedByFileType', {
//       uniqueId,
//       remotePath,
//       fileExtension,
//       requiredType: fileTypeFilter
//     });
//     return false;
//   }
//   const localPath = path.join(TEMP_ROOT, 'assets', uniqueId, fileName);

//   const timing = { start: Date.now() };
//   logInfo('InfoSearch.assetProcessStart', {
//     uniqueId,
//     documentTitle: row['Document Title'] || null,
//     remotePath
//   });
//   logInfo('InfoSearch.assetDownloadStart', { remotePath, localPath, uniqueId });
//   try {
//     const t0 = Date.now();
//     await downloadRemoteFile(remotePath, localPath);
//     const t1 = Date.now();
//     logInfo('InfoSearch.assetDownloadComplete', { remotePath, localPath, uniqueId, ms: t1 - t0 });
//     timing.download = t1 - t0;
//   } catch (error) {
//     summary.assets.missing += 1;
//     logError('InfoSearch.assetDownloadFailed', { remotePath, reason: error.message });
//     markAssetNotLoaded(context.notLoadedAssetsMap, row, error?.message || 'Asset download failed');
//     return false;
//   }

//   let processed = false;
//   let buffer = null;
//   let text = null;
//   let chunks = null;
//   let documents = null;
//   try {
//     // Log file name and size before reading
//     let fileStats = null;
//     try {
//       fileStats = await fsPromises.stat(localPath);
//       const fileSizeMB = fileStats.size / (1024 * 1024);
//       logInfo('InfoSearch.assetFileStats', {
//         uniqueId,
//         fileName,
//         localPath,
//         fileSizeBytes: fileStats.size,
//         fileSizeMB: fileSizeMB.toFixed(2)
//       });
//       if (fileSizeMB > 10) {
//         summary.assets.skipped += 1;
//         logInfo('InfoSearch.assetSkippedBySize', {
//           uniqueId,
//           fileName,
//           localPath,
//           fileSizeMB: fileSizeMB.toFixed(2),
//           reason: 'File size exceeds 10MB limit'
//         });
//         forceGarbageCollection();
//         markAssetNotLoaded(context.notLoadedAssetsMap, row, 'File size exceeds 10MB limit');
//         return false;
//       }
//     } catch (statErr) {
//       logError('InfoSearch.assetFileStatError', { uniqueId, fileName, localPath }, statErr);
//     }
//     const t2 = Date.now();
//     buffer = await fsPromises.readFile(localPath);
//     const t3 = Date.now();
//     logInfo('InfoSearch.assetFileRead', { uniqueId, ms: t3 - t2 });
//     timing.fileRead = t3 - t2;
//     const t4 = Date.now();
//     text = await extractTextFromBuffer(buffer, path.extname(fileName) || '', { fileName, skipPdfImages });
//     const t5 = Date.now();
//     logInfo('InfoSearch.assetTextExtracted', { uniqueId, charLength: text?.length || 0, ms: t5 - t4 });
//     timing.textExtract = t5 - t4;
//     // Release buffer after text extraction
//     buffer = null;
//     if (!text?.trim()) {
//       summary.assets.skipped += 1;
//       logError('InfoSearch.assetEmptyText', { remotePath });
//       forceGarbageCollection();
//       markAssetNotLoaded(context.notLoadedAssetsMap, row, 'Extracted text is empty');
//       return false;
//     }
//     const t6 = Date.now();
//     chunks = chunkTextContent(text);
//     const t7 = Date.now();
//     logInfo('InfoSearch.assetChunksPrepared', { uniqueId, chunkCount: chunks.length, ms: t7 - t6 });
//     timing.chunking = t7 - t6;
//     // Release text after chunking
//     text = null;
//     if (!chunks.length) {
//       summary.assets.skipped += 1;
//       forceGarbageCollection();
//       markAssetNotLoaded(context.notLoadedAssetsMap, row, 'No text chunks generated');
//       return false;
//     }

//     if (declaredUniqueId) {
//       const t8 = Date.now();
//       const removed = await deleteAssetsByUniqueId(declaredUniqueId);
//       const t9 = Date.now();
//       summary.assets.deleted += removed;
//       logInfo('InfoSearch.assetDeleteByUniqueId', { uniqueId, removed, ms: t9 - t8 });
//       timing.deleteByUniqueId = t9 - t8;
//     }

//     documents = [];
//     logInfo('InfoSearch.assetVectorizeStart', { uniqueId, chunkCount: chunks.length });
//     const t10 = Date.now();
//     for (let i = 0; i < chunks.length; i += 1) {
//       const vStart = Date.now();
//       const vector = await vectorizeWithRetry({ nuid: DEFAULT_BATCH_NUID, content: chunks[i] });
//       const vEnd = Date.now();
//       documents.push(buildAssetDocument(row, chunks[i], vector, i, declaredUniqueId || uniqueId));
//       logInfo('InfoSearch.assetVectorizeChunk', { uniqueId, chunkIndex: i, ms: vEnd - vStart });
//       if (previewChunks) {
//         previewChunks.push({
//           index: i,
//           length: chunks[i].length,
//           text: chunks[i]
//         });
//       }
//       // Release vector after use
//       // (if vector is a large object, set to null here if not needed)
//     }
//     const t11 = Date.now();
//     logInfo('InfoSearch.assetVectorizeComplete', { uniqueId, chunkCount: documents.length, ms: t11 - t10 });
//     timing.vectorize = t11 - t10;
//     const t12 = Date.now();
//     await uploadWithRetry('infosource_assets', documents);
//     const t13 = Date.now();
//     logInfo('InfoSearch.assetUploadSuccess', {
//       remotePath,
//       localPath,
//       uniqueId,
//       chunks: documents.length,
//       ms: t13 - t12
//     });
//     timing.upload = t13 - t12;
//     summary.assets.processed += 1;
//     summary.assets.uploaded += documents.length;
//     if (previewChunks) {
//       summary.assets.preview = {
//         uniqueId,
//         documentTitle: row['Document Title'] || null,
//         remotePath,
//         chunkCount: previewChunks.length,
//         chunks: previewChunks
//       };
//     }
//     processed = true;
//     clearAssetNotLoaded(context.notLoadedAssetsMap, row);
//   } catch (error) {
//     summary.assets.failed += 1;
//     logError('InfoSearch.assetProcessingFailed', { remotePath }, error);
//     markAssetNotLoaded(context.notLoadedAssetsMap, row, error?.message || 'Asset processing failed');
//   } finally {
//     // Release all large objects
//     buffer = null;
//     text = null;
//     chunks = null;
//     documents = null;
//     const tEnd = Date.now();
//     timing.total = tEnd - timing.start;
//     logInfo('InfoSearch.assetProcessTiming', { uniqueId, timing });
//     await safeUnlink(localPath);
//     forceGarbageCollection();
//   }

//   return processed;
// }

// async function processPageRow(row, summary, context = {}) {
//   const capturePreview = Boolean(context.capturePreview);
//   const previewChunks = capturePreview ? [] : null;
//   const declaredUniqueId = (row['Unique Id'] || '').trim();
//   const uniqueId = declaredUniqueId || uuidv4();
//   const remotePath = mapPageRemotePath(row['Path']);
//   const fileName = path.posix.basename(remotePath);
//   const localPath = path.join(TEMP_ROOT, 'pages', uniqueId, fileName);

//   const timing = { start: Date.now() };
//   logInfo('InfoSearch.pageProcessStart', {
//     uniqueId,
//     title: row['Title'] || null,
//     remotePath
//   });
//   logInfo('InfoSearch.pageDownloadStart', { remotePath, localPath, uniqueId });
//   try {
//     const t0 = Date.now();
//     await downloadRemoteFile(remotePath, localPath);
//     const t1 = Date.now();
//     logInfo('InfoSearch.pageDownloadComplete', { remotePath, localPath, uniqueId, ms: t1 - t0 });
//     timing.download = t1 - t0;
//   } catch (error) {
//     summary.pages.missing += 1;
//     logError('InfoSearch.pageDownloadFailed', { remotePath, reason: error.message });
//     return false;
//   }

//   let processed = false;
//   try {
//     const t2 = Date.now();
//     const buffer = await fsPromises.readFile(localPath);
//     const t3 = Date.now();
//     logInfo('InfoSearch.pageFileRead', { uniqueId, ms: t3 - t2 });
//     timing.fileRead = t3 - t2;
//     const t4 = Date.now();
//     const text = await extractTextFromBuffer(buffer, '.html', { fileName });
//     const t5 = Date.now();
//     logInfo('InfoSearch.pageTextExtracted', { uniqueId, charLength: text?.length || 0, ms: t5 - t4 });
//     timing.textExtract = t5 - t4;
//     if (!text?.trim()) {
//       summary.pages.skipped += 1;
//       logError('InfoSearch.pageEmptyText', { remotePath });
//       return false;
//     }
//     const t6 = Date.now();
//     const chunks = chunkTextContent(text);
//     const t7 = Date.now();
//     logInfo('InfoSearch.pageChunksPrepared', { uniqueId, chunkCount: chunks.length, ms: t7 - t6 });
//     timing.chunking = t7 - t6;
//     if (!chunks.length) {
//       summary.pages.skipped += 1;
//       return false;
//     }
//     const documents = [];
//     logInfo('InfoSearch.pageVectorizeStart', { uniqueId, chunkCount: chunks.length });
//     const t8 = Date.now();
//     for (let i = 0; i < chunks.length; i += 1) {
//       const vStart = Date.now();
//       const vector = await vectorizeWithRetry({ nuid: DEFAULT_BATCH_NUID, content: chunks[i] });
//       const vEnd = Date.now();
//       documents.push(buildPageDocument(row, chunks[i], vector, i));
//       logInfo('InfoSearch.pageVectorizeChunk', { uniqueId, chunkIndex: i, ms: vEnd - vStart });
//       if (previewChunks) {
//         previewChunks.push({
//           index: i,
//           length: chunks[i].length,
//           text: chunks[i]
//         });
//       }
//     }
//     const t9 = Date.now();
//     logInfo('InfoSearch.pageVectorizeComplete', { uniqueId, chunkCount: documents.length, ms: t9 - t8 });
//     timing.vectorize = t9 - t8;
//     const t10 = Date.now();
//     await uploadWithRetry('infosource_pages', documents);
//     const t11 = Date.now();
//     logInfo('InfoSearch.pageUploadSuccess', {
//       remotePath,
//       localPath,
//       uniqueId,
//       chunks: documents.length,
//       ms: t11 - t10
//     });
//     timing.upload = t11 - t10;
//     summary.pages.processed += 1;
//     summary.pages.uploaded += documents.length;
//     if (previewChunks) {
//       summary.pages.preview = {
//         uniqueId,
//         title: row['Title'] || null,
//         remotePath,
//         chunkCount: previewChunks.length,
//         chunks: previewChunks
//       };
//     }
//     processed = true;
//   } catch (error) {
//     summary.pages.failed += 1;
//     logError('InfoSearch.pageProcessingFailed', { remotePath }, error);
//   } finally {
//     const tEnd = Date.now();
//     timing.total = tEnd - timing.start;
//     logInfo('InfoSearch.pageProcessTiming', { uniqueId, timing });
//     await safeUnlink(localPath);
//   }

//   return processed;
// }

// async function safeUnlink(targetPath) {
//   try {
//     await fsPromises.unlink(targetPath);
//   } catch (error) {
//     if (error.code !== 'ENOENT') {
//       console.warn(`Unable to remove ${targetPath}: ${error.message}`);
//     }
//   }
// }

// function logInfo(name, detail) {
//   if (!infoSearchLoggingEnabled) {
//     return;
//   }
//   console.log(JSON.stringify({ kpmsg: { id: KPMSG_ID, name, detail } }));
// }

// function logError(name, detail, error) {
//   if (!infoSearchLoggingEnabled) {
//     return;
//   }
//   console.error(
//     JSON.stringify({
//       kpmsg: {
//         id: KPMSG_ID,
//         name,
//         detail: {
//           ...detail,
//           error: error?.message
//         }
//       }
//     })
//   );
// }

// const CHECKPOINT_PATH = path.join(TEMP_ROOT, 'processed-checkpoint.json');
// const DEFAULT_ASSET_LAST_PROCESSED_ROW = 0;
// const DEFAULT_PAGE_LAST_PROCESSED_ROW = 0;

// function normalizeCheckpoint(checkpoint = {}) {
//   const legacyLastProcessedRow = Number.isInteger(checkpoint.lastProcessedRow)
//     ? checkpoint.lastProcessedRow
//     : DEFAULT_ASSET_LAST_PROCESSED_ROW;
//   const assetsLastProcessedRow = Number.isInteger(checkpoint.assetsLastProcessedRow)
//     ? checkpoint.assetsLastProcessedRow
//     : legacyLastProcessedRow;
//   const pagesLastProcessedRow = Number.isInteger(checkpoint.pagesLastProcessedRow)
//     ? checkpoint.pagesLastProcessedRow
//     : DEFAULT_PAGE_LAST_PROCESSED_ROW;

//   return {
//     assetsLastProcessedRow,
//     pagesLastProcessedRow,
//     // Keep legacy field for compatibility with existing API/UI readers
//     lastProcessedRow: assetsLastProcessedRow
//   };
// }

// async function loadCheckpoint() {
//   try {
//     const raw = await fsPromises.readFile(CHECKPOINT_PATH, 'utf-8');
//     return normalizeCheckpoint(JSON.parse(raw));
//   } catch (error) {
//     if (error.code === 'ENOENT') {
//       return normalizeCheckpoint({
//         assetsLastProcessedRow: DEFAULT_ASSET_LAST_PROCESSED_ROW,
//         pagesLastProcessedRow: DEFAULT_PAGE_LAST_PROCESSED_ROW
//       });
//     }
//     throw error;
//   }
// }

// async function saveCheckpoint(checkpointInput) {
//   const checkpoint = normalizeCheckpoint(checkpointInput);
//   await fsPromises.mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true });
//   await fsPromises.writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
// }

// async function runBatch(options = {}) {
//   const checkpoint = await loadCheckpoint();
//   const requestedType = options.type || 'all';
//   const processAssets = requestedType !== 'pages';
//   const processPages = requestedType !== 'assets';
//   const requestedUniqueId = normalizeUniqueIdValue(options.uniqueId || '');
//   const requestedUniqueIdKey = toTrackingKey(requestedUniqueId || '');
//   const shouldSkipPreviouslyProcessed = Boolean(options.skipPreviouslyProcessed);
//   const startFromRow1 = Boolean(options.startFromRow1);
//   const effectiveSkipPreviouslyProcessed = shouldSkipPreviouslyProcessed && !startFromRow1;
//   const fileTypeFilter = (options.fileType || '').toLowerCase();
//   const skipPdfImages = Boolean(options.skipPdfImages);

//   if (startFromRow1) {
//     if (processAssets) {
//       checkpoint.assetsLastProcessedRow = 0;
//       checkpoint.lastProcessedRow = 0;
//     }
//     if (processPages) {
//       checkpoint.pagesLastProcessedRow = 0;
//     }
//     await saveCheckpoint(checkpoint);
//     logInfo('InfoSearch.checkpointResetForStartFromRow1', {
//       requestedType,
//       checkpoint
//     });
//   }

//   const trackers = effectiveSkipPreviouslyProcessed
//     ? await loadProcessedUniqueIds()
//     : { assets: new Set(), pages: new Set() };
//   const notLoadedAssetsMap = await loadNotLoadedAssets();
//   const existingAssetUniqueIdCache = new Map();

//   let assetsRow = 0;
//   let pagesRow = 0;

//   setInfoSearchLogging(options.enableLogging !== false);
//   logInfo('InfoSearch.batchOptionsResolved', {
//     requestedType,
//     requestedUniqueId,
//     deleteExistingData: Boolean(options.deleteExistingData),
//     fileTypeFilter: fileTypeFilter || null,
//     skipPdfImages,
//     startFromRow1,
//     shouldSkipPreviouslyProcessed,
//     effectiveSkipPreviouslyProcessed,
//     enableLogging: options.enableLogging !== false,
//     checkpoint
//   });

//   try {
//     const summary = {
//       assets: { processed: 0, skipped: 0, failed: 0, missing: 0, uploaded: 0, deleted: 0, preview: null },
//       pages: { processed: 0, skipped: 0, failed: 0, missing: 0, uploaded: 0, deleted: 0, preview: null }
//     };

//     if (options.deleteExistingData) {
//       if (processAssets) {
//         summary.assets.deleted += await deleteDocumentsFromIndex('infosource_assets', { reason: 'fullRefresh' });
//       }
//       if (processPages) {
//         summary.pages.deleted += await deleteDocumentsFromIndex('infosource_pages', { reason: 'fullRefresh' });
//       }
//     }

//     const assetsCsv = path.join(process.cwd(), 'infoSourceData', 'all_assets_2025-12-03.csv');
//     const pagesCsv = path.join(process.cwd(), 'infoSourceData', 'all_pages_2025-12-03.csv');

//     if (processAssets) {
//       await readCsvRows(assetsCsv, async (row) => {
//         assetsRow += 1;
//         if (effectiveSkipPreviouslyProcessed && assetsRow <= checkpoint.assetsLastProcessedRow) {
//           return;
//         }

//         const rowUniqueId = getAssetRowUniqueId(row);
//         const rowTrackingKey = toTrackingKey(rowUniqueId || '');
//         if (requestedUniqueIdKey && rowTrackingKey !== requestedUniqueIdKey) {
//           return;
//         }

//         if (rowUniqueId) {
//           let existsInSearch = existingAssetUniqueIdCache.get(rowTrackingKey);
//           if (existsInSearch === undefined) {
//             existsInSearch = await doesAssetUniqueIdExistInSearch(rowUniqueId);
//             existingAssetUniqueIdCache.set(rowTrackingKey, existsInSearch);
//           }

//           if (existsInSearch) {
//             summary.assets.skipped += 1;
//             logInfo('InfoSearch.assetSkippedByExistingUniqueIdInSearch', { uniqueId: rowUniqueId, row: assetsRow });
//             checkpoint.assetsLastProcessedRow = assetsRow;
//             checkpoint.lastProcessedRow = assetsRow;
//             await saveCheckpoint(checkpoint);
//             return;
//           }
//         }

//         if (effectiveSkipPreviouslyProcessed && rowTrackingKey && trackers.assets.has(rowTrackingKey)) {
//           summary.assets.skipped += 1;
//           logInfo('InfoSearch.assetSkippedByProcessedUniqueId', { uniqueId: rowUniqueId, row: assetsRow });
//           checkpoint.assetsLastProcessedRow = assetsRow;
//           checkpoint.lastProcessedRow = assetsRow;
//           await saveCheckpoint(checkpoint);
//           return;
//         }

//         const processedWithTracking = await processAssetRow(row, summary, {
//           fileTypeFilter,
//           skipPdfImages,
//           notLoadedAssetsMap
//         });
//         if (processedWithTracking && rowTrackingKey) {
//           trackers.assets.add(rowTrackingKey);
//           if (effectiveSkipPreviouslyProcessed) {
//             await persistProcessedUniqueIds(trackers);
//           }
//         }

//         checkpoint.assetsLastProcessedRow = assetsRow;
//         checkpoint.lastProcessedRow = assetsRow;
//         await saveCheckpoint(checkpoint);
//       });
//     }

//     if (processPages) {
//       await readCsvRows(pagesCsv, async (row) => {
//         pagesRow += 1;
//         if (effectiveSkipPreviouslyProcessed && pagesRow <= checkpoint.pagesLastProcessedRow) {
//           return;
//         }

//         const rowUniqueId = getPageRowUniqueId(row);
//         const rowTrackingKey = toTrackingKey(rowUniqueId || '');
//         if (requestedUniqueIdKey && rowTrackingKey !== requestedUniqueIdKey) {
//           return;
//         }

//         if (effectiveSkipPreviouslyProcessed && rowTrackingKey && trackers.pages.has(rowTrackingKey)) {
//           summary.pages.skipped += 1;
//           logInfo('InfoSearch.pageSkippedByProcessedUniqueId', { uniqueId: rowUniqueId, row: pagesRow });
//           checkpoint.pagesLastProcessedRow = pagesRow;
//           await saveCheckpoint(checkpoint);
//           return;
//         }

//         const processed = await processPageRow(row, summary, {});
//         if (processed && rowTrackingKey) {
//           trackers.pages.add(rowTrackingKey);
//           if (effectiveSkipPreviouslyProcessed) {
//             await persistProcessedUniqueIds(trackers);
//           }
//         }

//         checkpoint.pagesLastProcessedRow = pagesRow;
//         await saveCheckpoint(checkpoint);
//       });
//     }

//     if (effectiveSkipPreviouslyProcessed) {
//       await persistProcessedUniqueIds(trackers);
//     }
//     await persistNotLoadedAssets(notLoadedAssetsMap);
//     logInfo('InfoSearch.notLoadedAssetsPersisted', {
//       path: NOT_LOADED_ASSETS_PATH,
//       total: notLoadedAssetsMap.size
//     });

//     return summary;
//   } finally {
//     checkpoint.lastProcessedRow = checkpoint.assetsLastProcessedRow;
//     await saveCheckpoint(checkpoint);
//   }
// }

// export async function runInfoSearchBatch(options = {}) {
//   assertCliOptions(options);
//   return runBatch(options);
// }

// const isCliEntryPoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

// if (isCliEntryPoint) {
//   const cliOptions = parseCliArgs(process.argv.slice(2));

//   if (cliOptions.help) {
//     showUsage();
//     process.exit(0);
//   }

//   runInfoSearchBatch(cliOptions).catch((error) => {
//     logError('InfoSearch.batchFailed', {
//       filters: {
//         type: cliOptions.type || 'all',
//         uniqueId: cliOptions.uniqueId || 'all'
//       }
//     }, error);
//     process.exitCode = 1;
//   });
// }

// export { getSearchClient };

// export async function getBreakdownByFileType(indexName = 'infosource_assets') {
//   const client = await getSearchClient(indexName);

//   const alphaNumChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
//   const fileTypeUniqueIds = new Map();
//   const extractedDocsByKey = new Map();
//   const extractedDocsPath = path.join(process.cwd(), 'logs', 'cognitive-search-results', 'infosource-assets-extracted-docs.json');

//   const resolveDocumentPath = (document = {}) => {
//     return document.document_path || document.path || document.documentPath || null;
//   };

//   const getFileTypeFromPath = (documentPath) => {
//     const normalizedPath = String(documentPath || '').split('?')[0].split('#')[0];
//     const extension = (path.extname(normalizedPath) || '').replace('.', '').toLowerCase();
//     return extension || 'unknown';
//   };

//   const addToBreakdown = (document = {}) => {
//     const resolvedPath = resolveDocumentPath(document);
//     const uniqueId = String(document.unique_id || 'unknown');
//     const fileType = getFileTypeFromPath(resolvedPath);

//     const docId = document.id || null;
//     const extractedDoc = {
//       id: docId,
//       document_path: resolvedPath,
//       unique_id: uniqueId
//     };
//     const dedupeKey = docId || `${uniqueId}|${resolvedPath || 'null'}`;
//     extractedDocsByKey.set(dedupeKey, extractedDoc);

//     if (!fileTypeUniqueIds.has(fileType)) {
//       fileTypeUniqueIds.set(fileType, new Set());
//     }
//     fileTypeUniqueIds.get(fileType).add(uniqueId);
//   };

//   const isSkipLimitError = (error) => {
//     const message = error?.message || '';
//     return /Parameter name:\s*\$skip/i.test(message)
//       || /Value must be between 0 and 100000/i.test(message);
//   };

//   const escapeODataValue = (value = '') => String(value).replace(/'/g, "''");

//   const nextPrefix = (prefix = '') => {
//     if (!prefix) {
//       return null;
//     }
//     const chars = prefix.split('');
//     const last = chars[chars.length - 1];
//     const next = String.fromCharCode(last.charCodeAt(0) + 1);
//     chars[chars.length - 1] = next;
//     return chars.join('');
//   };

//   const buildPrefixRangeFilter = (prefix) => {
//     const lower = escapeODataValue(prefix);
//     const upper = escapeODataValue(nextPrefix(prefix));
//     return `unique_id ne null and unique_id ge '${lower}' and unique_id lt '${upper}'`;
//   };

//   const runScanForFilter = async (filter) => {
//     const iterator = await client.search('*', {
//       filter
//     });

//     for await (const result of iterator.results) {
//       addToBreakdown(result?.document || {});
//     }
//   };

//   const scanPrefix = async (prefix, depth = 1) => {
//     const filter = buildPrefixRangeFilter(prefix);
//     try {
//       await runScanForFilter(filter);
//     } catch (error) {
//       if (isSkipLimitError(error) && depth < 2) {
//         for (const nextChar of alphaNumChars) {
//           await scanPrefix(`${prefix}${nextChar}`, depth + 1);
//         }
//         return;
//       }
//       throw error;
//     }
//   };

//   try {
//     for (const prefix of alphaNumChars) {
//       await scanPrefix(prefix);
//     }

//     const alphaNumRanges = alphaNumChars
//       .map((char) => {
//         const lower = escapeODataValue(char);
//         const upper = escapeODataValue(nextPrefix(char));
//         return `(unique_id ge '${lower}' and unique_id lt '${upper}')`;
//       })
//       .join(' or ');
//     const nonAlphaNumFilter = `unique_id eq null or not (${alphaNumRanges})`;
//     await runScanForFilter(nonAlphaNumFilter);

//     // Format as: one row per file type with distinct unique_id count.
//     const formattedResult = Array.from(fileTypeUniqueIds.entries())
//       .map(([fileType, uniqueIds]) => ({
//         fileType,
//         uniqueIdCount: uniqueIds.size
//       }))
//       .sort((a, b) => b.uniqueIdCount - a.uniqueIdCount);

//     const extractedDocs = Array.from(extractedDocsByKey.values());
//     await fsPromises.mkdir(path.dirname(extractedDocsPath), { recursive: true });
//     await fsPromises.writeFile(
//       extractedDocsPath,
//       JSON.stringify({
//         indexName,
//         extractedAt: new Date().toISOString(),
//         totalDocs: extractedDocs.length,
//         documents: extractedDocs
//       }, null, 2),
//       'utf-8'
//     );

//     logInfo('InfoSearch.getBreakdownByFileTypeResult', {
//       indexName,
//       resultCount: formattedResult.length,
//       extractedDocsPath,
//       extractedDocCount: extractedDocs.length,
//       breakdown: formattedResult
//     });

//     return formattedResult;
//   } catch (error) {
//     logError('InfoSearch.getBreakdownByFileTypeFailed', { indexName }, error);
//     throw error;
//   }
// }
