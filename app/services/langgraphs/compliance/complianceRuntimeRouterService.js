'use server';

import { AzureOpenAI } from 'openai';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import ExcelJS from 'exceljs-hardened';
import { getCompletionsClient } from '@/app/services/chatCompletionService3.js';
import { complianceConversationGraphV2 } from './complianceConversationService2';
import { complianceComparisonGraphV2 } from './complianceComparisonService2';
import { answerWithFirstPrinciplesConversationEngine } from './docConversation1stPriConversationEngine';
import { compareWithFirstPrinciplesEngine } from './docConversation1stPriComparisonEngine';
import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '@/app/services/blobStorageService';
import {
  resolveComplianceRuntimeEngines,
  buildConversationFirstPrinciplesResponse,
  buildComparisonFirstPrinciplesResponse,
} from './helpers/runtimeEngineRouting';
import {
  updateChatInteractionProgress,
  createProgressMarkdown,
  isChatInteractionCancelledError,
  assertChatInteractionNotCancelled,
} from './helpers/progressTracking';

function logRoutingEvent(name, detail = {}) {
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

function resolveConversationIdWithSource(request = {}) {
  const candidates = [
    { source: 'request.geisingerConversation.id', value: request?.geisingerConversation?.id },
    { source: 'request.geisingerConversationId', value: request?.geisingerConversationId },
    { source: 'request.conversationId', value: request?.conversationId },
  ];

  for (const candidate of candidates) {
    const value = normalizeString(candidate?.value);
    if (value) {
      return {
        conversationId: value,
        conversationIdSource: candidate.source,
      };
    }
  }

  return {
    conversationId: '',
    conversationIdSource: 'missing',
  };
}

function buildConversationTraceId({ conversationId, chatInteractionId, chatId } = {}) {
  const cId = normalizeString(conversationId, 'no-conversation');
  const ciId = normalizeString(chatInteractionId, 'no-chat-interaction');
  const chId = normalizeString(chatId, 'no-chat');
  return `first-pri-conversation-${cId}-${ciId}-${chId}-${Date.now()}`;
}

function normalizeComparisonMode(value) {
  const mode = normalizeString(value).toLowerCase();
  return mode === 'comprehensive' ? 'comprehensive' : 'topic';
}

function normalizeTopicComparisonQueryText(prompt = '') {
  const raw = normalizeString(prompt);
  if (!raw || raw === '*') return raw || '*';

  // If user explicitly quotes a term, compare on the quoted term itself.
  const quotedAnyMatch = raw.match(/["']([^"']+)["']/);
  if (quotedAnyMatch?.[1]) {
    return normalizeString(quotedAnyMatch[1]);
  }

  // Handle definition-style prompts such as "what does affiliate mean".
  const definitionPromptMatch = raw.match(/(?:what\s+does|define|meaning\s+of)\s+(.+?)(?:\s+mean\??)?$/i);
  if (definitionPromptMatch?.[1]) {
    return normalizeString(definitionPromptMatch[1]).replace(/[.\s?]+$/, '');
  }

  const quotedMatch = raw.match(/topic\s+of\s+"([^"]+)"/i) || raw.match(/topic\s+of\s+'([^']+)'/i);
  if (quotedMatch?.[1]) {
    return normalizeString(quotedMatch[1]);
  }

  const topicOfMatch = raw.match(/topic\s+of\s+(.+)$/i);
  if (topicOfMatch?.[1]) {
    return normalizeString(topicOfMatch[1]).replace(/[.\s]+$/, '');
  }

  // Remove common wrapper prefixes while preserving user intent text.
  const stripped = raw
    .replace(/^perform\s+a\s+topic\s+based\s+comparison\s+(on\s+)?/i, '')
    .replace(/^please\s+perform\s+a\s+topic\s+based\s+comparison\s+(on\s+)?/i, '')
    .replace(/^compare\s+(on\s+)?the\s+topic\s+of\s+/i, '')
    .trim()
    .replace(/[.\s]+$/, '');

  return stripped || raw;
}

