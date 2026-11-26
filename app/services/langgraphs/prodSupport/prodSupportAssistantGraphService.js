'use server';

import { Annotation, StateGraph, START, END } from "../langgraph-light.js";
import { chatCompletionMarkdown, chatCompletion, chatCompletionPrompts, chatCompletionMcp } from '@/app/services/chatCompletionService2';
import { getAllMcpServers } from '@/app/services/mcpServerConfigService';
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
import { getSNOWRecords } from "../../smdwSqlDatabaseService.js";

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

const determineIntentNode = async (state) => {
  // TODO: Externalize this intentPrompt to live configuration in the app that can be controlled via a Team Admin Page so adjustments can be made quickly without requireing a deployment.
  const intentPrompt = `You are an AI assistant that determines the intent of a user's question. Your job is to categorize the question into one of three categories: "lookup", "compare", or "other". The user's question is: "${state.chatInteraction.prompt}".

  Users may formulate questions that start in the form "provide a list...", "identify tickets... ". These type of questions will require a lookup in the SNOW Reporting Database. Examples include:

  - "Provide a list of all Production Defect SCTASKs that are in a deployed status within the last 6 months that have a title referencing Delinquency"
  - "Provide a list of all Production Defect SCTASKs related to SCTASK12345678"
  - "Provide a list of all Production Defect SCTASKs that are a Fix in Progress or Fixed Retest status under the VS3 Delinquency"
  - "Provide me with a list of Production Defect SCTASKs that are in Evaluation Status with keyword of \"MACL5519\" in the title"

  If a user asks a question in this category, respond with the intent "lookup". 
  
  Users may formulate questions that start in the form "find tickets related to...", "do we have any tickets similar to...". These type of questions will require a comparison in the SNOW Reporting Database. Examples include:

  - "Find tickets related to SCTASK12345678"
  - "Do we have any tickets similar to SCTASK87654321"
  - "Find tickets that are similar to the following description: \"There was an issue identified with high volume requests to the xyz service, causing delinquency payments to fail. The issue was resolved by updating the xyz service to handle high volume requests more efficiently.\""

  If a user asks a question in this category, respond with the intent "compare".

  If a users asks a question that does not match either of the above categories, respond with the intent "other".

  You must ONLY respond with the intent, no other text.`;

  const intentResponse = await chatCompletion({
    messages: [{ role: 'user', content: intentPrompt }],
    onToken: (content) => state.sendEvent({ type: 'data', data: content }),
    teamName: state.teamName,
    assistantName: state.assistantName,
    chatResponseConfig: {
      temperature: 0,
      max_completion_tokens: 50
    }
  });
  const intent = intentResponse.trim().toLowerCase();

  console.log(`[Prod Support] Intent determined: ${intent}`);

  return { intent };
}

const buildSM_DWContextNode = async (state) => {
  // TODO: Implement logic to build context for SM_DW (Service Management Data Warehouse) so the assistant understands the schema of the database table(s) and columns and how they might related to certain keywords in natural language. This should be used to help the Assistant understand how to build SQL Queries to extract SM_DW data.
  const sm_dwContext = `The SM_DW database contains tables and columns that store information about Service Management data. We will use this database to query information based on the user's prompt.

  Any query you write must only target the \`dbo.SCTaskDetailHistory\` table in the SM_DW database. You must not attempt to write queries that target any other tables in the SM_DW database.
  

  The following table provides a mapping of SNOW fields to SM_DW fields that can be used to construct SQL queries:

| SNOW Field | SM_DW Field |
| ---------- | -------------- |
| Number     | ScTaskIDSource |
| State | State |
| Assignment group | AssignmentGroup |
| Assigned to | AssignedToName |
| Opened | OpenedAt |
| Requested for | RequestedForName |
| Opened by | OpenedByName |
| Priority | Priority |
| Description | Description | 

When a user makes a request for a single task or list of tasks, you should only return the following fields from the \`dbo.SCTaskDetailHistory\` table: ScTaskIDSource, State, AssignmentGroup, AssignedToName, OpenedAt, RequestedForName, OpenedByName, Priority, Description. You should not attempt to return any other fields from the \`dbo.SCTaskDetailHistory\` table.

When you generate SQL queries, you should use the following rules:
1. Always use the \`dbo.SCTaskDetailHistory\` table in your queries.
2. Always filter the results to only include records where AssignmentGroup = 'KPMC Prod Sup Core'.
3. Only return the fields specified above.
4. Use the correct SM_DW field names in your queries.
5. Ensure that your queries are valid SQL syntax and can be executed against the SM_DW database.
6. Avoid querying large amounts of data. Limit the maximum number of results returned to 10 at an absolute maximum.
7. If the user's prompt is too broad, ask them to provide more specific criteria to narrow down the results.
  `;

  return { sm_dwContext };
}


