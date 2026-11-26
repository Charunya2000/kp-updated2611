export const KP_POLICY_INDEX_NAME = 'kp-policy-2026-08-07';
export const ALLOWED_INFO_SOURCE_INDEX_NAMES = Object.freeze([
  'infosource_assets_2026-03-25',
  'infosource_pages2_2026-03-25',
  KP_POLICY_INDEX_NAME,
]);

export function isAllowedInfoSourceIndex(indexName = '') {
  return ALLOWED_INFO_SOURCE_INDEX_NAMES.includes(String(indexName).toLowerCase());
}

export function isKpPolicySource(value = {}) {
  if (typeof value === 'string') {
    return value.toLowerCase() === KP_POLICY_INDEX_NAME;
  }

  return value.citationType === 'kp-policy'
    || String(value.indexName || '').toLowerCase() === KP_POLICY_INDEX_NAME
    || String(value.trace?.indexName || '').toLowerCase() === KP_POLICY_INDEX_NAME;
}

export function resolveInfoSourceCitationLabel(citation = {}) {
  return isKpPolicySource(citation) ? 'KP Policy Library' : 'InfoSource';
}

export function resolveKpPolicyMetadata(document = {}) {
  const sectionPath = Array.isArray(document.sectionPath)
    ? document.sectionPath.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  return {
    citationType: 'kp-policy',
    sourceTitle: document.policyTitle || 'KP Policy',
    region: document.leftNavSelection || null,
    documentOwner: document.documentOwner || null,
    lastUpdated: document.publicationDate || null,
    sourceLabel: 'KP Policy Library',
    keywords: [],
    url: document.titleUrl || document.evergreenLink || null,
    sectionTitle: sectionPath.join(' > ') || null,
    uniqueId: document.uniqueId || null,
  };
}

export function buildKpPolicyCitationKey(document = {}, normalizedUrl = null) {
  const metadata = resolveKpPolicyMetadata(document);
  const documentKey = document.uniqueId
    || document.fileId
    || normalizedUrl
    || metadata.sourceTitle;
  const topicKey = metadata.sectionTitle || document.chunkId || 'policy';

  return `${KP_POLICY_INDEX_NAME}::${documentKey}::${topicKey}`;
}
