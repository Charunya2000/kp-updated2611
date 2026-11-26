'use server';

import { NextResponse } from 'next/server';
import { appendFile } from 'fs/promises';
import path from 'path';
import { getServerSession } from '@utils/getSession';
import { runInfoSourceSubmission } from '@/app/services/infoSourceSubmitGraphService';
import {
  completeInfoSourceProgress,
  failInfoSourceProgress,
  persistInfoSourceProgress,
  persistInfoSourceSuggestedPrompts,
} from '@/app/services/infoSourceProgressService';
import { recordGenericEventWithMeta } from '@services/statisticsService';

const INFO_SOURCE_DIRECT_RESPONSE_MODE = String(process.env.INFOSEARCH_DIRECT_RESPONSE_MODE || 'true').toLowerCase() === 'true';
const INFO_SOURCE_JSON_FILE_LOGGING = String(process.env.INFOSEARCH_JSON_FILE_LOGGING || 'true').toLowerCase() === 'true';

function normalizeStringList(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )];
}

function normalizeInfoSourceFilterMetadata(rawFilters = null) {
  const enabled = Boolean(rawFilters?.enabled);
  const contentType = ['both', 'asset', 'page'].includes(rawFilters?.contentType)
    ? rawFilters.contentType
    : 'both';
  const updatedBucket = ['any', 'thisMonth', 'last3Months', 'last6Months', 'thisYear', 'lastYear'].includes(rawFilters?.updatedBucket)
    ? rawFilters.updatedBucket
    : 'any';

  const title = String(rawFilters?.title || '').trim();
  const owners = normalizeStringList(rawFilters?.owners || []);
  const markets = normalizeStringList(rawFilters?.markets || []);
  const keywords = normalizeStringList(rawFilters?.keywords || []);

  return {
    enabled,
    contentType,
    updatedBucket,
    useCitationSeed: Boolean(rawFilters?.useCitationSeed),
    title,
    owners,
    markets,
    keywords,
    citationSeed: rawFilters?.citationSeed || null,
  };
}

function buildInfoSourceStatisticsMetadata({ smartNoteId, chatInteraction, sources, infoSourceFilters }) {
  const normalizedFilters = normalizeInfoSourceFilterMetadata(infoSourceFilters);

  return {
    smartNoteId,
    hasPrompt: Boolean(String(chatInteraction?.prompt || '').trim()),
    promptLength: String(chatInteraction?.prompt || '').trim().length,
    sourceCount: Array.isArray(sources) ? sources.length : 0,
    filtersEnabled: normalizedFilters.enabled,
    contentType: normalizedFilters.contentType,
    updatedBucket: normalizedFilters.updatedBucket,
    useCitationSeed: normalizedFilters.useCitationSeed,
    title: normalizedFilters.title,
    owners: normalizedFilters.owners,
    markets: normalizedFilters.markets,
    keywords: normalizedFilters.keywords,
    citationSeed: normalizedFilters.citationSeed,
  };
}

function analyzeResponseCitationAlignment(markdownResponse = '', citations = []) {
  const markdown = String(markdownResponse || '');
  const codeStripped = markdown.replace(/```[\s\S]*?```/g, ' ');
  const markerMatches = [...codeStripped.matchAll(/\[(\d+)\]/g)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isInteger(value));
  const uniqueMarkers = [...new Set(markerMatches)];

  const missingCitationContentMarkers = uniqueMarkers.filter((marker) => {
    const citation = citations[marker - 1];
    return !citation || !String(citation?.citationContent || '').trim();
  });

  const hasCitations = Array.isArray(citations) && citations.length > 0;
  const hasMarkers = uniqueMarkers.length > 0;
  const isAligned = !hasCitations || (hasMarkers && missingCitationContentMarkers.length === 0);

  const issues = [];
  if (hasCitations && !hasMarkers) {
    issues.push('Response contains no citation markers while citations are present.');
  }
  if (missingCitationContentMarkers.length > 0) {
    issues.push(`Citation content missing for markers: ${missingCitationContentMarkers.join(', ')}`);
  }

  return {
    isAligned,
    hasCitations,
    citationCount: hasCitations ? citations.length : 0,
    markerCount: uniqueMarkers.length,
    markersInResponse: uniqueMarkers,
    missingCitationContentMarkers,
    issues,
  };
}

function applyCitationVerificationNotice(markdownResponse = '', verification = {}) {
  if (verification?.isAligned) {
    return String(markdownResponse || '');
  }

  const note = 'Verification note: Some response statements may not be fully grounded in displayed citation content.';
  const markdown = String(markdownResponse || '');
  if (markdown.includes(note)) {
    return markdown;
  }

  return `${markdown}\n\n${note}`.trim();
}

