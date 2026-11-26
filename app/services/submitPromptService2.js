'use server';

import { Annotation, StateGraph, START, END } from "./langgraphs/langgraph-light.js";
import { chatCompletionMarkdown, chatCompletionPrompts, chatCompletionMcp } from './chatCompletionService2';
import { getAllMcpServers } from './mcpServerConfigService';
import { searchIndex } from './searchVectorDataService';
import { vectorize } from './vectorizeDataService';
import { selectSmartNote } from '@services/smartNoteService';
import { selectSystemPrompt } from '@services/systemPromptService';
import { selectJustSources, selectRelatedDesignReferences, selectRelatedDesignIndexes, selectRelatedUploadedDocuments, selectRelatedSharePointFiles, selectRelatedSavedResponses, selectRelatedWebsiteURLs, selectRelatedConfluenceURLs } from '@services/actualSourcesService';
import { recordAssistantPromptSubmitted } from '@services/statisticsService';
import { getIndexConfigById } from "./aiSearchConfigService";
import { systemPromptNode } from '@/app/services/langgraphs/shared/nodes/addSystemPromptsNode.js';
import { personaNode } from '@/app/services/langgraphs/shared/nodes/addPersonaPromptsNode.js';
import { selectChatInteractions } from "./chatInteractionService";
import { getDefaultChatCompletionConfig } from "./chatCompletionConfigService";
import { AVAILABLE_TOOLS } from './chatCompletionService2.js';

const smartNoteIndex = 'smartnote-001';

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

// const getSystemContent = async (smartNoteId, teamName) => {
// const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId }
// const smartNote = await selectSmartNote(query, teamName);
// if (smartNote.selectedUserAssistant === 'kpmc-assistant' || smartNote.selectedUserAssistant === 'scheduletopay') {
//   switch (smartNote.persona) {
//     case 'Business': {
//       return 'You are a business user with domain expertise and work within an Agile software delivery life cycle.';
//     }
//     case 'Planning': {
//       return 'You are an iteration planning member defining user stories for the next sprint and work within an Agile software delivery life cycle.';
//     }
//     case 'Architecture': {
//       return 'You are an architect, helping development teams with technical design and work within an Agile software delivery life cycle.';
//     }
//     case 'Development': {
//       return 'You are a developer and your job is to understand requirements and implement a solution working within an Agile software delivery life cycle.';
//     }
//     case 'Testing': {
//       return 'You are a tester and your job is to create test cases and automated tests working within an Agile software delivery life cycle.';
//     }
//     default: {
//       return 'You are an expert in Agile product management.';
//     }
//   }
// } else if (smartNote.selectedUserAssistant === 'health-plan-medicare-regulatory') {
//   switch (smartNote.persona) {
//     case 'Solution Architect': {
//       return 'You assist a Solution Architect supporting regulatory systems at KP. Focus on designing secure, scalable, and compliant solutions. Align architecture with internal policies and healthcare regulations, ensuring maintainability and system integration.';
//     }
//     case 'Business': {
//       return 'You assist a Business Owner in KP’s Medicare Regulatory team. Focus on regulatory impact, compliance operations, and aligning initiatives with business objectives. Provide clear, concise insights to support prioritization, planning, and oversight.';
//     }
//     case 'Product Owner': {
//       return 'You assist a Product Owner in KP’s Medicare Regulatory team. Focus on regulatory requirements, stakeholder alignment, backlog management, and timely delivery of compliance-related features. Ensure clarity, traceability, and value in product decisions.';
//     }
//     default: {
//       return 'Behave as if you are an expert in Medicare Regulations.';
//     }
//   }
// } else {
//   return 'You are an expert in Agile product management.';
// }
// };

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

const enrichPromptNode = async (state) => {
  const enrichedPrompt = state.totalMessages.map(result => result.content).join("\n") + "\n\nUser question is: " + state.chatInteraction.prompt;
  return { enrichedPrompt };
};

