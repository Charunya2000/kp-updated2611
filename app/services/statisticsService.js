'use server';

import { connectToDatabase } from '../../db/connection.js';
import { aggregateStatistics, aggregateLLMStatistics, aggregateDistinctNuids, aggregateDistVarCategories } from '../../db/selectDocument.js';

async function recordEvent(event, date, teamName) {
  const dbName = teamName ? `team-${teamName}-db` : 'aisvc_userdb';
  const db = await connectToDatabase(dbName);
  const eventToInsert = {
    ...event,
    date: date || new Date(), // Ensure date is stored in a format suitable for temporal queries
  };

  await db.collection('statistics').insertOne(eventToInsert);
}

export async function recordGenericEvent(variant, nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant, nuid, assistantName }, date, teamName);
}

export async function recordGenericEventWithMeta(metadata, variantCategory, variant, nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variantCategory, variant, nuid, assistantName, metadata }, date, teamName);
}

export async function recordUserActive(nuid, date, teamName) {
  await recordEvent({ type: 'Statistic', variant: 'UserAuth', nuid }, date, teamName);
}

export async function recordSmartNoteCreated(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'SmartNoteCreated', nuid, assistantName }, date, teamName);
}

export async function recordDesignReference(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'DesignReference', nuid, assistantName }, date, teamName);
}

export async function recordUploadedDocument(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'UploadedDocument', nuid, assistantName }, date, teamName);
}

export async function recordWebURL(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'WebURL', nuid, assistantName }, date, teamName);
}

export async function recordJiraIssue(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'JiraIssue', nuid, assistantName }, date, teamName);
}

export async function recordAssistantPromptSubmitted(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'AssistantPromptSubmitted', nuid, assistantName }, date, teamName);
}

export async function recordUserNoteAdded(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'UserNoteAdded', nuid, assistantName }, date, teamName);
}

export async function recordSavedResponseAdded(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'SavedResponseAdded', nuid, assistantName }, date, teamName);
}

export async function recordAssistantPromptSubmittedViaAPI(nuid, date, teamName, assistantName) {
  await recordEvent({ type: 'Statistic', variant: 'AssistantPromptSubmittedViaAPI', nuid, assistantName }, date, teamName);
}

export async function recordEmbeddingCreatedViaAPI(nuid, date, teamName, assistantName) {
  await recordEvent({ type: 'Statistic', variant: 'EmbeddingCreatedViaAPI', nuid, assistantName }, date, teamName);
}

/* Record SharePoint added as source */
export async function recordSharePointSource(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'SharePoint Added as Source', nuid, assistantName }, date, teamName);
}

/* Record Confluence added as source */
export async function recordConfluenceSource(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'Confluence Added as Source', nuid, assistantName }, date, teamName);
}

/* Record QTest added as source */
export async function recordQTestSource(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'QTest Added as Source', nuid, assistantName }, date, teamName);
}

/* Record blob storage download */
export async function recordBlobDownload(nuid, date, teamName, assistantName = null) {
  await recordEvent({ type: 'Statistic', variant: 'Download from Blob Storage', nuid, assistantName }, date, teamName);
}

/**
 * Record error/failure events of chat completion
 * @param {string} nuid - User NUID 
 * @param {Date} date - Event date
 * @param {string} teamName - Team name
 * @param {string} assistantName - Name of the assistant
 * @param {number} count - Number of failures to record (default: 1)
 */
export async function recordFailure(nuid, date, teamName, assistantName = null, count = 1) {
  await recordEvent({ type: 'Statistic', variant: 'Chat Completion Error', nuid, assistantName, category: 'llm-consumption', count }, date, teamName);
}

export async function getStatistics(flavor, dateRange, teamName, assistantName, nuid, variantCategory = null) {
  const dbName = teamName ? `team-${teamName}-db` : 'aisvc_userdb';
  return await aggregateStatistics(flavor, dateRange, dbName, 'statistics', assistantName, nuid, variantCategory);
}

export async function getDistinctNuids(teamName, assistantName) {
  const dbName = teamName ? `team-${teamName}-db` : 'aisvc_userdb';
  return await aggregateDistinctNuids(dbName, 'statistics', assistantName);
}

export async function getDistinctVariantCategories(teamName, assistantName, nuid) {
  const dbName = teamName ? `team-${teamName}-db` : 'aisvc_userdb';
  return await aggregateDistVarCategories(dbName, 'statistics', assistantName, nuid);
}

// ===== NEW STRUCTURE: Detailed Event Recording =====

