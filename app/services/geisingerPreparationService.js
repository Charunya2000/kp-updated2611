'use server';

import { connectToDatabase } from '@/db/connection';
import { createJob, getAllJobs, getJobById, updateJob } from '@/app/services/backgroundJobService';
import { runCompliancePreparationWithRouting } from '@/app/services/langgraphs/compliance/compliancePreparationRouterService';
import { getFolderByServerRelativeUrl as getFolderByServerRelativeUrlGraph } from '@/app/services/sharePointGraphRestAPIService';
import { getFolderByServerRelativeUrl as getFolderByServerRelativeUrlRest } from '@/app/services/sharePointRestAPIService';
import { selectGeisingerConfigContextDocuments } from '@/app/services/geisingerConfigService';
import { loadPreparationConfigV1, DEFAULT_PREPARATION_CONFIG_V1 } from '@/app/services/langgraphs/compliance/helpers/loadPreparationConfigV1';
import { jobStatus } from '@/utils/constants';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_RUNTIME = DEFAULT_PREPARATION_CONFIG_V1.runtime;

let resolvedPreparationConfigV1 = null;

function getPreparationRuntimeV1() {
  const runtime = resolvedPreparationConfigV1?.config?.runtime || DEFAULT_RUNTIME;
  const envVarName = String(runtime?.preparationVersion?.envVar || 'GEISINGER_PREPARATION_VERSION').trim() || 'GEISINGER_PREPARATION_VERSION';
  const defaultPreparationVersion = String(runtime?.preparationVersion?.defaultValue || '1').trim() || '1';

  return {
    jobType: String(runtime?.job?.jobType || 'GeisingerDocumentPreparation').trim() || 'GeisingerDocumentPreparation',
    maxConcurrency: Number(runtime?.job?.maxConcurrency || 10),
    defaultRootFolder: String(runtime?.discovery?.defaultRootFolder || 'Shared Documents/Regulatory and Contractual Documents').trim() || 'Shared Documents/Regulatory and Contractual Documents',
    preparableExtensions: new Set(Array.isArray(runtime?.discovery?.preparableExtensions) ? runtime.discovery.preparableExtensions : ['pdf', 'docx']),
    requireSingleLobWhenFileNameFilterPresent: runtime?.discovery?.requireSingleLobWhenFileNameFilterPresent !== false,
    conversationCollectionName: String(runtime?.collections?.conversationCollectionName || 'user_collection').trim() || 'user_collection',
    currentPreparationVersion: String(process.env[envVarName] || defaultPreparationVersion).trim() || '1',
    sharePointDomainToggleEnvVar: String(runtime?.sharePoint?.domainToggleEnvVar || 'USE_VAULT').trim() || 'USE_VAULT',
    sharePointVaultDomain: String(runtime?.sharePoint?.vaultDomain || 'geisinger.sharepoint.com').trim() || 'geisinger.sharepoint.com',
    sharePointLegacyDomain: String(runtime?.sharePoint?.legacyDomain || 'sp-cloud.kp.org').trim() || 'sp-cloud.kp.org',
  };
}

async function fetchPreparationConfigDocumentsV1() {
  const collectionNames = ['Document Preparation Config', 'Geisinger Preparation'];
  const all = [];
  const seen = new Set();
  let invalidDocumentCount = 0;

  for (const collectionName of collectionNames) {
    try {
      const { data } = await selectGeisingerConfigContextDocuments({
        type: 'GeisingerConfig',
        collectionName,
      });

      for (const doc of Array.isArray(data) ? data : []) {
        const documentText = String(doc?.documentText || '').trim();
        if (!documentText) {
          invalidDocumentCount += 1;
          continue;
        }

        const key = String(doc?.id || `${collectionName}:${doc?.title || ''}`).trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        all.push({ ...doc, documentText });
      }
    } catch (error) {
      logPreparationEvent('fetchPreparationConfigDocumentsV1Failed', {
        collectionName,
        error: error?.message || String(error),
      });
    }
  }

  if (invalidDocumentCount > 0) {
    logPreparationEvent('fetchPreparationConfigDocumentsV1InvalidDocumentsSkipped', {
      invalidDocumentCount,
    });
  }

  return all;
}

async function resolvePreparationConfigV1() {
  if (resolvedPreparationConfigV1) return resolvedPreparationConfigV1;

  try {
    const geisingerConfigEnabled = String(process.env.GEISINGER_PREPARATION_CONFIG_ENABLED || 'true').toLowerCase() !== 'false';
    const geisingerConfigDocuments = geisingerConfigEnabled
      ? await fetchPreparationConfigDocumentsV1()
      : [];

    const snapshot = await loadPreparationConfigV1({ geisingerConfigDocuments });
    logPreparationEvent('preparationV1ConfigResolved', {
      fileConfigCount: Object.keys(snapshot?.metadata?.fileSources || {}).length,
      geisingerDocumentCount: snapshot?.metadata?.geisingerOverlay?.documentCount || 0,
      geisingerAppliedCount: Array.isArray(snapshot?.metadata?.geisingerOverlay?.applied)
        ? snapshot.metadata.geisingerOverlay.applied.length
        : 0,
      geisingerParseErrorCount: Array.isArray(snapshot?.metadata?.geisingerOverlay?.parseErrors)
        ? snapshot.metadata.geisingerOverlay.parseErrors.length
        : 0,
    });

    resolvedPreparationConfigV1 = snapshot;
    return snapshot;
  } catch (error) {
    logPreparationEvent('resolvePreparationConfigV1Failed', {
      error: error?.message || String(error),
    });

    resolvedPreparationConfigV1 = {
      config: DEFAULT_PREPARATION_CONFIG_V1,
      metadata: null,
    };
    return resolvedPreparationConfigV1;
  }
}

