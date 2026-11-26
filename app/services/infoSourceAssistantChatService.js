import { Annotation, StateGraph, START, END } from './langgraphs/langgraph-light.js';
import { vectorize } from './vectorizeDataService';
import { searchIndex } from './searchVectorDataService';
import { selectSmartNote } from '@services/smartNoteService';
import { systemPromptNode } from '@/app/services/langgraphs/shared/nodes/addSystemPromptsNode.js';
import { personaNode } from '@/app/services/langgraphs/shared/nodes/addPersonaPromptsNode.js';
import { selectChatInteractions } from './chatInteractionService';
import { chatCompletionMarkdown, chatCompletionPrompts } from './chatCompletionService2';
import { getDefaultChatCompletionConfig } from './chatCompletionConfigService';

const INFO_SOURCE_ASSISTANT_NAMES = new Set(['infosource', 'info-source-assistant']);

const INFO_SOURCE_INDEX_CONFIGS = [
  {
    indexName: 'infosource_assets',
    nearestNeighbors: 10,
    selectFields: ['id', 'document_title', 'document_path', 'owner', 'last_reviewed', 'market', 'region', 'section_title']
  },
  {
    indexName: 'infosource_pages',
    nearestNeighbors: 10,
    selectFields: ['id', 'title', 'path', 'owner', 'last_reviewed', 'market', 'section_title']
  }
];

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

const retrieveInfoSourceNode = async (state) => {
  const prompt = state.chatInteraction?.prompt || '';

  const indexResults = await Promise.all(
    INFO_SOURCE_INDEX_CONFIGS.map(async (indexConfig) => {
      try {
        const results = await searchIndex({
          searchIndex: indexConfig.indexName,
          selectFields: indexConfig.selectFields,
          searchEmbedding: state.promptEmbedding,
          nearestNeighbors: indexConfig.nearestNeighbors,
          contentVectorField: 'section'
        });

        return {
          indexName: indexConfig.indexName,
          results: Array.isArray(results) ? results : [],
          error: null
        };
      } catch (error) {
        return {
          indexName: indexConfig.indexName,
          results: [],
          error: error?.message || 'Unknown retrieval error'
        };
      }
    })
  );

  const successfulIndexes = indexResults.filter((entry) => !entry.error).length;
  const failedIndexes = indexResults.length - successfulIndexes;
  const totalResults = indexResults.reduce((count, entry) => count + entry.results.length, 0);

  let dataSource = 'live';
  if (successfulIndexes === 0) {
    dataSource = 'retrieval-unavailable';
  } else if (totalResults === 0) {
    dataSource = 'live-empty';
  } else if (failedIndexes > 0) {
    dataSource = 'partial-live';
  }

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'InfoSourceGraphIndexTelemetry',
      detail: {
        smartNoteId: state.smartNoteId,
        promptLength: prompt.length,
        indexes: indexResults.map((entry) => ({
          indexName: entry.indexName,
          resultCount: entry.results.length,
          error: entry.error
        })),
        dataSource,
        totalResults
      }
    }
  }));

  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'InfoSourceGraphRetrievalMode',
      detail: {
        smartNoteId: state.smartNoteId,
        dataSource,
        successfulIndexes,
        failedIndexes,
        totalResults
      }
    }
  }));

  const contextMessages = [];
  const citations = [];
  const dedupe = new Set();

  indexResults.forEach((entry) => {
    entry.results.slice(0, 8).forEach((result) => {
      const document = result?.document || {};
      const source = document.document_title || document.title || document.section_title || 'InfoSource document';
      const url = document.document_path || document.path || null;
      const sectionTitle = document.section_title || null;

      contextMessages.push({
        role: 'assistant',
        content: [
          `index: ${entry.indexName}`,
          `source: ${source}`,
          sectionTitle ? `section_title: ${sectionTitle}` : null,
          document.market ? `market: ${document.market}` : null,
          document.region ? `region: ${document.region}` : null,
          document.owner ? `owner: ${document.owner}` : null,
          document.last_reviewed ? `last_reviewed: ${document.last_reviewed}` : null,
          url ? `url: ${url}` : null
        ].filter(Boolean).join(', ')
      });

      const citation = {
        id: document.id || `${entry.indexName}-${source}`,
        indexName: entry.indexName,
        source,
        region: document.region || document.market || null,
        owner: document.owner || null,
        lastUpdated: document.last_reviewed || null,
        url: normalizeInfoSourceLink(url)
      };

      const key = `${citation.indexName}::${citation.url || citation.source}`;
      if (!dedupe.has(key)) {
        dedupe.add(key);
        citations.push(citation);
      }
    });
  });

  return {
    infoSourceContextMessages: contextMessages,
    citations,
    retrievalDiagnostics: {
      dataSource,
      successfulIndexes,
      failedIndexes,
      totalResults
    }
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
  const context = (state.infoSourceContextMessages || []).map((message) => message.content).join('\n');
  const retrievalMode = state.retrievalDiagnostics?.dataSource || 'live';
  const enrichedPrompt = [
    'Use only the InfoSource context below when possible. If context is insufficient, explicitly state that.',
    retrievalMode !== 'live' ? `Retrieval mode: ${retrievalMode}. Some InfoSource indexes may be unavailable or returned no results.` : null,
    '',
    context || 'No InfoSource context was retrieved for this prompt.',
    '',
    `User question is: ${state.chatInteraction.prompt}`
  ].filter(Boolean).join('\n');

  return { enrichedPrompt };
};