/**
 * Record LLM chat interaction with detailed metrics
 * @param {Object} params - Interaction parameters
 * @param {string} params.nuid - User NUID 
 * @param {number} params.requestTokens - Tokens in request
 * @param {number} params.responseTokens - Tokens in response
 * @param {number} params.sourcesCount - Number of sources used
 * @param {string[]} params.selectedSources - Array of source types (e.g., ['jira', 'confluence'])
 * @param {Date} params.date - Event date
 * @param {string} teamName - Team name
 * @param {string} assistantName - Name of the assistant
 */
export async function recordLLMInteraction(nuid, date, teamName, assistantName = null, params) {
  const {
    requestTokens = 0,
    responseTokens = 0,
    sourcesCount = 0,
    selectedSources = []
  } = params;

  // Record request tokens
  if (requestTokens > 0) {
    await recordEvent({
      type: 'Statistic',
      variant: 'Request Tokens',
      nuid,
      teamName,
      assistantName,
      category: 'llm-consumption',
      count: requestTokens
    }, date, teamName);
  }

  // Record response tokens
  if (responseTokens > 0) {
    await recordEvent({
      type: 'Statistic',
      variant: 'Response Tokens',
      nuid,
      teamName,
      assistantName,
      category: 'llm-consumption',
      count: responseTokens
    }, date, teamName);
  }

  // Record sources used
  if (sourcesCount > 0) {

    const selectedSourcesStr = selectedSources.map(src => src.sourceType);
    await recordEvent({
      type: 'Statistic',
      variant: 'Sources Used',
      nuid,
      teamName,
      assistantName,
      category: 'llm-consumption',
      count: sourcesCount,
      metadata: {
        selectedSources: selectedSourcesStr
      }
    }, date, teamName);

    // Record each selected source type
    /*for (const source of selectedSources) {
      await recordEvent({
        type: 'Statistic',
        variant: `Source: ${source?.sourceType}`,
        nuid,
        teamName,
        assistantName,
        category: 'llm-consumption',
        count: 1
      }, date, teamName);
    }*/
  }
}

/**
 * Record image processing
 * @param {Object} params - Image processing parameters
 * @param {string} nuid - User NUID
 * @param {string} assistantName - Name of the assistant
 * @param {string} params.imageType - Type: 'direct', 'word', 'pdf'
 * @param {string} params.fileFormat - Format: 'png', 'jpg', 'jpeg', 'webp', 'heic', 'tiff' (required for direct images)
 * @param {number} params.count - Number of images processed (default: 1)
 * @param {Date} date - Event date
 * @param {string} teamName - Team name
 */
export async function recordImageProcessed(nuid, date, teamName, assistantName = null, params = {}) {
  const {
    imageType,
    fileFormat,
    count = 1
  } = params;

  const normalizedFormat = fileFormat?.toLowerCase() || 'unknown';

  // Determine the variant based on image type
  let variant = 'Images Processed';
  if (imageType === 'direct') {
    // Map format to specific variant names
    switch (normalizedFormat) {
      case 'png':
        variant = 'PNG Images Processed';
        break;
      case 'jpg':
      case 'jpeg':
        variant = 'JPEG Images Processed';
        break;
      case 'webp':
        variant = 'WebP Images Processed';
        break;
      case 'heic':
        variant = 'HEIC Images Processed';
        break;
      case 'tiff':
      case 'tif':
        variant = 'TIFF Images Processed';
        break;
      default:
        variant = 'Images Processed';
    }
  } else if (imageType === 'word') {
    variant = 'Word Doc Images Processed';
  } else if (imageType === 'pdf') {
    variant = 'PDF Doc Images Processed';
  }

  await recordEvent({
    type: 'Statistic',
    variant,
    nuid,
    teamName,
    assistantName,
    category: 'llm-consumption',
    count
  }, date, teamName);
}

// ===== Application Admin Statistics =====
/**
 * Get comprehensive statistics for Application Admin
 * @param {Object} options - Query options
 * @param {string|string[]} options.variant - Variant(s) to filter by (e.g., 'Request Tokens', 'Response Tokens', 'Sources Used', etc.)
 * @param {string} options.dateRange - Date range filter
 * @param {string[]} options.teamNames - Array of team names, or null for all teams
 * @param {string} options.category - Optional category filter: 'llm-consumption' | 'integrations'
 */
export async function getApplicationStatistics(options) {
  const { flavor, variant, dateRange, teamName, teamNames, assistantName, category, nuid } = options;

  // Convert single variant to array
  const variants = Array.isArray(variant) ? variant : (variant ? [variant] : null);

  const dbName = teamName ? `team-${teamName}-db` : 'aisvc_userdb';
  const resolvedTeamNames = Array.isArray(teamNames) && teamNames.length > 0
    ? teamNames
    : (teamName ? [teamName] : null);

  return await aggregateLLMStatistics({
    flavor,
    dateRange,
    dbName,
    teamNames: resolvedTeamNames,
    variants,
    assistantName,
    category,
    nuid
  });
}