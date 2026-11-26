'use server';

import { Annotation, StateGraph, START, END } from './langgraphs/langgraph-light.js';
import { vectorize } from './vectorizeDataService';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { selectSmartNote } from '@services/smartNoteService';
import { systemPromptNode } from '@/app/services/langgraphs/shared/nodes/addSystemPromptsNode.js';
import { personaNode } from '@/app/services/langgraphs/shared/nodes/addPersonaPromptsNode.js';
import { selectChatInteractions } from './chatInteractionService';
import { chatCompletionMarkdown, chatCompletionPrompts } from './chatCompletionService2';
import { getDefaultChatCompletionConfig } from './chatCompletionConfigService';

const ORMB_KNOWLEDGEBASE_INDEX = process.env.ORMB_KNOWLEDGEBASE_INDEX || 'ormb-knowledgebase-002';
const ORMB_KNOWLEDGEBASE_NEAREST_NEIGHBORS = Number.parseInt(process.env.ORMB_KNOWLEDGEBASE_NEAREST_NEIGHBORS || '10', 10);
const ORMB_MAX_CONTEXT_RESULTS = Number.parseInt(process.env.ORMB_KNOWLEDGEBASE_MAX_CONTEXT_RESULTS || '8', 10);

const ORMB_INDEX_SELECT_FIELDS = [
  'id',
  'sourceType',
  'sourceUrl',
  'pageId',
  'pageTitle',
  'sectionTitle',
  'sectionPathText',
  'contentType',
  'sqlSectionTitle',
  'contentDescription',
  'content',
  'isSql',
  'hasTable'
];

const ormbSearchClients = {};

function getOrmbSearchConfig() {
  const envName = process.env['envName'] || 'dev';

  const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`];
  const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.new.t3.api.key`]
    || process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`];

  if (!searchEndpoint || !searchAPIKey) {
    throw new Error('Azure AI Search ORMB (t3) config missing');
  }

  return { searchEndpoint, searchAPIKey };
}

function getOrmbSearchClient(searchIndex) {
  const { searchEndpoint, searchAPIKey } = getOrmbSearchConfig();
  const cacheKey = `${searchEndpoint}::${searchIndex}`;

  if (!ormbSearchClients[cacheKey]) {
    ormbSearchClients[cacheKey] = new SearchClient(
      searchEndpoint,
      searchIndex,
      new AzureKeyCredential(searchAPIKey)
    );

    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'OrmbConfluenceKnowledgebaseSearchClientConfigured',
        detail: {
          searchIndex,
          endpointMode: 't3'
        }
      }
    }));
  }

  return ormbSearchClients[cacheKey];
}

async function searchOrmbIndex({
  searchIndex,
  selectFields,
  searchEmbedding,
  nearestNeighbors,
  contentVectorField = 'contentVector'
}) {
  try {
    const searchClient = getOrmbSearchClient(searchIndex);

    const searchResults = await searchClient.search('*', {
      select: selectFields,
      vectorSearchOptions: {
        queries: [{
          kNearestNeighborsCount: nearestNeighbors,
          fields: [contentVectorField],
          kind: 'vector',
          vector: searchEmbedding
        }]
      }
    });

    const results = [];
    for await (const result of searchResults.results) {
      results.push(result);
    }
    return results;

  } catch (error) {
    console.error('Error searching ORMB index:', error);
    throw error;
  }
}

const smartNotesNode = async (state) => {
  const query = { type: 'SmartNote', parentId: { $exists: true }, id: state.smartNoteId };
  const smartNote = await selectSmartNote(query, state.teamName);

  return {
    assistantName: smartNote?.selectedUserAssistant || state.assistantName,
    userSelectedPersona: smartNote?.persona || null
  };
};

const vectorizePromptNode = async (state) => {
  const promptEmbedding = await vectorize({ nuid: state.nuid, content: state.chatInteraction.prompt });
  return { promptEmbedding };
};

function normalizeText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatContextSnippet(document = {}) {
  const content = normalizeText(document.content || '');
  const contentDescription = normalizeText(document.contentDescription || '');
  const snippet = content || contentDescription;
  if (!snippet) {
    return '';
  }

  if (snippet.length <= 1200) {
    return snippet;
  }

  return `${snippet.slice(0, 1200).trim()}...`;
}

function normalizeSourceUrl(url = '') {
  const value = String(url || '').trim();
  if (!value) {
    return null;
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('/')) {
    return `https://confluence.kp.org${value}`;
  }

  return value;
}

