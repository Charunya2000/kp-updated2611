'use server';

import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { isAllowedInfoSourceIndex } from '@/app/utils/infoSourceCitationUtils';

const infoSourceSearchClients = {};
const INFO_SOURCE_SEMANTIC_CONFIG = process.env.INFOSEARCH_INFOSOURCE_SEMANTIC_CONFIG || null;
const INFO_SOURCE_SEMANTIC_MODE = normalizeSemanticMode(process.env.INFOSEARCH_INFOSOURCE_SEMANTIC_MODE || 'auto');
const INFO_SOURCE_RETRIEVAL_TOP_MULTIPLIER = Number.parseInt(process.env.INFOSEARCH_RETRIEVAL_TOP_MULTIPLIER || '2', 10);
const INFO_SOURCE_RETRIEVAL_TOP_CAP = Number.parseInt(process.env.INFOSEARCH_RETRIEVAL_TOP_CAP || '40', 10);
function shouldExcludeAssetResult(result) {
  const documentPath = result?.document?.document_path;
  if (!documentPath || typeof documentPath !== 'string') {
    return false;
  }

  const normalizedPath = documentPath
    .trim()
    .toLowerCase()
    .split('#')[0]
    .split('?')[0];

  return normalizedPath.endsWith('.xlsx');
}

function isInfoSourceIndex(searchIndex = '') {
  return isAllowedInfoSourceIndex(searchIndex);
}

function normalizeSemanticMode(value = 'auto') {
  const normalized = String(value || 'auto').toLowerCase();
  if (['off', 'auto', 'always'].includes(normalized)) {
    return normalized;
  }
  return 'auto';
}

async function executeInfoSourceSearch(searchClient, {
  searchText,
  selectFields,
  filter,
  nearestNeighbors,
  contentVectorField,
  searchEmbedding,
  semanticMode,
  semanticConfiguration
}) {
  const effectiveSemanticMode = normalizeSemanticMode(semanticMode || INFO_SOURCE_SEMANTIC_MODE);
  const effectiveSemanticConfiguration = semanticConfiguration || INFO_SOURCE_SEMANTIC_CONFIG;
  const topMultiplier = Number.isFinite(INFO_SOURCE_RETRIEVAL_TOP_MULTIPLIER) && INFO_SOURCE_RETRIEVAL_TOP_MULTIPLIER >= 1
    ? INFO_SOURCE_RETRIEVAL_TOP_MULTIPLIER
    : 2;
  const topCap = Number.isFinite(INFO_SOURCE_RETRIEVAL_TOP_CAP) && INFO_SOURCE_RETRIEVAL_TOP_CAP >= 1
    ? INFO_SOURCE_RETRIEVAL_TOP_CAP
    : 40;
  const top = Math.min(Math.max(nearestNeighbors * topMultiplier, nearestNeighbors), topCap);
  const shouldAttemptSemantic = effectiveSemanticMode !== 'off'
    && Boolean(effectiveSemanticConfiguration)
    && searchText
    && searchText !== '*';

  const baseOptions = {
    includeTotalCount: true,
    filter,
    select: selectFields,
    top,
    vectorSearchOptions: {
      queries: [{
        kNearestNeighborsCount: top,
        fields: [contentVectorField],
        kind: 'vector',
        vector: searchEmbedding
      }]
    }
  };

  if (shouldAttemptSemantic) {
    try {
      return await searchClient.search(searchText, {
        ...baseOptions,
        queryType: 'semantic',
        semanticSearchOptions: {
          configurationName: effectiveSemanticConfiguration
        }
      });
    } catch (error) {
      if (effectiveSemanticMode === 'always') {
        throw error;
      }
    }
  }

  return await searchClient.search(searchText, baseOptions);
}

function getInfoSourceSearchConfig() {
  const envName = process.env['envName'] || 'dev';

  // Prefer dedicated InfoSource config if present; fall back to existing new.t3 config.
  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.infosource`]
    || process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`];

  const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.infosource.api.key`]
    || process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`]
    || process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`];

  if (!searchEndpoint || !searchAPIKey) {
    throw new Error('Azure AI Search InfoSource config missing');
  }

  return { searchEndpoint, searchAPIKey };
}

function getInfoSourceSearchClient(searchIndex) {
  if (!isInfoSourceIndex(searchIndex)) {
    throw new Error(`InfoSource search service only supports infosource_* indexes. Received: '${searchIndex}'`);
  }

  const { searchEndpoint, searchAPIKey } = getInfoSourceSearchConfig();
  const cacheKey = `${searchEndpoint}::${searchIndex}`;

  if (!infoSourceSearchClients[cacheKey]) {
    infoSourceSearchClients[cacheKey] = new SearchClient(
      searchEndpoint,
      searchIndex,
      new AzureKeyCredential(searchAPIKey)
    );

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'InfoSourceSearchVectorDataServiceClientConfigured',
        detail: {
          searchIndex,
          endpointMode: 'infosource-dedicated'
        }
      }
    }));
  }

  return infoSourceSearchClients[cacheKey];
}

export async function searchInfoSourceIndex({
  searchIndex,
  selectFields,
  searchEmbedding,
  nearestNeighbors,
  filter,
  contentVectorField = 'content_vector',
  queryText = '',
  semanticMode,
  semanticConfiguration
}) {
  try {
    if (!isInfoSourceIndex(searchIndex)) {
      throw new Error(`Invalid InfoSource index '${searchIndex}'. Expected infosource_*.`);
    }

    const searchClient = getInfoSourceSearchClient(searchIndex);
    const searchText = String(queryText || '').trim() || '*';
    const searchResults = await executeInfoSourceSearch(searchClient, {
      searchText,
      selectFields,
      filter,
      nearestNeighbors,
      contentVectorField,
      searchEmbedding,
      semanticMode,
      semanticConfiguration
    });

    const results = [];
    for await (const result of searchResults.results) {
      results.push(result);
    }

    if (searchIndex === 'infosource_assets' || searchIndex === 'infosource_assets_2026-03-25') {
      return results.filter((result) => !shouldExcludeAssetResult(result));
    }

    return results;
  } catch (error) {
    console.error('Error searching InfoSource index:', error);
    throw error;
  }
}