function splitMarkdownIntoSentences(value = '') {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildResponseSentencesByMarker(markdownResponse = '', citationCount = 0) {
  const sentences = splitMarkdownIntoSentences(markdownResponse);
  const byMarker = {};

  for (let marker = 1; marker <= citationCount; marker += 1) {
    byMarker[marker] = [];
  }

  sentences.forEach((sentence) => {
    const markers = [...sentence.matchAll(/\[(\d+)\]/g)]
      .map((match) => Number.parseInt(match[1], 10))
      .filter((marker) => Number.isInteger(marker) && marker >= 1 && marker <= citationCount);

    if (!markers.length) {
      return;
    }

    const cleaned = sentence.replace(/\[(\d+)\]/g, '').replace(/\s{2,}/g, ' ').trim();
    if (!cleaned) {
      return;
    }

    markers.forEach((marker) => {
      byMarker[marker].push(cleaned);
    });
  });

  return byMarker;
}

async function appendInfoSourceJsonLog({
  teamName,
  assistantName,
  smartNoteId,
  nuid,
  question,
  searchResults,
  responseCitations,
  markdownResponse,
  verification,
}) {
  if (!INFO_SOURCE_JSON_FILE_LOGGING) {
    return;
  }

  try {
    const loggingPath = path.join(process.cwd(), 'logging.json');
    const citationList = Array.isArray(responseCitations) ? responseCitations : [];
    const responseSentencesByMarker = buildResponseSentencesByMarker(markdownResponse, citationList.length);
    const payload = {
      timestamp: new Date().toISOString(),
      teamName,
      assistantName,
      smartNoteId,
      nuid,
      question: String(question || ''),
      searchResults: Array.isArray(searchResults) ? searchResults : [],
      citationContentServer: citationList.map((citation, index) => ({
        marker: index + 1,
        citationKey: citation?.citationKey || citation?.id || null,
        source: citation?.source || null,
        indexName: citation?.indexName || citation?.trace?.indexName || null,
        content: citation?.citationContent || null,
        snippet: citation?.relevanceSnippet || null,
        rawEvidencePreview: String(citation?.rawEvidenceText || '').slice(0, 3500),
        responseSentencesForMarker: responseSentencesByMarker[index + 1] || [],
      })),
      responseReturnedToUser: String(markdownResponse || ''),
      responseCitationVerification: verification || null,
    };

    await appendFile(loggingPath, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'InfoSourceJsonFileLoggingFailed',
        detail: {
          smartNoteId,
          teamName,
          assistantName,
          error: error?.message || 'Unknown error'
        }
      }
    }));
  }
}

async function recordInfoSourceStatistics({ nuid, teamName, assistantName, smartNoteId, chatInteraction, sources, infoSourceFilters }) {
  const metadataBase = buildInfoSourceStatisticsMetadata({
    smartNoteId,
    chatInteraction,
    sources,
    infoSourceFilters,
  });

  const events = [
    { eventScope: 'generalPromptSubmission', variant: 'PromptSubmissionRegular' },
  ];

  const hasAssetOrPageFilter = metadataBase.contentType !== 'both';
  const hasTitleFilter = Boolean(metadataBase.title);
  const hasOwnersFilter = metadataBase.owners.length > 0;
  const hasMarketsFilter = metadataBase.markets.length > 0;
  const hasKeywordsFilter = metadataBase.keywords.length > 0;
  const hasLastUpdatedDateFilter = metadataBase.updatedBucket !== 'any';

  if (hasAssetOrPageFilter) {
    events.push({ eventScope: 'assetOrPageFilter', variant: 'PromptSubmissionAssetOrPageFilter' });
  }

  if (hasTitleFilter) {
    events.push({ eventScope: 'titleFilter', variant: 'PromptSubmissionTitleFilter' });
  }

  if (hasOwnersFilter) {
    events.push({ eventScope: 'ownersFilter', variant: 'PromptSubmissionOwnersFilter' });
  }

  if (hasMarketsFilter) {
    events.push({ eventScope: 'marketsFilter', variant: 'PromptSubmissionMarketsFilter' });
  }

  if (hasKeywordsFilter) {
    events.push({ eventScope: 'keywordsFilter', variant: 'PromptSubmissionKeywordsFilter' });
  }

  if (hasLastUpdatedDateFilter) {
    events.push({ eventScope: 'lastUpdatedDateFilter', variant: 'PromptSubmissionLastUpdatedDateFilter' });
  }

  const results = await Promise.allSettled(
    events.map((eventMeta) => recordGenericEventWithMeta(
      {
        ...metadataBase,
        ...eventMeta,
      },
      'InfoSource',
      eventMeta.variant,
      nuid,
      new Date(),
      teamName,
      assistantName
    ))
  );

  const rejectedCount = results.filter((result) => result.status === 'rejected').length;
  if (rejectedCount > 0) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'InfoSourceStatisticsRecordFailed',
        detail: {
          smartNoteId,
          teamName,
          assistantName,
          rejectedCount,
          error: 'One or more InfoSource statistics events failed to record'
        }
      }
    }));
  }
}