const retrieveKnowledgebaseNode = async (state) => {
  const results = await searchOrmbIndex({
    searchIndex: ORMB_KNOWLEDGEBASE_INDEX,
    selectFields: ORMB_INDEX_SELECT_FIELDS,
    searchEmbedding: state.promptEmbedding,
    nearestNeighbors: ORMB_KNOWLEDGEBASE_NEAREST_NEIGHBORS,
    contentVectorField: 'contentVector'
  });

  const topResults = Array.isArray(results) ? results.slice(0, ORMB_MAX_CONTEXT_RESULTS) : [];

  const contextMessages = topResults.map((result) => {
    const document = result?.document || {};
    const sourceTitle = document.sectionTitle || document.pageTitle || 'ORMB Confluence content';
    const pageTitle = document.pageTitle ? `page: ${document.pageTitle}` : null;
    const section = document.sectionTitle ? `section: ${document.sectionTitle}` : null;
    const contentType = document.contentType ? `content_type: ${document.contentType}` : null;
    const isSql = document.isSql === true ? 'is_sql: true' : null;
    const hasTable = document.hasTable === true ? 'has_table: true' : null;
    const sourceUrl = normalizeSourceUrl(document.sourceUrl);
    const snippet = formatContextSnippet(document);

    return {
      role: 'assistant',
      content: [
        `source: ${sourceTitle}`,
        pageTitle,
        section,
        contentType,
        isSql,
        hasTable,
        sourceUrl ? `url: ${sourceUrl}` : null,
        snippet ? `content: ${snippet}` : null
      ].filter(Boolean).join(', ')
    };
  });

  const citations = topResults.map((result, index) => {
    const document = result?.document || {};
    return {
      id: document.id || `ormb-kb-${index + 1}`,
      indexName: ORMB_KNOWLEDGEBASE_INDEX,
      source: document.sectionTitle || document.pageTitle || 'ORMB Confluence content',
      pageTitle: document.pageTitle || null,
      sectionTitle: document.sectionTitle || null,
      contentType: document.contentType || null,
      sourceType: document.sourceType || null,
      url: normalizeSourceUrl(document.sourceUrl),
      citationContent: formatContextSnippet(document),
      trace: {
        route: 'submitAssistant/ormbconfluenceknowledgebase',
        indexName: ORMB_KNOWLEDGEBASE_INDEX,
        sourceDocumentId: document.id || null
      }
    };
  });

  const retrievalDiagnostics = {
    dataSource: topResults.length > 0 ? 'live' : 'live-empty',
    searchIndex: ORMB_KNOWLEDGEBASE_INDEX,
    totalResults: topResults.length
  };

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'OrmbConfluenceKnowledgebaseRetrieval',
      detail: {
        smartNoteId: state.smartNoteId,
        promptLength: String(state.chatInteraction?.prompt || '').length,
        indexName: ORMB_KNOWLEDGEBASE_INDEX,
        totalResults: topResults.length,
        dataSource: retrievalDiagnostics.dataSource
      }
    }
  }));

  return {
    knowledgebaseContextMessages: contextMessages,
    citations,
    retrievalDiagnostics
  };
};

const addChatHistoryNode = async (state) => {
  let chatInteractions = await selectChatInteractions({
    type: 'ChatInteraction',
    parentId: state.chatInteraction.parentId
  }, state.teamName);

  chatInteractions = chatInteractions
    .filter((interaction) => interaction.isComplete)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
    .slice(-10);

  const chatHistory = [];
  chatInteractions.forEach((interaction) => {
    chatHistory.push({ role: 'user', content: interaction.prompt });
    chatHistory.push({ role: 'assistant', content: interaction.response });
  });

  return { chatHistory };
};

const enrichPromptNode = async (state) => {
  const context = (state.knowledgebaseContextMessages || []).map((message) => message.content).join('\n');

  const enrichedPrompt = [
    'You are assisting with ORMB Confluence Knowledge Base content.',
    'Ground your answer in the provided context whenever possible.',
    'If context is missing or insufficient, say what is missing and avoid guessing.',
    '',
    context || 'No ORMB Confluence context was retrieved for this prompt.',
    '',
    `User question: ${state.chatInteraction.prompt}`
  ].join('\n');

  return { enrichedPrompt };
};

function streamTextInChunks(sendEvent, text) {
  if (!text) {
    return;
  }

  const chunkSize = 180;
  for (let index = 0; index < text.length; index += chunkSize) {
    sendEvent({ type: 'data', data: text.slice(index, index + chunkSize) });
  }
}

const chatCompletionMarkdownNode = async (state) => {
  const chatCompletionConfig = await getDefaultChatCompletionConfig(state.teamName, state.assistantName);

  const messages = [
    ...(state.systemPrompt ? [{ role: 'system', content: state.systemPrompt }] : []),
    ...(state.personaPrompt ? [{ role: 'system', content: state.personaPrompt }] : []),
    {
      role: 'system',
      content: [
        'Respond in markdown.',
        'Use retrieved ORMB Confluence context for factual statements.',
        'Do not fabricate implementation details or data that are not in context.'
      ].join(' ')
    },
    ...state.chatHistory,
    { role: 'user', content: state.enrichedPrompt }
  ];

  let streamedResponse = '';

  const markdownResponse = await chatCompletionMarkdown({
    messages,
    onToken: (content) => {
      streamedResponse += content || '';
    },
    teamName: state.teamName,
    assistantName: state.assistantName,
    chatCompletionConfig: {
      temperature: chatCompletionConfig?.temperature,
      max_tokens: chatCompletionConfig?.max_tokens,
      model: chatCompletionConfig?.model
    }
  });

  const finalMarkdown = markdownResponse || streamedResponse || '';
  streamTextInChunks(state.sendEvent, finalMarkdown);

  return { markdownResponse: finalMarkdown };
};

