'use server';

import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { orchestrateFirstPrinciplesSearchPreparation } from '@/app/services/langgraphs/compliance/docConversation1stPriOrchestrator';
import {
  deleteFirstPrinciplesArtifactsByConversationId,
  deleteFirstPrinciplesArtifactsByDocument,
} from '@/app/services/langgraphs/compliance/docConversation1stPriCleanupService';
import { prepareSharePointPdfsForConversation as runLegacyPreparation } from '@/app/services/langgraphs/compliance/docConversationService3';
import {
  resolveEnvValueByRef,
  resolveFirstPrinciplesRuntimeConfigV1,
} from '@/app/services/langgraphs/compliance/helpers/loadFirstPrinciplesRuntimeConfigV1';

const LEGACY_INDEX_NAME = 'geisinger-002';
const FIRST_PRINCIPLES_CHUNK_INDEX = 'compliance-chunks-v1';
const FIRST_PRINCIPLES_REQUIREMENT_INDEX = 'compliance-requirements-v1';

const LEGACY_KEY_REFS = {
  endpoint: 'searchEndpoint',
  query: 'aisearch.api.key',
};

function logFirstPrinciplesPrepEvent(name, detail = {}) {
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

function normalizePage(value) {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? page : null;
}

function isUseVaultEnabled() {
  return normalizeString(process.env.USE_VAULT).toLowerCase() === 'true';
}

function resolveKeyRefFamily(keyRef) {
  return normalizeString(keyRef).includes('.new.t3') ? 'first-principles' : 'legacy';
}

function resolveLegacySearchRuntime() {
  const searchEndpoint = resolveEnvValueByRef(LEGACY_KEY_REFS.endpoint);
  const searchApiKey = resolveEnvValueByRef(LEGACY_KEY_REFS.query);

  if (!searchEndpoint || !searchApiKey) {
    const error = new Error('Legacy search runtime keys are unavailable for first-principles prep bridge. Required refs: searchEndpoint, aisearch.api.key.');
    error.statusCode = 500;
    throw error;
  }

  return {
    searchEndpoint,
    searchApiKey,
  };
}

function resolveFirstPrinciplesSearchRuntime(firstPrinciplesConfig = {}) {
  const endpointRef = normalizeString(firstPrinciplesConfig?.searchEndpointKeyRef);
  const uploadRef = normalizeString(firstPrinciplesConfig?.searchUploadKeyRef);

  if (!endpointRef || !uploadRef) {
    const error = new Error('First-principles search endpoint/upload key references are required for prep execution.');
    error.statusCode = 500;
    throw error;
  }

  const searchEndpoint = resolveEnvValueByRef(endpointRef);
  const searchUploadKey = resolveEnvValueByRef(uploadRef);

  if (!searchEndpoint || !searchUploadKey) {
    const error = new Error('First-principles search runtime key values are missing from environment resolution.');
    error.statusCode = 500;
    throw error;
  }

  const useVaultEnabled = isUseVaultEnabled();
  const expectedFamily = useVaultEnabled ? 'legacy' : 'first-principles';
  const endpointFamily = resolveKeyRefFamily(endpointRef);
  const uploadFamily = resolveKeyRefFamily(uploadRef);
  const resolvedFamily = endpointFamily === uploadFamily ? endpointFamily : 'mixed';

  return {
    searchEndpoint,
    searchUploadKey,
    endpointRef,
    uploadRef,
    chunkIndexName: normalizeString(firstPrinciplesConfig?.chunkIndexName, FIRST_PRINCIPLES_CHUNK_INDEX),
    requirementIndexName: normalizeString(firstPrinciplesConfig?.requirementIndexName, FIRST_PRINCIPLES_REQUIREMENT_INDEX),
    keyResolution: {
      useVaultEnabled,
      expectedFamily,
      resolvedFamily,
      mapsToService3KeyFamily: expectedFamily === 'legacy',
      endpointRef,
      uploadRef,
    },
  };
}

async function fetchAllLegacyChunks({
  searchEndpoint,
  searchApiKey,
  conversationId,
}) {
  const client = new SearchClient(
    searchEndpoint,
    LEGACY_INDEX_NAME,
    new AzureKeyCredential(searchApiKey)
  );

  const normalizedConversationId = String(conversationId || '').replace(/'/g, "''");
  const filter = `smartnote_id eq '${normalizedConversationId}'`;

  const docs = [];
  let skip = 0;
  const top = 1000;

  // Keep pagination bounded for safety while covering large prepared docs.
  while (skip < 20000) {
    const response = await client.search('*', {
      filter,
      top,
      skip,
      select: ['id', 'title', 'content', 'page', 'createdAt'],
    });

    const pageDocs = [];
    for await (const result of response.results) {
      if (result?.document) {
        pageDocs.push(result.document);
      }
    }

    if (!pageDocs.length) {
      break;
    }

    docs.push(...pageDocs);
    if (pageDocs.length < top) {
      break;
    }

    skip += top;
  }

  return docs;
}

function buildSectionsFromLegacyChunks(legacyDocs = []) {
  const sortedDocs = (Array.isArray(legacyDocs) ? legacyDocs : [])
    .filter((doc) => normalizeString(doc?.content))
    .sort((a, b) => {
      const pageA = normalizePage(a?.page) || Number.MAX_SAFE_INTEGER;
      const pageB = normalizePage(b?.page) || Number.MAX_SAFE_INTEGER;
      if (pageA !== pageB) return pageA - pageB;

      const createdA = new Date(a?.createdAt || 0).getTime();
      const createdB = new Date(b?.createdAt || 0).getTime();
      if (createdA !== createdB) return createdA - createdB;

      return normalizeString(a?.id).localeCompare(normalizeString(b?.id));
    });

  let cursor = 0;
  return sortedDocs.map((doc) => {
    const heading = normalizeString(doc?.title, 'Document Section');
    const content = normalizeString(doc?.content);
    const startIndex = cursor;
    const endIndex = startIndex + content.length;
    cursor = endIndex + 1;

    return {
      heading,
      content,
      startPage: normalizePage(doc?.page),
      startIndex,
      endIndex,
      subsections: [],
    };
  });
}

function createFirstPrinciplesWriteDeps({ searchEndpoint, searchUploadKey }) {
  const updateClientCache = new Map();
  const searchClientCache = new Map();

  return {
    getSearchClient(indexName) {
      const normalizedIndexName = normalizeString(indexName);
      if (!normalizedIndexName) {
        throw new Error('indexName is required for first-principles search client resolution.');
      }

      if (!searchClientCache.has(normalizedIndexName)) {
        searchClientCache.set(
          normalizedIndexName,
          new SearchClient(searchEndpoint, normalizedIndexName, new AzureKeyCredential(searchUploadKey))
        );
      }

      return searchClientCache.get(normalizedIndexName);
    },
    getUpdateClient(indexName) {
      const normalizedIndexName = normalizeString(indexName);
      if (!normalizedIndexName) {
        throw new Error('indexName is required for first-principles update client resolution.');
      }

      if (!updateClientCache.has(normalizedIndexName)) {
        updateClientCache.set(
          normalizedIndexName,
          new SearchClient(searchEndpoint, normalizedIndexName, new AzureKeyCredential(searchUploadKey))
        );
      }

      return updateClientCache.get(normalizedIndexName);
    },
  };
}

export async function runFirstPrinciplesPreparationForConversation({
  teamName,
  configDoc = {},
  runtimeConfig,
  conversationId,
  fileAName,
  lob,
  preparationVersion,
  preparationPayload,
} = {}) {
  const incomingConversationId = normalizeString(conversationId);
  let normalizedConversationId = incomingConversationId;
  let conversationIdSource = incomingConversationId ? 'argument.conversationId' : 'legacyPrepResult.geisingerConversationId';
  let effectiveFileAName = normalizeString(fileAName);
  let effectiveLob = normalizeString(lob);

  logFirstPrinciplesPrepEvent('firstPrinciplesPreparationRuntimeConversationIdInput', {
    teamName: normalizeString(teamName) || null,
    incomingConversationId: incomingConversationId || null,
    incomingConversationIdSource: incomingConversationId ? 'argument.conversationId' : 'missing',
    fileAName: effectiveFileAName || null,
    lob: effectiveLob || null,
    hasPreparationPayload: !!(preparationPayload && typeof preparationPayload === 'object'),
  });

  // Always execute the legacy prep bridge first so prior Mongo + legacy AI Search
  // artifacts for this document are deleted/rebuilt before first-principles projection.
  if (!preparationPayload || typeof preparationPayload !== 'object') {
    const error = new Error('preparationPayload is required for first-principles prep execution.');
    error.statusCode = 400;
    throw error;
  }

  const legacyPrepPayload = {
    ...preparationPayload,
    suppressProgressUpdates: true,
    ...(incomingConversationId ? { id: incomingConversationId } : {}),
  };

  logFirstPrinciplesPrepEvent('firstPrinciplesPreparationRuntimeLegacyPrepBridgeStarted', {
    teamName: normalizeString(teamName) || null,
    incomingConversationId: incomingConversationId || null,
    effectiveLegacyPayloadConversationId: normalizeString(legacyPrepPayload?.id) || null,
    fileAName: normalizeString(legacyPrepPayload?.fileAName) || effectiveFileAName || null,
    lob: normalizeString(legacyPrepPayload?.lob || legacyPrepPayload?.inferredLob) || effectiveLob || null,
    suppressProgressUpdates: legacyPrepPayload?.suppressProgressUpdates === true,
  });

  const legacyPrepResult = await runLegacyPreparation(legacyPrepPayload);
  normalizedConversationId = normalizeString(legacyPrepResult?.geisingerConversationId);
  if (!normalizedConversationId) {
    const error = new Error('Legacy preparation did not return a conversation ID required for first-principles projection.');
    error.statusCode = 500;
    throw error;
  }

  conversationIdSource = 'legacyPrepResult.geisingerConversationId';
  logFirstPrinciplesPrepEvent('firstPrinciplesPreparationRuntimeLegacyPrepBridgeCompleted', {
    teamName: normalizeString(teamName) || null,
    conversationId: normalizedConversationId,
    conversationIdSource,
    legacyPrepResultConversationId: normalizeString(legacyPrepResult?.geisingerConversationId) || null,
    fileNameFromLegacyPrepResult: normalizeString(legacyPrepResult?.file) || null,
    legacyPrepStatus: normalizeString(legacyPrepResult?.status) || null,
  });

  logFirstPrinciplesPrepEvent('firstPrinciplesPreparationRuntimeConversationIdFromLegacyPrep', {
    teamName: normalizeString(teamName) || null,
    conversationId: normalizedConversationId,
    conversationIdSource,
    legacyPrepResultConversationId: normalizeString(legacyPrepResult?.geisingerConversationId) || null,
    fileANameFromPayload: normalizeString(legacyPrepPayload?.fileAName) || null,
    lobFromPayload: normalizeString(legacyPrepPayload?.lob || legacyPrepPayload?.inferredLob) || null,
  });

  effectiveFileAName = effectiveFileAName || normalizeString(legacyPrepPayload?.fileAName);
  effectiveLob = effectiveLob || normalizeString(legacyPrepPayload?.lob || legacyPrepPayload?.inferredLob);

  const legacyRuntime = resolveLegacySearchRuntime();

  logFirstPrinciplesPrepEvent('firstPrinciplesPreparationRuntimeConversationIdResolved', {
    teamName: normalizeString(teamName) || null,
    conversationId: normalizedConversationId,
    conversationIdSource,
    incomingConversationId: incomingConversationId || null,
    fileAName: effectiveFileAName || null,
    lob: effectiveLob || null,
  });

  let resolvedRuntimeConfig = runtimeConfig;
  if (!resolvedRuntimeConfig || typeof resolvedRuntimeConfig !== 'object') {
    const runtimeSnapshot = await resolveFirstPrinciplesRuntimeConfigV1({ inferredLob: effectiveLob });
    resolvedRuntimeConfig = runtimeSnapshot?.config || {};
  }

  const effectiveFirstPrinciplesConfig =
    (resolvedRuntimeConfig?.firstPrinciples && typeof resolvedRuntimeConfig.firstPrinciples === 'object')
      ? resolvedRuntimeConfig.firstPrinciples
      : {
        searchEndpointKeyRef: configDoc?.firstPrinciplesSearchEndpointKey,
        searchUploadKeyRef: configDoc?.firstPrinciplesSearchUploadKey,
        chunkIndexName: FIRST_PRINCIPLES_CHUNK_INDEX,
        requirementIndexName: FIRST_PRINCIPLES_REQUIREMENT_INDEX,
      };

  const firstPrinciplesRuntime = resolveFirstPrinciplesSearchRuntime(effectiveFirstPrinciplesConfig);

  const legacyDocs = await fetchAllLegacyChunks({
    searchEndpoint: legacyRuntime.searchEndpoint,
    searchApiKey: legacyRuntime.searchApiKey,
    conversationId: normalizedConversationId,
  });

  const sections = buildSectionsFromLegacyChunks(legacyDocs);
  if (!sections.length) {
    const error = new Error('No legacy indexed sections were found to derive first-principles prep artifacts.');
    error.statusCode = 500;
    throw error;
  }

  const deps = createFirstPrinciplesWriteDeps({
    searchEndpoint: firstPrinciplesRuntime.searchEndpoint,
    searchUploadKey: firstPrinciplesRuntime.searchUploadKey,
  });

  // Enforce one active first-principles artifact footprint per prepared document.
  if (effectiveFileAName) {
    await deleteFirstPrinciplesArtifactsByDocument({
      fileName: effectiveFileAName,
      lob: effectiveLob,
      excludeConversationId: normalizedConversationId,
      options: {
        chunkIndexName: firstPrinciplesRuntime.chunkIndexName,
        requirementIndexName: firstPrinciplesRuntime.requirementIndexName,
      },
    }, deps);
  }

  // Ensure idempotent reruns for the same conversation.
  await deleteFirstPrinciplesArtifactsByConversationId({
    conversationId: normalizedConversationId,
    options: {
      chunkIndexName: firstPrinciplesRuntime.chunkIndexName,
      requirementIndexName: firstPrinciplesRuntime.requirementIndexName,
    },
  }, deps);

  const summary = await orchestrateFirstPrinciplesSearchPreparation({
    conversation: {
      id: normalizedConversationId,
      fileAName: effectiveFileAName,
      lob: effectiveLob,
      preparationVersion: normalizeString(preparationVersion, '1'),
    },
    sections,
    options: {
      conversationId: normalizedConversationId,
      fileName: effectiveFileAName,
      lob: effectiveLob,
      prepVersion: normalizeString(preparationVersion, '1'),
      chunkIndexName: firstPrinciplesRuntime.chunkIndexName,
      requirementIndexName: firstPrinciplesRuntime.requirementIndexName,
      strictValidation: true,
      emitLogs: true,
    },
  }, deps);

  logFirstPrinciplesPrepEvent('firstPrinciplesPreparationRuntimeCompleted', {
    teamName: normalizeString(teamName) || null,
    conversationId: normalizedConversationId,
    conversationIdSource,
    incomingConversationId: incomingConversationId || null,
    fileAName: effectiveFileAName || null,
    lob: effectiveLob || null,
    legacyChunkSourceCount: sections.length,
    chunkUploadedCount: summary?.writeSummary?.chunkWriteResult?.uploadedCount || 0,
    requirementUploadedCount: summary?.writeSummary?.requirementWriteResult?.uploadedCount || 0,
    chunkIndexName: firstPrinciplesRuntime.chunkIndexName,
    requirementIndexName: firstPrinciplesRuntime.requirementIndexName,
    firstPrinciplesKeyResolution: firstPrinciplesRuntime.keyResolution,
  });

  return {
    conversationId: normalizedConversationId,
    chunkIndexName: firstPrinciplesRuntime.chunkIndexName,
    requirementIndexName: firstPrinciplesRuntime.requirementIndexName,
    legacyChunkSourceCount: sections.length,
    chunkUploadedCount: summary?.writeSummary?.chunkWriteResult?.uploadedCount || 0,
    requirementUploadedCount: summary?.writeSummary?.requirementWriteResult?.uploadedCount || 0,
    durationMs: summary?.durationMs || 0,
    firstPrinciplesKeyResolution: firstPrinciplesRuntime.keyResolution,
  };
}
