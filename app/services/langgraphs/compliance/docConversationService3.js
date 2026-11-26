/**
 * docConversationService3.js
 *
 * Alternative document conversation preparation service that uses the LLM-driven
 * topic segmentation approach from src-txt/analyze.js instead of the two-phase
 * heuristic approach in docConversationService2.js.
 *
 * Key differences from service2:
 * - PDF segmentation: sends all font-annotated spans to GPT-4o in one call
 *   (or batched for large PDFs) and lets the model decide topic boundaries.
 * - Flat sections only — no hierarchy (level/parentId/root/children are null/empty).
 * - No HierarchyNode documents written to MongoDB.
 *
 * Retained from service2:
 * - SharePoint retrieval via Microsoft Graph API → Azure Blob Storage
 * - Embedding generation with dynamic batching
 * - Azure AI Search indexing into geisinger-002
 * - MongoDB GeisingerConversation lifecycle (create/status/cleanup)
 * - DOCX support via docConversationWordSupportService
 * - Config loading from GeisingerConfig collection
 */

import { connectToDatabase } from '@/db/connection';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { BlobServiceClient } from '@azure/storage-blob';
import { AzureOpenAI } from "openai";
import PDFParser from 'pdf2json';
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { selectGeisingerConfigContextDocuments } from '@/app/services/geisingerConfigService';
import { extractDocxStructure } from '@/app/services/langgraphs/compliance/docConversationWordSupportService';
import { loadPreparationConfigV1, DEFAULT_PREPARATION_CONFIG_V1 } from '@/app/services/langgraphs/compliance/helpers/loadPreparationConfigV1';
import {
  streamSharePointFileForPreparation,
} from '@/app/services/langgraphs/compliance/sharePointPreparationAcquisitionService';
// Progress tracking helpers
import { updateChatInteractionProgress, createProgressMarkdown } from './helpers/progressTracking.js';

const BACKGROUND_JOB_TYPE = 'BackgroundJob';
const ADMIN_PREPARATION_JOB_TYPE = 'GeisingerDocumentPreparation';
const GEISINGER_COLLECTION = 'user_collection';

function logConversationEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function escapeODataString(value) {
  return String(value || '').replace(/'/g, "''");
}

async function collectLegacySearchDocumentIdsByFilter({
  searchClient,
  filter,
  top = 1000,
  maxScan = 50000,
}) {
  const ids = [];
  let skip = 0;

  while (ids.length < maxScan) {
    const searchResults = await searchClient.search('*', {
      filter,
      select: ['id'],
      top,
      skip,
    });

    let pageCount = 0;
    for await (const result of searchResults.results) {
      const id = normalizeString(result?.document?.id);
      if (id) {
        ids.push(id);
        pageCount += 1;
      }
    }

    if (pageCount === 0 || pageCount < top) {
      break;
    }

    skip += top;
  }

  return Array.from(new Set(ids)).slice(0, maxScan).map((id) => ({ id }));
}

function normalizePreparationVersion(value) {
  if (value === null || value === undefined) return null;
  const version = String(value).trim();
  return version || null;
}

let configuredPreparationVersionSingleton = null;

async function fetchPreparationConfigDocumentsForVersion() {
  const collectionNames = ['Document Preparation Config', 'Geisinger Preparation'];
  const all = [];
  const seen = new Set();

  for (const collectionName of collectionNames) {
    try {
      const { data } = await selectGeisingerConfigContextDocuments({
        type: 'GeisingerConfig',
        collectionName,
      });

      for (const doc of Array.isArray(data) ? data : []) {
        const documentText = String(doc?.documentText || '').trim();
        if (!documentText) continue;

        const key = String(doc?.id || `${collectionName}:${doc?.title || ''}`).trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        all.push({ ...doc, documentText });
      }
    } catch (error) {
      logConversationEvent('fetchPreparationConfigDocumentsForVersionFailed', {
        collectionName,
        error: error?.message || String(error),
      });
    }
  }

  return all;
}

async function getConfiguredPreparationVersion(options = {}) {
  const reset = !!options?.reset;
  if (!reset && configuredPreparationVersionSingleton) {
    return configuredPreparationVersionSingleton;
  }

  try {
    const geisingerConfigDocuments = await fetchPreparationConfigDocumentsForVersion();
    const snapshot = await loadPreparationConfigV1({ geisingerConfigDocuments });
    const runtime = snapshot?.config?.runtime || DEFAULT_PREPARATION_CONFIG_V1.runtime;
    const envVarName = String(runtime?.preparationVersion?.envVar || 'GEISINGER_PREPARATION_VERSION').trim() || 'GEISINGER_PREPARATION_VERSION';
    const defaultValue = String(runtime?.preparationVersion?.defaultValue || '1').trim() || '1';

    configuredPreparationVersionSingleton = String(process.env[envVarName] || defaultValue).trim() || '1';
    return configuredPreparationVersionSingleton;
  } catch (error) {
    logConversationEvent('getConfiguredPreparationVersionFailed', {
      error: error?.message || String(error),
    });
    configuredPreparationVersionSingleton = String(process.env.GEISINGER_PREPARATION_VERSION || '1').trim() || '1';
    return configuredPreparationVersionSingleton;
  }
}

function toNumericVersion(value) {
  const normalized = normalizePreparationVersion(value);
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function isAtOrAbovePreparationVersion(value, minimumPreparationVersion = '1') {
  const normalized = normalizePreparationVersion(value);
  const minVersion = normalizePreparationVersion(minimumPreparationVersion) || '1';

  // Backward compatibility: older records may not have preparationVersion.
  if (!normalized) {
    return minVersion === '1';
  }

  const docNumeric = toNumericVersion(normalized);
  const minNumeric = toNumericVersion(minVersion);
  if (docNumeric !== null && minNumeric !== null) {
    return docNumeric >= minNumeric;
  }

  // Non-numeric versions fallback to exact compare.
  return normalized === minVersion;
}

function normalizeConversationStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isEquivalentPreparedStatus(actualStatus, requestedStatus) {
  const actual = normalizeConversationStatus(actualStatus);
  const requested = normalizeConversationStatus(requestedStatus);
  if (!requested) return true;

  // Historical records may use either Complete or Prepared for ready documents.
  const readyStates = new Set(['complete', 'prepared']);
  if (readyStates.has(requested)) {
    return readyStates.has(actual);
  }

  return actual === requested;
}

function buildLookupStatusBreakdown(conversations = []) {
  return conversations.reduce((acc, doc) => {
    const key = normalizeConversationStatus(doc?.status) || 'missing';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildLookupVersionBreakdown(conversations = []) {
  return conversations.reduce((acc, doc) => {
    const key = normalizePreparationVersion(doc?.preparationVersion) || 'missing';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildConversationKey(fileAName, relativeAUrl) {
  const normalizedName = String(fileAName || '').trim().toLowerCase();
  const normalizedUrl = String(relativeAUrl || '').trim().toLowerCase();
  if (!normalizedName || !normalizedUrl) return '';
  return `${normalizedUrl}::${normalizedName}`;
}

function countNestedSubsections(sections = []) {
  if (!Array.isArray(sections) || sections.length === 0) return 0;
  let count = 0;
  for (const section of sections) {
    const subsections = Array.isArray(section?.subsections) ? section.subsections : [];
    count += subsections.length;
    count += countNestedSubsections(subsections);
  }
  return count;
}

function computeChunkCharStats(chunks = []) {
  const lengths = (Array.isArray(chunks) ? chunks : [])
    .map((chunk) => String(chunk?.content || '').length)
    .filter((len) => Number.isFinite(len) && len >= 0)
    .sort((a, b) => a - b);

  if (lengths.length === 0) {
    return {
      averageChunkChars: 0,
      p95ChunkChars: 0,
      maxChunkChars: 0,
      minChunkChars: 0,
    };
  }

  const sum = lengths.reduce((acc, len) => acc + len, 0);
  const p95Index = Math.min(lengths.length - 1, Math.floor(lengths.length * 0.95));

  return {
    averageChunkChars: Math.round(sum / lengths.length),
    p95ChunkChars: lengths[p95Index],
    maxChunkChars: lengths[lengths.length - 1],
    minChunkChars: lengths[0],
  };
}

function normalizeHeadingProbe(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTemporarySection722Evidence(fullStructure = []) {
  const target = '7.2.2. second level complaint process';
  const matches = (Array.isArray(fullStructure) ? fullStructure : [])
    .filter((chunk) => {
      const heading = normalizeHeadingProbe(chunk?.heading || '');
      const content = normalizeHeadingProbe(chunk?.content || '');
      return heading.includes(target) || content.includes(target);
    })
    .map((chunk) => ({
      id: chunk?.id || null,
      heading: chunk?.heading || null,
      page: Number.isFinite(Number(chunk?.page)) ? Number(chunk.page) : null,
      contentPreview: String(chunk?.content || '').slice(0, 240),
    }));

  return {
    target,
    matchCount: matches.length,
    matches: matches.slice(0, 5),
  };
}

function splitConversationKey(key) {
  const normalized = String(key || '').trim().toLowerCase();
  if (!normalized) {
    return { relativeAUrl: '', fileAName: '' };
  }
  const [relativeAUrl = '', fileAName = ''] = normalized.split('::');
  return { relativeAUrl, fileAName };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeInferredLob(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.toLowerCase() === 'aca') return 'Marketplace';
  return raw;
}

function getInferredLobAliases(value) {
  const normalized = normalizeInferredLob(value);
  if (!normalized) return [];
  if (normalized.toLowerCase() === 'marketplace') {
    // Keep compatibility with historical records that may still store ACA.
    return ['Marketplace', 'ACA'];
  }
  return [normalized];
}

function toTimestamp(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getMostRecentJob(jobs = []) {
  if (!Array.isArray(jobs) || jobs.length === 0) return null;
  return [...jobs].sort((a, b) => {
    const aTime = Math.max(toTimestamp(a?.updatedAt), toTimestamp(a?.createdAt));
    const bTime = Math.max(toTimestamp(b?.updatedAt), toTimestamp(b?.createdAt));
    return bTime - aTime;
  })[0];
}

async function getLatestAdminPreparedInventory(teamName, inferredLob) {
  const currentPreparationVersion = await getConfiguredPreparationVersion();
  const normalizedTeamName = String(teamName || '').trim();
  const normalizedLob = normalizeInferredLob(inferredLob).toLowerCase();
  const normalizedAliases = new Set(
    getInferredLobAliases(inferredLob).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
  );
  if (!normalizedTeamName || !normalizedLob) return null;

  const teamDb = await connectToDatabase(`team-${normalizedTeamName}-db`);
  const jobs = await teamDb.collection('user_collection').find({
    type: BACKGROUND_JOB_TYPE,
    jobType: ADMIN_PREPARATION_JOB_TYPE,
  }).toArray();

  const latestJob = getMostRecentJob(jobs);
  if (!latestJob) {
    return {
      teamName: normalizedTeamName,
      hasJob: false,
      applyFilter: false,
      preparedConversationIds: new Set(),
      preparedConversationKeys: new Set(),
      preparedItems: [],
      preparedItemsCount: 0,
      jobId: null,
    };
  }

  const items = Array.isArray(latestJob?.items) ? latestJob.items : [];
  const lobItems = items.filter((item) => {
    const itemLob = String(item?.lob || '').trim().toLowerCase();
    if (!itemLob) return false;
    return normalizedAliases.has(itemLob);
  });

  const currentVersionLobItems = lobItems.filter((item) => (
    isAtOrAbovePreparationVersion(item?.preparationVersion, currentPreparationVersion)
  ));

  const preparedItems = currentVersionLobItems.filter((item) => {
    const itemStatus = String(item?.status || '').trim().toLowerCase();
    if (itemStatus !== 'prepared') return false;
    return true;
  });

  const preparedConversationIds = new Set();
  const preparedConversationKeys = new Set();
  const normalizedPreparedItems = [];

  preparedItems.forEach((item) => {
    const conversationId = String(item?.conversationId || '').trim();
    const fileAName = String(item?.fileAName || '').trim();
    const relativeAUrl = String(item?.relativeAUrl || '').trim();
    const itemLob = String(item?.lob || '').trim();
    const preparationVersion = normalizePreparationVersion(item?.preparationVersion) || currentPreparationVersion;
    const preparedAt = item?.preparedAt || item?.lastUpdatedAt || latestJob?.updatedAt || latestJob?.createdAt || null;

    if (conversationId) {
      preparedConversationIds.add(conversationId);
    }

    const key = buildConversationKey(fileAName, relativeAUrl);
    if (key) {
      preparedConversationKeys.add(key);
    }

    normalizedPreparedItems.push({
      conversationId,
      fileAName,
      relativeAUrl,
      lob: itemLob,
      status: 'Complete',
      preparationVersion,
      preparedAt,
      updatedAt: preparedAt,
      createdAt: preparedAt,
    });
  });

  return {
    teamName: normalizedTeamName,
    hasJob: true,
    applyFilter: lobItems.length > 0,
    preparedConversationIds,
    preparedConversationKeys,
    preparedItems: normalizedPreparedItems,
    lobItemsCount: lobItems.length,
    currentVersionLobItemsCount: currentVersionLobItems.length,
    preparedItemsCount: preparedItems.length,
    jobId: latestJob?.id || null,
  };
}

function matchesPreparedInventory(doc, preparedInventory, requestedStatus) {
  const requested = normalizeConversationStatus(requestedStatus);

  // For GeisingerContext selection lists (Complete/Prepared), return all LOB docs that pass
  // status+version checks instead of narrowing to only the latest job's item set.
  if (requested === 'complete' || requested === 'prepared') {
    return true;
  }

  if (!preparedInventory?.applyFilter) return true;

  const id = String(doc?.id || '').trim();
  if (id && preparedInventory.preparedConversationIds.has(id)) return true;

  const key = buildConversationKey(doc?.fileAName, doc?.relativeAUrl);
  if (key && preparedInventory.preparedConversationKeys.has(key)) return true;

  return false;
}

function createConversationCompletionMarkdown(conversation) {
  if (!conversation) {
    return '✅ **Document Ready**\n\nThe conversation file has finished processing and is now available.';
  }
  const fileName = conversation.fileAName || conversation.fileName || conversation.title || 'Conversation Document';
  const relativeUrl = conversation.relativeAUrl || conversation.relativeUrl || '';
  const lob = conversation.lob || '';
  let body = `✅ **Document Ready**\n\nThe conversation file **${fileName}** has finished processing and is now available.\n\n- Status: Complete`;
  if (lob) {
    body += `\n- LOB: ${lob}`;
  }
  if (relativeUrl) {
    body += `\n- Source: ${relativeUrl}`;
  }
  body += '\nYou can now ask follow-up questions about this document.';
  return body;
}

function normalizeRequiredTeamName(teamName) {
  const normalized = String(teamName || '').trim();
  if (!normalized) {
    throw new Error('teamName is required for Geisinger conversation preparation.');
  }
  return normalized;
}

// ─── Singleton clients (shared with service2 pattern) ─────────────────────────

let containerClientSingleton = null;
function getContainerClient() {
  if (!containerClientSingleton) {
    const envName = process.env['envName'];
    const connectionStringKey = `host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.blobstorage.endpoint`;
    const BLOB_STORAGE_CONNECTION_STRING = process.env[connectionStringKey];
    if (!BLOB_STORAGE_CONNECTION_STRING) {
      console.error('❌ [getContainerClient] Blob storage connection string is empty or undefined');
      throw new Error(`Blob storage connection string not found for key: ${connectionStringKey}`);
    }
    const BLOB_CONTAINER = 'compliance-ai';
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_STORAGE_CONNECTION_STRING);
      containerClientSingleton = blobServiceClient.getContainerClient(BLOB_CONTAINER);
    } catch (error) {
      console.error('❌ [getContainerClient] Failed to create blob storage client:', error.message);
      throw error;
    }
  }
  return containerClientSingleton;
}

let embeddingsClient = null;
function getEmbeddingsClient() {
  if (!embeddingsClient) {
    const envName = process.env['envName'];
    const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
    const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const embeddingsDeployment = "gpt-4o-aisvc";
    const embeddingsDeploymentAPIiVersion = "2023-05-15";
    embeddingsClient = new AzureOpenAI({
      apiVersion: embeddingsDeploymentAPIiVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment: embeddingsDeployment
    });
  }
  return embeddingsClient;
}

let completionsClient = null;
async function getCompletionsClient() {
  if (!completionsClient) {
    const envName = process.env['envName'];
    const completionsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.completionsEndpoint`];
    const completionsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const completionsDeployment = (envName === 'pp') ? 'gpt-4o' : 'gpt-4o-aisvc';
    const completionsDeploymentAPIiVersion = "2024-08-01-preview";
    completionsClient = new AzureOpenAI({
      apiVersion: completionsDeploymentAPIiVersion,
      endpoint: completionsEndpoint,
      apiKey: completionsAPIKey,
      deployment: completionsDeployment
    });
  }
  return completionsClient;
}

let searchClients = {};
function getSearchClient(searchIndex) {
  if (!searchClients[searchIndex]) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];
    searchClients[searchIndex] = new SearchClient(
      searchEndpoint,
      searchIndex,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClients[searchIndex];
}

let updateClients = {};
function getUpdateClient(indexName) {
  if (!updateClients[indexName]) {
    const envName = process.env['envName'];
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`];
    updateClients[indexName] = new SearchClient(
      searchEndpoint,
      indexName,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return updateClients[indexName];
}

// ─── Geisinger Config (singleton) ─────────────────────────────────────────────

let geisingerConfigSingleton = null;
async function getGeisingerConfig(reset = false) {
  if (reset) geisingerConfigSingleton = null;
  if (geisingerConfigSingleton) return geisingerConfigSingleton;
  const query = { type: 'GeisingerConfig', collectionName: 'Document Conversation', purpose: 'GeneralConfig', title: 'Document Conversation Config For Conversation Prepare' };
  const { data: docs } = await selectGeisingerConfigContextDocuments(query);
  const firstDoc = Array.isArray(docs) ? docs[0] : null;
  const text = String(firstDoc?.documentText || '').trim();

  if (!text) {
    console.warn(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getGeisingerConfigMissingDocument',
        detail: {
          query,
        },
      }
    }));
    geisingerConfigSingleton = {};
    return geisingerConfigSingleton;
  }

  let config = {};
  try {
    const jsonSchemaMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonSchemaMatch && jsonSchemaMatch[1]) {
      config = JSON.parse(jsonSchemaMatch[1]);
    }
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'getGeisingerConfigParseError',
        detail: {
          query,
          error: error?.message || String(error),
        },
      }
    }));
    config = {};
  }

  geisingerConfigSingleton = config;
  return geisingerConfigSingleton;
}

// ─── PDF Analyzer-style segmentation (ported from src-txt/analyze.js) ─────────

/**
 * Downloads a blob to a temp file and parses it with pdf2json in raw text mode.
 * @param {string} blobName - Blob path in the compliance-ai container
 * @returns {Promise<object>} - pdf2json raw pdfData
 */
async function parsePdfFromBlob(blobName) {
  const path = require('path');
  const os = require('os');
  const fs = require('fs');

  const containerClient = getContainerClient();
  const blobClient = containerClient.getBlobClient(blobName);
  const downloadResponse = await blobClient.download();

  const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${path.basename(blobName)}`);
  const writable = fs.createWriteStream(tempFilePath);

  await new Promise((resolve, reject) => {
    downloadResponse.readableStreamBody.pipe(writable);
    writable.on('finish', resolve);
    writable.on('error', (error) => {
      console.error('❌ [parsePdfFromBlob] Temp file write failed:', error.message);
      reject(error);
    });
  });

  const parser = new PDFParser(null, 1); // 1 = raw text mode (same as analyzer)
  const pdfData = await new Promise((resolve, reject) => {
    parser.on('pdfParser_dataError', (err) => reject(err.parserError || err));
    parser.on('pdfParser_dataReady', (data) => resolve(data));
    parser.loadPDF(tempFilePath);
  });

  // Clean up temp file
  fs.unlinkSync(tempFilePath);

  return pdfData;
}

/**
 * Flattens pdf2json raw-mode output into an array of text spans with font metadata.
 * Each span carries: pageNumber, startIndex, endIndex, text, fontFaceId, fontSize, bold, italic
 * Ported directly from src-txt/analyze.js extractSpans()
 */
function extractSpans(pdfData) {
  const spans = [];
  let cursor = 0;

  pdfData.Pages.forEach((page, pageIdx) => {
    (page.Texts || []).forEach((textItem) => {
      (textItem.R || []).forEach((run) => {
        const text = decodeURIComponent(run.T);
        if (!text) return;

        const [fontFaceId, fontSize, boldFlag, italicFlag] = run.TS || [0, 12, 0, 0];

        spans.push({
          pageNumber: pageIdx + 1,
          startIndex: cursor,
          endIndex: cursor + text.length - 1,
          text,
          fontFaceId,
          fontSize,
          bold: boldFlag === 1,
          italic: italicFlag === 1,
        });

        cursor += text.length;
      });
    });
  });

  return spans;
}

const STATUTE_HEADING_REGEX = /^§\s*\d{2,}(?:\.\d+[a-z0-9-]*)*/i;

function shouldInjectStatuteHeadingSpace(prevText = '', nextText = '') {
  if (!prevText || !nextText) return false;
  if (/\s$/.test(prevText) || /^\s/.test(nextText)) return false;

  const trimmedPrev = prevText.replace(/\s+$/, '');
  const trimmedNext = nextText.replace(/^\s+/, '');
  if (!trimmedPrev || !trimmedNext) return false;

  if (trimmedPrev.endsWith('-')) return false;

  const match = trimmedPrev.match(STATUTE_HEADING_REGEX);
  if (!match) return false;

  const trailing = trimmedPrev.slice(match[0].length).trim();
  if (trailing.length > 0) return false;

  return /^[A-Za-z(]/.test(trimmedNext);
}

/**
 * Merges consecutive same-format spans to reduce token count.
 * Ported directly from src-txt/analyze.js mergeSpans()
 */
function mergeSpans(spans) {
  if (!spans.length) return [];
  const merged = [];
  let cur = { ...spans[0] };

  for (let i = 1; i < spans.length; i++) {
    const s = spans[i];
    if (
      s.pageNumber === cur.pageNumber &&
      s.fontFaceId === cur.fontFaceId &&
      s.fontSize === cur.fontSize &&
      s.bold === cur.bold &&
      s.italic === cur.italic
    ) {
      if (shouldInjectStatuteHeadingSpace(cur.text, s.text)) {
        cur.text += ' ';
      }
      cur.text += s.text;
      cur.endIndex = s.endIndex;
    } else {
      merged.push(cur);
      cur = { ...s };
    }
  }
  merged.push(cur);
  return merged;
}

/**
 * Serializes spans as compact pipe-delimited lines for GPT-4o.
 * Format: page|startIdx|endIdx|fFontId|sizept|fmt|text
 * Ported directly from src-txt/analyze.js spansToCompact()
 */
function spansToCompact(spans) {
  return spans
    .map((s) => {
      const fmt = (s.bold ? 'B' : '') + (s.italic ? 'I' : '') || '-';
      const text = s.text.replace(/\r?\n/g, ' ').trim();
      return `${s.pageNumber}|${s.startIndex}|${s.endIndex}|f${s.fontFaceId}|${s.fontSize}pt|${fmt}|${text}`;
    })
    .join('\n');
}

/**
 * Sends merged+compacted spans to GPT-4o for topic segmentation.
 * Adapted from src-txt/analyze.js segmentWithGPT() — uses the service's
 * completionsClient instead of a standalone Azure OpenAI client.
 *
 * @param {Array} mergedSpans - Already merged spans
 * @returns {Promise<Array>} - Array of { heading, summary, rationale, startIndex, endIndex, startPage }
 */
async function segmentWithGPT(mergedSpans) {
  const client = await getCompletionsClient();
  const compact = spansToCompact(mergedSpans);


  const headerInstructions = "Documents may contain repeated page headers or footers, which can be either boilerplate text or page-specific references. Ignore all such repeated elements entirely so they never become section content.";

  // Dynamic prompt and batch sizing based on document length
  const docLength = compact.length;
  let promptDepth = 'all';
  let sectionLimit = 30;
  let promptInstructions = '';
  if (docLength < 5000) {
    promptDepth = 'all';
    sectionLimit = 35;
    promptInstructions = `Find and enumerate ALL logical sections and subsections, even if they are small or closely spaced. HOWEVER, do NOT create a new section or subsection just because a document structure number, letter, or bullet (e.g., (a), (1), (4), A., B., etc.) appears. Only create a new section if the content clearly shifts topic or scope. If the text is a continuation, list item, or detail under the same topic, keep it within the current section. The content and meaning—not formatting or numbering—should drive the transition to a new section. For example, do NOT split out items like "(4) Content of request." as their own section unless they introduce a truly distinct topic. Merge all related bullet points or numbered items under their parent section. When sequential numbered paragraphs such as "156.330 (a)" through "(d)" stay on the same subject, keep them in one section unless both formatting and semantics clearly reset the topic. If a heading wraps across multiple spans with the same font/size and fewer than ~50 characters, stitch those spans together before deciding boundaries so the heading stays intact. ${headerInstructions}`;
  } else if (docLength < 15000) {
    promptDepth = 'main';
    sectionLimit = 35;
    promptInstructions = `Find only main sections and important subsections. Do NOT enumerate every small or closely spaced subsection. Do NOT create a new section or subsection just because a document structure number, letter, or bullet (e.g., (a), (1), (4), A., B., etc.) appears. Only create a new section if the content clearly shifts topic or scope. If the text is a continuation, list item, or detail under the same topic, keep it within the current section. The content and meaning—not formatting or numbering—should drive the transition to a new section. For example, do NOT split out items like "(4) Content of request." as their own section unless they introduce a truly distinct topic. Merge all related bullet points or numbered items under their parent section. When sequential numbered paragraphs such as "156.330 (a)" through "(d)" stay on the same subject, keep them in one section unless both formatting and semantics clearly reset the topic. If a heading wraps across multiple spans with the same font/size and fewer than ~50 characters, stitch those spans together before deciding boundaries so the heading stays intact. ${headerInstructions}`;
  } else {
    promptDepth = 'top';
    sectionLimit = 45;
    promptInstructions = `List only top-level sections (e.g., chapters or main headings). Do NOT break into subsections or enumerate every small section. Do NOT create a new section or subsection just because a document structure number, letter, or bullet (e.g., (a), (1), (4), A., B., etc.) appears. Only create a new section if the content clearly shifts topic or scope. If the text is a continuation, list item, or detail under the same topic, keep it within the current section. The content and meaning—not formatting or numbering—should drive the transition to a new section. For example, do NOT split out items like "(4) Content of request." as their own section unless they introduce a truly distinct topic. Merge all related bullet points or numbered items under their parent section. When sequential numbered paragraphs such as "156.330 (a)" through "(d)" stay on the same subject, keep them in one section unless both formatting and semantics clearly reset the topic. If a heading wraps across multiple spans with the same font/size and fewer than ~50 characters, stitch those spans together before deciding boundaries so the heading stays intact. ${headerInstructions}`;
  }

  const systemPrompt = `You are a document structure analyst. You receive parsed PDF text spans and identify logical topic sections based on formatting signals and content. You respond only with valid JSON arrays.`;

  const userPrompt = `Analyze this parsed PDF document broken into formatted text spans.\n\nEach line represents one span in this pipe-delimited format:\n  page|startIndex|endIndex|fontFaceId|fontSize|fmt|text\nWhere:\n  - page       = page number\n  - startIndex = character offset where this span begins in the full document\n  - endIndex   = character offset where this span ends\n  - fontFaceId = font identifier (f0, f1, f2 ... different IDs = different fonts)\n  - fontSize   = font size (e.g. 12pt, 18pt)\n  - fmt        = B (bold), I (italic), BI (both), - (neither)\n  - text       = the actual text content\n\n${promptInstructions} Limit the total number of sections (including subsections) to no more than ${sectionLimit} for this batch.\n\nIMPORTANT: If a section or subsection has a document structure number or letter (such as \"156.330\", \"A.\", \"(1)\", etc.), you MUST include that number or letter as part of the section or subsection heading/title. Do not omit or paraphrase these identifiers—preserve them exactly as they appear in the document. The title should be a combination of the section numbers or letters plus the summary title text. When multiple spans visually form one heading (same font/size and short combined length), concatenate them before evaluating the heading.\n\nUse font size, bold/italic flags, font-face changes, indentation, numbering, and text content to identify where topics and subtopics change. Sections and subsections can span multiple pages; do NOT force a break at every page boundary. If a span of text repeats on every page with identical wording and formatting (e.g., headers/footers), treat it as noise and exclude it from all sections.\n\nSPAN DATA:\n${compact}\n\nReturn ONLY a JSON array of section objects with exactly these fields:\n{\n  \"heading\": \"short descriptive title (must include any document structure number/letter if present)\",\n  \"summary\": \"1-2 sentence description of what the section covers (must add new detail beyond the heading text)\",\n  \"rationale\": \"brief explanation citing both formatting cues and semantic shifts that make this a distinct section\",\n  \"startIndex\": <startIndex of the first span in this section>,\n  \"endIndex\": <endIndex of the last span in this section>,\n  \"startPage\": <page number where this section begins>,\n  \"subsections\": [\n    {\n      \"heading\": \"short descriptive title (must include any document structure number/letter if present)\",\n      \"summary\": \"1-2 sentence description of what the subsection covers\",\n      \"rationale\": \"brief explanation of why this is a distinct subsection\",\n      \"startIndex\": <startIndex of the first span in this subsection>,\n      \"endIndex\": <endIndex of the last span in this subsection>,\n      \"startPage\": <page number where this subsection begins>\n    }\n    // ... more subsections as needed\n  ]\n}\nAlways include the \"subsections\" array (use [] when there are none) and ensure subsection headings preserve the numbering prefixes inherited from their parent.\n\nRules:\n- Sections and subsections must be contiguous and cover the entire document - no gaps, no overlaps. If a small portion of text would otherwise be orphaned, merge it with the closest logically related section instead of leaving a gap.\n- startIndex and endIndex values must be strictly increasing and cover the entire document range without duplicates.\n- Preserve document order and hierarchy.\n- Summaries must add substantive content beyond simply restating the heading.\n- Rationales must reference both the formatting signal (e.g., new font/size) and the semantic shift.\n- Return ONLY the raw JSON array - no markdown fences, no explanation.`;

  // Adjust max_tokens for LLM call based on document size
  let maxTokens = 8192;
  if (docLength < 5000) {
    maxTokens = 8192;
  } else if (docLength < 15000) {
    maxTokens = 6000;
  } else {
    maxTokens = 4000;
  }

  const response = await client.chat.completions.create({
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = response.choices[0].message.content.trim();
  // Defensive JSON extraction: find the first and last brackets and parse only that substring
  let cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[segmentWithGPT] primary JSON parse failed, attempting repair:', err.message);
    throw new Error(`Failed to parse GPT response as JSON: ${err.message}\nRaw response:\n${raw}`);
  }
}

/**
 * Estimates token count for a string (~4 chars per token).
 */
function estimateTokens(text) {
  if (typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

const DEFAULT_BATCH_TOKEN_LIMIT = 6000;
const MIN_BATCH_TOKEN_LIMIT = 2500;
const SEGMENT_BATCH_OVERLAP_PAGES = 2;
const MAX_SEGMENTATION_RETRIES = 3;
const SEGMENTATION_RETRY_BACKOFF = 0.6;

/**
 * Splits merged spans into page-range batches suitable for GPT-4o's context window.
 * Each batch is a contiguous set of pages whose compact representation fits within maxTokens.
 * Adjacent batches overlap by `overlapPages` pages so the model has context at boundaries.
 *
 * @param {Array} mergedSpans - Already merged spans (must have pageNumber)
 * @param {number} maxTokens - Max tokens per batch for the compact span data (default 6,000)
 * @param {number} overlapPages - Number of pages to overlap between batches (default 2)
 * @returns {Array<Array>} - Array of span batches
 */
function splitSpansIntoBatches(mergedSpans, maxTokens = DEFAULT_BATCH_TOKEN_LIMIT, overlapPages = SEGMENT_BATCH_OVERLAP_PAGES) {
  // Group spans by page
  const pageMap = new Map();
  for (const span of mergedSpans) {
    if (!pageMap.has(span.pageNumber)) {
      pageMap.set(span.pageNumber, []);
    }
    pageMap.get(span.pageNumber).push(span);
  }

  const pageNumbers = [...pageMap.keys()].sort((a, b) => a - b);

  // If everything fits in one batch, return a single batch
  const fullCompact = spansToCompact(mergedSpans);
  if (estimateTokens(fullCompact) <= maxTokens) {
    return [mergedSpans];
  }

  const batches = [];
  let startPageIdx = 0;

  while (startPageIdx < pageNumbers.length) {
    const batchSpans = [];
    let batchTokens = 0;
    let endPageIdx = startPageIdx;

    // Greedily add pages until we'd exceed the token budget
    while (endPageIdx < pageNumbers.length) {
      const pageSpans = pageMap.get(pageNumbers[endPageIdx]);
      const pageCompact = spansToCompact(pageSpans);
      const pageTokens = estimateTokens(pageCompact);

      if (batchSpans.length > 0 && batchTokens + pageTokens > maxTokens) {
        break;
      }

      batchSpans.push(...pageSpans);
      batchTokens += pageTokens;
      endPageIdx++;
    }

    batches.push(batchSpans);

    // Advance start, backing up by overlapPages for context continuity
    const pagesConsumed = endPageIdx - startPageIdx;
    const advance = Math.max(1, pagesConsumed - overlapPages);
    startPageIdx += advance;
  }

  return batches;
}

function forceSplitBatchByPageRange(batchSpans) {
  const pageSet = [...new Set(batchSpans.map(span => span.pageNumber))].sort((a, b) => a - b);
  if (pageSet.length <= 1) {
    return [];
  }
  const midpoint = Math.floor(pageSet.length / 2);
  const firstPages = new Set(pageSet.slice(0, midpoint));
  const secondPages = new Set(pageSet.slice(midpoint));
  const firstBatch = batchSpans.filter(span => firstPages.has(span.pageNumber));
  const secondBatch = batchSpans.filter(span => secondPages.has(span.pageNumber));
  if (!firstBatch.length || !secondBatch.length) {
    return [];
  }
  return [firstBatch, secondBatch];
}

/**
 * Merges sections from overlapping batches. When two adjacent batches overlap in
 * page range, sections from the later batch that start within the overlap zone
 * are discarded in favor of the earlier batch's sections.
 *
 * @param {Array<Array>} batchSections - Array of section arrays, one per batch
 * @returns {Array} - Deduplicated, merged section array
 */
function mergeBatchSections(batchSections) {
  if (batchSections.length === 0) return [];
  if (batchSections.length === 1) return batchSections[0];

  let merged = [...batchSections[0]];

  for (let b = 1; b < batchSections.length; b++) {
    const prevLastEndIndex = merged.length > 0 ? merged[merged.length - 1].endIndex : -1;
    const incoming = batchSections[b];

    // Find the first section in the incoming batch that starts AFTER the
    // last merged section's endIndex (i.e. no overlap)
    let startIdx = 0;
    for (let i = 0; i < incoming.length; i++) {
      if (incoming[i].startIndex > prevLastEndIndex) {
        startIdx = i;
        break;
      }
      // If this is the last section and it still overlaps, we might need
      // to adjust the previous batch's last section endIndex
      if (i === incoming.length - 1) {
        startIdx = incoming.length; // skip all — fully overlapped
      }
    }

    // Extend the last merged section to meet the first non-overlapping incoming section
    if (startIdx < incoming.length && merged.length > 0) {
      const gap = incoming[startIdx].startIndex - merged[merged.length - 1].endIndex;
      if (gap > 1) {
        // There's a gap — extend previous section to cover it
        merged[merged.length - 1].endIndex = incoming[startIdx].startIndex - 1;
      }
    }

    merged.push(...incoming.slice(startIdx));
  }

  return merged;
}

async function segmentBatchWithRetry(batchSpans, attempt = 1) {
  try {
    return await segmentWithGPT(batchSpans);
  } catch (error) {
    const isJsonParseError = /Failed to parse GPT response as JSON/i.test(error.message);
    if (!isJsonParseError || attempt >= MAX_SEGMENTATION_RETRIES) {
      throw error;
    }

    const nextTokenBudget = Math.max(
      Math.floor(DEFAULT_BATCH_TOKEN_LIMIT * Math.pow(SEGMENTATION_RETRY_BACKOFF, attempt)),
      MIN_BATCH_TOKEN_LIMIT
    );
    console.warn(`⚠️ [segmentBatchWithRetry] Attempt ${attempt} failed (${error.message}). Retrying with batches limited to ~${nextTokenBudget} tokens.`);

    let smallerBatches = splitSpansIntoBatches(batchSpans, nextTokenBudget, Math.max(1, SEGMENT_BATCH_OVERLAP_PAGES - 1));
    if (smallerBatches.length <= 1) {
      const forced = forceSplitBatchByPageRange(batchSpans);
      if (forced.length > 1) {
        smallerBatches = forced;
      } else {
        throw error;
      }
    }

    const nestedSections = [];
    for (const smaller of smallerBatches) {
      nestedSections.push(await segmentBatchWithRetry(smaller, attempt + 1));
    }
    return mergeBatchSections(nestedSections);
  }
}

/**
 * Extracts the raw text content for a section from the original spans using character offsets.
 *
 * @param {Array} spans - Original (unmerged) spans with startIndex/endIndex/text
 * @param {number} sectionStartIndex - Section's startIndex
 * @param {number} sectionEndIndex - Section's endIndex
 * @returns {string} - Concatenated text content for the section
 */
function extractSectionText(spans, sectionStartIndex, sectionEndIndex) {
  const parts = [];
  let covered = 0;
  for (const span of spans) {
    // Skip spans entirely outside this section
    if (span.endIndex < sectionStartIndex || span.startIndex > sectionEndIndex) continue;

    // Calculate substring boundaries within this span
    const spanRelStart = Math.max(0, sectionStartIndex - span.startIndex);
    const spanRelEnd = Math.min(span.text.length, sectionEndIndex - span.startIndex + 1);
    // Defensive: If spanRelEnd <= spanRelStart, skip (shouldn't happen)
    if (spanRelEnd > spanRelStart) {
      parts.push(span.text.substring(spanRelStart, spanRelEnd));
      covered += (spanRelEnd - spanRelStart);
    }
  }
  // If covered < sectionEndIndex - sectionStartIndex + 1, log a warning
  const expected = sectionEndIndex - sectionStartIndex + 1;
  if (covered < expected) {
    console.warn(`⚠️ [extractSectionText] Section missing ${expected - covered} chars (expected: ${expected}, got: ${covered})`);
  }
  // Join parts, then fix line-break hyphenation (e.g., 'eligi-\nbility' -> 'eligibility')
  let text = parts.join(' ');
  // Remove hyphen at end of a word followed by any whitespace and a lowercase letter (seal hyphenation)
  text = text.replace(/-\s+([a-z])/g, '$1');
  // Also handle rare case: hyphen directly followed by a lowercase letter (no whitespace)
  text = text.replace(/-([a-z])/g, '$1');
  // Collapse multiple spaces
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function clampIndex(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  if (numeric < min) return min;
  if (numeric > max) return max;
  return numeric;
}

function findSpanForStartOffset(spans, startIndex) {
  return spans.find((span) => span.startIndex <= startIndex && span.endIndex >= startIndex)
    || spans.find((span) => span.startIndex >= startIndex)
    || null;
}

function findSpanForEndOffset(spans, endIndex) {
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i];
    if (span.startIndex <= endIndex && span.endIndex >= endIndex) {
      return span;
    }
    if (span.endIndex <= endIndex) {
      return span;
    }
  }
  return null;
}

function normalizeSectionBounds(section, spans, maxEndIndex) {
  const clampedStart = clampIndex(section?.startIndex, 0, maxEndIndex);
  const clampedEnd = clampIndex(section?.endIndex, clampedStart, maxEndIndex);

  const startSpan = findSpanForStartOffset(spans, clampedStart);
  const endSpan = findSpanForEndOffset(spans, clampedEnd);

  let startIndex = clampedStart;
  let endIndex = clampedEnd;

  if (startSpan) {
    startIndex = startSpan.startIndex;
  }
  if (endSpan) {
    endIndex = endSpan.endIndex;
  }
  if (endIndex < startIndex) {
    endIndex = startIndex;
  }

  const subsectionList = Array.isArray(section?.subsections) ? section.subsections : [];
  const normalizedSubsections = subsectionList.map((subsection) => normalizeSectionBounds(subsection, spans, maxEndIndex));

  return {
    ...section,
    startIndex,
    endIndex,
    // Prefer the physical PDF page derived from the snapped start span.
    startPage: Number.isFinite(Number(startSpan?.pageNumber)) ? Number(startSpan.pageNumber) : (Number(section?.startPage) || null),
    subsections: normalizedSubsections,
  };
}

function normalizeStatuteKey(text = '') {
  const match = text.match(STATUTE_HEADING_REGEX);
  if (!match) return null;
  return match[0].replace(/\s+/g, '').toLowerCase();
}

function detectStatutoryHeadings(mergedSpans) {
  if (!Array.isArray(mergedSpans)) return [];
  const headings = [];

  for (let i = 0; i < mergedSpans.length; i++) {
    const span = mergedSpans[i];
    const cleaned = span.text?.replace(/\s+/g, ' ').trim();
    if (!cleaned || !STATUTE_HEADING_REGEX.test(cleaned)) {
      continue;
    }

    let headingText = cleaned;
    let endIndex = span.endIndex;
    let j = i + 1;
    while (j < mergedSpans.length) {
      const candidate = mergedSpans[j];
      const candidateText = candidate.text?.replace(/\s+/g, ' ').trim();
      if (!candidateText) {
        j++;
        continue;
      }
      if (STATUTE_HEADING_REGEX.test(candidateText)) {
        break;
      }
      const sameFormat = candidate.fontFaceId === span.fontFaceId &&
        candidate.fontSize === span.fontSize &&
        candidate.bold === span.bold &&
        candidate.italic === span.italic;
      if (!sameFormat || headingText.length + candidateText.length > 140) {
        break;
      }
      headingText += ' ' + candidateText;
      endIndex = candidate.endIndex;
      j++;
    }

    headings.push({
      heading: headingText.trim(),
      startIndex: span.startIndex,
      endIndex,
      startPage: span.pageNumber
    });
  }

  return headings.sort((a, b) => a.startIndex - b.startIndex);
}

function ensureStatutoryCoverage(chunks, spans) {
  if (!Array.isArray(chunks) || chunks.length === 0 || !Array.isArray(spans) || spans.length === 0) {
    return chunks;
  }

  const mergedForHeadings = mergeSpans(spans);
  const headingCandidates = detectStatutoryHeadings(mergedForHeadings);
  if (headingCandidates.length === 0) {
    return chunks;
  }

  const docEndIndex = mergedForHeadings[mergedForHeadings.length - 1]?.endIndex ?? 0;
  const resultChunks = [...chunks];
  const newSections = [];

  headingCandidates.forEach((candidate, idx) => {
    const statuteKey = normalizeStatuteKey(candidate.heading);
    if (!statuteKey) {
      return;
    }

    const coveringChunk = resultChunks.find(section =>
      typeof section.startIndex === 'number' &&
      typeof section.endIndex === 'number' &&
      section.startIndex <= candidate.startIndex &&
      section.endIndex >= candidate.startIndex
    );

    if (coveringChunk) {
      if (!normalizeStatuteKey(coveringChunk.heading)) {
        const original = coveringChunk.heading?.trim();
        coveringChunk.heading = original && !original.toLowerCase().includes(candidate.heading.toLowerCase())
          ? `${candidate.heading} — ${original}`
          : candidate.heading;
        coveringChunk.content = `${coveringChunk.heading}: ${extractSectionText(spans, coveringChunk.startIndex, coveringChunk.endIndex)}`;
      }
      return;
    }

    const alreadyPresent = resultChunks.some(section => normalizeStatuteKey(section.heading) === statuteKey);
    if (alreadyPresent) {
      return;
    }

    const nextStart = headingCandidates[idx + 1]?.startIndex ?? (docEndIndex + 1);
    const computedEnd = nextStart > candidate.startIndex ? nextStart - 1 : candidate.endIndex;
    const sectionText = extractSectionText(spans, candidate.startIndex, computedEnd);
    if (!sectionText) {
      console.warn(`⚠️ [ensureStatutoryCoverage] Unable to extract text for statute ${statuteKey}`);
      return;
    }

    newSections.push({
      id: uuidv4(),
      heading: candidate.heading,
      content: `${candidate.heading}: ${sectionText}`,
      page: candidate.startPage,
      level: 0,
      parentId: null,
      root: true,
      children: [],
      startIndex: candidate.startIndex,
      endIndex: computedEnd
    });
  });

  if (newSections.length === 0) {
    return resultChunks;
  }

  const combined = [...resultChunks, ...newSections].sort((a, b) => (a.startIndex ?? 0) - (b.startIndex ?? 0));
  return combined;
}

/**
 * Master segmentation function: downloads a PDF from blob, parses it with pdf2json
 * in raw text mode, and uses GPT-4o to identify topic sections.
 * For large PDFs that exceed the token window, automatically splits into
 * overlapping page-range batches and merges results.
 *
 * @param {string} blobName - Blob path in the compliance-ai container
 * @returns {Promise<{ sections: Array, totalPages: number, totalSpans: number }>}
 */
async function segmentPdfFromBlob({ teamName, chatId, chatInteractionId, suppressProgressUpdates }, blobName) {

  // Step 1: Parse PDF from blob
  const pdfData = await parsePdfFromBlob(blobName);
  const totalPages = pdfData.Pages.length;

  // Step 2: Extract and merge spans
  const spans = extractSpans(pdfData);
  const merged = mergeSpans(spans);

  // Step 3: Split into batches if needed and segment with GPT-4o
  const batches = splitSpansIntoBatches(merged);

  let sections;
  if (batches.length === 1) {
    // Single batch — send everything in one call
    sections = await segmentBatchWithRetry(batches[0]);
  } else {
    // Multiple batches — process sequentially and merge
    const batchSections = [];
    for (let i = 0; i < batches.length; i++) {
      let progressResponse = createProgressMarkdown(`Processing batch ${i + 1}/${batches.length}...`, '', 'Preparation');
      if (chatInteractionId && suppressProgressUpdates !== true) {
        await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
      }
      const batchResult = await segmentBatchWithRetry(batches[i]);
      batchSections.push(batchResult);

      // Throttle between batches to avoid rate limiting
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    sections = mergeBatchSections(batchSections);
  }

  // Step 4: Validate and fix section boundaries, then extract full text content
  const maxEndIndex = spans.length > 0 ? spans[spans.length - 1].endIndex : 0;

  // Fix GPT-4o's startIndex/endIndex to snap to actual span boundaries.
  // The model may hallucinate offsets that fall between or outside real spans.
  const fixedSections = sections.map((section) => normalizeSectionBounds(section, spans, maxEndIndex));

  // Ensure no gaps between consecutive sections — extend each section's endIndex
  // to meet the next section's startIndex so no content falls through the cracks.
  for (let i = 0; i < fixedSections.length - 1; i++) {
    const currentEnd = fixedSections[i].endIndex;
    const nextStart = fixedSections[i + 1].startIndex;
    if (nextStart > currentEnd + 1) {
      // Gap detected — extend current section to cover it
      fixedSections[i].endIndex = nextStart - 1;
    }
  }
  // Ensure last section extends to end of document
  if (fixedSections.length > 0) {
    fixedSections[fixedSections.length - 1].endIndex = maxEndIndex;
  }

  const enrichedSections = fixedSections.map(section => {
    const text = extractSectionText(spans, section.startIndex, section.endIndex);
    if (!text || text.length === 0) {
      console.warn(`⚠️ [segmentPdfFromBlob] Empty content for section "${section.heading}" (startIndex: ${section.startIndex}, endIndex: ${section.endIndex})`);
    }
    return {
      ...section,
      content: `${section.heading}: ${text}`
    };
  });

  return { sections: enrichedSections, totalPages, totalSpans: spans.length };
}

// ─── Embeddings (unchanged from service2) ─────────────────────────────────────

async function getEmbeddingsForChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  const client = getEmbeddingsClient();

  const estimateTokensFn = (text) => {
    if (typeof text !== 'string') return 0;
    return Math.ceil(text.length / 4);
  };

  const MAX_CHUNK_CHARS = 7500;
  const MAX_BATCH_TOKENS = 2500;

  const inputTexts = chunks.map((chunk) => {
    let content = chunk.content;
    if (typeof content !== 'string') {
      content = String(content || '');
    }
    if (content.length > MAX_CHUNK_CHARS) {
      content = content.slice(0, MAX_CHUNK_CHARS);
    }
    if (content.trim().length === 0) {
      return '[empty content]';
    }
    return content;
  });

  const config = await getGeisingerConfig();
  const throttleMs = config.embedding?.throttleMs || 250;
  let allEmbeddings = [];

  let i = 0;
  let batchNumber = 0;
  while (i < inputTexts.length) {
    const batch = [];
    let batchTokenCount = 0;

    while (i < inputTexts.length) {
      const textTokens = estimateTokensFn(inputTexts[i]);
      if (batch.length > 0 && batchTokenCount + textTokens > MAX_BATCH_TOKENS) {
        break;
      }
      if (textTokens > MAX_BATCH_TOKENS && batch.length === 0) {
        console.warn(`⚠️ [getEmbeddingsForChunks] Single chunk estimated at ${textTokens} tokens exceeds batch limit of ${MAX_BATCH_TOKENS}`);
      }
      batch.push(inputTexts[i]);
      batchTokenCount += textTokens;
      i++;
    }

    if (batch.length === 0) break;
    batchNumber++;

    try {
      const response = await client.embeddings.create({ input: batch });
      if (!response || !response.data) {
        throw new Error('No embeddings returned from API');
      }
      const batchEmbeddings = response.data.map(item => item.embedding);
      if (batchEmbeddings.length !== batch.length) {
        throw new Error(`Embedding batch size mismatch: sent ${batch.length}, received ${batchEmbeddings.length}`);
      }
      allEmbeddings.push(...batchEmbeddings);

      if (i < inputTexts.length) {
        await new Promise(resolve => setTimeout(resolve, throttleMs));
      }
    } catch (error) {
      console.error(`❌ [getEmbeddingsForChunks] Error processing batch ${batchNumber}:`, error.message);
      throw error;
    }
  }

  if (allEmbeddings.length !== chunks.length) {
    throw new Error(`Final embedding count mismatch: ${chunks.length} chunks vs ${allEmbeddings.length} embeddings`);
  }

  return allEmbeddings;
}

// ─── Azure AI Search indexing (adapted from service2 — hierarchy fields nulled) ──

async function batchIndexChunksInCognitiveSearch(chunks, embeddings, cognitiveSearchConfig) {
  if (!chunks || chunks.length === 0) {
    return { indexed: 0, skipped: true };
  }
  if (!embeddings || embeddings.length !== chunks.length) {
    throw new Error(`Embeddings count (${embeddings?.length || 0}) does not match chunks count (${chunks.length})`);
  }

  const config = await getGeisingerConfig();
  const indexName = cognitiveSearchConfig?.indexName || config.azure?.searchIndex || 'geisinger-002';
  const client = getUpdateClient(indexName);
  const conversationId = cognitiveSearchConfig?.conversationId || '';

  // Build documents — hierarchy fields are set to null/empty for flat sections
  const allDocs = chunks.map((chunk, i) => ({
    id: chunk.id,
    nuid: cognitiveSearchConfig?.nuid || '',
    smartnote_id: conversationId,
    smart_file_type: cognitiveSearchConfig?.fileType || 'pdf',
    smart_file_name: cognitiveSearchConfig?.fileName || chunk.heading,
    page: chunk.page || chunk.startPage || null,
    title: chunk.heading,
    level: null,         // flat — no hierarchy
    parentId: null,      // flat — no hierarchy
    root: false,         // flat — no hierarchy
    children: [],        // flat — no hierarchy
    content: chunk.content,
    content_vector: embeddings[i],
    createdAt: new Date()
  }));

  // Log docs to JSON file (exclude content_vector)
  try {
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `ai-search-docs-${indexName}-${timestamp}.json`;
    const filePath = path.join(process.cwd(), fileName);
    const docsToLog = allDocs.map(({ content_vector, ...rest }) => rest);
    // fs.writeFileSync(filePath, JSON.stringify(docsToLog, null, 2));
  } catch (logErr) {
    console.warn(`⚠️ [batchIndexChunksInCognitiveSearch] Failed to write docs to JSON file: ${logErr.message}`);
  }

  if (!allDocs || allDocs.length === 0) {
    return { indexed: 0, skipped: true };
  }

  const BATCH_SIZE = 100;
  let totalIndexed = 0;
  const totalBatches = Math.ceil(allDocs.length / BATCH_SIZE);

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const batchDocs = allDocs.slice(i, Math.min(i + BATCH_SIZE, allDocs.length));

    try {
      await client.uploadDocuments(batchDocs);
      totalIndexed += batchDocs.length;

      if (batchNumber < totalBatches) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      // For 413 errors, retry with smaller batch
      if (error.statusCode === 413 && batchDocs.length > 10) {
        const smallerBatchSize = Math.max(10, Math.floor(batchDocs.length / 2));
        for (let j = 0; j < batchDocs.length; j += smallerBatchSize) {
          const subBatch = batchDocs.slice(j, Math.min(j + smallerBatchSize, batchDocs.length));
          try {
            await client.uploadDocuments(subBatch);
            totalIndexed += subBatch.length;
            if (j + smallerBatchSize < batchDocs.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (subError) {
            throw subError;
          }
        }
      } else {
        throw error;
      }
    }
  }

  return { indexed: totalIndexed, skipped: false };
}

// ─── Cleanup (adapted from service2 — still deletes HierarchyNodes for safety) ──

async function deleteExistingGeisingerConversationData({ teamName, fileAName, relativeAUrl, lob }) {
  const normalizedTeamName = normalizeRequiredTeamName(teamName);
  const db = await connectToDatabase(`team-${normalizedTeamName}-db`);
  const collection = db.collection(GEISINGER_COLLECTION);
  const queryOptions = { maxTimeMS: 600000 };

  const normalizedFileAName = normalizeString(fileAName);
  const normalizedRelativeAUrl = normalizeString(relativeAUrl);
  const normalizedLob = normalizeString(lob);

  const conversationQuery = {
    type: 'GeisingerConversation',
    fileAName: normalizedFileAName,
    ...(normalizedLob ? { lob: normalizedLob } : (normalizedRelativeAUrl ? { relativeAUrl: normalizedRelativeAUrl } : {})),
  };

  const conversations = await collection.find(
    conversationQuery,
    queryOptions
  ).toArray();

  logConversationEvent('deleteExistingGeisingerConversationDataLookup', {
    fileAName: normalizedFileAName,
    relativeAUrl: normalizedRelativeAUrl || null,
    lob: normalizedLob || null,
    queryMode: normalizedLob ? 'fileAName+lob' : 'fileAName+relativeAUrl',
    existingConversationsCount: conversations.length,
    existingConversations: conversations.slice(0, 20).map((convo) => ({
      id: convo?.id,
      status: convo?.status,
      preparationVersion: convo?.preparationVersion,
      preparedAt: convo?.preparedAt || null,
      updatedAt: convo?.updatedAt || null,
      createdAt: convo?.createdAt || null,
    })),
  });

  let deletedIndexDocumentsByConversationId = 0;
  for (const convo of conversations) {
    const conversationId = convo.id;
    // Delete any HierarchyNode docs (may exist from previous service2 processing)
    await collection.deleteMany({ type: 'HierarchyNode', conversationId }, queryOptions);
    // Delete the GeisingerConversation doc
    await collection.deleteMany({ type: 'GeisingerConversation', id: conversationId }, queryOptions);
    // Delete Cognitive Search index docs
    const indexName = 'geisinger-002';
    const searchClient = getSearchClient(indexName);
    const updateClient = getUpdateClient(indexName);
    const documentIds = await collectLegacySearchDocumentIdsByFilter({
      searchClient,
      filter: `smartnote_id eq '${escapeODataString(conversationId)}'`,
    });
    if (documentIds.length > 0) {
      await updateClient.deleteDocuments(documentIds);
    }
    deletedIndexDocumentsByConversationId += documentIds.length;

    logConversationEvent('deleteExistingGeisingerConversationDataDeleted', {
      fileAName: normalizedFileAName,
      relativeAUrl: normalizedRelativeAUrl || null,
      lob: normalizedLob || null,
      conversationId,
      deletedIndexDocuments: documentIds.length,
    });
  }

  // Safety net: delete any lingering legacy AI Search docs by filename regardless of conversation linkage.
  const indexName = 'geisinger-002';
  const searchClient = getSearchClient(indexName);
  const updateClient = getUpdateClient(indexName);
  const fileFilter = `smart_file_name eq '${escapeODataString(normalizedFileAName)}'`;
  const lingeringDocumentIds = await collectLegacySearchDocumentIdsByFilter({
    searchClient,
    filter: fileFilter,
  });

  if (lingeringDocumentIds.length > 0) {
    await updateClient.deleteDocuments(lingeringDocumentIds);
  }

  logConversationEvent('deleteExistingGeisingerConversationDataLegacySearchFileSweep', {
    fileAName: normalizedFileAName,
    relativeAUrl: normalizedRelativeAUrl || null,
    lob: normalizedLob || null,
    fileFilter,
    deletedIndexDocumentsByConversationId,
    deletedIndexDocumentsByFileSweep: lingeringDocumentIds.length,
  });
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function prepareSharePointPdfsForConversation(geisingerConversation) {
  const startTime = Date.now();
  const currentPreparationVersion = await getConfiguredPreparationVersion();
  const preparationVersion = String(
    geisingerConversation?.preparationVersion || currentPreparationVersion
  ).trim();
  // Progress tracking: extract from geisingerConversation if present
  const normalizedTeamName = normalizeRequiredTeamName(geisingerConversation?.teamName);
  const teamName = normalizedTeamName;
  const { chatId, chatInteractionId } = geisingerConversation;
  const suppressProgressUpdates = geisingerConversation?.suppressProgressUpdates === true;
  const shouldReportProgress = Boolean(chatInteractionId) && !suppressProgressUpdates;
  let progressResponse = createProgressMarkdown('Starting document processing...', '', 'Preparation');
  try {
    if (shouldReportProgress) {
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
    }
    await getGeisingerConfig(true);

    // Pre-processing: delete any previous data for this file
    progressResponse = createProgressMarkdown('Deleting previous data...', '', 'Preparation');
    if (shouldReportProgress) {
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
    }
    await deleteExistingGeisingerConversationData({
      teamName: normalizedTeamName,
      fileAName: geisingerConversation.fileAName,
      relativeAUrl: geisingerConversation.relativeAUrl,
      lob: geisingerConversation.lob,
    });

    const { siteName, fileAName, fileId, relativeAUrl, lob, status } = geisingerConversation;
    const db = await connectToDatabase(`team-${normalizedTeamName}-db`);
    const incomingConversationId = normalizeString(geisingerConversation?.id);
    const conversationId = incomingConversationId || uuidv4();
    const conversationIdSource = incomingConversationId ? 'geisingerConversation.id' : 'generated.uuidv4';

    logConversationEvent('prepareSharePointPdfsForConversationConversationIdResolved', {
      conversationId,
      conversationIdSource,
      incomingConversationId: incomingConversationId || null,
      fileAName,
      relativeAUrl,
      lob,
      teamName: geisingerConversation?.teamName || null,
      chatId: geisingerConversation?.chatId || null,
      chatInteractionId: geisingerConversation?.chatInteractionId || null,
    });

    // Create conversation record in MongoDB
    progressResponse = createProgressMarkdown('Creating conversation record...', '', 'Preparation');
    if (shouldReportProgress) {
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
    }
    await db.collection(GEISINGER_COLLECTION).insertOne({
      ...geisingerConversation,
      type: 'GeisingerConversation',
      preparationVersion,
      id: conversationId,
      createdAt: new Date()
    });

    logConversationEvent('prepareSharePointPdfsForConversationInserted', {
      conversationId,
      conversationIdSource,
      incomingConversationId: incomingConversationId || null,
      fileAName,
      relativeAUrl,
      lob,
      incomingStatus: status,
      preparationVersion,
      teamName: geisingerConversation?.teamName || null,
      chatId: geisingerConversation?.chatId || null,
      chatInteractionId: geisingerConversation?.chatInteractionId || null,
    });

    // Step 1: Copy SharePoint file to Azure Blob Storage
    progressResponse = createProgressMarkdown('Copying SharePoint file to Azure Blob Storage...', '', 'Preparation');
    if (shouldReportProgress) {
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
    }
    const sharePointAcquisition = await streamSharePointFileForPreparation({
      siteName,
      fileAName,
      fileId,
      relativeAUrl,
      destBlobName: fileAName,
    });
    const withFolderDestBlobName = sharePointAcquisition.blobName;

    // Detect file type
    const lowerName = fileAName.toLowerCase();
    const isDocx = lowerName.endsWith('.docx');
    const isPdf = lowerName.endsWith('.pdf');

    let fullStructure = [];

    if (isPdf) {
      // Step 2: LLM-driven topic segmentation (analyzer approach)
      progressResponse = createProgressMarkdown('Segmenting PDF with LLM...', '', 'Preparation');
      if (shouldReportProgress) {
        await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
      }
      const { sections, totalPages, totalSpans } = await segmentPdfFromBlob(geisingerConversation, withFolderDestBlobName);
      const topLevelSectionCount = Array.isArray(sections) ? sections.length : 0;
      const subsectionCount = countNestedSubsections(sections);

      // Helper to flatten sections and subsections
      function flattenSections(sections, parentId = null, level = 0) {
        const flat = [];
        for (const section of sections) {
          const sectionId = uuidv4();
          const subsectionList = Array.isArray(section?.subsections) ? section.subsections : [];
          flat.push({
            id: sectionId,
            heading: section.heading,
            content: section.content,
            page: section.startPage || null,
            level,
            parentId,
            root: level === 0,
            children: [],
            startIndex: section.startIndex,
            endIndex: section.endIndex
          });

          if (subsectionList.length > 0) {
            const nested = flattenSections(subsectionList, sectionId, level + 1);
            flat.push(...nested);
          }
        }
        return flat;
      }

      // Flatten all sections and subsections
      fullStructure = flattenSections(sections);

      // Extract content for each using offsets (ensure content is up-to-date)
      // Re-parse PDF spans for content extraction
      progressResponse = createProgressMarkdown('Extracting section content from PDF...', '', 'Preparation');
      if (shouldReportProgress) {
        await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
      }
      const pdfData = await parsePdfFromBlob(withFolderDestBlobName);
      const spans = extractSpans(pdfData);
      fullStructure = fullStructure.map(chunk => {
        const text = extractSectionText(spans, chunk.startIndex, chunk.endIndex);
        return {
          ...chunk,
          content: `${chunk.heading}: ${text}`
        };
      });
      fullStructure = ensureStatutoryCoverage(fullStructure, spans);
      const prepChunkStats = computeChunkCharStats(fullStructure);
      const section722Evidence = buildTemporarySection722Evidence(fullStructure);
      logConversationEvent('prepareSharePointPdfsForConversationSegmentationDiagnostics', {
        conversationId,
        fileAName,
        topLevelSectionCount,
        subsectionCount,
        finalChunkCount: fullStructure.length,
        ...prepChunkStats,
      });

      // Temporary debug signal for validating the 7.2.2 subsection fix; remove after verification.
      logConversationEvent('prepareSharePointPdfsForConversationSection722Probe', {
        conversationId,
        fileAName,
        ...section722Evidence,
      });

      // Remove startIndex/endIndex from final structure
      fullStructure = fullStructure.map(({ startIndex, endIndex, ...rest }) => rest);

    } else if (isDocx) {
      // DOCX path: extract normalized structure (unchanged from service2)
      progressResponse = createProgressMarkdown('Extracting DOCX structure...', '', 'Preparation');
      if (shouldReportProgress) {
        await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
      }
      const { structure } = await extractDocxStructure(withFolderDestBlobName);
      fullStructure = structure || [];
    } else {
      console.error(`❌ [prepareSharePointPdfsForConversation] Unsupported file type: ${fileAName}`);
      throw new Error(`Unsupported file type: ${fileAName}`);
    }

    // Validate that structure extraction succeeded
    if (!fullStructure || fullStructure.length === 0) {
      await db.collection(GEISINGER_COLLECTION).updateOne(
        { type: 'GeisingerConversation', id: conversationId },
        { $set: { status: 'Complete - No Content' } }
      );
      progressResponse = createProgressMarkdown('No content extracted.', '', 'Preparation');
      if (shouldReportProgress) {
        await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
      }
      return {
        file: fileAName,
        chunkCount: 0,
        embeddingsCount: 0,
        geisingerConversationId: conversationId,
        status: 'Complete - No Content'
      };
    }

    // Step 3: Generate embeddings
    progressResponse = createProgressMarkdown('Generating embeddings...', '', 'Preparation');
    if (shouldReportProgress) {
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
    }
    const embeddings = await getEmbeddingsForChunks(fullStructure);

    // Step 4: Index in Azure AI Search
    progressResponse = createProgressMarkdown('Indexing in Azure AI Search...', '', 'Preparation');
    if (shouldReportProgress) {
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
    }
    const indexResult = await batchIndexChunksInCognitiveSearch(fullStructure, embeddings, {
      fileName: fileAName,
      conversationId,
      fileType: isDocx ? 'docx' : 'pdf'
    });

    // No Step 5 — no saveHierarchyToMongo() call (flat sections, no HierarchyNode)

    // Update status
    const completionUpdate = await db.collection(GEISINGER_COLLECTION).updateOne(
      { type: 'GeisingerConversation', id: conversationId },
      { $set: { status: 'Complete', preparedAt: new Date(), updatedAt: new Date() } }
    );

    const conversationAfterComplete = await db.collection(GEISINGER_COLLECTION).findOne({
      type: 'GeisingerConversation',
      id: conversationId,
    });

    logConversationEvent('prepareSharePointPdfsForConversationMarkedComplete', {
      conversationId,
      fileAName,
      relativeAUrl,
      updateMatchedCount: completionUpdate?.matchedCount || 0,
      updateModifiedCount: completionUpdate?.modifiedCount || 0,
      dbStatusAfterUpdate: conversationAfterComplete?.status || null,
      dbPreparationVersionAfterUpdate: conversationAfterComplete?.preparationVersion || null,
      dbPreparedAtAfterUpdate: conversationAfterComplete?.preparedAt || null,
      dbUpdatedAtAfterUpdate: conversationAfterComplete?.updatedAt || null,
    });
    progressResponse = createConversationCompletionMarkdown({
      ...geisingerConversation,
      id: conversationId
    });
    if (shouldReportProgress) {
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
    }

    const totalTime = Date.now() - startTime;

    return {
      file: fileAName,
      chunkCount: fullStructure.length,
      embeddingsCount: embeddings.length,
      geisingerConversationId: conversationId,
      status
    };
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [prepareSharePointPdfsForConversation] Failed after ${totalTime}ms:`, err.message);

    // Attempt safe status update
    try {
      const conversationId = geisingerConversation?.id;
      if (conversationId) {
        const normalizedErrorTeamName = normalizeRequiredTeamName(geisingerConversation?.teamName);
        const teamDb = await connectToDatabase(`team-${normalizedErrorTeamName}-db`);
        const errorUpdate = await teamDb.collection(GEISINGER_COLLECTION).updateOne(
          { type: 'GeisingerConversation', id: conversationId },
          { $set: { status: 'Error', errorMessage: err.message, errorTime: new Date() } }
        );

        const conversationAfterError = await teamDb.collection(GEISINGER_COLLECTION).findOne({
          type: 'GeisingerConversation',
          id: conversationId,
        });

        logConversationEvent('prepareSharePointPdfsForConversationMarkedError', {
          conversationId,
          fileAName: geisingerConversation?.fileAName || null,
          relativeAUrl: geisingerConversation?.relativeAUrl || null,
          error: err?.message,
          updateMatchedCount: errorUpdate?.matchedCount || 0,
          updateModifiedCount: errorUpdate?.modifiedCount || 0,
          dbStatusAfterUpdate: conversationAfterError?.status || null,
          dbErrorMessageAfterUpdate: conversationAfterError?.errorMessage || null,
          dbUpdatedAtAfterUpdate: conversationAfterError?.updatedAt || null,
        });
      }
    } catch (updateErr) {
      // Silent fail on update error
    }
    progressResponse = `## Processing Error\n\n❌ An error occurred during document processing:\n\n${err.message}\n\n---\n*Failed at ${new Date().toLocaleTimeString()}*`;
    if (shouldReportProgress) {
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, progressResponse);
    }
    throw err;
  }
}

// ─── Query helpers (re-exported from service2 pattern) ────────────────────────

export async function findGeisingerConversationsByInferredLobAndStatus(inferredLob, status, options = {}) {
  const currentPreparationVersion = await getConfiguredPreparationVersion();
  const canonicalInferredLob = normalizeInferredLob(inferredLob);
  const lobAliases = getInferredLobAliases(inferredLob);
  const normalizedTeamName = String(options?.teamName || '').trim();
  let preparedInventory = null;
  preparedInventory = await getLatestAdminPreparedInventory(normalizedTeamName, canonicalInferredLob);
  const inferredLobPattern = new RegExp(`^(?:${lobAliases.map(escapeRegex).join('|')})$`, 'i');

  if (normalizedTeamName) {
    try {
      preparedInventory = await getLatestAdminPreparedInventory(normalizedTeamName, inferredLob);
    } catch (inventoryError) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'findGeisingerConversationsByInferredLobAndStatusInventoryError',
          detail: {
            inferredLob,
            teamName: normalizedTeamName,
            error: inventoryError?.message,
          },
        }
      }));
    }
  }

  const connection = normalizedTeamName
    ? await connectToDatabase(`team-${normalizedTeamName}-db`)
    : await connectToDatabase();
  const collection = connection.collection(GEISINGER_COLLECTION);
  let conversations = [];
  let lookupMode = 'lob';
  const hasUserCollectionLobData = !!preparedInventory?.applyFilter;

  if (hasUserCollectionLobData) {
    lookupMode = 'user_collection';
    const docsById = [];
    const docsByKeyCandidates = [];

    const preparedItems = Array.isArray(preparedInventory?.preparedItems)
      ? preparedInventory.preparedItems
      : [];

    const preparedIds = preparedItems
      .map((item) => String(item?.conversationId || '').trim())
      .filter(Boolean);
    if (preparedIds.length > 0) {
      const byId = await collection.find({
        type: 'GeisingerConversation',
        id: { $in: preparedIds },
      }).toArray();
      docsById.push(...byId);
    }

    const preparedKeys = preparedItems
      .map((item) => buildConversationKey(item?.fileAName, item?.relativeAUrl))
      .filter(Boolean);
    if (preparedKeys.length > 0) {
      const parsedKeys = preparedKeys.map(splitConversationKey);
      const relativeUrls = [...new Set(parsedKeys.map((item) => item.relativeAUrl).filter(Boolean))];
      const fileNames = [...new Set(parsedKeys.map((item) => item.fileAName).filter(Boolean))];

      if (relativeUrls.length > 0 && fileNames.length > 0) {
        const byKeyCandidates = await collection.find({
          type: 'GeisingerConversation',
          relativeAUrl: { $in: relativeUrls },
          fileAName: { $in: fileNames },
        }).toArray();
        docsByKeyCandidates.push(...byKeyCandidates);
      }
    }

    const docsByIdMap = new Map(
      docsById.map((doc) => [String(doc?.id || '').trim(), doc]).filter(([id]) => !!id)
    );
    const docsByKeyMap = new Map(
      docsByKeyCandidates
        .map((doc) => [buildConversationKey(doc?.fileAName, doc?.relativeAUrl), doc])
        .filter(([key]) => !!key)
    );

    const stitchedConversations = preparedItems.map((item) => {
      const conversationId = String(item?.conversationId || '').trim();
      const key = buildConversationKey(item?.fileAName, item?.relativeAUrl);

      const existingDoc = (conversationId && docsByIdMap.get(conversationId))
        || (key && docsByKeyMap.get(key));

      if (existingDoc) {
        return existingDoc;
      }

      return {
        type: 'GeisingerConversation',
        id: conversationId || key,
        fileAName: item?.fileAName || null,
        relativeAUrl: item?.relativeAUrl || null,
        lob: item?.lob || inferredLob,
        status: item?.status || 'Complete',
        preparationVersion: item?.preparationVersion || currentPreparationVersion,
        preparedAt: item?.preparedAt || null,
        updatedAt: item?.updatedAt || item?.preparedAt || null,
        createdAt: item?.createdAt || item?.preparedAt || null,
      };
    });

    const deduped = new Map();
    stitchedConversations.forEach((doc) => {
      const dedupeKey = String(doc?.id || '').trim() || buildConversationKey(doc?.fileAName, doc?.relativeAUrl);
      if (!dedupeKey) return;
      deduped.set(dedupeKey, doc);
    });

    const stitched = Array.from(deduped.values());
    const lobDocs = await collection.find({
      type: 'GeisingerConversation',
      lob: inferredLobPattern,
    }).toArray();

    // Keep stitched entries (latest-job hints) but also include all matching LOB docs.
    const combined = new Map();
    [...stitched, ...lobDocs].forEach((doc) => {
      const dedupeKey = String(doc?.id || '').trim() || buildConversationKey(doc?.fileAName, doc?.relativeAUrl);
      if (!dedupeKey) return;
      combined.set(dedupeKey, doc);
    });

    conversations = Array.from(combined.values());
  } else {
    conversations = await collection.find({
      type: 'GeisingerConversation',
      lob: inferredLobPattern,
    }).toArray();

    if (conversations.length === 0) {
      const lobSamples = await collection.find(
        { type: 'GeisingerConversation' },
        { projection: { id: 1, fileAName: 1, lob: 1, status: 1, preparationVersion: 1 } }
      ).limit(25).toArray();

      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'findGeisingerConversationsByInferredLobAndStatusLobDebug',
          detail: {
            inferredLob,
            teamName: normalizedTeamName || null,
            sampleCount: lobSamples.length,
            samples: lobSamples,
          },
        }
      }));
    }
  }

  const currentVersionConversations = conversations.filter((doc) => {
    if (!isAtOrAbovePreparationVersion(doc?.preparationVersion, currentPreparationVersion)) {
      return false;
    }

    if (!matchesPreparedInventory(doc, preparedInventory, status)) {
      return false;
    }

    return isEquivalentPreparedStatus(doc?.status, status);
  });

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'findGeisingerConversationsByInferredLobAndStatus',
      detail: {
        inferredLob,
        teamName: normalizedTeamName || null,
        requestedStatus: status,
        currentPreparationVersion,
        lookupMode,
        totalFetched: conversations.length,
        totalReturned: currentVersionConversations.length,
        fetchedStatusBreakdown: buildLookupStatusBreakdown(conversations),
        fetchedVersionBreakdown: buildLookupVersionBreakdown(conversations),
        returnedDocuments: currentVersionConversations.slice(0, 50).map((doc) => ({
          id: doc?.id,
          fileAName: doc?.fileAName,
          relativeAUrl: doc?.relativeAUrl,
          lob: doc?.lob,
          status: doc?.status,
          preparationVersion: doc?.preparationVersion,
          preparedAt: doc?.preparedAt,
          updatedAt: doc?.updatedAt,
          createdAt: doc?.createdAt,
        })),
      },
    }
  }));

  // Cosmos Mongo API can require composite indexes for ORDER BY queries; sort in memory instead.
  return currentVersionConversations.sort((a, b) => {
    const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export async function findGeisingerConversationById(conversationId, options = {}) {
  const normalizedTeamName = normalizeRequiredTeamName(options?.teamName);
  const connection = await connectToDatabase(`team-${normalizedTeamName}-db`);
  return await connection.collection(GEISINGER_COLLECTION)
    .findOne({ type: 'GeisingerConversation', id: conversationId });
}

export async function prepareSharePointPdfsForComparison(geisingerComparison) {
  const db = await connectToDatabase();
  await db.collection(GEISINGER_COLLECTION).deleteMany({ type: 'GeisingerComparison', lob: geisingerComparison.lob });
  const comparisonId = geisingerComparison.id || uuidv4();
  await db.collection(GEISINGER_COLLECTION).insertOne({
    ...geisingerComparison,
    id: comparisonId,
    status: 'Complete',
    createdAt: new Date()
  });
  return { geisingerComparison };
}

export async function findGeisingerComparisonsByInferredLobAndStatus(teamName, inferredLob, status) {
  const lobAliases = getInferredLobAliases(inferredLob);
  const connection = await connectToDatabase(`team-${teamName}-db`);
  const result = await connection.collection(GEISINGER_COLLECTION)
    .find({ type: 'GeisingerComparison', comparisonType: 'comprehensive', lob: inferredLob })
    .toArray();
  return result;
}
