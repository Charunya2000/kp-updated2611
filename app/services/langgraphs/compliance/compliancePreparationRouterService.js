'use server';

import { prepareSharePointPdfsForConversation as runLegacyPreparation } from '@/app/services/langgraphs/compliance/docConversationService3';
import { runFirstPrinciplesPreparationForConversation } from '@/app/services/langgraphs/compliance/firstPrinciplesPreparationRuntimeService';
import { resolveCompliancePreparationEngine } from '@/app/services/langgraphs/compliance/helpers/prepEngineRouting';

function logPreparationRoutingEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

function normalizeString(value) {
  return String(value || '').trim();
}

function shouldAllowLegacyFallbackForFirstPrinciplesPrep() {
  return String(process.env.GEISINGER_PREP_FIRST_PRINCIPLES_ALLOW_LEGACY_FALLBACK || 'true').toLowerCase() !== 'false';
}

function buildPreparationPayload(item = {}, context = {}) {
  return {
    siteName: item.siteName,
    fileAName: item.fileAName,
    relativeAUrl: item.relativeAUrl,
    fileId: item.fileId,
    lob: item.lob,
    inferredLob: item.lob,
    status: 'Preparing',
    preparationVersion: context.preparationVersion,
    teamName: context.teamName,
    chatId: context.chatId,
    chatInteractionId: context.chatInteractionId,
  };
}

export async function runCompliancePreparationWithRouting({
  teamName,
  item,
  context = {},
} = {}) {
  const inferredLob = normalizeString(item?.lob);
  const runtime = await resolveCompliancePreparationEngine({ teamName, inferredLob });

  const payload = buildPreparationPayload(item, {
    preparationVersion: context.preparationVersion,
    teamName,
    chatId: context.chatId,
    chatInteractionId: context.chatInteractionId,
  });

  logPreparationRoutingEvent('compliancePreparationRoutingConversationIdCandidate', {
    teamName: normalizeString(teamName) || null,
    fileAName: normalizeString(item?.fileAName) || null,
    relativeAUrl: normalizeString(item?.relativeAUrl) || null,
    lob: normalizeString(item?.lob) || null,
    selectedPrepEngine: runtime.selectedPrepEngine,
    effectivePrepEngine: runtime.effectivePrepEngine,
    itemConversationId: normalizeString(item?.conversationId) || null,
    payloadConversationId: normalizeString(payload?.id) || null,
  });

  if (runtime.effectivePrepEngine === 'legacy') {
    const result = await runLegacyPreparation(payload);
    logPreparationRoutingEvent('compliancePreparationRoutingLegacyCompleted', {
      teamName: normalizeString(teamName) || null,
      fileAName: normalizeString(item?.fileAName) || null,
      routedConversationId: normalizeString(result?.geisingerConversationId) || null,
      routedConversationIdSource: 'legacy.prepareSharePointPdfsForConversation',
      selectedPrepEngine: runtime.selectedPrepEngine,
      effectivePrepEngine: runtime.effectivePrepEngine,
    });
    return {
      result,
      routing: {
        selectedPrepEngine: runtime.selectedPrepEngine,
        effectivePrepEngine: runtime.effectivePrepEngine,
        fallbackTriggered: runtime.fallbackTriggered,
        fallbackReason: runtime.fallbackTriggered ? 'scope_not_allowed' : null,
      },
    };
  }

  try {
    const result = await runFirstPrinciplesPreparationForConversation({
      teamName,
      configDoc: runtime.configDoc,
      runtimeConfig: runtime.runtimeConfig,
      conversationId: item?.conversationId,
      fileAName: item?.fileAName,
      lob: item?.lob,
      preparationVersion: context.preparationVersion,
      preparationPayload: payload,
    });

    logPreparationRoutingEvent('compliancePreparationRoutingFirstPrinciplesCompleted', {
      teamName: normalizeString(teamName) || null,
      fileAName: normalizeString(item?.fileAName) || null,
      routedConversationId: normalizeString(result?.conversationId) || null,
      routedConversationIdSource: normalizeString(item?.conversationId) ? 'item.conversationId' : 'legacyPrepResult.geisingerConversationId',
      selectedPrepEngine: runtime.selectedPrepEngine,
      effectivePrepEngine: runtime.effectivePrepEngine,
    });

    return {
      result,
      routing: {
        selectedPrepEngine: runtime.selectedPrepEngine,
        effectivePrepEngine: runtime.effectivePrepEngine,
        fallbackTriggered: runtime.fallbackTriggered,
        fallbackReason: runtime.fallbackTriggered ? 'scope_not_allowed' : null,
      },
    };
  } catch (firstPrinciplesError) {
    const allowLegacyFallback = shouldAllowLegacyFallbackForFirstPrinciplesPrep();
    if (!allowLegacyFallback) {
      throw firstPrinciplesError;
    }

    logPreparationRoutingEvent('compliancePreparationFirstPrinciplesFallbackToLegacy', {
      teamName: normalizeString(teamName) || null,
      inferredLob: inferredLob || null,
      selectedPrepEngine: runtime.selectedPrepEngine,
      effectivePrepEngine: runtime.effectivePrepEngine,
      reason: 'first_principles_prep_runtime_error',
      error: firstPrinciplesError?.message || String(firstPrinciplesError),
    });

    const result = await runLegacyPreparation(payload);
    return {
      result,
      routing: {
        selectedPrepEngine: runtime.selectedPrepEngine,
        effectivePrepEngine: runtime.effectivePrepEngine,
        fallbackTriggered: true,
        fallbackReason: 'first_principles_prep_runtime_error',
      },
    };
  }
}
