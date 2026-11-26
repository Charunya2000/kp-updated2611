'use server';

import { Annotation, StateGraph, START, END } from "../langgraph-light.js";
import { chatCompletion, chatCompletionMarkdown, chatCompletionPrompts } from '@/app/services/chatCompletionService2';
import { getSCTaskById } from '@/app/services/langgraphs/prodSupport/tools/getSCTaskById';
import { getSCTasksByKeyword, SCTASK_SEARCHABLE_COLUMNS } from '@/app/services/langgraphs/prodSupport/tools/getSCTasksByKeyword';
import { searchIndex } from '@/app/services/searchVectorDataService';
import { vectorize } from '@/app/services/vectorizeDataService';
import { selectSmartNote } from '@/app/services/smartNoteService';
import { selectJustSources, selectRelatedDesignReferences, selectRelatedDesignIndexes, selectRelatedUploadedDocuments, selectRelatedSharePointFiles, selectRelatedSavedResponses, selectRelatedWebsiteURLs, selectRelatedConfluenceURLs } from '@services/actualSourcesService';
import { recordAssistantPromptSubmitted } from '@/app/services/statisticsService';
import { getIndexConfigById } from '@/app/services/aiSearchConfigService';
import { systemPromptNode } from '@/app/services/langgraphs/shared/nodes/addSystemPromptsNode.js';
import { personaNode } from '@/app/services/langgraphs/shared/nodes/addPersonaPromptsNode.js';
import { selectChatInteractions } from '@/app/services/chatInteractionService';
import { getDefaultChatCompletionConfig } from '@/app/services/chatCompletionConfigService';

const smartNoteIndex = 'smartnote-001';
const LOG_TAG = '[ProdSupportToolGraph]';

const logProdSupportToolGraph = (message, detail = {}) => {
  console.log(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'prodSupportToolGraph',
      detail: {
        tag: LOG_TAG,
        message,
        ...detail
      }
    }
  }));
};

const errorProdSupportToolGraph = (message, detail = {}) => {
  console.error(JSON.stringify({
    kpmsg: {
      id: 'AI_PORTAL_NOTEBOOK',
      name: 'prodSupportToolGraph',
      detail: {
        tag: LOG_TAG,
        message,
        ...detail
      }
    }
  }));
};

const createMessagesFromDesignReferences = (designReferences) => {
  const messages = [];

  designReferences.forEach(designReferenceArray => {
    designReferenceArray.forEach(result => {
      const content = `source category: ${result.document.document_name}${result.document.source_url && (' , at source_url: ' + result.document.source_url)}, content: ${result.document.content}`;
      const message = {
        role: 'assistant',
        content: content
      };
      messages.push(message);
    });
  });
  return messages;
};
// Given a single designIndexSearchResult (array of result objects) and the index config (from getIndexConfigByName),
// return an array of string messages, one for each result, using only the selectFields from the index config.
function createMessagesFromDesignIndexResultsSelectFields(designIndexSearchResult, indexConfig) {
  if (!Array.isArray(designIndexSearchResult) || !indexConfig || !Array.isArray(indexConfig.selectFields)) return [];
  return designIndexSearchResult.map(result => {
    const content = indexConfig.selectFields
      .map(field => {
        let value = result.document && result.document[field] !== undefined ? result.document[field] : '';
        // If value is an object (not null, not an array, not a Date), stringify it
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
          try {
            value = JSON.stringify(value);
          } catch (e) {
            value = '[Unserializable Object]';
          }
        }
        return `${field}: ${value}`;
      })
      .join(', ');
    return {
      role: 'assistant',
      content
    };
  });
}

const createMessagesFromSavedResponses = (savedResponses) => {
  const messages = [];

  savedResponses.forEach(savedResponseArray => {
    savedResponseArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: Saved Response, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

const createMessagesFromDesignIndexes = async (designIndexes, state) => {
  const messages = [];
  let indexConfig, previousIndexName = '';
  for (const designIndexArray of designIndexes) {
    for (const result of designIndexArray) {
      // avoid unnecessary calls to getIndexByName if the index name hasn't changed
      if (previousIndexName !== designIndexArray.indexName) {
        previousIndexName = designIndexArray.indexName;
        indexConfig = await getIndexConfigById(designIndexArray.searchIndexConfigId, state.teamName);
      }

      try {
        let content = '';
        if (!indexConfig || !indexConfig.template) {
          // build a generic template
          content = Object.keys(result.document)
            .map(key => `${key}: ${result.document[key]}`)
            .join(', ');
        } else {
          const templateFunction = new Function(...Object.keys(result.document), `return \`${indexConfig.template}\`;`);
          content = templateFunction(...Object.values(result.document));
        }

        const message = {
          role: 'assistant',
          content: content
        };
        messages.push(message);
      } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'createMessagesFromDesignIndexes', detail: { indexSettings: indexConfig, designIndexFields: result.document } } }));

        throw error;
      }
    }
  }
  return messages;
};