function buildComparisonTraceId({ leftConversationId, rightConversationId, chatInteractionId, chatId } = {}) {
  const leftId = normalizeString(leftConversationId, 'no-left');
  const rightId = normalizeString(rightConversationId, 'no-right');
  const ciId = normalizeString(chatInteractionId, 'no-chat-interaction');
  const chId = normalizeString(chatId, 'no-chat');
  return `first-pri-comparison-${leftId}-${rightId}-${ciId}-${chId}-${Date.now()}`;
}

function resolveFirstPrinciplesComparisonTimeoutMs() {
  const rawValue = Number(process.env.FIRST_PRINCIPLES_COMPARISON_TIMEOUT_MS || 600000);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 600000;
  }

  return Math.min(Math.max(Math.trunc(rawValue), 60000), 3600000);
}

async function executeWithTimeout(promiseFactory, timeoutMs, timeoutMessage) {
  let timeoutHandle;
  try {
    return await Promise.race([
      Promise.resolve().then(() => promiseFactory()),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const timeoutError = new Error(timeoutMessage);
          timeoutError.statusCode = 504;
          reject(timeoutError);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function buildFirstPrinciplesComparisonSpreadsheetArtifact({
  geisingerComparison = {},
  engineOutput = {},
} = {}) {
  const payload = engineOutput?.responsePayload || {};
  const summary = payload?.summary || engineOutput?.summary || {};
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];
  const partials = Array.isArray(payload?.partials) ? payload.partials : [];
  const conflicts = Array.isArray(payload?.conflicts) ? payload.conflicts : [];
  const gapLeft = Array.isArray(payload?.gaps?.left) ? payload.gaps.left : [];
  const gapRight = Array.isArray(payload?.gaps?.right) ? payload.gaps.right : [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GenAI Portal First-Principles Comparison';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 40 },
    { header: 'Value', key: 'value', width: 18 },
    { header: 'Detail', key: 'detail', width: 80 },
  ];

  summarySheet.addRows([
    { metric: 'Left requirements', value: Number(summary?.leftRequirementCount || 0), detail: 'Retrieved from left conversation first-principles requirements index.' },
    { metric: 'Right requirements', value: Number(summary?.rightRequirementCount || 0), detail: 'Retrieved from right conversation first-principles requirements index.' },
    { metric: 'Aligned pairs', value: Number(summary?.alignedCount || 0), detail: 'Total aligned requirement pairs.' },
    { metric: 'Matches', value: Number(summary?.matchCount || 0), detail: 'High-confidence aligned requirements.' },
    { metric: 'Partials', value: Number(summary?.partialCount || 0), detail: 'Related but not equivalent requirement alignments.' },
    { metric: 'Conflicts', value: Number(summary?.conflictCount || 0), detail: 'Potentially contradictory requirement pairs.' },
    { metric: 'Left-only gaps', value: Number(summary?.gapLeftCount || 0), detail: 'Requirements present only in left document.' },
    { metric: 'Right-only gaps', value: Number(summary?.gapRightCount || 0), detail: 'Requirements present only in right document.' },
    { metric: 'Summary mode', value: normalizeString(payload?.summaryMode || engineOutput?.summaryMode || 'fallback'), detail: 'Summary generation mode.' },
    { metric: 'Duration (ms)', value: Number(summary?.durationMs || 0), detail: 'Engine execution duration.' },
  ]);

  const alignmentSheet = workbook.addWorksheet('Aligned Requirements');
  alignmentSheet.columns = [
    { header: 'Classification', key: 'classification', width: 14 },
    { header: 'Score', key: 'score', width: 10 },
    { header: 'Left Citation', key: 'leftCitation', width: 54 },
    { header: 'Left Text', key: 'leftText', width: 76 },
    { header: 'Right Citation', key: 'rightCitation', width: 54 },
    { header: 'Right Text', key: 'rightText', width: 76 },
    { header: 'Modality Conflict', key: 'modalityConflict', width: 16 },
  ];

  const alignedRows = [...matches, ...partials, ...conflicts].map((item) => ({
    classification: normalizeString(item?.classification || 'unknown'),
    score: Number(item?.score || 0),
    leftCitation: normalizeString(item?.left?.citation),
    leftText: normalizeString(item?.left?.text),
    rightCitation: normalizeString(item?.right?.citation),
    rightText: normalizeString(item?.right?.text),
    modalityConflict: item?.diagnostics?.modalityConflict ? 'Yes' : 'No',
  }));
  alignmentSheet.addRows(alignedRows);

  const gapSheet = workbook.addWorksheet('Gaps');
  gapSheet.columns = [
    { header: 'Side', key: 'side', width: 12 },
    { header: 'Citation', key: 'citation', width: 54 },
    { header: 'Requirement Text', key: 'text', width: 86 },
    { header: 'Section', key: 'sectionNumber', width: 14 },
    { header: 'Heading', key: 'heading', width: 42 },
    { header: 'Requirement Key', key: 'requirementKey', width: 28 },
  ];

  gapSheet.addRows([
    ...gapLeft.map((item) => ({
      side: 'left',
      citation: normalizeString(item?.citation),
      text: normalizeString(item?.text),
      sectionNumber: normalizeString(item?.sectionNumber),
      heading: normalizeString(item?.heading),
      requirementKey: normalizeString(item?.requirementKey),
    })),
    ...gapRight.map((item) => ({
      side: 'right',
      citation: normalizeString(item?.citation),
      text: normalizeString(item?.text),
      sectionNumber: normalizeString(item?.sectionNumber),
      heading: normalizeString(item?.heading),
      requirementKey: normalizeString(item?.requirementKey),
    })),
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const leftConversationId = normalizeString(geisingerComparison?.geisingerConversationAId, 'left');
  const rightConversationId = normalizeString(geisingerComparison?.geisingerConversationBId, 'right');
  const fileName = `comparison-1stpri-${timestamp}.xlsx`;
  const blobPath = `document-comparisons/${timestamp.slice(0, 10)}/${leftConversationId}-vs-${rightConversationId}/${fileName}`;
  const containerName = 'compliance-ai';

  const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const uploadSuccess = await writeFileBufferToBlobStorage(
    fileBuffer,
    containerName,
    blobPath,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  if (!uploadSuccess) {
    throw new Error('First-principles comparison spreadsheet upload failed.');
  }

  const downloadLink = await generateTemporaryDownloadLink(containerName, blobPath, 1440);
  return {
    spreadsheetBlobName: blobPath,
    spreadsheetFileName: fileName,
    downloadLink,
  };
}

function buildFirstPrinciplesDeps(firstPrinciplesRuntime) {
  const { searchEndpoint, searchApiKey } = firstPrinciplesRuntime;
  const searchClientCache = new Map();
  let completionsClientPromise = null;

  const envName = String(process.env.envName || '').trim();
  const embeddingsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.embeddingsEndpoint`];
  const embeddingsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
  const embeddingsDeployment = 'gpt-4o-aisvc';
  const embeddingsApiVersion = '2023-05-15';

  const embeddingsClient = (embeddingsEndpoint && embeddingsAPIKey)
    ? new AzureOpenAI({
      apiVersion: embeddingsApiVersion,
      endpoint: embeddingsEndpoint,
      apiKey: embeddingsAPIKey,
      deployment: embeddingsDeployment,
    })
    : null;

  return {
    getSearchClient: (indexName) => {
      const normalizedIndexName = String(indexName || '').trim();
      if (!normalizedIndexName) {
        throw new Error('indexName is required for first-principles search retrieval.');
      }

      if (!searchClientCache.has(normalizedIndexName)) {
        searchClientCache.set(
          normalizedIndexName,
          new SearchClient(
            searchEndpoint,
            normalizedIndexName,
            new AzureKeyCredential(searchApiKey)
          )
        );
      }

      return searchClientCache.get(normalizedIndexName);
    },
    embedQuery: async ({ text }) => {
      if (!embeddingsClient) return null;
      const { data: [{ embedding }] } = await embeddingsClient.embeddings.create({
        input: String(text || ''),
        model: 'text-embedding-ada-002',
      });
      return embedding;
    },
    generateAnswer: async ({ systemPrompt, userPrompt, originalQuestion }) => {
      if (!completionsClientPromise) {
        completionsClientPromise = getCompletionsClient();
      }

      const completionsClient = await completionsClientPromise;
      if (!completionsClient) {
        return {
          answerText: '',
          modelInfo: { available: false, reason: 'completions_client_missing' },
        };
      }

      const completion = await completionsClient.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.2,
        max_completion_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: String(systemPrompt || 'You are a healthcare compliance analyst. Answer only from provided evidence snippets.'),
          },
          {
            role: 'user',
            content: [
              String(userPrompt || ''),
              '',
              'Answer requirements:',
              '- Provide a direct answer first.',
              '- Include key supporting points.',
              '- Include citations inline in [file:page] format.',
              '- If evidence is unclear or incomplete, state limitations clearly.',
            ].join('\n'),
          },
        ],
      });

      return {
        answerText: String(completion?.choices?.[0]?.message?.content || '').trim(),
        modelInfo: {
          provider: 'azure-openai',
          model: 'gpt-4o',
          promptLength: String(originalQuestion || '').length,
        },
      };
    },
  };
}

function attachDiagnostics(result, diagnosticsPatch) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  return {
    ...result,
    diagnostics: {
      ...(result.diagnostics || {}),
      ...diagnosticsPatch,
    },
  };
}

function startConversationProgressHeartbeat({ teamName, chatId, chatInteractionId }, intervalMs = 8000) {
  if (!teamName || !chatInteractionId) {
    return () => { };
  }

  const stages = [
    'Running first-principles conversation retrieval and analysis...',
    'Retrieving relevant chunks and requirement evidence...',
    'Scoring and fusing first-principles evidence...',
    'Assembling grounded response with citations...',
  ];

  let stageIndex = 0;
  let inFlight = false;
  let stopped = false;

  const timer = setInterval(async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const stage = stages[stageIndex % stages.length];
      stageIndex += 1;
      const heartbeat = createProgressMarkdown(stage, '', 'Conversation');
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, heartbeat);
    } catch (error) {
      logRoutingEvent('runComplianceConversationWithRoutingHeartbeatError', {
        teamName,
        chatId,
        chatInteractionId,
        error: error?.message || String(error),
      });
    } finally {
      inFlight = false;
    }
  }, Number(intervalMs) > 0 ? Number(intervalMs) : 8000);

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };
}

function startComparisonProgressHeartbeat({ teamName, chatId, chatInteractionId, comparisonMode }, intervalMs = 8000) {
  if (!teamName || !chatInteractionId) {
    return () => { };
  }

  const stages = comparisonMode === 'comprehensive'
    ? [
      'Running first-principles comprehensive retrieval and requirement alignment...',
      'Comparing all requirements and classifying matches, partials, conflicts, and gaps...',
      'Building comprehensive summary and spreadsheet artifacts...',
      'Assembling grounded comprehensive comparison response...',
    ]
    : [
      'Running first-principles topic retrieval and requirement alignment...',
      'Comparing topic-specific requirements across both documents...',
      'Scoring topic alignments and gap signals...',
      'Assembling grounded topic comparison response...',
    ];

  let stageIndex = 0;
  let inFlight = false;
  let stopped = false;

  const timer = setInterval(async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const stage = stages[stageIndex % stages.length];
      stageIndex += 1;
      const heartbeat = createProgressMarkdown(stage, '', 'Comparison');
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, heartbeat);
    } catch (error) {
      if (isChatInteractionCancelledError(error)) {
        stopped = true;
        clearInterval(timer);
        return;
      }
      logRoutingEvent('runComplianceComparisonWithRoutingHeartbeatError', {
        teamName,
        chatId,
        chatInteractionId,
        comparisonMode,
        error: error?.message || String(error),
      });
    } finally {
      inFlight = false;
    }
  }, Number(intervalMs) > 0 ? Number(intervalMs) : 8000);

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };
}

export async function runComplianceConversationWithRouting({ nuid, request }) {
  const normalizedRequest = request || {};
  const teamName = String(normalizedRequest?.teamName || '').trim();
  const chatId = String(
    normalizedRequest?.chatId
    || normalizedRequest?.chatInteraction?.parentId
    || normalizedRequest?.geisingerConversation?.chatId
    || ''
  ).trim();
  const chatInteractionId = String(
    normalizedRequest?.chatInteractionId
    || normalizedRequest?.chatInteraction?.id
    || normalizedRequest?.geisingerConversation?.chatInteractionId
    || ''
  ).trim();
  const userPrompt = String(normalizedRequest?.prompt || normalizedRequest?.chatInteraction?.prompt || '').trim();

  const runtimeEngines = await resolveComplianceRuntimeEngines({
    teamName,
    inferredLob: normalizedRequest?.geisingerConversation?.lob,
  });

  if (runtimeEngines.effectiveConversationEngine !== 'first-principles') {
    const legacyResult = await complianceConversationGraphV2(nuid, normalizedRequest);
    return attachDiagnostics(legacyResult, {
      selectedConversationEngine: runtimeEngines.effectiveConversationEngine,
      legacyKeyFamilyActive: !!runtimeEngines.legacyRuntime,
      firstPrinciplesKeyFamilyActive: !!runtimeEngines.firstPrinciplesRuntime,
      firstPrinciplesKeyResolution: runtimeEngines.firstPrinciplesKeyResolution || null,
      firstPrinciplesConfigSources: runtimeEngines.configSources || null,
    });
  }

  const { conversationId, conversationIdSource } = resolveConversationIdWithSource(normalizedRequest);
  if (!conversationId) {
    logRoutingEvent('firstPriConversationRoutingRejectedMissingConversationId', {
      teamName: teamName || null,
      chatId: chatId || null,
      chatInteractionId: chatInteractionId || null,
      conversationIdSource,
      hasGeisingerConversation: !!normalizedRequest?.geisingerConversation,
    });
    const error = new Error('conversationId is required for first-principles conversation engine.');
    error.statusCode = 400;
    throw error;
  }

  if (!userPrompt) {
    const error = new Error('prompt is required for first-principles conversation engine.');
    error.statusCode = 400;
    throw error;
  }

  const traceId = buildConversationTraceId({
    conversationId,
    chatInteractionId,
    chatId,
  });

  logRoutingEvent('firstPriConversationRoutingStarted', {
    traceId,
    nuid: normalizeString(nuid) || null,
    teamName: teamName || null,
    conversationId,
    conversationIdSource,
    chatId: chatId || null,
    chatInteractionId: chatInteractionId || null,
    promptLength: userPrompt.length,
    selectedConversationEngine: runtimeEngines.effectiveConversationEngine,
    chunkIndexName: runtimeEngines?.firstPrinciplesRuntime?.chunkIndexName || null,
    requirementIndexName: runtimeEngines?.firstPrinciplesRuntime?.requirementIndexName || null,
    firstPrinciplesKeyResolution: runtimeEngines.firstPrinciplesKeyResolution || null,
  });

  const executeFirstPrinciplesConversation = async () => {
    const engineOutput = await answerWithFirstPrinciplesConversationEngine({
      conversationId,
      userPrompt,
      options: {
        chunkIndexName: runtimeEngines?.firstPrinciplesRuntime?.chunkIndexName,
        requirementIndexName: runtimeEngines?.firstPrinciplesRuntime?.requirementIndexName,
        traceId,
        maxLoggedResultIds: 100,
      },
    }, buildFirstPrinciplesDeps(runtimeEngines.firstPrinciplesRuntime));

    logRoutingEvent('firstPriConversationRoutingCompleted', {
      traceId,
      conversationId,
      conversationIdSource,
      selectedConversationEngine: runtimeEngines.effectiveConversationEngine,
      requirementResultCount: Number(engineOutput?.metrics?.requirementResultCount || 0),
      chunkResultCount: Number(engineOutput?.metrics?.chunkResultCount || 0),
      fusedEvidenceCount: Number(engineOutput?.metrics?.fusedEvidenceCount || 0),
      retrievalFallbackUsed: !!engineOutput?.metrics?.retrievalFallbackUsed,
      generationMode: normalizeString(engineOutput?.metrics?.generationMode) || null,
      durationMs: Number(engineOutput?.metrics?.durationMs || 0),
      citationCount: Array.isArray(engineOutput?.citations) ? engineOutput.citations.length : 0,
      citationPreview: Array.isArray(engineOutput?.citations) ? engineOutput.citations.slice(0, 20) : [],
    });

    return attachDiagnostics(
      buildConversationFirstPrinciplesResponse(
        engineOutput,
        runtimeEngines.effectiveConversationEngine,
        {
          userPrompt,
          geisingerConversation: normalizedRequest?.geisingerConversation || {},
        }
      ),
      {
        traceId,
        conversationIdSource,
        selectedConversationEngine: runtimeEngines.effectiveConversationEngine,
        legacyKeyFamilyActive: !!runtimeEngines.legacyRuntime,
        firstPrinciplesKeyFamilyActive: !!runtimeEngines.firstPrinciplesRuntime,
        firstPrinciplesKeyResolution: runtimeEngines.firstPrinciplesKeyResolution || null,
        firstPrinciplesConfigSources: runtimeEngines.configSources || null,
      }
    );
  };

  const shouldTrackProgress = !!(teamName && chatInteractionId);
  if (!shouldTrackProgress) {
    return executeFirstPrinciplesConversation();
  }

  logRoutingEvent('firstPriConversationRoutingAsyncQueued', {
    traceId,
    conversationId,
    conversationIdSource,
    teamName: teamName || null,
    chatId: chatId || null,
    chatInteractionId: chatInteractionId || null,
  });

  const initialProgress = createProgressMarkdown(
    'Running first-principles conversation retrieval and analysis...',
    '',
    'Conversation'
  );

  await updateChatInteractionProgress(teamName, chatId, chatInteractionId, initialProgress);

  (async () => {
    const stopConversationHeartbeat = startConversationProgressHeartbeat({
      teamName,
      chatId,
      chatInteractionId,
    });

    try {
      const finalResult = await executeFirstPrinciplesConversation();
      stopConversationHeartbeat();
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, finalResult?.responseContent || 'Conversation completed.');
    } catch (error) {
      logRoutingEvent('firstPriConversationRoutingFailed', {
        traceId,
        conversationId,
        conversationIdSource,
        teamName: teamName || null,
        chatId: chatId || null,
        chatInteractionId: chatInteractionId || null,
        error: error?.message || String(error),
      });
      stopConversationHeartbeat();
      const errorProgressBase = createProgressMarkdown('First-principles conversation failed.', error?.message || 'Unknown error', 'Conversation');
      const errorProgress = errorProgressBase
        .replace(/\[[^\]\r\n]{1,8}\]\s+Processing:/i, 'X')
        .replace('AI processing:', 'X')
        .replace('⏳', 'X');
      await updateChatInteractionProgress(teamName, chatId, chatInteractionId, errorProgress);
    }
  })();

  return {
    responseContent: initialProgress,
    suggestedPrompts: [],
    diagnostics: {
      selectedConversationEngine: runtimeEngines.effectiveConversationEngine,
      legacyKeyFamilyActive: !!runtimeEngines.legacyRuntime,
      firstPrinciplesKeyFamilyActive: !!runtimeEngines.firstPrinciplesRuntime,
      firstPrinciplesKeyResolution: runtimeEngines.firstPrinciplesKeyResolution || null,
      firstPrinciplesConfigSources: runtimeEngines.configSources || null,
      traceId,
      conversationIdSource,
      mode: 'async-progress',
      status: 'processing',
    },
    usedDocuments: [],
  };
}

export async function runComplianceComparisonWithRouting({
  nuid,
  teamName,
  assistantName,
  smartNoteId,
  chatInteractionId,
  geisingerComparison,
  sources,
  chatId,
  prompt,
  comparisonMode,
}) {
  const normalizedTeamName = String(teamName || '').trim();
  const normalizedChatId = String(chatId || '').trim();
  const normalizedChatInteractionId = String(chatInteractionId || '').trim();
  const normalizedPrompt = String(prompt || '*').trim() || '*';
  const effectiveComparisonMode = normalizeComparisonMode(comparisonMode);

  const runtimeEngines = await resolveComplianceRuntimeEngines({
    teamName: normalizedTeamName,
    inferredLob: geisingerComparison?.lob,
  });

  if (runtimeEngines.effectiveComparisonEngine !== 'first-principles') {
    const legacyResult = await complianceComparisonGraphV2(
      nuid,
      teamName,
      assistantName,
      smartNoteId,
      chatInteractionId,
      geisingerComparison,
      sources,
      chatId,
      prompt,
      comparisonMode
    );

    return attachDiagnostics(legacyResult, {
      selectedComparisonEngine: runtimeEngines.effectiveComparisonEngine,
      legacyKeyFamilyActive: !!runtimeEngines.legacyRuntime,
      firstPrinciplesKeyFamilyActive: !!runtimeEngines.firstPrinciplesRuntime,
      firstPrinciplesKeyResolution: runtimeEngines.firstPrinciplesKeyResolution || null,
      firstPrinciplesConfigSources: runtimeEngines.configSources || null,
    });
  }

  const leftConversationId = String(geisingerComparison?.geisingerConversationAId || '').trim();
  const rightConversationId = String(geisingerComparison?.geisingerConversationBId || '').trim();
  const traceId = buildComparisonTraceId({
    leftConversationId,
    rightConversationId,
    chatInteractionId: normalizedChatInteractionId,
    chatId: normalizedChatId,
  });
  if (!leftConversationId || !rightConversationId) {
    const error = new Error('Both geisingerConversationAId and geisingerConversationBId are required for first-principles comparison engine.');
    error.statusCode = 400;
    throw error;
  }

  const comparisonTimeoutMs = resolveFirstPrinciplesComparisonTimeoutMs();
  const assertComparisonNotCancelled = async () => {
    if (!normalizedTeamName || !normalizedChatInteractionId) return;
    await assertChatInteractionNotCancelled(normalizedTeamName, normalizedChatId, normalizedChatInteractionId);
  };

  const executeFirstPrinciplesComparison = async () => {
    // Match service3 semantics: prompt submit => topic mode, explicit button => comprehensive mode.
    const firstPrinciplesQueryText = effectiveComparisonMode === 'comprehensive'
      ? '*'
      : normalizeTopicComparisonQueryText(normalizedPrompt);

    logRoutingEvent('firstPrinciplesComparisonModeResolved', {
      traceId,
      leftConversationId,
      rightConversationId,
      requestedComparisonMode: normalizeString(comparisonMode).toLowerCase() || null,
      effectiveComparisonMode,
      firstPrinciplesQueryText,
      originalPrompt: normalizedPrompt,
      timeoutMs: comparisonTimeoutMs,
    });

    const engineOutput = await compareWithFirstPrinciplesEngine({
      leftConversationId,
      rightConversationId,
      queryText: firstPrinciplesQueryText,
      options: {
        requirementIndexName: runtimeEngines?.firstPrinciplesRuntime?.requirementIndexName,
        comparisonMode: effectiveComparisonMode,
        traceId,
        originalPrompt: normalizedPrompt,
      },
    }, {
      ...buildFirstPrinciplesDeps(runtimeEngines.firstPrinciplesRuntime),
      assertNotCancelled: assertComparisonNotCancelled,
    });

    await assertComparisonNotCancelled();

    let spreadsheetArtifact = null;
    if (effectiveComparisonMode === 'comprehensive') {
      try {
        spreadsheetArtifact = await buildFirstPrinciplesComparisonSpreadsheetArtifact({
          geisingerComparison,
          engineOutput,
        });
      } catch (artifactError) {
        logRoutingEvent('firstPrinciplesComparisonSpreadsheetArtifactFailed', {
          leftConversationId,
          rightConversationId,
          error: artifactError?.message || String(artifactError),
        });
      }
    }

    await assertComparisonNotCancelled();

    return attachDiagnostics(
      buildComparisonFirstPrinciplesResponse(
        engineOutput,
        runtimeEngines.effectiveComparisonEngine,
        {
          spreadsheetArtifact,
          comparisonMode: effectiveComparisonMode,
          queryText: firstPrinciplesQueryText,
        }
      ),
      {
        traceId,
        selectedComparisonEngine: runtimeEngines.effectiveComparisonEngine,
        comparisonMode: effectiveComparisonMode,
        legacyKeyFamilyActive: !!runtimeEngines.legacyRuntime,
        firstPrinciplesKeyFamilyActive: !!runtimeEngines.firstPrinciplesRuntime,
        firstPrinciplesKeyResolution: runtimeEngines.firstPrinciplesKeyResolution || null,
        firstPrinciplesConfigSources: runtimeEngines.configSources || null,
        spreadsheetArtifactAvailable: !!spreadsheetArtifact?.downloadLink,
      }
    );
  };

  const shouldTrackProgress = !!(normalizedTeamName && normalizedChatInteractionId);
  if (!shouldTrackProgress) {
    return executeWithTimeout(
      executeFirstPrinciplesComparison,
      comparisonTimeoutMs,
      `First-principles ${effectiveComparisonMode} comparison timed out after ${Math.round(comparisonTimeoutMs / 1000)}s.`
    );
  }

  logRoutingEvent('firstPriComparisonRoutingAsyncQueued', {
    traceId,
    teamName: normalizedTeamName || null,
    chatId: normalizedChatId || null,
    chatInteractionId: normalizedChatInteractionId || null,
    leftConversationId,
    rightConversationId,
    comparisonMode: effectiveComparisonMode,
    timeoutMs: comparisonTimeoutMs,
  });

  const initialProgress = createProgressMarkdown(
    `Starting first-principles ${effectiveComparisonMode} comparison...`,
    '',
    'Comparison'
  );
  await updateChatInteractionProgress(normalizedTeamName, normalizedChatId, normalizedChatInteractionId, initialProgress);

  (async () => {
    const stopComparisonHeartbeat = startComparisonProgressHeartbeat({
      teamName: normalizedTeamName,
      chatId: normalizedChatId,
      chatInteractionId: normalizedChatInteractionId,
      comparisonMode: effectiveComparisonMode,
    });

    try {
      const finalResult = await executeWithTimeout(
        executeFirstPrinciplesComparison,
        comparisonTimeoutMs,
        `First-principles ${effectiveComparisonMode} comparison timed out after ${Math.round(comparisonTimeoutMs / 1000)}s.`
      );
      stopComparisonHeartbeat();
      await updateChatInteractionProgress(normalizedTeamName, normalizedChatId, normalizedChatInteractionId, finalResult?.responseContent || 'Comparison completed.');
      logRoutingEvent('firstPriComparisonRoutingCompleted', {
        traceId,
        teamName: normalizedTeamName || null,
        chatId: normalizedChatId || null,
        chatInteractionId: normalizedChatInteractionId || null,
        comparisonMode: effectiveComparisonMode,
      });
    } catch (error) {
      stopComparisonHeartbeat();
      if (isChatInteractionCancelledError(error)) {
        logRoutingEvent('firstPriComparisonRoutingCancelled', {
          traceId,
          teamName: normalizedTeamName || null,
          chatId: normalizedChatId || null,
          chatInteractionId: normalizedChatInteractionId || null,
          comparisonMode: effectiveComparisonMode,
        });
        return;
      }

      logRoutingEvent('firstPriComparisonRoutingFailed', {
        traceId,
        teamName: normalizedTeamName || null,
        chatId: normalizedChatId || null,
        chatInteractionId: normalizedChatInteractionId || null,
        leftConversationId,
        rightConversationId,
        comparisonMode: effectiveComparisonMode,
        error: error?.message || String(error),
      });
      const errorProgressBase = createProgressMarkdown(
        'First-principles comparison failed.',
        'Temporary processing issue. Please retry in about a minute.',
        'Comparison'
      );
      const errorProgress = errorProgressBase
        .replace(/\[[^\]\r\n]{1,8}\]\s+Processing:/i, 'X')
        .replace('AI processing:', 'X')
        .replace('⏳', 'X');
      await updateChatInteractionProgress(normalizedTeamName, normalizedChatId, normalizedChatInteractionId, errorProgress);
    }
  })();

  return {
    responseContent: initialProgress,
    suggestedPrompts: [],
    diagnostics: {
      selectedComparisonEngine: runtimeEngines.effectiveComparisonEngine,
      comparisonMode: effectiveComparisonMode,
      legacyKeyFamilyActive: !!runtimeEngines.legacyRuntime,
      firstPrinciplesKeyFamilyActive: !!runtimeEngines.firstPrinciplesRuntime,
      firstPrinciplesKeyResolution: runtimeEngines.firstPrinciplesKeyResolution || null,
      firstPrinciplesConfigSources: runtimeEngines.configSources || null,
      traceId,
      mode: 'async-progress',
      status: 'processing',
    },
  };
}
