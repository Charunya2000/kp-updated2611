import { buildFirstPrinciplesArtifacts } from './docConversation1stPriService.js';
import { serializeFirstPrinciplesArtifactsForSearch } from './docConversation1stPriIndexMapper.js';
import { writeFirstPrinciplesSearchDocuments } from './docConversation1stPriIndexWriter.js';

function logOrchestratorEvent(name, detail = {}) {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name,
      detail,
    }
  }));
}

function normalizeBaseOptions(conversation = {}, options = {}) {
  return {
    conversationId: String(options?.conversationId || conversation?.id || '').trim() || null,
    docId: String(options?.docId || conversation?.id || '').trim() || null,
    fileName: String(options?.fileName || conversation?.fileAName || '').trim() || '',
    lob: String(options?.lob || conversation?.lob || conversation?.inferredLob || '').trim() || '',
    prepVersion: String(options?.prepVersion || conversation?.preparationVersion || '1').trim() || '1',
    jurisdiction: String(options?.jurisdiction || '').trim() || '',
    effectiveDate: options?.effectiveDate || null,
    createdAt: options?.createdAt || null,
    updatedAt: options?.updatedAt || null,
    chunkVectorsByArtifactId: options?.chunkVectorsByArtifactId || null,
    requirementVectorsByArtifactId: options?.requirementVectorsByArtifactId || null,
  };
}

/**
 * Standalone first-principles prep orchestrator.
 *
 * Chain:
 * 1) buildFirstPrinciplesArtifacts
 * 2) serializeFirstPrinciplesArtifactsForSearch
 * 3) writeFirstPrinciplesSearchDocuments
 *
 * This helper is intentionally not wired into runtime routes/jobs.
 *
 * Required input:
 * - conversation: contextual metadata (id/file/lob)
 * - sections: segmented section/subsection structure
 *
 * Required DI for write stage:
 * - deps.getUpdateClient(indexName) or explicit update clients
 */
export async function orchestrateFirstPrinciplesSearchPreparation({
  conversation = {},
  sections = [],
  options = {},
} = {}, deps = {}) {
  const logger = typeof deps?.logEvent === 'function' ? deps.logEvent : logOrchestratorEvent;
  const startedAt = Date.now();

  const normalizedOptions = normalizeBaseOptions(conversation, options);

  logger('firstPriOrchestratorStarted', {
    conversationId: normalizedOptions.conversationId,
    fileName: normalizedOptions.fileName,
    sectionCount: Array.isArray(sections) ? sections.length : 0,
  });

  const artifactBuild = buildFirstPrinciplesArtifacts({
    sections,
    conversationId: normalizedOptions.conversationId || '',
    fileAName: normalizedOptions.fileName,
  });

  const serialized = serializeFirstPrinciplesArtifactsForSearch({
    chunkArtifacts: artifactBuild.chunkArtifacts,
    requirementArtifacts: artifactBuild.requirementArtifacts,
    options: normalizedOptions,
  });

  const writeSummary = await writeFirstPrinciplesSearchDocuments({
    chunkDocuments: serialized.chunkDocuments,
    requirementDocuments: serialized.requirementDocuments,
    conversationId: normalizedOptions.conversationId,
    options: {
      chunkIndexName: options?.chunkIndexName,
      requirementIndexName: options?.requirementIndexName,
      batchSize: options?.batchSize,
      maxRetries: options?.maxRetries,
      strictValidation: options?.strictValidation,
      emitLogs: options?.emitLogs,
    },
  }, deps);

  const summary = {
    conversationId: normalizedOptions.conversationId,
    fileName: normalizedOptions.fileName,
    artifactMetrics: artifactBuild.metrics,
    serializationValidation: serialized.validation,
    writeSummary,
    durationMs: Date.now() - startedAt,
  };

  logger('firstPriOrchestratorCompleted', {
    conversationId: normalizedOptions.conversationId,
    fileName: normalizedOptions.fileName,
    chunkCount: artifactBuild.chunkArtifacts.length,
    requirementCount: artifactBuild.requirementArtifacts.length,
    chunkUploadedCount: writeSummary?.chunkWriteResult?.uploadedCount || 0,
    requirementUploadedCount: writeSummary?.requirementWriteResult?.uploadedCount || 0,
    durationMs: summary.durationMs,
  });

  return summary;
}