export async function getPreparationConfigSnapshotV1() {
  const { config, metadata } = await resolvePreparationConfigV1();

  return {
    config,
    metadata: {
      ...metadata,
      fileSources: Object.fromEntries(
        Object.entries(metadata?.fileSources || {}).map(([key, value]) => [key, String(value || '').split(/[/\\]/).pop() || ''])
      ),
    },
  };
}

const preparationStatus = {
  PREPARED: 'Prepared',
  NOT_PREPARED: 'Not Prepared',
  PREPARING: 'Preparing',
  ERRORED: 'Errored',
};

function normalizeRequiredTeamName(teamName) {
  const normalized = String(teamName || '').trim();
  if (!normalized) {
    throw new Error('teamName is required for Geisinger preparation operations.');
  }
  return normalized;
}

function logPreparationEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

function toDocIdentity(doc = {}) {
  return {
    lob: doc?.lob || null,
    fileAName: doc?.fileAName || null,
    relativeAUrl: doc?.relativeAUrl || null,
    conversationId: doc?.conversationId || doc?.id || null,
    status: doc?.status || null,
    preparationVersion: doc?.preparationVersion || null,
    preparedAt: doc?.preparedAt || null,
    updatedAt: doc?.updatedAt || null,
    createdAt: doc?.createdAt || null,
  };
}