const createMessagesFromConfluenceURLs = (confluenceSearchResults) => {
  const messages = [];

  confluenceSearchResults.forEach(confluenceURLArray => {
    confluenceURLArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: Confluence, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

const createMessagesFromWebsiteURLs = (websiteURLs) => {
  const messages = [];

  websiteURLs.forEach(websiteURLArray => {
    websiteURLArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: Website URL, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

const createMessagesFromUploadedDocuments = (uploadedDocumentResults) => {
  const messages = [];

  uploadedDocumentResults.forEach(uploadedDocumentArray => {
    uploadedDocumentArray.results.forEach(result => {
      const message = {
        role: 'assistant',
        content: getUploadedDocumentsContentMessage(uploadedDocumentArray.searchIndexName, result.document)
      };
      messages.push(message);
    });
  });
  return messages;
};

const createMessagesFromSharePointFiles = (sharePointFiles) => {
  const messages = [];

  sharePointFiles.forEach(filesArray => {
    filesArray.forEach(result => {
      const message = {
        role: 'assistant',
        content: `source category: ${result.document.file_name}, content: ${result.document.content}`
      };
      messages.push(message);
    });
  });
  return messages;
};

const getUploadedDocumentsIndexName = (assistantName, fileName) => {
  switch (assistantName) {
    case 'products':
    case 'kpif':
      {
        const extension = fileName.split('.').pop();
        if (extension === 'xlsx') {
          return 'hipos-excel-001';
        } else if (extension === 'pptx' || extension === 'ppt') {
          return 'hipos-pptx-001';
        }
        else {
          return 'smartnote-file-002';
        }
      }
    default:
      return 'smartnote-file-002';
  }
}

const getUploadedDocumentsIndexFields = (searchIndex) => {
  switch (searchIndex) {
    case 'hipos-excel-001':
      return ["document", "sheet", "header", "parent_header", "brq", "has_it_impact", "content"];
    case 'hipos-pptx-001':
      return ["document", "slide", "content"];
    case 'smartnote-file-002':
      return ["smart_file_name", "content"];
    default:
      return ["smart_file_name", "content"];
  }
}

const getUploadedDocumentsIndexFilter = (searchIndex, smartNoteId, fileName) => {
  switch (searchIndex) {
    case 'hipos-excel-001':
      return `smartnote_id eq '${smartNoteId}' and document eq '${fileName}'`;
    case 'hipos-pptx-001':
      return `smartnote_id eq '${smartNoteId}' and document eq '${fileName}'`;
    case 'smartnote-file-002':
      return `smartnote_id eq '${smartNoteId}' and smart_file_name eq '${fileName}'`;
    default:
      return `smartnote_id eq '${smartNoteId}' and smart_file_name eq '${fileName}'`;
  }
}

const getUploadedDocumentsContentMessage = (searchIndex, doc) => {
  const getMessagePart = (label, property) => {
    return property ? `, ${label}: ${property}` : '';
  }

  switch (searchIndex) {
    case 'hipos-excel-001':
      return `source category is Excel file with: ${doc.document}${getMessagePart('sheet', doc.sheet)}${getMessagePart('header', doc.header)}${getMessagePart('parent header', doc.parent_header)}${getMessagePart('brq', doc.brq)}${getMessagePart('hasImpact', doc.hasImpact)}${getMessagePart('content', doc.content)}`;
    case 'hipos-pptx-001':
      return `source category is PowerPoint file with: ${doc.smart_file_name}${getMessagePart('slide', doc.slide)}${getMessagePart('content', doc.content)}`;
    case 'smartnote-file-002':
      return `source category is file upload with: ${doc.smart_file_name}${getMessagePart('content', doc.content)}`;
    default:
      return `source category is file upload with: ${doc.smart_file_name}, content: ${doc.content}`;
  }
}

const addMissingDesignIndexes = async (foundDesignIndexes, smartNoteId, teamName) => {
  const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId }
  const smartNote = await selectSmartNote(query, teamName);
  const additionalIndexes = [];

  if (smartNote.selectedUserAssistant === 'kpmc-assistant' || smartNote.selectedUserAssistant === 'scheduletopay') {
    switch (smartNote.persona) {
      case 'Planning':
        additionalIndexes.push({
          type: 'DesignIndex',
          smartNoteId: smartNoteId,
          title: 'PI Planning Index',
          indexName: 'pi-planning-001'
        });
        break;
      case 'Change Request':
        additionalIndexes.push({
          type: 'DesignIndex',
          smartNoteId: smartNoteId,
          title: 'Change Request Index',
          indexName: 'kpmc-cr-001'
        });
        break;
      case 'Architecture':
        additionalIndexes.push({
          type: 'DesignIndex',
          smartNoteId: smartNoteId,
          title: 'ORMB Index',
          indexName: 'ormb-001'
        });
        break;
    }
  }

  additionalIndexes.forEach(index => {
    if (!foundDesignIndexes.some(designIndex => designIndex.indexName === index.indexName)) {
      foundDesignIndexes.push(index);
    }
  });

  return foundDesignIndexes;
};

// Define the nodes

// const systemMessagesNode = async (state) => {
//   const systemMessage = await getSystemContent(state.smartNoteId, state.teamName);
//   const query = { type: 'SmartNote', parentId: { $exists: true }, id: state.smartNoteId }
//   const smartNote = await selectSmartNote(query, state.teamName);
//   return { systemMessage, assistantName: smartNote.selectedUserAssistant, userSelectedPersona: smartNote.persona };
// };

const smartNotesNode = async (state) => {
  // const systemMessage = await getSystemContent(state.smartNoteId, state.teamName);
  const query = { type: 'SmartNote', parentId: { $exists: true }, id: state.smartNoteId }
  const smartNote = await selectSmartNote(query, state.teamName);
  return { assistantName: smartNote.selectedUserAssistant, userSelectedPersona: smartNote.persona };
};

const vectorizePromptNode = async (state) => {
  const promptEmbedding = await vectorize({ nuid: state.nuid, content: state.chatInteraction.prompt });
  return { promptEmbedding };
};

const searchIndexNode = async (state) => {
  const filter = `nuid eq '${state.nuid}' and smartnote_id eq '${state.smartNoteId}' and (smart_type eq 'ChatInteraction' or smart_type eq 'SavedNote' or smart_type eq 'JiraIssue' or smart_type eq 'UploadedDocument')`;
  const searchResults = await searchIndex({
    searchIndex: smartNoteIndex,
    selectFields: ["id", "nuid", "smartnote_id", "smart_type", "content"],
    searchEmbedding: state.promptEmbedding,
    nearestNeighbors: 5,
    filter
  });
  return { searchResults };
};

const filterSourcesNode = async (state) => {
  const actualSources = await selectJustSources(state.smartNoteId, state.teamName);
  const filteredSearchResults = state.searchResults.filter(searchResult =>
    actualSources.some(actualSource => actualSource.sourceId === searchResult.document.id)
  );

  return { actualSources, filteredSearchResults };
};

const createMessagesNode = async (state) => {
  const filteredMessages = state.filteredSearchResults.map(result => {
    const message = {
      role: 'assistant',
      content: `source category: ${result.document.smart_type}, content: ${result.document.content}`
    };
    return message;
  });

  const foundDesignReferences = await selectRelatedDesignReferences(state.smartNoteId, state.teamName);
  const filteredDesignReferences = foundDesignReferences.filter(designReference =>
    state.actualSources.some(actualSource => actualSource.sourceId === designReference.id)
  );
  const designReferenceSearchResults = await Promise.all(
    filteredDesignReferences.map(async (designReference) => {
      const nameRef = designReference.indexName === 'cms-doc-001' ? 'source' : 'document_name';
      const selectedFields = designReference.indexName === 'cms-doc-001' ? [nameRef, "content"] : ["source_url", nameRef, "content"];
      const filter = `${nameRef} eq '${designReference.name}'`;
      const result = await searchIndex({
        searchIndex: designReference.indexName,
        selectFields: selectedFields,
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 30,
        filter
      });
      return result;
    })
  );
  const filteredDesignReferenceSearchResults = createMessagesFromDesignReferences(designReferenceSearchResults);

  const foundSavedResponses = await selectRelatedSavedResponses(state.smartNoteId, state.teamName);
  const filteredSavedResponses = foundSavedResponses.filter(savedResponse =>
    state.actualSources.some(actualSource => actualSource.sourceId === savedResponse.id)
  );
  const savedResponseSearchResults = await Promise.all(
    filteredSavedResponses.map(async (savedResponse) => {
      const filter = `smartnote_id eq '${savedResponse.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredSavedResponseSearchResults = createMessagesFromSavedResponses(savedResponseSearchResults);
  const foundDesignIndexes = await selectRelatedDesignIndexes(state.smartNoteId, state.teamName);

  const filteredDesignIndexes = foundDesignIndexes.filter(designIndex =>
    state.actualSources.some(actualSource => actualSource.sourceId === designIndex.id)
  );

  const filteredDesignIndexesAdded = await addMissingDesignIndexes(filteredDesignIndexes, state.smartNoteId, state.teamName);

  const designIndexSearchResults = await Promise.all(
    filteredDesignIndexesAdded.map(async (designIndex) => {
      let filter;
      const integerCheck = /\d+/;
      if ((designIndex.indexName === 'kpmc-cr-001') && integerCheck.test(state.chatInteraction.prompt) && (state.chatInteraction.prompt.match(integerCheck) || []).length === 1) {
        const numberString = state.chatInteraction.prompt.match(integerCheck)[0];
        filter = `cr_id eq '${numberString}'`;
      }

      const index = await getIndexConfigById(designIndex.searchIndexConfigId, state.teamName);

      const result = await searchIndex({
        searchIndex: designIndex.indexName,
        selectFields: index?.selectFields,
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: index?.nearestNeighbors || 5,
        filter: filter || index?.filter,
        contentVectorField: designIndex.indexName === 'wstp-qtest-001' ? 'description_vector' : undefined
      });

      result.indexName = designIndex.indexName;
      result.searchIndexConfigId = designIndex.searchIndexConfigId;
      return result;
    })
  );

  const filteredDesignIndexSearchResults = await (async () => {
    // If any designIndexSearchResults has indexName 'geisinger-lcdarticle', use createMessagesFromDesignIndexResultsSelectFields for those
    const messages = [];
    for (const result of designIndexSearchResults) {
      if (typeof result.indexName === 'string' && result.indexName.startsWith('geisinger-')) {
        const indexConfig = await getIndexConfigById(result.searchIndexConfigId, state.teamName);
        messages.push(...createMessagesFromDesignIndexResultsSelectFields(result, indexConfig));
      } else {
        // fallback to existing logic
        const msgArr = await createMessagesFromDesignIndexes([result], state);
        messages.push(...msgArr);
      }
    }
    return messages;
  })();

  let filteredConfluenceURLsSearchResults = [];
  if (state.assistantName === 'kpmc-assistant') {
    const result = await searchIndex({
      searchIndex: 'kpmc-confluence-002',
      selectFields: ["space", "title", "content"],
      searchEmbedding: state.promptEmbedding,
      nearestNeighbors: 3
    });

    filteredConfluenceURLsSearchResults = createMessagesFromConfluenceURLs([result]);
  }

  let confluenceGeneralSearchResults = [];
  const foundGeneralConfluenceUrls = await selectRelatedConfluenceURLs(state.smartNoteId, state.teamName);
  const filteredGeneralConfluenceUrls = foundGeneralConfluenceUrls.filter(confluenceUrl =>
    state.actualSources.some(actualSource => actualSource.sourceId === confluenceUrl.id)
  );
  if (filteredGeneralConfluenceUrls.length > 0) {
    confluenceGeneralSearchResults = await Promise.all(
      filteredGeneralConfluenceUrls.map(async (confluenceUrl) => {
        const result = await searchIndex({
          searchIndex: 'smartnote-001',
          selectFields: ["smart_type", "content"],
          searchEmbedding: state.promptEmbedding,
          nearestNeighbors: 5,
          filter: `smart_type eq 'ConfluenceURL' and smartnote_id eq '${state.smartNoteId}'`
        });
        return result;
      })
    );
  }
  const filteredGeneralConfluenceURLsSearchResults = createMessagesFromConfluenceURLs(confluenceGeneralSearchResults);

  const foundWebsiteURLs = await selectRelatedWebsiteURLs(state.smartNoteId, state.teamName);
  const filteredWebsiteURLs = foundWebsiteURLs.filter(websiteURL =>
    state.actualSources.some(actualSource => actualSource.sourceId === websiteURL.id)
  );
  const websiteURLsSearchResults = await Promise.all(
    filteredWebsiteURLs.map(async (websiteURL) => {
      const filter = `smart_type eq 'WebsiteURL' and smartnote_id eq '${websiteURL.parentId}'`;
      const result = await searchIndex({
        searchIndex: 'smartnote-001',
        selectFields: ["smart_type", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 10,
        filter
      });
      return result;
    })
  );
  const filteredWebsiteURLsSearchResults = createMessagesFromWebsiteURLs(websiteURLsSearchResults);

  const foundUploadedDocuments = await selectRelatedUploadedDocuments(state.smartNoteId, state.teamName);
  const filteredUploadedDocuments = foundUploadedDocuments.filter(uploadedDocument =>
    state.actualSources.some(actualSource => actualSource.sourceId === uploadedDocument.id)
  );
  const uploadedDocumentSearchResults = await Promise.all(
    filteredUploadedDocuments.map(async (uploadedDocument) => {
      const searchIndexName = getUploadedDocumentsIndexName(state.assistantName, uploadedDocument.fileName);
      const searchFields = getUploadedDocumentsIndexFields(searchIndexName);
      const filter = getUploadedDocumentsIndexFilter(searchIndexName, uploadedDocument.parentId, uploadedDocument.fileName);
      const results = await searchIndex({
        searchIndex: searchIndexName,
        selectFields: searchFields,
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return { results, searchIndexName };
    })
  );
  const filteredUploadedDocumentSearchResults = createMessagesFromUploadedDocuments(uploadedDocumentSearchResults);

  const foundSharePointFiles = await selectRelatedSharePointFiles(state.smartNoteId, state.teamName);
  const filteredSharePointFiles = foundSharePointFiles.filter(sharePointFile =>
    state.actualSources.some(actualSource => actualSource.sourceId === sharePointFile.id)
  );
  const SharePointFilesearchResults = await Promise.all(
    filteredSharePointFiles.map(async (sharePointFile) => {
      const filter = `smartnote_id eq '${sharePointFile.parentId}' and file_name eq '${sharePointFile.fileName}' and  site_name eq '${sharePointFile.siteName}'`;
      const result = await searchIndex({
        searchIndex: 'sharepoint-uploads',
        selectFields: ["file_name", "content"],
        searchEmbedding: state.promptEmbedding,
        nearestNeighbors: 5,
        filter
      });
      return result;
    })
  );
  const filteredSharePointFilesearchResults = createMessagesFromSharePointFiles(SharePointFilesearchResults);

  let totalMessages;

  totalMessages = [
    ...filteredMessages,
    ...filteredDesignReferenceSearchResults,
    ...filteredSavedResponseSearchResults,
    ...filteredDesignIndexSearchResults,
    ...filteredConfluenceURLsSearchResults,
    ...filteredGeneralConfluenceURLsSearchResults,
    ...filteredUploadedDocumentSearchResults,
    ...filteredSharePointFilesearchResults,
    ...filteredWebsiteURLsSearchResults
  ];

  return { totalMessages };
};

const addChatHistoryNode = async (state) => {
  // get all chatInteraction data for this chatInteraction's parentId
  let chatInteractions = await selectChatInteractions({ type: 'ChatInteraction', parentId: state.chatInteraction.parentId, nuid: state.nuid }, state.teamName);
  // TODO: make this more intelligent by calculating tokens
  // If we exceed a given token limit (say 20,000), then summarize the initial interactions to keep an understanding of the main purpose of this conversation
  // then drop the earliest interactions until we are under the limit
  chatInteractions = chatInteractions
    .filter(ci => ci.isComplete)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-10); // get last 10 interactions only

  const chatHistory = [];
  chatInteractions.forEach(interaction => {
    chatHistory.push({ role: 'user', content: interaction.prompt });
    chatHistory.push({ role: 'assistant', content: interaction.response });
  });

  return { chatHistory };
}

const DEFAULT_ASSISTANT_CONFIG = {
  contextMessages: [
    {
      role: "system",
      content: "Even if asked, in all responses, avoid anything that appears to be PII or PHI: names, email addresses, etc."
    },
    {
      role: "system",
      content: "Always respond with UTF-8 encoding and return formatted markdown."
    }
  ]
};

const MAX_PLANNING_ROUNDS = 2;
const MAX_TOOL_CALLS_PER_ROUND = 5;
const SCTASK_ID_PATTERN = /^SCTASK\d+$/i;
const PLANNER_SEARCH_COLUMNS = SCTASK_SEARCHABLE_COLUMNS.filter(column => column !== 'ScTaskIDSource');

// Only these tools may be executed; arguments are whitelisted per tool before execution.
const TOOL_EXECUTORS = {
  get_sctask_by_id: async ({ scTaskId } = {}) => {
    const record = await getSCTaskById({ scTaskId });
    return { found: Boolean(record), record };
  },
  get_sctasks_by_keyword: async ({ searchCriteria, scTaskExclusions, limit } = {}) => {
    const records = await getSCTasksByKeyword({ searchCriteria, scTaskExclusions, limit });
    return { resultCount: records.length, records };
  }
};

const TOOL_PLANNER_PROMPT = `You are the tool-planning step for the Prod Support assistant for KPMC Prod Sup Core.
You cannot call tools yourself. Decide which SCTask database lookups the application should run to answer the user's latest message, and return ONLY a JSON object.

Available tools:
1. get_sctask_by_id - Look up a single SCTask by exact SCTask number. Use when the user references a specific SCTask ID such as SCTASK12345678.
   arguments: { "scTaskId": string }
2. get_sctasks_by_keyword - Search SCTasks for related tickets, similar tickets, or filtered ticket lists.
   arguments: {
     "searchCriteria": [{ "column": one of ${JSON.stringify(PLANNER_SEARCH_COLUMNS)}, "keywords": [string, ...] }],
     "scTaskExclusions": [string],
     "limit": integer from 1 to 10,
     "userRequestedIdMentionSearch": boolean
   }
   Keywords are OR'd within one criterion and criteria are AND'd together. Each keyword is matched as a substring. For broad free-text search, use the Description column unless the user explicitly identifies another field.

Rules:
- Plan tool calls whenever the user wants ticket lookup, related tickets, similar tickets, filtered ticket lists, or ticket details.
- Never search by SCTask ID column. To retrieve a specific ticket, use get_sctask_by_id.
- Never use an SCTask ID as a keyword unless the user explicitly asks for tickets whose text mentions that ID. Only in that case set "userRequestedIdMentionSearch": true.
- To find tickets similar or related to a known SCTask, plan ONLY get_sctask_by_id for that ticket in this step and set needsFollowUp to true. Do not plan a keyword search until you have seen that ticket's details.
- Set needsFollowUp to true only when you must see these results before planning additional calls.
- When planning a keyword search from a retrieved ticket, extract 2-5 distinctive keywords from its Description: application or system names, job or interface names, error codes or messages, file names, and specific technical terms. Use short phrases (1-3 words) likely to appear verbatim in other tickets. Do not use generic words (issue, error, request, please, help, ticket), people's names, dates, or SCTask IDs. Put them in a single Description criterion so they are OR'd, and exclude the original SCTask ID via scTaskExclusions.
- Never plan a call that has already been executed.
- If no SCTask data is needed, or the request is too ambiguous to search, return no tool calls.
- Never generate SQL.

Respond with JSON only (no markdown fences, no prose) in this exact shape:
{"toolCalls":[{"name":"<tool name>","arguments":{}}],"needsFollowUp":false}`;

const RESPONSE_BEHAVIOR_PROMPT = `You are the Prod Support assistant for KPMC Prod Sup Core.

Use the retrieved Smart Note context and recent chat history for general context. SCTask database lookups for this turn have already been run by the application, and their results are provided in the "Prod Support tool results" message.

- For requests that require SCTask data, answer only from the provided tool results. Do not answer from memory or guess.
- Never generate or expose SQL.
- If the tool results are empty or no lookups were run, say that plainly, explain which keywords were tried (if any), and suggest narrower or alternative search terms.
- If a tool returned an error, tell the user the lookup failed and suggest trying again.
- If the user's request is ambiguous, ask a focused clarification question instead of guessing.
- If the user asks for a longer list of tickets, notify them that 10 is the maximum you're allowed to lookup.
- Whenever SCTasks are displayed, always format them as a markdown table with one row per SCTask.
- Whenever SCTasks are returned from a search for tickets similar or related to another SCTask, or from a search using the user's own keywords, the markdown table must include a "Confidence" column with a score from 0.0 to 1.0 (one decimal place) estimating how well each SCTask matches the reference SCTask or the user's keywords. Sort rows by Confidence, highest first.`;

const formatRetrievedContextMessage = (totalMessages = []) => {
  if (!Array.isArray(totalMessages) || totalMessages.length === 0) {
    return 'No relevant Smart Note source context was retrieved for this turn.';
  }

  return totalMessages.map(result => result.content).join("\n");
};

const parseToolPlan = (rawResponse) => {
  if (typeof rawResponse !== 'string') {
    return null;
  }
  const start = rawResponse.indexOf('{');
  const end = rawResponse.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawResponse.slice(start, end + 1));
    return {
      toolCalls: Array.isArray(parsed?.toolCalls) ? parsed.toolCalls : [],
      needsFollowUp: parsed?.needsFollowUp === true
    };
  } catch {
    return null;
  }
};

const normalizeScTaskId = (value) => String(value ?? '').trim().toUpperCase();

// Enforces search rules the planner may not follow: no ID-column filters and no SCTask ID keywords unless explicitly requested.
const sanitizeKeywordSearchArgs = (args, seedScTaskIds) => {
  const allowIdKeywords = args?.userRequestedIdMentionSearch === true;
  const strippedScTaskIds = new Set();

  const searchCriteria = (Array.isArray(args?.searchCriteria) ? args.searchCriteria : [])
    .filter(criterion => criterion && PLANNER_SEARCH_COLUMNS.includes(criterion.column))
    .map(criterion => ({
      column: criterion.column,
      keywords: (Array.isArray(criterion.keywords) ? criterion.keywords : [criterion.keywords])
        .map(keyword => String(keyword ?? '').trim())
        .filter(keyword => {
          if (!keyword) {
            return false;
          }
          const normalized = normalizeScTaskId(keyword);
          if (SCTASK_ID_PATTERN.test(normalized) && (!allowIdKeywords || seedScTaskIds.has(normalized))) {
            strippedScTaskIds.add(normalized);
            return false;
          }
          return true;
        })
    }))
    .filter(criterion => criterion.keywords.length > 0);

  const scTaskExclusions = [...new Set([
    ...(Array.isArray(args?.scTaskExclusions) ? args.scTaskExclusions.map(normalizeScTaskId).filter(Boolean) : []),
    ...seedScTaskIds
  ])];

  return {
    args: { searchCriteria, scTaskExclusions, limit: args?.limit },
    strippedScTaskIds
  };
};

const sanitizePlannedCalls = (toolCalls, seedScTaskIds) => {
  const validCalls = toolCalls.filter(call => call && typeof call.name === 'string');

  validCalls
    .filter(call => call.name === 'get_sctask_by_id')
    .forEach(call => {
      const id = normalizeScTaskId(call.arguments?.scTaskId);
      if (id) {
        seedScTaskIds.add(id);
      }
    });

  const sanitizedCalls = [];
  const idsNeedingLookup = new Set();
  let deferredKeywordSearch = false;

  for (const call of validCalls) {
    if (call.name === 'get_sctask_by_id') {
      sanitizedCalls.push({ name: call.name, arguments: { scTaskId: normalizeScTaskId(call.arguments?.scTaskId) } });
      continue;
    }
    if (call.name !== 'get_sctasks_by_keyword') {
      sanitizedCalls.push(call);
      continue;
    }

    const { args, strippedScTaskIds } = sanitizeKeywordSearchArgs(call.arguments, seedScTaskIds);
    strippedScTaskIds.forEach(id => {
      if (!seedScTaskIds.has(id)) {
        idsNeedingLookup.add(id);
      }
    });

    // A search that only contained seed IDs must wait until keywords are extracted from the seed ticket.
    if (args.searchCriteria.length === 0) {
      deferredKeywordSearch = true;
      continue;
    }
    sanitizedCalls.push({ name: call.name, arguments: args });
  }

  idsNeedingLookup.forEach(id => {
    seedScTaskIds.add(id);
    sanitizedCalls.unshift({ name: 'get_sctask_by_id', arguments: { scTaskId: id } });
  });

  return {
    calls: sanitizedCalls,
    forceFollowUp: deferredKeywordSearch || idsNeedingLookup.size > 0
  };
};

const executePlannedToolCall = async ({ name, arguments: args }) => {
  const executor = TOOL_EXECUTORS[name];
  if (!executor) {
    return { tool: name, arguments: args, error: `Unknown tool: ${name}` };
  }
  try {
    const result = await executor(args && typeof args === 'object' && !Array.isArray(args) ? args : {});
    logProdSupportToolGraph('Executed planned tool call', {
      toolName: name,
      argumentKeys: Object.keys(args || {}),
      resultCount: result.resultCount ?? (result.found ? 1 : 0)
    });
    return { tool: name, arguments: args, ...result };
  } catch (error) {
    errorProdSupportToolGraph('Planned tool call failed', { toolName: name, error: error.message });
    return { tool: name, arguments: args, error: `Tool execution failed: ${error.message}` };
  }
};

const planAndExecuteToolsNode = async (state) => {
  const toolResults = [];
  const executedCallKeys = new Set();
  const seedScTaskIds = new Set();
  const plannerMessages = [
    { role: 'system', content: TOOL_PLANNER_PROMPT },
    ...state.chatHistory,
    { role: 'user', content: state.chatInteraction.prompt }
  ];

  for (let round = 1; round <= MAX_PLANNING_ROUNDS; round++) {
    const rawPlan = await chatCompletion({
      messages: plannerMessages,
      temperature: 0,
      max_tokens: 1000,
      teamName: state.teamName,
      assistantName: state.assistantName,
      nuid: state.nuid
    });
    const plan = parseToolPlan(rawPlan);

    if (!plan) {
      errorProdSupportToolGraph('Unable to parse tool plan', { teamName: state.teamName, assistantName: state.assistantName, round });
      break;
    }

    const { calls: sanitizedCalls, forceFollowUp } = sanitizePlannedCalls(plan.toolCalls, seedScTaskIds);
    const needsFollowUp = plan.needsFollowUp || forceFollowUp;

    const newCalls = sanitizedCalls
      .filter(call => {
        const key = `${call.name}:${JSON.stringify(call.arguments ?? {})}`;
        if (executedCallKeys.has(key)) {
          return false;
        }
        executedCallKeys.add(key);
        return true;
      })
      .slice(0, MAX_TOOL_CALLS_PER_ROUND);

    logProdSupportToolGraph('Resolved tool plan', {
      teamName: state.teamName,
      assistantName: state.assistantName,
      round,
      toolCallNames: newCalls.map(call => call.name),
      plannedToolCallCount: plan.toolCalls.length,
      needsFollowUp,
      forcedFollowUp: forceFollowUp
    });

    if (newCalls.length === 0) {
      break;
    }

    const roundResults = await Promise.all(newCalls.map(executePlannedToolCall));
    toolResults.push(...roundResults);

    if (!needsFollowUp) {
      break;
    }

    const seedIdList = [...seedScTaskIds];
    plannerMessages.push(
      { role: 'assistant', content: JSON.stringify({ toolCalls: newCalls, needsFollowUp: true }) },
      {
        role: 'user',
        content: `Tool results so far:\n${JSON.stringify(toolResults)}\n\nPlan any additional tool calls needed to answer my original request, using the same JSON format.${seedIdList.length > 0
          ? ` If my request is for similar or related tickets, plan get_sctasks_by_keyword using distinctive keywords extracted from the Description of ${seedIdList.join(', ')} above. Do not use ${seedIdList.join(', ')} as keywords, and exclude them via scTaskExclusions.`
          : ''}`
      }
    );
  }

  return { toolResults };
};

const chatCompletionWithToolResultsNode = async (state) => {
  const systemPromptMessages = state.systemPrompt ? [{ role: 'system', content: state.systemPrompt }] : [];
  const personaPromptMessages = state.personaPrompt ? [{ role: 'system', content: state.personaPrompt }] : [];
  const toolResultsContent = state.toolResults.length > 0
    ? JSON.stringify(state.toolResults)
    : 'No Prod Support tool lookups were run for this turn. Do not claim to have queried the SM_DW database.';
  const contextMessages = [
    ...DEFAULT_ASSISTANT_CONFIG.contextMessages,
    { role: 'system', content: RESPONSE_BEHAVIOR_PROMPT },
    { role: 'assistant', content: `Relevant Smart Note and source context:\n${formatRetrievedContextMessage(state.totalMessages)}` },
    { role: 'system', content: `Prod Support tool results:\n${toolResultsContent}` }
  ];

  const userMessages = [{ role: 'user', content: state.chatInteraction.prompt }];

  const allMessages = [
    ...systemPromptMessages,
    ...personaPromptMessages,
    ...contextMessages,
    ...state.chatHistory,
    ...userMessages
  ];

  const chatCompletionConfig = await getDefaultChatCompletionConfig(state.teamName, state.assistantName);

  logProdSupportToolGraph('Preparing completion request', {
    teamName: state.teamName,
    assistantName: state.assistantName,
    toolResultCount: state.toolResults.length,
    messageCount: allMessages.length,
    retrievedContextCount: Array.isArray(state.totalMessages) ? state.totalMessages.length : 0,
    chatHistoryMessageCount: Array.isArray(state.chatHistory) ? state.chatHistory.length : 0,
    hasSystemPrompt: Boolean(state.systemPrompt),
    hasPersonaPrompt: Boolean(state.personaPrompt),
    model: chatCompletionConfig?.model
  });

  const markdownResponse = await chatCompletionMarkdown({
    messages: allMessages,
    onToken: (content) => state.sendEvent({ type: 'data', data: content }),
    teamName: state.teamName,
    assistantName: state.assistantName,
    chatCompletionConfig: {
      temperature: chatCompletionConfig?.temperature,
      max_tokens: chatCompletionConfig?.max_tokens,
      model: chatCompletionConfig?.model
    }
  });

  logProdSupportToolGraph('Completion finished', {
    teamName: state.teamName,
    assistantName: state.assistantName,
    responseGenerated: typeof markdownResponse === 'string' && markdownResponse.length > 0
  });

  return { markdownResponse };
};

const chatCompletionPromptsNode = async (state) => {
  const contextMessages = [
    {
      role: "user",
      content: `Based on your ${state.markdownResponse} response, provide 3 suggested prompts, plain text only, separated by ~!~ and don't number them.`
    }
  ];

  const suggestedPrompts = await chatCompletionPrompts({ messages: contextMessages, teamName: state?.teamName, assistantName: state?.assistantName });
  state.sendEvent({ type: 'data', data: JSON.stringify({ suggestedPrompts }) });
  return { suggestedPrompts };
};

// Define the state annotations
const StateAnnotation = Annotation.Root({
  nuid: Annotation,
  smartNoteId: Annotation,
  teamName: Annotation,
  assistantName: Annotation,
  systemPrompt: Annotation,
  userSelectedPersona: Annotation,
  personaPrompt: Annotation,
  personaAssociatedGraph: Annotation,
  sources: Annotation,
  chatInteraction: Annotation,
  systemMessage: Annotation,
  promptEmbedding: Annotation,
  searchResults: Annotation,
  filteredSearchResults: Annotation,
  actualSources: Annotation,
  totalMessages: Annotation,
  markdownResponse: Annotation,
  suggestedPrompts: Annotation,
  chatHistory: Annotation,
  sendEvent: Annotation,
  toolResults: Annotation
});

// Build the state graph
const graphBuilder = new StateGraph(StateAnnotation);

const graph = graphBuilder
  .addNode("smartNotesNode", smartNotesNode)
  .addNode("systemPromptNode", systemPromptNode)
  .addNode("personaNode", personaNode)
  .addNode("vectorizePromptNode", vectorizePromptNode)
  .addNode("searchIndexNode", searchIndexNode)
  .addNode("filterSourcesNode", filterSourcesNode)
  .addNode("createMessagesNode", createMessagesNode)
  .addNode("chatHistoryNode", addChatHistoryNode)
  .addNode("planAndExecuteToolsNode", planAndExecuteToolsNode)
  .addNode("chatCompletionWithToolResultsNode", chatCompletionWithToolResultsNode)
  .addNode("chatCompletionPromptsNode", chatCompletionPromptsNode)

  .addEdge(START, "smartNotesNode")
  .addEdge("smartNotesNode", "systemPromptNode")
  .addEdge("systemPromptNode", "personaNode")
  .addEdge("personaNode", "vectorizePromptNode")
  .addEdge("vectorizePromptNode", "searchIndexNode")
  .addEdge("searchIndexNode", "filterSourcesNode")
  .addEdge("filterSourcesNode", "createMessagesNode")
  .addEdge("createMessagesNode", "chatHistoryNode")
  .addEdge("chatHistoryNode", "planAndExecuteToolsNode")
  .addEdge("planAndExecuteToolsNode", "chatCompletionWithToolResultsNode")
  .addEdge("chatCompletionWithToolResultsNode", "chatCompletionPromptsNode")
  .addEdge("chatCompletionPromptsNode", END)
  .compile();

export async function runProdSupportToolGraph({ nuid, smartNoteId, chatInteraction, teamName, assistantName }) {
  recordAssistantPromptSubmitted(nuid, null, teamName, assistantName); // may need to revisit
  logProdSupportToolGraph('Starting graph invocation', {
    teamName,
    assistantName,
    smartNoteId,
    hasChatInteraction: Boolean(chatInteraction),
    hasParentInteraction: Boolean(chatInteraction?.parentId)
  });
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Invoke the state graph
      await graph.invoke({
        nuid,
        smartNoteId,
        chatInteraction,
        teamName,
        assistantName,
        sendEvent: (event) => {
          if (event.type === 'data') {
            // Enqueue each data event (e.g., markdown response tokens)
            controller.enqueue(encoder.encode(event.data));
          }
        }
      });

      logProdSupportToolGraph('Graph invocation completed', {
        teamName,
        assistantName,
        smartNoteId
      });

      // Close the stream
      controller.close();
    }
  });

  return stream;
}