async function executeInfoSourceSubmission({
  nuid,
  teamName,
  assistantName,
  smartNoteId,
  chatInteraction,
  sources,
  infoSourceFilters,
  persistProgress = true,
}) {
  const chatId = chatInteraction?.parentId;
  const chatInteractionId = chatInteraction?.id;
  const prompt = chatInteraction?.prompt || '';

  try {
    if (persistProgress) {
      await persistInfoSourceProgress({
        teamName,
        nuid,
        smartNoteId,
        chatId,
        chatInteractionId,
        prompt,
        stage: 'Starting InfoSource retrieval...'
      });
    }

    const result = await runInfoSourceSubmission({
      nuid,
      smartNoteId,
      sources,
      infoSourceFilters,
      chatInteraction,
      teamName,
      assistantName,
      onProgress: persistProgress
        ? async ({ stage, details }) => {
          await persistInfoSourceProgress({
            teamName,
            nuid,
            smartNoteId,
            chatId,
            chatInteractionId,
            prompt,
            stage,
            details,
          });
        }
        : undefined,
    });

    const verification = analyzeResponseCitationAlignment(result?.markdownResponse || '', result?.responseCitations || []);
    const verifiedMarkdownResponse = applyCitationVerificationNotice(result?.markdownResponse || '', verification);
    const normalizedResult = {
      ...result,
      markdownResponse: verifiedMarkdownResponse,
    };

    await appendInfoSourceJsonLog({
      teamName,
      assistantName,
      smartNoteId,
      nuid,
      question: prompt,
      searchResults: normalizedResult?.retrievalDiagnostics?.searchResults || [],
      responseCitations: normalizedResult?.responseCitations || [],
      markdownResponse: normalizedResult?.markdownResponse || '',
      verification,
    });

    console.log(`result: ${JSON.stringify(normalizedResult)}`);

    await completeInfoSourceProgress({
      teamName,
      nuid,
      smartNoteId,
      chatId,
      chatInteractionId,
      prompt,
      response: normalizedResult.markdownResponse,
      citations: normalizedResult.responseCitations,
      retrieval: normalizedResult.retrievalDiagnostics,
    });

    const savedSuggestedPrompts = await persistInfoSourceSuggestedPrompts({
      teamName,
      nuid,
      smartNoteId,
      chatInteractionId,
      suggestedPrompts: normalizedResult.suggestedPrompts,
    });

    return {
      ...normalizedResult,
      suggestedPrompts: Array.isArray(savedSuggestedPrompts) && savedSuggestedPrompts.length
        ? savedSuggestedPrompts
        : (Array.isArray(normalizedResult.suggestedPrompts) ? normalizedResult.suggestedPrompts : [])
    };
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'InfoSourceDedicatedBackgroundRunFailed',
        detail: {
          smartNoteId,
          teamName,
          assistantName,
          chatInteractionId,
          error: error?.message || 'Unknown error'
        }
      }
    }));

    await failInfoSourceProgress({
      teamName,
      nuid,
      smartNoteId,
      chatId,
      chatInteractionId,
      prompt,
      error,
    });

    throw error;
  }
}

export async function POST(req, { params }) {
  try {
    const { teamName, assistantName, smartNoteId } = await params;
    const { sources, chatInteraction, infoSourceFilters } = await req.json();
    const { nuid } = await getServerSession();

    console.log(`req: ${JSON.stringify(req)}`);
    console.log(`nuid: ${JSON.stringify(nuid)}`);
    if (!chatInteraction?.id || !chatInteraction?.parentId) {
      return NextResponse.json({ error: 'Missing required chat interaction identifiers.' }, { status: 400 });
    }

    await recordInfoSourceStatistics({
      nuid,
      teamName,
      assistantName,
      smartNoteId,
      chatInteraction,
      sources,
      infoSourceFilters
    });

    if (INFO_SOURCE_DIRECT_RESPONSE_MODE) {
      const result = await executeInfoSourceSubmission({
        nuid,
        teamName,
        assistantName,
        smartNoteId,
        chatInteraction,
        sources,
        infoSourceFilters,
        persistProgress: false,
      });

      return NextResponse.json({
        mode: 'direct',
        status: 'completed',
        chatInteractionId: chatInteraction.id,
        markdownResponse: result.markdownResponse,
        responseCitations: result.responseCitations,
        retrievalDiagnostics: result.retrievalDiagnostics,
        suggestedPrompts: result.suggestedPrompts,
      }, { status: 200 });
    }

    void executeInfoSourceSubmission({
      nuid,
      teamName,
      assistantName,
      smartNoteId,
      chatInteraction,
      sources,
      infoSourceFilters,
    });

    return NextResponse.json({
      accepted: true,
      status: 'running',
      chatInteractionId: chatInteraction.id,
    }, { status: 202 });
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'InfoSourceDedicatedRouteFailed',
        detail: { error: error?.message || 'Unknown error' }
      }
    }));

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