function buildStatusCounts(items = []) {
  return items.reduce((acc, item) => {
    const key = String(item?.status || 'missing').trim() || 'missing';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

const activeWorkers = new Set();

function getExtension(name = '') {
  const parts = String(name).split('.');
  if (parts.length < 2) return '';
  return String(parts[parts.length - 1]).trim().toLowerCase();
}

function normalizeDiscoveryFolder(value) {
  const runtime = getPreparationRuntimeV1();
  const raw = String(value || '').trim();
  if (!raw) return runtime.defaultRootFolder;
  return raw.replace(/^\/+/, '').replace(/\/+$/, '') || runtime.defaultRootFolder;
}

function joinFolderPath(base, segment) {
  const cleanBase = String(base || '').replace(/\/+$/, '');
  const cleanSegment = String(segment || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleanBase) return cleanSegment;
  if (!cleanSegment) return cleanBase;
  return `${cleanBase}/${cleanSegment}`;
}

function parseLobFolders(lobFolders) {
  if (Array.isArray(lobFolders)) {
    return lobFolders
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof lobFolders === 'string') {
    return lobFolders
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function fetchFolder(siteName, folderPath) {
  const runtime = getPreparationRuntimeV1();
  const useGraph = String(process.env[runtime.sharePointDomainToggleEnvVar] || '').toLowerCase() === 'true';
  const results = useGraph
    ? await getFolderByServerRelativeUrlGraph(siteName, folderPath)
    : await getFolderByServerRelativeUrlRest(siteName, folderPath);

  const d = results?.d || {};
  const files = d?.Files?.results || [];
  const folders = d?.Folders?.results || [];

  return {
    serverRelativeUrl: d?.ServerRelativeUrl || '',
    files,
    folders,
  };
}

async function discoverLobFolders(siteName, rootFolder) {
  const root = await fetchFolder(siteName, rootFolder);
  return (root.folders || []).map((folder) => String(folder.Name || '').trim()).filter(Boolean);
}

async function collectPreparablesForLob(siteName, rootFolder, lobFolderName) {
  const runtime = getPreparationRuntimeV1();
  const queue = [joinFolderPath(rootFolder, lobFolderName)];
  const discovered = [];

  while (queue.length) {
    const currentPath = queue.shift();
    if (!currentPath) continue;

    const current = await fetchFolder(siteName, currentPath);

    for (const childFolder of current.folders || []) {
      const childName = String(childFolder?.Name || '').trim();
      if (!childName) continue;
      queue.push(joinFolderPath(currentPath, childName));
    }

    for (const file of current.files || []) {
      const fileAName = String(file?.Name || '').trim();
      const relativeAUrl = String(file?.ServerRelativeUrl || '').trim();
      if (!fileAName || !relativeAUrl) continue;

      const extension = getExtension(fileAName);
      if (!runtime.preparableExtensions.has(extension)) continue;

      discovered.push({
        lob: lobFolderName,
        preparationVersion: runtime.currentPreparationVersion,
        siteName,
        fileAName,
        relativeAUrl,
        fileId: file?.Id ? String(file.Id) : '',
        fileUpdatedAt: file?.TimeLastModified || file?.Modified || null,
      });
    }
  }

  return discovered;
}

function normalizeFileNameFilter(value) {
  const raw = String(value || '').trim();
  return raw || '';
}

export async function discoverGeisingerPreparationDocuments({
  teamName,
  siteName,
  rootFolder = '',
  lobFolders = [],
  fileName = '',
} = {}) {
  await resolvePreparationConfigV1();
  const runtime = getPreparationRuntimeV1();
  const normalizedTeamName = normalizeRequiredTeamName(teamName);
  const normalizedSiteName = String(siteName || '').trim();
  if (!normalizedSiteName) {
    throw new Error('siteName is required for discovery.');
  }

  const normalizedRootFolder = normalizeDiscoveryFolder(rootFolder);
  const normalizedFileName = normalizeFileNameFilter(fileName);
  const explicitLobFolders = parseLobFolders(lobFolders);
  const effectiveLobFolders = explicitLobFolders.length
    ? explicitLobFolders
    : await discoverLobFolders(normalizedSiteName, normalizedRootFolder);

  if (normalizedFileName && runtime.requireSingleLobWhenFileNameFilterPresent && effectiveLobFolders.length !== 1) {
    throw new Error('Specific filename filter requires exactly one LOB folder.');
  }

  if (!effectiveLobFolders.length) {
    return {
      rootFolder: normalizedRootFolder,
      lobFolders: [],
      documents: [],
      byLob: {},
      total: 0,
    };
  }

  const allDocuments = [];

  for (const lob of effectiveLobFolders) {
    const documents = await collectPreparablesForLob(normalizedSiteName, normalizedRootFolder, lob);
    const filteredDocuments = normalizedFileName
      ? documents.filter((doc) => String(doc?.fileAName || '').toLowerCase() === normalizedFileName.toLowerCase())
      : documents;
    allDocuments.push(...filteredDocuments);
  }

  const existingMap = await getExistingConversationMap(allDocuments, {
    source: 'discoverGeisingerPreparationDocuments',
    teamName: normalizedTeamName,
    siteName: normalizedSiteName,
    rootFolder: normalizedRootFolder,
    fileName: normalizedFileName || null,
    lobFolders: effectiveLobFolders,
  });
  const documentsWithStatus = mergeWithExistingStatus(allDocuments, existingMap);

  logPreparationEvent('discoverGeisingerPreparationDocumentsStatusMerge', {
    siteName: normalizedSiteName,
    rootFolder: normalizedRootFolder,
    fileName: normalizedFileName || null,
    totalDiscovered: allDocuments.length,
    totalMerged: documentsWithStatus.length,
    mergedStatusCounts: buildStatusCounts(documentsWithStatus),
    sampleDocuments: documentsWithStatus.slice(0, 20).map((doc) => ({
      lob: doc?.lob,
      fileAName: doc?.fileAName,
      relativeAUrl: doc?.relativeAUrl,
      status: doc?.status,
      conversationId: doc?.conversationId,
      preparedVersion: doc?.preparedVersion,
      preparedAt: doc?.preparedAt,
      changedSincePrepared: !!doc?.changedSincePrepared,
      requiresVersionUpgrade: !!doc?.requiresVersionUpgrade,
      fileUpdatedAt: doc?.fileUpdatedAt,
      lastError: doc?.lastError || null,
    })),
  });

  const byLob = {};
  for (const document of documentsWithStatus) {
    const lob = document.lob || 'Unknown';
    if (!byLob[lob]) byLob[lob] = [];
    byLob[lob].push(document);
  }

  return {
    rootFolder: normalizedRootFolder,
    lobFolders: effectiveLobFolders,
    documents: documentsWithStatus,
    byLob,
    total: documentsWithStatus.length,
  };
}

function normalizeConcurrency(value) {
  const runtime = getPreparationRuntimeV1();
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Number(runtime.maxConcurrency || 10));
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function buildDocumentKey(doc) {
  return `${doc.relativeAUrl || ''}::${doc.fileAName || ''}`;
}

function normalizeInputDocuments(inputDocuments = []) {
  const runtime = getPreparationRuntimeV1();
  const unique = new Map();

  for (const doc of inputDocuments) {
    if (!doc || typeof doc !== 'object') continue;

    const siteName = String(doc.siteName || '').trim().toLowerCase();
    const fileAName = String(doc.fileAName || doc.name || '').trim();
    const relativeAUrl = String(doc.relativeAUrl || doc.relativeUrl || '').trim();
    const fileId = doc.fileId ? String(doc.fileId).trim() : '';
    const fileUpdatedAt = doc.fileUpdatedAt || doc.lastModified || doc.modifiedAt || doc.TimeLastModified || doc.Modified || null;
    const lob = String(doc.lob || doc.inferredLob || 'Unknown').trim() || 'Unknown';

    if (!siteName || !fileAName || !relativeAUrl) {
      continue;
    }

    const normalized = {
      siteName,
      fileAName,
      relativeAUrl,
      fileId,
      fileUpdatedAt: fileUpdatedAt ? toIsoString(fileUpdatedAt) : null,
      lob,
      preparationVersion: runtime.currentPreparationVersion,
      status: preparationStatus.NOT_PREPARED,
      lastError: null,
      lastUpdatedAt: new Date().toISOString(),
      conversationId: null,
      attempts: 0,
    };

    const dedupeKey = buildDocumentKey(normalized);
    unique.set(dedupeKey, normalized);
  }

  return Array.from(unique.values());
}

function selectMostRecent(existing, candidate) {
  const existingTime = new Date(existing?.createdAt || existing?.updatedAt || 0).getTime();
  const candidateTime = new Date(candidate?.createdAt || candidate?.updatedAt || 0).getTime();
  return candidateTime >= existingTime ? candidate : existing;
}

function normalizeExistingConversationStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.startsWith('complete')) return preparationStatus.PREPARED;
  if (normalized.startsWith('error')) return preparationStatus.ERRORED;
  return preparationStatus.NOT_PREPARED;
}

function normalizePreparationVersion(value) {
  const version = String(value || '').trim();
  return version || null;
}

function toNumericVersion(value) {
  const normalized = normalizePreparationVersion(value);
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function isAtOrAbovePreparationVersion(value, minimumPreparationVersion) {
  const normalized = normalizePreparationVersion(value);
  const minVersion = normalizePreparationVersion(minimumPreparationVersion) || '1';

  if (!normalized) {
    return minVersion === '1';
  }

  const docNumeric = toNumericVersion(normalized);
  const minNumeric = toNumericVersion(minVersion);
  if (docNumeric !== null && minNumeric !== null) {
    return docNumeric >= minNumeric;
  }

  return normalized === minVersion;
}

function isPreparedAtCurrentVersion(existing) {
  const runtime = getPreparationRuntimeV1();
  const status = normalizeExistingConversationStatus(existing?.status);
  if (status !== preparationStatus.PREPARED) return false;
  return isAtOrAbovePreparationVersion(existing?.preparationVersion, runtime.currentPreparationVersion);
}

function toTimestamp(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function wasFileUpdatedAfterPreparation(doc, existing) {
  const fileUpdatedAt = toTimestamp(doc?.fileUpdatedAt);
  const preparedAt = toTimestamp(existing?.preparedAt || existing?.updatedAt || existing?.createdAt);
  if (!fileUpdatedAt || !preparedAt) return false;
  return fileUpdatedAt > preparedAt;
}

async function getExistingConversationMap(documents, context = {}) {
  const map = new Map();
  if (!documents.length) return map;

  const relativeUrls = [...new Set(documents.map((doc) => doc.relativeAUrl))];
  const fileNames = [...new Set(documents.map((doc) => doc.fileAName))];

  const normalizedTeamName = normalizeRequiredTeamName(context?.teamName);
  const db = await connectToDatabase(`team-${normalizedTeamName}-db`);
  logPreparationEvent('getExistingConversationMapQuery', {
    source: context?.source || null,
    siteName: context?.siteName || null,
    rootFolder: context?.rootFolder || null,
    fileName: context?.fileName || null,
    lobFolders: Array.isArray(context?.lobFolders) ? context.lobFolders : null,
    requestedDocumentsCount: documents.length,
    requestedRelativeUrlCount: relativeUrls.length,
    requestedFileNameCount: fileNames.length,
    requestedSample: documents.slice(0, 20).map(toDocIdentity),
  });

  const runtime = getPreparationRuntimeV1();
  const existing = await db.collection(runtime.conversationCollectionName).find({
    type: 'GeisingerConversation',
    relativeAUrl: { $in: relativeUrls },
    fileAName: { $in: fileNames },
  }).toArray();

  logPreparationEvent('getExistingConversationMapFetched', {
    source: context?.source || null,
    fetchedCount: existing.length,
    fetchedStatusCounts: buildStatusCounts(existing),
    fetchedSample: existing.slice(0, 30).map(toDocIdentity),
  });

  for (const record of existing) {
    const key = buildDocumentKey(record);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, record);
      continue;
    }
    map.set(key, selectMostRecent(map.get(key), record));
  }

  logPreparationEvent('getExistingConversationMapResolved', {
    source: context?.source || null,
    resolvedKeyCount: map.size,
    resolvedSample: Array.from(map.values()).slice(0, 30).map(toDocIdentity),
  });

  return map;
}

function mergeWithExistingStatus(documents, existingMap) {
  const runtime = getPreparationRuntimeV1();
  const merged = documents.map((doc) => {
    const existing = existingMap.get(buildDocumentKey(doc));
    const existingStatus = existing ? normalizeExistingConversationStatus(existing.status) : preparationStatus.NOT_PREPARED;
    const preparedVersion = normalizePreparationVersion(existing?.preparationVersion);
    const changedSincePrepared = existingStatus === preparationStatus.PREPARED && wasFileUpdatedAfterPreparation(doc, existing);
    const status = isPreparedAtCurrentVersion(existing) && !changedSincePrepared
      ? preparationStatus.PREPARED
      : (existingStatus === preparationStatus.PREPARED ? preparationStatus.NOT_PREPARED : existingStatus);

    return {
      ...doc,
      status,
      conversationId: existing?.id || null,
      chatId: existing?.chatId || null,
      chatInteractionId: existing?.chatInteractionId || null,
      preparedVersion,
      preparedAt: existing?.preparedAt || existing?.updatedAt || existing?.createdAt || null,
      changedSincePrepared,
      requiresVersionUpgrade: existingStatus === preparationStatus.PREPARED
        && !isAtOrAbovePreparationVersion(preparedVersion, runtime.currentPreparationVersion),
      lastError: existing?.errorMessage || null,
      lastUpdatedAt: new Date().toISOString(),
    };
  });

  logPreparationEvent('mergeWithExistingStatus', {
    totalDocuments: documents.length,
    matchedExistingCount: merged.filter((doc) => !!doc.conversationId).length,
    mergedStatusCounts: buildStatusCounts(merged),
    unmatchedSample: merged
      .filter((doc) => !doc.conversationId)
      .slice(0, 20)
      .map(toDocIdentity),
    matchedSample: merged
      .filter((doc) => !!doc.conversationId)
      .slice(0, 20)
      .map(toDocIdentity),
  });

  return merged;
}

function shouldQueueItem(item, reprocessPrepared) {
  if (reprocessPrepared) {
    return item.status !== preparationStatus.PREPARING;
  }
  return item.status !== preparationStatus.PREPARED && item.status !== preparationStatus.PREPARING;
}

function buildSummary(items) {
  const summary = {
    total: items.length,
    prepared: 0,
    notPrepared: 0,
    preparing: 0,
    errored: 0,
  };

  for (const item of items) {
    if (item.status === preparationStatus.PREPARED) summary.prepared += 1;
    else if (item.status === preparationStatus.PREPARING) summary.preparing += 1;
    else if (item.status === preparationStatus.ERRORED) summary.errored += 1;
    else summary.notPrepared += 1;
  }

  return summary;
}

function buildByLob(items) {
  const byLob = {};

  for (const item of items) {
    const lob = item.lob || 'Unknown';
    if (!byLob[lob]) {
      byLob[lob] = {
        total: 0,
        prepared: 0,
        notPrepared: 0,
        preparing: 0,
        errored: 0,
      };
    }

    byLob[lob].total += 1;

    if (item.status === preparationStatus.PREPARED) byLob[lob].prepared += 1;
    else if (item.status === preparationStatus.PREPARING) byLob[lob].preparing += 1;
    else if (item.status === preparationStatus.ERRORED) byLob[lob].errored += 1;
    else byLob[lob].notPrepared += 1;
  }

  return byLob;
}

function resolvePreparedConversationId(result = {}, currentItem = {}) {
  return result?.geisingerConversationId
    || result?.conversationId
    || currentItem?.conversationId
    || null;
}

function sortJobsByCreatedAt(jobs) {
  return [...jobs].sort((a, b) => {
    const aTime = new Date(a?.createdAt || 0).getTime();
    const bTime = new Date(b?.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function getProgressEntryForItem(job, item) {
  const chatInteractionId = String(item?.chatInteractionId || '').trim();
  if (!chatInteractionId) return null;

  const progressMap = job?.progressByChatInteractionId;
  if (!progressMap || typeof progressMap !== 'object') return null;

  const entry = progressMap[chatInteractionId];
  if (!entry) return null;

  if (typeof entry === 'string') {
    return {
      markdown: entry,
      updatedAt: null,
    };
  }

  return {
    markdown: typeof entry.markdown === 'string' ? entry.markdown : null,
    updatedAt: entry.updatedAt || null,
  };
}

function buildStatusPayload(job) {
  const runtime = getPreparationRuntimeV1();
  if (!job) return null;

  const rawItems = Array.isArray(job.items) ? job.items : [];
  const items = rawItems.map((item) => {
    const progressEntry = getProgressEntryForItem(job, item);
    if (!progressEntry) return item;

    return {
      ...item,
      progressMarkdown: progressEntry.markdown,
      progressUpdatedAt: progressEntry.updatedAt,
    };
  });
  const summary = job.summary || buildSummary(items);
  const byLob = job.byLob || buildByLob(items);

  return {
    jobId: job.id,
    jobType: runtime.jobType,
    currentPreparationVersion: runtime.currentPreparationVersion,
    status: job.status,
    cancelRequested: !!job.cancelRequested,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    lastUpdatedAt: job.lastUpdatedAt || null,
    concurrency: job.concurrency || 1,
    reprocessPrepared: !!job.reprocessPrepared,
    summary,
    byLob,
    items,
  };
}

async function findChatInteractionProgress(teamName, { chatId, chatInteractionId } = {}) {
  if (!teamName || !chatId || !chatInteractionId) return null;

  const teamDb = await connectToDatabase(`team-${teamName}-db`);
  const chatInteraction = await teamDb.collection('user_collection').findOne({
    type: 'ChatInteraction',
    parentId: chatId,
    id: chatInteractionId,
  });

  return chatInteraction?.response || null;
}

async function persistProgress(teamName, jobId, items, extra = {}) {
  await updateJob(teamName, jobId, {
    ...extra,
    items,
    summary: buildSummary(items),
    byLob: buildByLob(items),
    lastUpdatedAt: new Date().toISOString(),
  });
}

function updateItem(items, index, patch) {
  const next = [...items];
  next[index] = {
    ...next[index],
    ...patch,
    lastUpdatedAt: new Date().toISOString(),
  };
  return next;
}

function ensureProgressIds(item = {}) {
  return {
    chatId: item.chatId || uuidv4(),
    chatInteractionId: item.chatInteractionId || uuidv4(),
  };
}

function resetItemToNotPrepared(item = {}) {
  return {
    ...item,
    status: preparationStatus.NOT_PREPARED,
    lastError: null,
    lastUpdatedAt: new Date().toISOString(),
    changedSincePrepared: false,
    requiresVersionUpgrade: false,
    preparedAt: null,
    preparedVersion: null,
  };
}

async function runPreparationWorker(teamName, jobId) {
  await resolvePreparationConfigV1();
  const runtime = getPreparationRuntimeV1();
  const startingJob = await getJobById(teamName, jobId);
  if (!startingJob) return;

  let items = Array.isArray(startingJob.items) ? startingJob.items : [];
  const reprocessPrepared = !!startingJob.reprocessPrepared;
  const concurrency = normalizeConcurrency(startingJob.concurrency);
  const queue = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => shouldQueueItem(item, reprocessPrepared))
    .map(({ index }) => index);

  logPreparationEvent('runPreparationWorkerStart', {
    teamName,
    jobId,
    queueLength: queue.length,
    totalItems: items.length,
    reprocessPrepared,
    concurrency,
    itemStatusCounts: buildStatusCounts(items),
  });

  if (queue.length === 0) {
    await updateJob(teamName, jobId, {
      status: jobStatus.COMPLETE,
      finishedAt: new Date().toISOString(),
      summary: buildSummary(items),
      byLob: buildByLob(items),
      lastUpdatedAt: new Date().toISOString(),
    });
    return;
  }

  let queueCursor = 0;
  let canceled = false;

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queueCursor < queue.length) {
      const nextIndex = queue[queueCursor];
      queueCursor += 1;

      const latestJob = await getJobById(teamName, jobId);
      if (!latestJob) return;
      if (latestJob.cancelRequested || latestJob.resetRequested) {
        canceled = true;
        return;
      }

      items = Array.isArray(latestJob.items) ? latestJob.items : items;
      let currentItem = items[nextIndex];
      if (!currentItem) continue;

      const progressIds = ensureProgressIds(currentItem);
      currentItem = {
        ...currentItem,
        ...progressIds,
      };

      items = updateItem(items, nextIndex, {
        status: preparationStatus.PREPARING,
        lastError: null,
        attempts: Number(currentItem.attempts || 0) + 1,
        preparationVersion: runtime.currentPreparationVersion,
        chatId: currentItem.chatId,
        chatInteractionId: currentItem.chatInteractionId,
      });
      logPreparationEvent('runPreparationWorkerItemPreparing', {
        teamName,
        jobId,
        itemIndex: nextIndex,
        item: toDocIdentity({ ...currentItem, status: preparationStatus.PREPARING }),
        attempts: Number(currentItem.attempts || 0) + 1,
      });
      await persistProgress(teamName, jobId, items);

      try {
        const routedPreparation = await runCompliancePreparationWithRouting({
          teamName,
          item: currentItem,
          context: {
            preparationVersion: runtime.currentPreparationVersion,
            chatId: currentItem.chatId,
            chatInteractionId: currentItem.chatInteractionId,
          },
        });

        const result = routedPreparation?.result || {};
        const routing = routedPreparation?.routing || {};
        const resolvedConversationId = resolvePreparedConversationId(result, currentItem);

        const afterWorkJob = await getJobById(teamName, jobId);
        if (!afterWorkJob || afterWorkJob.resetRequested) {
          canceled = true;
          return;
        }

        items = updateItem(items, nextIndex, {
          status: preparationStatus.PREPARED,
          conversationId: resolvedConversationId,
          preparationVersion: runtime.currentPreparationVersion,
          preparedVersion: runtime.currentPreparationVersion,
          preparedAt: new Date().toISOString(),
          changedSincePrepared: false,
          requiresVersionUpgrade: false,
          chatId: currentItem.chatId,
          chatInteractionId: currentItem.chatInteractionId,
          lastError: null,
          selectedPrepEngine: routing.selectedPrepEngine || 'legacy',
          effectivePrepEngine: routing.effectivePrepEngine || 'legacy',
          prepEngineFallbackTriggered: !!routing.fallbackTriggered,
          prepEngineFallbackReason: routing.fallbackReason || null,
        });
        logPreparationEvent('runPreparationWorkerItemPrepared', {
          teamName,
          jobId,
          itemIndex: nextIndex,
          conversationId: resolvedConversationId,
          selectedPrepEngine: routing.selectedPrepEngine || 'legacy',
          effectivePrepEngine: routing.effectivePrepEngine || 'legacy',
          prepEngineFallbackTriggered: !!routing.fallbackTriggered,
          prepEngineFallbackReason: routing.fallbackReason || null,
          item: toDocIdentity({
            ...currentItem,
            status: preparationStatus.PREPARED,
            conversationId: resolvedConversationId,
            preparationVersion: runtime.currentPreparationVersion,
            preparedAt: new Date().toISOString(),
          }),
        });
      } catch (error) {
        const afterWorkJob = await getJobById(teamName, jobId);
        if (!afterWorkJob || afterWorkJob.resetRequested) {
          canceled = true;
          return;
        }

        items = updateItem(items, nextIndex, {
          status: preparationStatus.ERRORED,
          preparationVersion: runtime.currentPreparationVersion,
          chatId: currentItem.chatId,
          chatInteractionId: currentItem.chatInteractionId,
          lastError: error?.message || 'Unknown preparation error',
        });
        logPreparationEvent('runPreparationWorkerItemErrored', {
          teamName,
          jobId,
          itemIndex: nextIndex,
          item: toDocIdentity({ ...currentItem, status: preparationStatus.ERRORED }),
          error: error?.message || 'Unknown preparation error',
        });
      }

      await persistProgress(teamName, jobId, items);
    }
  });

  try {
    await Promise.all(workers);
  } catch (error) {
    await updateJob(teamName, jobId, {
      status: jobStatus.ERROR,
      error: error?.message || 'Unexpected worker error',
      finishedAt: new Date().toISOString(),
      items,
      summary: buildSummary(items),
      byLob: buildByLob(items),
      lastUpdatedAt: new Date().toISOString(),
    });
    return;
  }

  const latestJob = await getJobById(teamName, jobId);
  if (!latestJob) return;
  if (latestJob.resetRequested) {
    return;
  }

  const finalCanceled = canceled || !!latestJob?.cancelRequested;

  logPreparationEvent('runPreparationWorkerFinalize', {
    teamName,
    jobId,
    finalCanceled,
    itemStatusCounts: buildStatusCounts(items),
  });

  await updateJob(teamName, jobId, {
    status: finalCanceled ? jobStatus.CANCELED : jobStatus.COMPLETE,
    finishedAt: new Date().toISOString(),
    items,
    summary: buildSummary(items),
    byLob: buildByLob(items),
    lastUpdatedAt: new Date().toISOString(),
  });
}

function ensureWorkerStarted(teamName, jobId) {
  if (activeWorkers.has(jobId)) return;

  activeWorkers.add(jobId);
  runPreparationWorker(teamName, jobId)
    .catch(async (error) => {
      await updateJob(teamName, jobId, {
        status: jobStatus.ERROR,
        error: error?.message || 'Unhandled preparation worker failure',
        finishedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      });
    })
    .finally(() => {
      activeWorkers.delete(jobId);
    });
}

export async function getLatestGeisingerPreparationJob(teamName) {
  await resolvePreparationConfigV1();
  const runtime = getPreparationRuntimeV1();
  const jobs = await getAllJobs(teamName, runtime.jobType);
  if (!Array.isArray(jobs) || jobs.length === 0) return null;
  const sorted = sortJobsByCreatedAt(jobs);
  return sorted[0];
}

export async function startGeisingerPreparationJob(teamName, {
  documents = [],
  concurrency = 1,
  reprocessPrepared = false,
  jobName = null,
} = {}) {
  await resolvePreparationConfigV1();
  const runtime = getPreparationRuntimeV1();
  const normalizedDocs = normalizeInputDocuments(documents);
  if (!normalizedDocs.length) {
    throw new Error('No valid documents provided. Required: siteName, fileAName, relativeAUrl.');
  }

  const existingMap = await getExistingConversationMap(normalizedDocs, {
    source: 'startGeisingerPreparationJob',
    teamName,
    totalInputDocs: normalizedDocs.length,
  });
  const items = mergeWithExistingStatus(normalizedDocs, existingMap);
  const normalizedConcurrency = normalizeConcurrency(concurrency);

  const job = await createJob(teamName, runtime.jobType, {
    name: jobName || `Geisinger preparation ${new Date().toISOString()}`,
    status: jobStatus.PROCESSING,
    cancelRequested: false,
    concurrency: normalizedConcurrency,
    reprocessPrepared: !!reprocessPrepared,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    items,
    summary: buildSummary(items),
    byLob: buildByLob(items),
  });

  if (!job?.id) {
    throw new Error('Unable to create preparation job.');
  }

  ensureWorkerStarted(teamName, job.id);
  return buildStatusPayload(job);
}

export async function getGeisingerPreparationStatus(teamName, jobId = null) {
  await resolvePreparationConfigV1();
  const job = jobId ? await getJobById(teamName, jobId) : await getLatestGeisingerPreparationJob(teamName);
  return buildStatusPayload(job);
}

export async function getGeisingerPreparationDocumentProgress(teamName, {
  jobId,
  relativeAUrl,
  fileAName,
} = {}) {
  await resolvePreparationConfigV1();
  if (!jobId || !relativeAUrl || !fileAName) {
    throw new Error('jobId, relativeAUrl and fileAName are required.');
  }

  const job = await getJobById(teamName, jobId);
  if (!job) return null;

  const items = Array.isArray(job.items) ? job.items : [];
  const targetItem = items.find((item) => (
    String(item?.relativeAUrl || '') === String(relativeAUrl) &&
    String(item?.fileAName || '') === String(fileAName)
  ));

  if (!targetItem) return null;

  const jobProgressEntry = getProgressEntryForItem(job, targetItem);
  let progressMarkdown = jobProgressEntry?.markdown || null;

  let chatId = targetItem.chatId || null;
  let chatInteractionId = targetItem.chatInteractionId || null;

  let conversation = null;
  const normalizedTeamName = normalizeRequiredTeamName(teamName);
  const teamDb = await connectToDatabase(`team-${normalizedTeamName}-db`);
  const runtime = getPreparationRuntimeV1();

  if ((!chatId || !chatInteractionId) && targetItem.conversationId) {
    conversation = await teamDb.collection(runtime.conversationCollectionName).findOne({
      type: 'GeisingerConversation',
      id: targetItem.conversationId,
    });

    chatId = chatId || conversation?.chatId || null;
    chatInteractionId = chatInteractionId || conversation?.chatInteractionId || null;
  }

  if (!chatId || !chatInteractionId) {
    const conversations = await teamDb.collection(runtime.conversationCollectionName).find({
      type: 'GeisingerConversation',
      fileAName: targetItem.fileAName,
      relativeAUrl: targetItem.relativeAUrl,
    }).toArray();
    conversation = conversations.reduce((latest, candidate) => {
      if (!latest) return candidate;
      return selectMostRecent(latest, candidate);
    }, null);

    chatId = chatId || conversation?.chatId || null;
    chatInteractionId = chatInteractionId || conversation?.chatInteractionId || null;
  }

  if (!progressMarkdown) {
    progressMarkdown = await findChatInteractionProgress(teamName, { chatId, chatInteractionId });
  }

  if (!progressMarkdown) {
    const lines = [
      '## Preparation Progress',
      '',
      `Status: ${targetItem.status || 'Unknown'}`,
      `Attempts: ${Number(targetItem.attempts || 0)}`,
      targetItem.lastUpdatedAt ? `Last update: ${targetItem.lastUpdatedAt}` : null,
      conversation?.status ? `Conversation status: ${conversation.status}` : null,
      conversation?.updatedAt ? `Conversation updated: ${conversation.updatedAt}` : null,
      conversation?.preparedAt ? `Prepared at: ${conversation.preparedAt}` : null,
      targetItem.lastError || conversation?.errorMessage ? `Error: ${targetItem.lastError || conversation?.errorMessage}` : null,
      '',
      'Live preparation progress markdown is not yet available for this document. Processing may still be running.'
    ].filter(Boolean);

    progressMarkdown = lines.join('\n');
  }

  return {
    fileAName: targetItem.fileAName,
    relativeAUrl: targetItem.relativeAUrl,
    status: targetItem.status,
    chatId: chatId || null,
    chatInteractionId: chatInteractionId || null,
    progressUpdatedAt: jobProgressEntry?.updatedAt || null,
    progressMarkdown: progressMarkdown || null,
    hasProgress: !!progressMarkdown,
  };
}

export async function requestStopGeisingerPreparationJob(teamName, jobId = null, {
  resetToNotPrepared = false,
} = {}) {
  const targetJob = jobId ? await getJobById(teamName, jobId) : await getLatestGeisingerPreparationJob(teamName);
  if (!targetJob) return null;

  const now = new Date().toISOString();
  const shouldReset = !!resetToNotPrepared;
  const currentItems = Array.isArray(targetJob.items) ? targetJob.items : [];
  const nextItems = shouldReset ? currentItems.map((item) => resetItemToNotPrepared(item)) : currentItems;
  const nextProgressMap = shouldReset ? {} : (targetJob.progressByChatInteractionId || {});

  await updateJob(teamName, targetJob.id, {
    cancelRequested: true,
    canceledAt: now,
    status: shouldReset ? jobStatus.CANCELED : (targetJob.status || jobStatus.CANCELED),
    finishedAt: shouldReset ? now : (targetJob.finishedAt || null),
    resetRequested: shouldReset,
    resetRequestedAt: shouldReset ? now : (targetJob.resetRequestedAt || null),
    items: nextItems,
    summary: buildSummary(nextItems),
    byLob: buildByLob(nextItems),
    progressByChatInteractionId: nextProgressMap,
    lastUpdatedAt: now,
  });

  const updated = await getJobById(teamName, targetJob.id);
  return buildStatusPayload(updated);
}
