// 'use server';

// import { chatCompletion } from './chatCompletionsService';
// import { searchIndex } from './searchVectorDataService';
// import { vectorize } from './vectorizeDataService';
// import { selectSmartNote } from '@services/smartNoteService';
// import { selectJustSources, selectRelatedDesignReferences, selectRelatedDesignIndexes, selectRelatedUploadedDocuments, selectRelatedSavedResponses, selectRelatedWebsiteURLs } from '@services/actualSourcesService';

// const smartNoteIndex = 'smartnote-001';

// const createMessagesFromDesignReferences = (designReferences) => {
//   const messages = [];

//   designReferences.forEach(designReferenceArray => {
//     designReferenceArray.forEach(result => {
//       const message = {
//         role: 'assistant',
//         content: `source category: ${result.document.document_name}, content: ${result.document.content}`
//       };
//       messages.push(message);
//     });
//   });
//   return messages;
// };

// const createMessagesFromSavedResponses = (savedResponses) => {
//   const messages = [];

//   savedResponses.forEach(savedResponseArray => {
//     savedResponseArray.forEach(result => {
//       const message = {
//         role: 'assistant',
//         content: `source category: Saved Response, content: ${result.document.content}`
//       };
//       messages.push(message);
//     });
//   });
//   return messages;
// };

// const createMessagesFromDesignIndexes = (designIndexes) => {
//   const messages = [];

//   designIndexes.forEach(designIndexArray => {
//     designIndexArray.forEach(result => {
//       const message = {
//         role: 'assistant',
//         content: `source category: ${result.document.document_name}, content: ${result.document.content}`
//       };
//       messages.push(message);
//     });
//   });
//   return messages;
// };

// const createMessagesFromConfliuenceIndex = (designIndexes) => {
//   const messages = [];

//   designIndexes.forEach(designIndexArray => {
//     designIndexArray.forEach(result => {
//       const message = {
//         role: 'assistant',
//         content: `source category: Confluence Index - ${result.document.space}/${result.document.title}, content: ${result.document.content}`
//       };
//       messages.push(message);
//     });
//   });
//   return messages;
// };

// const createMessagesFromWebsiteURLs = (websiteURLs) => {
//   const messages = [];

//   websiteURLs.forEach(websiteURLArray => {
//     websiteURLArray.forEach(result => {
//       const message = {
//         role: 'assistant',
//         content: `source category: Website URL, content: ${result.document.content}`
//       };
//       messages.push(message);
//     });
//   });
//   return messages;
// };

// const createMessagesFromUploadedDocuments = (uploadedDocuments) => {
//   const messages = [];

//   uploadedDocuments.forEach(uploadedDocumentArray => {
//     uploadedDocumentArray.forEach(result => {
//       const message = {
//         role: 'assistant',
//         content: `source category: ${result.document.smart_file_name}, content: ${result.document.content}`
//       };
//       messages.push(message);
//     });
//   });
//   return messages;
// };

// const getSystemContent = async (smartNoteId) => {
//   const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId }
//   const smartNote = await selectSmartNote(query);
//   if (smartNote.selectedUserAssistant === 'kpmc-assistant') {
//     switch (smartNote.persona) {
//       case 'Business': {
//         return 'You are a business user with domain expertise and work within an Agile software delivery life cycle.';
//       }
//       case 'Planning': {
//         return 'You are an iteration planning member defining user stories for the next sprint and work within an Agile software delivery life cycle.';
//       }
//       case 'Architecture': {
//         return 'You are an architect, helping development teams with technical design and work within an Agile software delivery life cycle.';
//       }
//       case 'Development': {
//         return 'You are a developer and your job is to understand requirements and implement a solution working within an Agile software delivery life cycle.';
//       }
//       case 'Testing': {
//         return 'You are a tester and your job is to create test cases and automated tests working within an Agile software delivery life cycle.';
//       }
//       default: {
//         return 'You are an expert in Agile product management.';
//       }
//     }
//   } else {
//     return 'You are an expert in Agile product management.';
//   }
// };


// const addMissingDesignIndexes = async (foundDesignIndexes, smartNoteId) => {

//   const query = { type: 'SmartNote', parentId: { $exists: true }, id: smartNoteId }
//   const smartNote = await selectSmartNote(query);
//   const additionalIndexes = [];