const generateSQLQueryNode = async (state) => {
  // TODO: Ask the LLM to build the SQL Query baseed on the SM_DW and SQL generation rules context. The LLM should be able to understand the user's prompt and the context of the database schema and generate a valid SQL query that can be run against the SM_DW database.
  let sqlQueryPrompt = `Based on the user's question: "${state.chatInteraction.prompt}", and the SM_DW database context: "${state.sm_dwContext}", generate a valid SQL query that can be run against the SM_DW database to retrieve the relevant data. Respond ONLY with the query and nothing else. Do not include any explanations or additional text.`;

  if (state.comparisonKeywords) {
    sqlQueryPrompt += ` The user's question contains the following comparison keywords: "${state.comparisonKeywords}". Use all of these keywords to help generate the SQL query. Only exclude keywords from the query if the user explicitly says to. The Description field should be used to test comparison against keywords in most cases, unless indicated by the user.`;
  }

  const sqlQueryResponse = await chatCompletion({
    messages: [{ role: 'user', content: sqlQueryPrompt }],
    onToken: (content) => state.sendEvent({ type: 'data', data: content }),
    teamName: state.teamName,
    assistantName: state.assistantName,
    chatResponseConfig: {
      temperature: 0,
      max_completion_tokens: 1000
    }
  });
  const sqlQuery = sqlQueryResponse.trim();

  console.log(`[Prod Support] SQL Query generated: ${sqlQuery}`);

  return { sqlQuery, queryGenAttemptCount: (state.queryGenAttemptCount || 0) + 1 };
}

const validateSQLQuery = (query) => {
  // Validate that the SQL Query contains valid syntax, is not succeptible to SQL injection, and adheres to the rules for querying the SM_DW database.
  // Rules: 
  // Only SELECT statements are allowed
  // Only the dbo.SCTaskDetailHistory table can be queried
  // Only the specified fields can be returned
  // No subqueries or joins are allowed
  // No data modification statements (INSERT, UPDATE, DELETE) are allowed
  // No comments are allowed in the query
  // The query must not return more than 10 results

  const isValid = query.toLowerCase().startsWith('select') &&
    query.toLowerCase().includes('from dbo.sctaskdetailhistory') &&
    !query.toLowerCase().includes('insert') &&
    !query.toLowerCase().includes('update') &&
    !query.toLowerCase().includes('delete') &&
    !query.toLowerCase().includes('drop') &&
    !query.toLowerCase().includes('alter') &&
    !query.toLowerCase().includes('--') &&
    !query.toLowerCase().includes('/*') &&
    !query.toLowerCase().includes('*/') &&
    !query.toLowerCase().includes('join') &&
    !query.toLowerCase().includes('union') &&
    !query.toLowerCase().includes('limit') // Assuming SQL Server, use TOP instead
    ;
  return isValid;
}

/*

 */

