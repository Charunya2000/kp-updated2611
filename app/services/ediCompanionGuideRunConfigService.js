import { v4 as uuidv4 } from 'uuid';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { validateBasicMulti } from './validation';

const RUN_CONFIG_TYPE = 'EdiCompanionGuideRunConfig';

const OVERRIDE_MODE = 'single-subscriber-overrides';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSsn(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeStipulatedValues(stipulatedValues) {
  if (!stipulatedValues || typeof stipulatedValues !== 'object') {
    return null;
  }

  const nm1Input = stipulatedValues.nm1 && typeof stipulatedValues.nm1 === 'object'
    ? stipulatedValues.nm1
    : {};
  const refInput = stipulatedValues.ref && typeof stipulatedValues.ref === 'object'
    ? stipulatedValues.ref
    : {};

  const nm1 = {
    NM101: normalizeText(nm1Input.NM101),
    NM102: normalizeText(nm1Input.NM102),
    NM103: normalizeText(nm1Input.NM103),
    NM104: normalizeText(nm1Input.NM104),
    NM105: normalizeText(nm1Input.NM105),
    NM106: normalizeText(nm1Input.NM106),
    NM107: normalizeText(nm1Input.NM107),
    NM108: normalizeText(nm1Input.NM108),
    NM109: normalizeSsn(nm1Input.NM109),
  };

  const ref = {
    REF0F: normalizeSsn(refInput.REF0F),
    REF1L: normalizeText(refInput.REF1L),
    REFDX: normalizeText(refInput.REFDX),
    REFZZ: normalizeText(refInput.REFZZ),
  };

  const hasValues = Object.values(nm1).some((value) => value)
    || Object.values(ref).some((value) => value);

  if (!hasValues) {
    return null;
  }

  return { nm1, ref };
}

function getTeamDbName(teamName) {
  return `team-${teamName}-db`;
}

function normalizeValidationScope(validationScope) {
  const mode = String(validationScope?.mode || '').trim() || 'all-subscribers';

  if (mode !== 'single-subscriber' && mode !== OVERRIDE_MODE) {
    return { mode: 'all-subscribers' };
  }

  const subscriberSsn = String(validationScope?.subscriberSsn || '').replace(/\D/g, '');
  const stipulatedValues = normalizeStipulatedValues(validationScope?.stipulatedValues);

  return {
    mode,
    subscriberSsn: subscriberSsn || null,
    stipulatedValues,
  };
}

export async function listEdiCompanionGuideRunConfigs({ teamName, assistantName, smartNoteId, templateId = null }) {
  const query = {
    type: RUN_CONFIG_TYPE,
    teamName,
    assistantName,
    smartNoteId,
  };

  if (templateId) {
    query.templateId = templateId;
  }

  return selectDocumentsExt(query, validateBasicMulti, null, getTeamDbName(teamName));
}

export async function getEdiCompanionGuideRunConfigById({ teamName, runConfigId }) {
  const query = {
    type: RUN_CONFIG_TYPE,
    id: runConfigId,
  };

  return selectDocumentExt(query, validateBasicMulti, null, getTeamDbName(teamName));
}

export async function createEdiCompanionGuideRunConfig({ teamName, assistantName, smartNoteId, runConfig }) {
  const document = {
    id: uuidv4(),
    type: RUN_CONFIG_TYPE,
    parentId: smartNoteId,
    smartNoteId,
    teamName,
    assistantName,
    templateId: String(runConfig?.templateId || '').trim() || null,
    runLabel: String(runConfig?.runLabel || '').trim() || 'Validation Run',
    effectiveValues: runConfig?.effectiveValues && typeof runConfig.effectiveValues === 'object'
      ? runConfig.effectiveValues
      : {},
    validationScope: normalizeValidationScope(runConfig?.validationScope || {}),
    status: String(runConfig?.status || '').trim() || 'active',
  };

  return insertDocument(document, validateBasicMulti, getTeamDbName(teamName));
}

export async function updateEdiCompanionGuideRunConfig({ teamName, runConfigId, updates }) {
  const existing = await getEdiCompanionGuideRunConfigById({ teamName, runConfigId });
  if (!existing) {
    return null;
  }

  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    type: RUN_CONFIG_TYPE,
    parentId: existing.parentId,
    smartNoteId: existing.smartNoteId,
    teamName: existing.teamName,
    assistantName: existing.assistantName,
    templateId: String(updates?.templateId ?? existing.templateId ?? '').trim() || null,
    runLabel: String(updates?.runLabel ?? existing.runLabel ?? '').trim() || 'Validation Run',
    effectiveValues: updates?.effectiveValues && typeof updates.effectiveValues === 'object'
      ? updates.effectiveValues
      : (existing.effectiveValues || {}),
    validationScope: updates?.validationScope
      ? normalizeValidationScope(updates.validationScope)
      : normalizeValidationScope(existing.validationScope || {}),
    status: String(updates?.status ?? existing.status ?? '').trim() || 'active',
  };

  const query = {
    type: RUN_CONFIG_TYPE,
    id: runConfigId,
  };

  return updateDocument(merged, query, validateBasicMulti, getTeamDbName(teamName));
}

export async function deleteEdiCompanionGuideRunConfig({ teamName, runConfigId }) {
  const query = {
    type: RUN_CONFIG_TYPE,
    id: runConfigId,
  };

  return deleteDocument(query, validateBasicMulti, getTeamDbName(teamName));
}

export { RUN_CONFIG_TYPE };