const chatCompletionMarkdownNode = async (state) => {
  const systemPromptMessages = state.systemPrompt ? [{ role: 'system', content: state.systemPrompt }] : [];
  const personaPromptMessages = state.personaPrompt ? [{ role: 'system', content: state.personaPrompt }] : [];

  const snowToolDescriptions = `# Tools:

You currently have access to two tools. The tools are described below.

## Service Now (SNOW) lookup.
The SNOW lookup tool allows you to look up Service Now (SNOW) tickets. In order to look up a ticket you need a ticket number. These come in several forms, like: RITM1236789, CHG1237468, INC1234567, TASK1234656, and others. If a user asks you to look up a ticket in SNOW and you're unable to find their ticket number, you should ask for it. Once you have the ticket number, you can use the SNOW lookup tool to get information about the ticket.

## Service Now (SNOW) create ticket.
The SNOW create ticket tool allows you to create a Service Now (SNOW) incident. When a user asks to create a ticket or incident, you should ask them for the required and optional information to create the ticket. The required fields are: category, configurationItem, and shortDescription. One optional auto-filled filed is: requestedFor - it will be automatically populated with the current user's NUID if not provided. Optional fields are: environment, impact, urgency, and vendorReference. Once you have the required information, you can use the SNOW create ticket tool to create the ticket. If the user provides optional information, you should include that in the create ticket request also. After creating the ticket, you should provide the user with the ticket number and any other relevant information.`;

  // Per-assistant config. New assistants are added here; no boolean flags needed.
  // - contextMessages: hardcoded system messages appended after systemPrompt/persona
  //   (the DB-managed system prompt is the preferred place; keep this minimal/legacy)
  // - tools: tools exposed to the model for this assistant
  const ASSISTANT_CONFIG = {
    'generate-test-mrn-v2': {
      contextMessages: [],
      tools: [AVAILABLE_TOOLS.createSubscriberMrn, AVAILABLE_TOOLS.createFamilyMrn]
    }
  };
  const DEFAULT_ASSISTANT_CONFIG = {
    contextMessages: [
      {
        role: "system",
        content: "Even if asked, in all responses, avoid anything that appears to be PII or PHI: names, email addresses, etc."
      },
      {
        role: "system",
        content: "Please respond with UTF-8 encoding and return formatted markdown. If the prompt directly requests a graph or you can infer that a graph would help explain the response, then introduce a mermaid graph in your response. In mermaid diagrams, always wrap node label text in double quotes to prevent syntax errors. For example: A[\"GET /v1/members/{id}\"] B(\"Process request\") C{\"Is valid?\"}. This applies to every shape: rectangles [], rounded (), diamonds {}, etc. For edge/link labels between pipes, use only plain alphanumeric text without quotes, parentheses, or special characters. For example: -->|Yes| -->|No| -->|Success| -->|Error 401|. Never use parentheses, quotes, slashes, or braces inside edge labels."
      },
      {
        role: "system",
        content: snowToolDescriptions
      }
    ],
    tools: [AVAILABLE_TOOLS.getSnowTicket, AVAILABLE_TOOLS.createSnowTicket]
  };
  const assistantConfig = ASSISTANT_CONFIG[state.assistantName] || DEFAULT_ASSISTANT_CONFIG;
  const contextMessages = assistantConfig.contextMessages;

  const userMessages = [
    {
      role: "user",
      content: state.enrichedPrompt
    }
  ];

  const allMessages = [
    ...systemPromptMessages,
    ...personaPromptMessages,
    ...contextMessages,
    ...state.chatHistory,
    ...userMessages
  ];

  const chatCompletionConfig = await getDefaultChatCompletionConfig(state.teamName, state.assistantName);

  let enabledMcpServers = [];
  try {
    const allMcpServers = await getAllMcpServers(state.teamName, state.assistantName);
    enabledMcpServers = Array.isArray(allMcpServers)
      ? allMcpServers.filter(server => server?.enabled !== false && server?.serverLabel && server?.serverUrl)
      : [];
  } catch (error) {
    console.error(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'chatCompletionMarkdownNode',
        detail: {
          teamName: state.teamName,
          assistantName: state.assistantName,
          action: 'Failed to load MCP servers',
          error: error.message
        }
      }
    }));
  }

  let markdownResponse;
  if (enabledMcpServers.length > 0) {

    console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'enabledMcpServers',
          detail: { teamName: state.teamName, assistantName: state.assistantName, enabledMcpServers: enabledMcpServers.map(server => ({ serverLabel: server.serverLabel, serverUrl: server.serverUrl })) }
        }
      }));   
      markdownResponse = await chatCompletionMcp({
        messages: allMessages,
        onToken: (content) => state.sendEvent({ type: 'data', data: content }),
        teamName: state.teamName,
        assistantName: state.assistantName,
        chatResponseConfig: {
          temperature: chatCompletionConfig?.temperature,
          max_completion_tokens: chatCompletionConfig?.max_completion_tokens,
          model: chatCompletionConfig?.model
        },
        mcpServers: enabledMcpServers
      });
    } else {
      markdownResponse = await chatCompletionMarkdown({
        messages: allMessages,
        onToken: (content) => state.sendEvent({ type: 'data', data: content }),
        teamName: state.teamName,
        assistantName: state.assistantName,
        chatCompletionConfig: {
          temperature: chatCompletionConfig?.temperature,
          max_tokens: chatCompletionConfig?.max_tokens,
          model: chatCompletionConfig?.model
        },
        toolsList: assistantConfig.tools
      });
    }

  return { markdownResponse };
};

const ASSISTANTS_WITHOUT_SUGGESTED_PROMPTS = new Set(['generate-test-mrn-v2']);

const chatCompletionPromptsNode = async (state) => {
  if (ASSISTANTS_WITHOUT_SUGGESTED_PROMPTS.has(state.assistantName)) {
    return { suggestedPrompts: [] };
  }

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
  enrichedPrompt: Annotation,
  markdownResponse: Annotation,
  suggestedPrompts: Annotation,
  chatHistory: Annotation,
  sendEvent: Annotation
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
  .addNode("enrichPromptNode", enrichPromptNode)
  .addNode("chatCompletionMarkdownNode", chatCompletionMarkdownNode)
  .addNode("chatCompletionPromptsNode", chatCompletionPromptsNode)

  .addEdge(START, "smartNotesNode")
  .addEdge("smartNotesNode", "systemPromptNode")
  .addEdge("systemPromptNode", "personaNode")
  .addEdge("personaNode", "vectorizePromptNode")
  .addEdge("vectorizePromptNode", "searchIndexNode")
  .addEdge("searchIndexNode", "filterSourcesNode")
  .addEdge("filterSourcesNode", "createMessagesNode")
  .addEdge("createMessagesNode", "chatHistoryNode")
  .addEdge("chatHistoryNode", "enrichPromptNode")
  .addEdge("enrichPromptNode", "chatCompletionMarkdownNode")
  .addEdge("chatCompletionMarkdownNode", "chatCompletionPromptsNode")
  .addEdge("chatCompletionPromptsNode", END)
  .compile();

export async function submitPrompt({ nuid, smartNoteId, sources, chatInteraction, teamName, assistantName }) {
  recordAssistantPromptSubmitted(nuid, null, teamName, assistantName); // may need to revisit
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Invoke the state graph
      await graph.invoke({
        nuid,
        smartNoteId,
        sources,
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

      // Close the stream
      controller.close();
    }
  });

  return stream;
}