const runSQLQueryNode = async (state) => {

  if (!validateSQLQuery(state.sqlQuery)) {
    state.sendEvent({ type: 'data', data: "The assistant generated a query that is invalid or does not adhere to the rules for querying the SM_DW database. Please try again, or rephrase your question. If this issue persists, please report this to the HPAIS team HealthPlanAIServices@kp.org" });
    console.error(`[Prod Support] Invalid SQL Query generated: ${state.sqlQuery}`);
    return; // Stop further execution if the query is invalid
  }

  // TODO: Run against the actual DB
  let sqlResults;

  sqlResults = await getSNOWRecords(state.sqlQuery);

  if (sqlResults.length === 0) {
    state.sendEvent({ type: 'data', data: "The query returned no results. Please refine your question to narrow down the results." });
    return { isQueryResultValid: false, sqlResults };
  }

  if (sqlResults.length > 10) {
    state.sendEvent({ type: 'data', data: "The query returned more than 10 results. Please refine your question to narrow down the results." });
  }


  console.log(`[Prod Support] SQL Query executed successfully.`);

  return { isQueryResultValid: true, sqlResults };
}

const scoreResultsNode = async (state) => {
  // After running the SQL and getting the results back, we should try to score the data set and remove low scoring matches.
  const sqlQueryPrompt = `You are an AI assistant that scores the relevance of a set of results based on a user's question. The user's question is: "${state.chatInteraction.prompt}". This question was used to query the SM_DW database for relevant data. That data is presented as follows: \n\n ${state.sqlResults.map(result => `SC Task Number: ${result.ScTaskIDSource ?? 'Not Found'}, Status: ${result.State ?? 'Not Found'}, Assignment Group: ${result.AssignmentGroup ?? 'Not Found'}, Assignee: ${result.AssignedToName ?? 'Not Found'}, Opened On: ${result.OpenedAt ?? 'Not Found'}, Requestor: ${result.RequestedForName ?? 'Not Found'}, Submitter: ${result.OpenedByName ?? 'Not Found'}, Request Status: ${result.requestStatus ?? 'Not Found'}, Severity: ${result.Priority ?? 'Not Found'}, Defect Number: ${result.DefectNumber ?? 'Not Found'}, Short Description: ${result.ShortDescription ?? 'Not Found'}, Description: ${result.Description ?? 'Not Found'}`).join('\n\n')}\n\nPlease score each result on a scale of 0.0 to 1.0, where 0 means not relevant at all and 1 means highly relevant. Your response must be formatted as HTML + Markdown. Use the <details> element. In the <summary> tags, include the SCTask number and the Confidence score. After the summary, format the Fields and Values as a Mardkown table. This response must be valid to properly rendered in a web browser.
  
  The output should follow this format for each result, but it should not use any of the fake data below:
  <details>
  <summary>SC Task Number: SCTASK12345678, Confidence Score: 0.95</summary>
  | Field | Value |
  | ----- | ----- |
  | SC Task Number | SCTASK12345678 |
  | Status | Deployed |
  | Assignment Group | HPAIS |
  | Assignee | Samuel Smith |
  | Created Date | 2026-09-15 |
  | Requestor | Jonathan Doe |
  | Submitter | Jonathan Doe |
  | Request Status | Tracking |
  | Severity | High |
  | Defect Number | DEF123456 |
  | Description | There was an issue identified with... |
  </details>`;

  const scoredResults = await chatCompletion({
    messages: [{ role: 'user', content: sqlQueryPrompt }],
    onToken: (content) => state.sendEvent({ type: 'data', data: content }),
    teamName: state.teamName,
    assistantName: state.assistantName,
    chatResponseConfig: {
      temperature: 0,
      max_completion_tokens: 1000
    }
  });

  let markdownResponse = scoredResults;
  state.sendEvent({ type: 'data', data: markdownResponse });

  return { markdownResponse };
}

const limitExceededNode = async (state) => {
  // TODO: test the number of times we've tried to generate valid SQL and if we exceed the limit, then return a message to the user that we are unable to generate a valid query and ask them to rephrase their question or provide more context.
  state.sendEvent({ type: 'data', data: "Unable to generate a valid SQL query after multiple attempts. Please rephrase your question or provide more context." });
}