//   if (smartNote.selectedUserAssistant === 'kpmc-assistant') {
//     switch (smartNote.persona) {
//       case 'Planning':
//         additionalIndexes.push({
//           type: 'DesignIndex',
//           smartNoteId: smartNoteId,
//           title: 'PI Planning Index',
//           indexName: 'pi-planning-001'
//         });
//         break;
//       case 'Change Request':
//         additionalIndexes.push({
//           type: 'DesignIndex',
//           smartNoteId: smartNoteId,
//           title: 'Change Request Index',
//           indexName: 'kpmc-cr-001'
//         });
//         break;
//     }
//   }

//   additionalIndexes.forEach(index => {
//     if (!foundDesignIndexes.some(designIndex => designIndex.indexName === index.indexName)) {
//       foundDesignIndexes.push(index);
//     }
//   });

//   return foundDesignIndexes;
// };


// async function submitPrompt({ nuid, smartNoteId, sources, chatInteraction }) {
//   const systemMessage = await getSystemContent(smartNoteId);
//   let result = null;
//   try {
//     const contextMessages = [
//       {
//         role: "system",
//         content: systemMessage
//       },
//       {
//         role: "system",
//         content: "Even if asked, in all responses, avoid anything that appears to be PII or PHI: names, email addresses, etc."
//       },
//       // {
//       //   role: "system",
//       //   content: "If the user prompt asks for a diagram, infer that they want a mermaid diagram."
//       // },
//       {
//         role: "system",
//         content: "Your response content, UTF-8 encoding, should include 2 parts: a response in 'markdown' between a pair of strings: '<wiki>', and followed by 3 suggested prompts, not 'wiki markup', but plain text, without numbering them, based on your response, on 3 separate lines."
//       }
//     ];
//     const promptEmbedding = await vectorize({ nuid: nuid, content: chatInteraction.prompt });
//     const filter = `nuid eq '${nuid}' and smartnote_id eq '${smartNoteId}' and (smart_type eq 'ChatInteraction' or smart_type eq 'SavedNote' or smart_type eq 'JiraIssue' or smart_type eq 'UploadedDocument')`;
//     const searchResults = await searchIndex(
//       {
//         searchIndex: smartNoteIndex,
//         selectFields: ["id", "nuid", "smartnote_id", "smart_type", "content"],
//         searchEmbedding: promptEmbedding,
//         nearestNeighbors: 3,
//         filter
//       }
//     );

//     const actualSources = await selectJustSources(smartNoteId, state.teamName);
//     const filteredSearchResults = searchResults.filter(searchResult =>
//       actualSources.some(actualSource => actualSource.sourceId === searchResult.document.id)
//     );

//     const filteredMessages = filteredSearchResults.map(result => {
//       const message =
//       {
//         role: 'assistant',
//         content: `source catorgy: ${result.document.smart_type}, content: ${result.document.content}`
//       }
//       return message;
//     });

//     const foundDesignReferences = await selectRelatedDesignReferences(smartNoteId);

//     const filteredDesignReferences = foundDesignReferences.filter(designReference =>
//       actualSources.some(actualSource => actualSource.sourceId === designReference.id)
//     );

//     const designReferenceSearchResults = await Promise.all(
//       filteredDesignReferences.map(async (designReference) => {
//         const nameRef = designReference.indexName === 'cms-doc-001' ? 'source' : 'document_name';
//         const filter = `${nameRef} eq '${designReference.name}'`;
//         const result = await searchIndex(
//           {
//             searchIndex: designReference.indexName,
//             selectFields: [nameRef, "content"],
//             searchEmbedding: promptEmbedding,
//             nearestNeighbors: 5,
//             filter
//           });
//         return result;
//       })
//     );

//     const filteredDesignReferenceSearchResults = createMessagesFromDesignReferences(designReferenceSearchResults);

//     const foundSavedResponses = await selectRelatedSavedResponses(smartNoteId);

//     const filteredSavedResponses = foundSavedResponses.filter(savedResponse =>
//       actualSources.some(actualSource => actualSource.sourceId === savedResponse.id)
//     );

//     const savedResponseSearchResults = await Promise.all(
//       filteredSavedResponses.map(async (savedResponse) => {
//         const filter = `smartnote_id eq '${savedResponse.parentId}'`;
//         const result = await searchIndex(
//           {
//             searchIndex: 'smartnote-001',
//             selectFields: ["smart_type", "content"],
//             searchEmbedding: promptEmbedding,
//             nearestNeighbors: 3,
//             filter
//           });
//         return result;
//       })
//     );
//     const filteredSavedResponseSearchResults = createMessagesFromSavedResponses(savedResponseSearchResults);




