import { v4 as uuidv4 } from 'uuid';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { validateBasicMulti } from './validation';

const TEMPLATE_TYPE = 'EdiCompanionGuideTemplate';

function getTeamDbName(teamName) {
  return `team-${teamName}-db`;
}

function normalizeRules(rules) {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .filter((rule) => rule && typeof rule === 'object')
    .map((rule) => ({
      id: rule.id || uuidv4(),
      loopName: String(rule.loopName || '').trim() || null,
      segmentId: String(rule.segmentId || '').trim() || null,
      elementRef: String(rule.elementRef || '').trim() || null,
      qualifier: String(rule.qualifier || '').trim() || null,
      ruleType: String(rule.ruleType || '').trim() || 'allowed-values',
      allowedValues: Array.isArray(rule.allowedValues)
        ? rule.allowedValues.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
      ruleSource: String(rule.ruleSource || '').trim() || 'csv',
      notes: String(rule.notes || '').trim() || null,
      updatedAt: new Date(),
    }));
}

export async function listEdiCompanionGuideTemplates({ teamName, assistantName, smartNoteId, includeInactive = false }) {
  const query = {
    type: TEMPLATE_TYPE,
    teamName,
    assistantName,
    smartNoteId,
  };

  if (!includeInactive) {
    query.status = 'active';
  }

  return selectDocumentsExt(query, validateBasicMulti, null, getTeamDbName(teamName));
}

export async function getEdiCompanionGuideTemplateById({ teamName, templateId }) {
  const query = {
    type: TEMPLATE_TYPE,
    id: templateId,
  };

  return selectDocumentExt(query, validateBasicMulti, null, getTeamDbName(teamName));
}

export async function createEdiCompanionGuideTemplate({ teamName, assistantName, smartNoteId, template }) {
  const now = new Date();
  const document = {
    id: uuidv4(),
    type: TEMPLATE_TYPE,
    parentId: smartNoteId,
    smartNoteId,
    teamName,
    assistantName,
    templateName: String(template?.templateName || '').trim() || 'Untitled Template',
    templateDescription: String(template?.templateDescription || '').trim() || null,
    status: String(template?.status || '').trim() || 'active',
    isShared: true,
    version: 1,
    source: {
      kind: String(template?.source?.kind || '').trim() || 'manual',
      fileName: String(template?.source?.fileName || '').trim() || null,
      blobName: String(template?.source?.blobName || '').trim() || null,
      container: String(template?.source?.container || '').trim() || null,
    },
    delimiterConfig: {
      treatSlashAsComma: template?.delimiterConfig?.treatSlashAsComma !== false,
    },
    normalizationConfig: {
      trimValues: template?.normalizationConfig?.trimValues !== false,
      uppercaseQualifiers: template?.normalizationConfig?.uppercaseQualifiers !== false,
    },
    dbRefConfig: template?.dbRefConfig && typeof template.dbRefConfig === 'object'
      ? template.dbRefConfig
      : {},
    rules: normalizeRules(template?.rules),
    lastPublishedAt: now,
  };

  return insertDocument(document, validateBasicMulti, getTeamDbName(teamName));
}

export async function updateEdiCompanionGuideTemplate({ teamName, templateId, updates }) {
  const existing = await getEdiCompanionGuideTemplateById({ teamName, templateId });
  if (!existing) {
    return null;
  }

  const nextVersion = Number(existing.version || 1) + 1;
  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    type: TEMPLATE_TYPE,
    parentId: existing.parentId,
    smartNoteId: existing.smartNoteId,
    teamName: existing.teamName,
    assistantName: existing.assistantName,
    templateName: String(updates?.templateName ?? existing.templateName ?? '').trim() || 'Untitled Template',
    templateDescription: String(updates?.templateDescription ?? existing.templateDescription ?? '').trim() || null,
    status: String(updates?.status ?? existing.status ?? '').trim() || 'active',
    version: nextVersion,
    delimiterConfig: {
      ...(existing.delimiterConfig || {}),
      ...((updates?.delimiterConfig && typeof updates.delimiterConfig === 'object') ? updates.delimiterConfig : {}),
    },
    normalizationConfig: {
      ...(existing.normalizationConfig || {}),
      ...((updates?.normalizationConfig && typeof updates.normalizationConfig === 'object') ? updates.normalizationConfig : {}),
    },
    dbRefConfig: {
      ...(existing.dbRefConfig || {}),
      ...((updates?.dbRefConfig && typeof updates.dbRefConfig === 'object') ? updates.dbRefConfig : {}),
    },
    source: {
      ...(existing.source || {}),
      ...((updates?.source && typeof updates.source === 'object') ? updates.source : {}),
    },
    rules: Array.isArray(updates?.rules) ? normalizeRules(updates.rules) : normalizeRules(existing.rules),
    lastPublishedAt: new Date(),
  };

  const query = {
    type: TEMPLATE_TYPE,
    id: templateId,
  };

  return updateDocument(merged, query, validateBasicMulti, getTeamDbName(teamName));
}

export async function deleteEdiCompanionGuideTemplate({ teamName, templateId }) {
  const query = {
    type: TEMPLATE_TYPE,
    id: templateId,
  };

  return deleteDocument(query, validateBasicMulti, getTeamDbName(teamName));
}

export { TEMPLATE_TYPE };
