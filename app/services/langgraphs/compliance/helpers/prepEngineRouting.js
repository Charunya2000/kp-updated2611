'use server';

import { resolveFirstPrinciplesRuntimeConfigV1 } from '@/app/services/langgraphs/compliance/helpers/loadFirstPrinciplesRuntimeConfigV1';

const DEFAULT_PREP_ENGINE = 'legacy';
const SUPPORTED_PREP_ENGINES = new Set(['legacy', 'first-principles']);

function logPrepRoutingEvent(name, detail = {}) {
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

function normalizeLob(value) {
  const lob = normalizeString(value);
  if (!lob) return '';
  return lob.toLowerCase() === 'aca' ? 'marketplace' : lob.toLowerCase();
}

function shouldAllowFirstPrinciplesForScope(rolloutScope, { teamName, inferredLob }) {
  if (!rolloutScope || typeof rolloutScope !== 'object') return true;

  const teamAllowlist = Array.isArray(rolloutScope.teamAllowlist)
    ? rolloutScope.teamAllowlist.map((item) => normalizeString(item).toLowerCase()).filter(Boolean)
    : [];

  const lobAllowlist = Array.isArray(rolloutScope.lobAllowlist)
    ? rolloutScope.lobAllowlist.map((item) => normalizeLob(item)).filter(Boolean)
    : [];

  const normalizedTeam = normalizeString(teamName).toLowerCase();
  const normalizedLob = normalizeLob(inferredLob);

  if (teamAllowlist.length > 0 && !teamAllowlist.includes(normalizedTeam)) {
    return false;
  }

  if (lobAllowlist.length > 0 && !lobAllowlist.includes(normalizedLob)) {
    return false;
  }

  return true;
}

function normalizeRequestedPrepEngine(rawValue) {
  const normalized = normalizeString(rawValue, DEFAULT_PREP_ENGINE);
  if (!SUPPORTED_PREP_ENGINES.has(normalized)) {
    const error = new Error("prepEngine must be one of: 'legacy', 'first-principles'");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

export async function resolveCompliancePreparationEngine({ teamName = '', inferredLob = '' } = {}) {
  const runtimeSnapshot = await resolveFirstPrinciplesRuntimeConfigV1({ inferredLob });
  const configDoc = runtimeSnapshot.configDoc;
  const runtimeConfig = runtimeSnapshot.config;
  const configSources = runtimeSnapshot.sources;

  const selectedPrepEngine = normalizeRequestedPrepEngine(runtimeConfig?.engines?.prepEngine);
  const scopeAllowed = shouldAllowFirstPrinciplesForScope(runtimeConfig?.rolloutScope, { teamName, inferredLob });

  const effectivePrepEngine =
    selectedPrepEngine === 'first-principles' && !scopeAllowed
      ? DEFAULT_PREP_ENGINE
      : selectedPrepEngine;

  const fallbackTriggered = selectedPrepEngine === 'first-principles' && effectivePrepEngine !== selectedPrepEngine;

  logPrepRoutingEvent('compliancePreparationEngineResolved', {
    configDocId: normalizeString(configDoc?.id) || null,
    inferredLob: normalizeString(inferredLob) || null,
    teamName: normalizeString(teamName) || null,
    selectedPrepEngine,
    effectivePrepEngine,
    fallbackTriggered,
    configSources,
  });

  return {
    configDoc,
    runtimeConfig,
    configSources,
    selectedPrepEngine,
    effectivePrepEngine,
    fallbackTriggered,
  };
}