function annotateMarkdownWithCitations(markdownResponse, citations = []) {
  if (!markdownResponse || !Array.isArray(citations) || citations.length === 0) {
    return markdownResponse;
  }

  let citationIndex = 0;
  const codeAwareParts = markdownResponse.split(/(```[\s\S]*?```)/g);

  const annotated = codeAwareParts.map((part) => {
    if (part.startsWith('```')) {
      return part;
    }

    return part.replace(/([^\n.!?]+[.!?]+)(?=\s|$)/g, (sentence) => {
      if (citationIndex >= citations.length) {
        return sentence;
      }

      citationIndex += 1;
      if (/\[\d+\]\s*$/.test(sentence)) {
        return sentence;
      }

      return `${sentence} [${citationIndex}]`;
    });
  }).join('');

  if (citationIndex === 0) {
    return `${annotated}\n\n[1]`;
  }

  return annotated;
}

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
      content: 'Respond in markdown. Where possible, anchor claims to provided InfoSource context and keep answers concise and practical.'
    },
    ...state.chatHistory,
    { role: 'user', content: state.enrichedPrompt }
  ];

  let streamedRawResponse = '';

  const markdownResponse = await chatCompletionMarkdown({
    messages,
    onToken: (content) => {
      streamedRawResponse += content || '';
    },
    teamName: state.teamName,
    assistantName: state.assistantName,
    chatCompletionConfig: {
      temperature: chatCompletionConfig?.temperature,
      max_tokens: chatCompletionConfig?.max_tokens,
      model: chatCompletionConfig?.model
    }
  });

  const finalMarkdown = markdownResponse || streamedRawResponse || '';
  const annotatedMarkdownResponse = annotateMarkdownWithCitations(finalMarkdown, state.citations || []);
  streamTextInChunks(state.sendEvent, annotatedMarkdownResponse);

  return { markdownResponse: annotatedMarkdownResponse };
};

const chatCompletionPromptsNode = async (state) => {
  const promptMessages = [{
    role: 'user',
    content: `Based on your ${state.markdownResponse} response, provide 3 suggested prompts, plain text only, separated by ~!~ and don't number them.`
  }];

  const suggestedPrompts = await chatCompletionPrompts({
    messages: promptMessages,
    teamName: state.teamName,
    assistantName: state.assistantName
  });

  const payload = {
    suggestedPrompts,
    citations: state.citations || [],
    retrieval: state.retrievalDiagnostics || null
  };

  state.sendEvent({ type: 'data', data: JSON.stringify(payload) });
  return { suggestedPrompts };
};

const StateAnnotation = Annotation.Root({
  nuid: Annotation,
  smartNoteId: Annotation,
  teamName: Annotation,
  assistantName: Annotation,
  sources: Annotation,
  chatInteraction: Annotation,
  userSelectedPersona: Annotation,
  systemPrompt: Annotation,
  personaPrompt: Annotation,
  promptEmbedding: Annotation,
  infoSourceContextMessages: Annotation,
  citations: Annotation,
  retrievalDiagnostics: Annotation,
  chatHistory: Annotation,
  enrichedPrompt: Annotation,
  markdownResponse: Annotation,
  suggestedPrompts: Annotation,
  sendEvent: Annotation
});

const infoSourceGraph = new StateGraph(StateAnnotation)
  .addNode('smartNotesNode', smartNotesNode)
  .addNode('systemPromptNode', systemPromptNode)
  .addNode('personaNode', personaNode)
  .addNode('vectorizePromptNode', vectorizePromptNode)
  .addNode('retrieveInfoSourceNode', retrieveInfoSourceNode)
  .addNode('addChatHistoryNode', addChatHistoryNode)
  .addNode('enrichPromptNode', enrichPromptNode)
  .addNode('chatCompletionMarkdownNode', chatCompletionMarkdownNode)
  .addNode('chatCompletionPromptsNode', chatCompletionPromptsNode)
  .addEdge(START, 'smartNotesNode')
  .addEdge('smartNotesNode', 'systemPromptNode')
  .addEdge('systemPromptNode', 'personaNode')
  .addEdge('personaNode', 'vectorizePromptNode')
  .addEdge('vectorizePromptNode', 'retrieveInfoSourceNode')
  .addEdge('retrieveInfoSourceNode', 'addChatHistoryNode')
  .addEdge('addChatHistoryNode', 'enrichPromptNode')
  .addEdge('enrichPromptNode', 'chatCompletionMarkdownNode')
  .addEdge('chatCompletionMarkdownNode', 'chatCompletionPromptsNode')
  .addEdge('chatCompletionPromptsNode', END)
  .compile();

function normalizeInfoSourceLink(value) {
  if (!value) {
    return null;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('/')) {
    return `https://infosource.kp.org${value}`;
  }
  return `https://infosource.kp.org/${value}`;
}

export function isInfoSourceAssistant(assistantName = '') {
  return INFO_SOURCE_ASSISTANT_NAMES.has(String(assistantName).toLowerCase());
}

export async function infoSourceAssistantChatStream({ nuid, smartNoteId, sources, chatInteraction, teamName, assistantName }) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        await infoSourceGraph.invoke({
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
            name: 'InfoSourceAssistantGraphFailed',
            detail: {
              smartNoteId,
              teamName,
              assistantName,
              error: error?.message || 'Unknown error'
            }
          }
        }));

        controller.enqueue(encoder.encode('Unable to complete InfoSource retrieval for this request. Please try again.'));
        controller.enqueue(encoder.encode(JSON.stringify({
          suggestedPrompts: [],
          citations: [],
          retrieval: { dataSource: 'graph-error' }
        })));
      }

      controller.close();
    }
  });

  return stream;
}