const chatCompletionPromptsNode = async (state) => {
  const promptMessages = [
    {
      role: 'system',
      content: 'Generate 3 concise follow-up prompts based on the response. Return plain text prompts only, separated by ~!~, and do not number them.'
    },
    {
      role: 'user',
      content: `Based on this ORMB response, provide 3 follow-up prompts: ${state.markdownResponse}`
    }
  ];

  const suggestedPrompts = await chatCompletionPrompts({
    messages: promptMessages,
    teamName: state.teamName,
    assistantName: state.assistantName
  });

  const payload = {
    suggestedPrompts: Array.isArray(suggestedPrompts) ? suggestedPrompts : [],
    citations: state.citations || [],
    retrieval: state.retrievalDiagnostics || null
  };

  state.sendEvent({ type: 'data', data: JSON.stringify(payload) });
  return { suggestedPrompts: payload.suggestedPrompts };
};

const StateAnnotation = Annotation.Root({
  nuid: Annotation,
  smartNoteId: Annotation,
  sources: Annotation,
  chatInteraction: Annotation,
  teamName: Annotation,
  assistantName: Annotation,
  userSelectedPersona: Annotation,
  systemPrompt: Annotation,
  personaPrompt: Annotation,
  promptEmbedding: Annotation,
  knowledgebaseContextMessages: Annotation,
  citations: Annotation,
  retrievalDiagnostics: Annotation,
  chatHistory: Annotation,
  enrichedPrompt: Annotation,
  markdownResponse: Annotation,
  suggestedPrompts: Annotation,
  sendEvent: Annotation
});

const ormbConfluenceKnowledgebaseGraph = new StateGraph(StateAnnotation)
  .addNode('smartNotesNode', smartNotesNode)
  .addNode('systemPromptNode', systemPromptNode)
  .addNode('personaNode', personaNode)
  .addNode('vectorizePromptNode', vectorizePromptNode)
  .addNode('retrieveKnowledgebaseNode', retrieveKnowledgebaseNode)
  .addNode('addChatHistoryNode', addChatHistoryNode)
  .addNode('enrichPromptNode', enrichPromptNode)
  .addNode('chatCompletionMarkdownNode', chatCompletionMarkdownNode)
  .addNode('chatCompletionPromptsNode', chatCompletionPromptsNode)
  .addEdge(START, 'smartNotesNode')
  .addEdge('smartNotesNode', 'systemPromptNode')
  .addEdge('systemPromptNode', 'personaNode')
  .addEdge('personaNode', 'vectorizePromptNode')
  .addEdge('vectorizePromptNode', 'retrieveKnowledgebaseNode')
  .addEdge('retrieveKnowledgebaseNode', 'addChatHistoryNode')
  .addEdge('addChatHistoryNode', 'enrichPromptNode')
  .addEdge('enrichPromptNode', 'chatCompletionMarkdownNode')
  .addEdge('chatCompletionMarkdownNode', 'chatCompletionPromptsNode')
  .addEdge('chatCompletionPromptsNode', END)
  .compile();

export async function runOrmbConfluenceKnowledgebaseSubmission({
  nuid,
  smartNoteId,
  sources,
  chatInteraction,
  teamName,
  assistantName,
  sendEvent = () => { }
}) {
  const result = await ormbConfluenceKnowledgebaseGraph.invoke({
    nuid,
    smartNoteId,
    sources,
    chatInteraction,
    teamName,
    assistantName,
    sendEvent
  });

  return {
    markdownResponse: result?.markdownResponse || '',
    suggestedPrompts: Array.isArray(result?.suggestedPrompts) ? result.suggestedPrompts : [],
    citations: Array.isArray(result?.citations) ? result.citations : [],
    retrievalDiagnostics: result?.retrievalDiagnostics || null
  };
}

export async function ormbConfluenceKnowledgebaseGraphStream({ nuid, smartNoteId, sources, chatInteraction, teamName, assistantName }) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        await runOrmbConfluenceKnowledgebaseSubmission({
          nuid,
          smartNoteId,
          sources,
          chatInteraction,
          teamName,
          assistantName,
          sendEvent: (event) => {
            if (event.type === 'data') {
              controller.enqueue(encoder.encode(event.data));
            }
          }
        });
      } catch (error) {
        console.error(JSON.stringify({
          kpmsg: {
            id: 'AI_PORTAL_NOTEBOOK',
            name: 'OrmbConfluenceKnowledgebaseGraphFailed',
            detail: {
              smartNoteId,
              teamName,
              assistantName,
              error: error?.message || 'Unknown error'
            }
          }
        }));

        controller.enqueue(encoder.encode('Unable to complete ORMB Confluence retrieval for this request. Please try again.'));
        controller.enqueue(encoder.encode(JSON.stringify({
          suggestedPrompts: [],
          citations: [],
          retrieval: { dataSource: 'graph-error', searchIndex: ORMB_KNOWLEDGEBASE_INDEX }
        })));
      }

      controller.close();
    }
  });

  return stream;
}