const compareNode = async (state) => {
  // TODO: extract initial SCTASK number from the prompt and gather the data for comparison later, or if the user has provided
  const comparePrompt = `You are an AI assistant designed to extract keywords from the summary section of the recently looked up SCTask from a user's recent chat history. The purpose of extracting these keywords is to build a SQL Query against the dbo.SCTaskDetailHistory table in the SM_DW database. The user's question is: "${state.chatInteraction.prompt}". The recent chat history is as follows: \n\n${state.chatHistory.slice(-2).map(entry => `${entry.role}: ${entry.content}`).join('\n')} \n\nPlease extract any keywords that can be used to build a SQL Query against the dbo.SCTaskDetailHistory table. Return only the keywords and nothing else.`;

  const comparisonKeywords = await chatCompletion({
    messages: [{ role: 'user', content: comparePrompt }],
    onToken: (content) => state.sendEvent({ type: 'data', data: content }),
    teamName: state.teamName,
    assistantName: state.assistantName,
    chatResponseConfig: {
      temperature: 0,
      max_completion_tokens: 100
    }
  });

  // state.sendEvent({ type: 'data', data: `<details><summary>Expand to see sample keywords:</summary> ${comparisonKeywords}</details>` });

  return { comparisonKeywords };
}

const chatCompletionMarkdownNode = async (state) => {
  const systemPromptMessages = state.systemPrompt ? [{ role: 'system', content: state.systemPrompt }] : [];
  const personaPromptMessages = state.personaPrompt ? [{ role: 'system', content: state.personaPrompt }] : [];

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
    ],
    tools: []
  };

  const contextMessages = DEFAULT_ASSISTANT_CONFIG.contextMessages;

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
      toolsList: DEFAULT_ASSISTANT_CONFIG.tools
    });
  }

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
  enrichedPrompt: Annotation,
  markdownResponse: Annotation,
  suggestedPrompts: Annotation,
  chatHistory: Annotation,
  sendEvent: Annotation,
  intent: Annotation,
  isQueryResultValid: Annotation,
  queryGenAttemptCount: Annotation,
  sqlResults: Annotation,
  scoredResults: Annotation,
  comparisonKeywords: Annotation
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
  .addNode("determineIntentNode", determineIntentNode)

  .addNode("buildSM_DWContextNode", buildSM_DWContextNode)
  .addNode("generateSQLQueryNode", generateSQLQueryNode)
  .addNode("runSQLQueryNode", runSQLQueryNode)
  .addNode("scoreResultsNode", scoreResultsNode)
  .addNode("limitExceededNode", limitExceededNode)
  .addNode("compareNode", compareNode)

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
  .addEdge("chatHistoryNode", "buildSM_DWContextNode")
  .addEdge("buildSM_DWContextNode", "determineIntentNode")
  .addConditionalEdges("determineIntentNode", async (state) => { return state.intent }, {
    "lookup": "generateSQLQueryNode",
    "compare": "compareNode",
    "other": "enrichPromptNode"
  })
  .addEdge("compareNode", "generateSQLQueryNode")
  .addEdge("generateSQLQueryNode", "runSQLQueryNode")
  .addConditionalEdges("runSQLQueryNode", async (state) => {
    if (state.queryGenAttemptCount > 2)
      return 'limitExceeded';
    return String(state.isQueryResultValid)
  }, {
    "true": "scoreResultsNode",
    "false": "generateSQLQueryNode",
    "limitExceeded": "limitExceededNode"
  })
  .addEdge("scoreResultsNode", END)
  .addEdge("enrichPromptNode", "chatCompletionMarkdownNode")
  .addEdge("chatCompletionMarkdownNode", "chatCompletionPromptsNode")
  .addEdge("limitExceededNode", END)
  .addEdge("chatCompletionPromptsNode", END)
  .compile();

export async function runProdSupportGraph({ nuid, smartNoteId, chatInteraction, teamName, assistantName }) {
  recordAssistantPromptSubmitted(nuid, null, teamName, assistantName); // may need to revisit
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

      // Close the stream
      controller.close();
    }
  });

  return stream;
}