//     const foundDesignIndexes = await selectRelatedDesignIndexes(smartNoteId);

//     const filteredDesignIndexes = foundDesignIndexes.filter(designIndex =>
//       actualSources.some(actualSource => actualSource.sourceId === designIndex.id)
//     );

//     const filteredDesignIndexesAdded = await addMissingDesignIndexes(filteredDesignIndexes, smartNoteId);

//     const designIndexSearchResults = await Promise.all(
//       filteredDesignIndexesAdded.map(async (designIndex) => {
//         let filter;
//         const integerCheck = /\d+/;
//         if ((designIndex.indexName === 'kpmc-cr-001') && integerCheck.test(chatInteraction.prompt) && (chatInteraction.prompt.match(integerCheck) || []).length === 1) {
//           const numberString = chatInteraction.prompt.match(integerCheck)[0];
//           filter = `cr_id eq '${numberString}'`;
//         }
//         const result = await searchIndex(
//           {
//             searchIndex: designIndex.indexName,
//             selectFields: ["document_name", "content"],
//             searchEmbedding: promptEmbedding,
//             nearestNeighbors: 2,
//             filter: filter
//           });
//         return result;
//       })
//     );

//     const filteredDesignIndexSearchResults = createMessagesFromDesignIndexes(designIndexSearchResults);


//     const confluenceResult = await searchIndex(
//       {
//         searchIndex: 'kpmc-confluence-002',
//         selectFields: ["space", "title", "content"],
//         searchEmbedding: promptEmbedding,
//         nearestNeighbors: 3
//       });

//     const confluenceSearchResults = createMessagesFromConfliuenceIndex([confluenceResult]);

//     const foundWebsiteURLs = await selectRelatedWebsiteURLs(smartNoteId);

//     const filteredWebsiteURLs = foundWebsiteURLs.filter(websiteURL =>
//       actualSources.some(actualSource => actualSource.sourceId === websiteURL.id)
//     );

//     const websiteURLsSearchResults = await Promise.all(
//       filteredWebsiteURLs.map(async (websiteURL) => {
//         const filter = `smart_type eq 'WebsiteURL' and smartnote_id eq '${websiteURL.parentId}'`;
//         const result = await searchIndex(
//           {
//             searchIndex: 'smartnote-001',
//             selectFields: ["smart_type", "content"],
//             searchEmbedding: promptEmbedding,
//             nearestNeighbors: 5,
//             filter
//           });
//         return result;
//       })
//     );

//     const filteredWebsiteURLsSearchResults = createMessagesFromWebsiteURLs(websiteURLsSearchResults);


//     const foundUploadedDocuments = await selectRelatedUploadedDocuments(smartNoteId);

//     const filteredUploadedDocuments = foundUploadedDocuments.filter(uploadedDocument =>
//       actualSources.some(actualSource => actualSource.sourceId === uploadedDocument.id)
//     );

//     const uploadedDocumentSearchResults = await Promise.all(
//       filteredUploadedDocuments.map(async (uploadedDocument) => {
//         const filter = `smartnote_id eq '${uploadedDocument.parentId}' and smart_file_name eq '${uploadedDocument.fileName}'`;
//         const result = await searchIndex(
//           {
//             searchIndex: 'smartnote-file-002',
//             selectFields: ["smart_file_name", "content"],
//             searchEmbedding: promptEmbedding,
//             nearestNeighbors: 5,
//             filter
//           });
//         return result;
//       })
//     );

//     const filteredUploadedDocumentSearchResults = createMessagesFromUploadedDocuments(uploadedDocumentSearchResults);

//     const totalMessages = [
//       ...filteredMessages,
//       ...filteredDesignReferenceSearchResults,
//       ...filteredSavedResponseSearchResults,
//       ...filteredDesignIndexSearchResults,
//       ...confluenceSearchResults,
//       ...filteredUploadedDocumentSearchResults,
//       ...filteredWebsiteURLsSearchResults
//     ]

//     const enrichedPrompt = totalMessages.map(result => result.content).join("\n") + "\n" + chatInteraction.prompt;
//     const userMessages = [
//       {
//         role: "user",
//         content: enrichedPrompt
//       }
//     ];

//     result = await chatCompletion({ contextMessages, userMessages });
//   } catch (error) {
//     console.error(error);
//   }
//   return result;
// }

// export {
//   submitPrompt
// };