'use server';

import { Annotation, StateGraph, START, END } from "../langgraph-light.js";
import { systemMessagesNode } from "./nodes/systemMessagesNode";
import { vectorizeOriginalPromptNode } from "./nodes/vectorizeOriginalPromptNode";
import { chatCompletionNode } from "./nodes/chatCompletionNode";
import { saveTemplateToBlobStorageNode } from "./nodes/saveTemplateToBlobStorageNode";
import { completeProgressNode } from "./nodes/completeProgressNode";
import { processUploadedDocument2Node } from "./nodes/processUploadedDocument2Node";
import { retrieveSavedNoteNode } from "./nodes/retrieveSavedNoteNode";
import { retrieveWorkflowNotesNode } from "./nodes/retrieveWorkflowNotesNode";
import { websiteURLsNode } from "../nodes/websiteURLNode";
import { sharePointFilesNode } from "./nodes/sharepointFilesNode";
import { jiraIssuesNode } from "./nodes/jiraIssuesNode";
import designIndexesNode from "./nodes/designIndexesNode";
import { savedResponsesNode } from "./nodes/savedResponsesNode";
import { getSourcesNode } from "./nodes/getSourcesNode";
import { createMessagesNode } from "./nodes/createMessagesNode";
import { v4 as uuidv4 } from 'uuid';

/**
 * Alternate test case generation for QTestWorkflow2
 * Uses processUploadedDocument2Node and retrieveSavedNoteNode
 * Returns documentContent, documentType, documentName, and fileDescription
 * 
 * NOTE: Workflow notes are retrieved by retrieveSavedNoteNode and added to state
 * as `fileDescription` and `warningMessage`. These notes provide user-provided
 * instructions that influence how the test cases are generated and processed.
 */

/**
 * Initialize progress tracking for test case generation
 * Creates a TestCaseGenerationProgress document and returns its ID
 * @param {string} teamName - The team name
 * @param {string} smartNoteId - The ID of the smart note
 * @param {Array<Object>} sections - Array of document sections with shortTopic
 * @returns {Promise<string>} - The ID of the created progress document
 */
export async function initializeGenerationProgress(input) {
  try {
    const testCaseGenerationProgressId = uuidv4();
    generateTestCases2({ ...input, testCaseGenerationProgressId })
    return { testCaseGenerationProgressId, success: true };
  } catch (error) {
    console.error('Error initializing generation progress:', error);
    throw error;
  }
}

async function generateTestCases2({ nuid, smartNoteId, prompt, teamName, assistantName, testCaseGenerationProgressId, llmDirections }) {
  // Define a new state annotation for the alternate workflow
  const AltStateAnnotation = Annotation.Root({
    nuid: Annotation,
    prompt: Annotation,
    smartNoteId: Annotation,
    teamName: Annotation,
    assistantName: Annotation,
    actualSources: Annotation,
    filteredSavedNotes: Annotation,
    filteredDesignIndexSearchResults: Annotation,
    filteredWebsiteURLsSearchResults: Annotation,
    filteredSavedResponseSearchResults: Annotation,
    filteredSharePointFilesearchResults: Annotation,
    filteredJiraIssueSearchResults: Annotation,
    filteredUploadedFilesSearchResults: Annotation,
    aiSearchMessages: Annotation,
    fileDescription: Annotation,
    workflowNotes: Annotation,
    error: Annotation,
    message: Annotation,
    messages: Annotation,
    originalPromptEmbedding: Annotation,
    promptEmbedding: Annotation,
    systemMessage: Annotation,
    testCases: Annotation,
    enrichedPrompt: Annotation,
    templateDownloadUrl: Annotation,
    warningMessage: Annotation,
    summary: Annotation,
    testCaseGenerationProgressId: Annotation,
    llmDirections: Annotation
  });

  // Build the alternate state graph
  const altGraphBuilder = new StateGraph(AltStateAnnotation);
  const altGraph = altGraphBuilder                                           // Returned state: 
    .addNode("systemMessagesNode", systemMessagesNode)                       // systemMessage
    .addNode("getSourcesNode", getSourcesNode)                               // actualSources
    .addNode("vectorizeOriginalPromptNode", vectorizeOriginalPromptNode)     // originalPromptEmbedding
    .addNode("processUploadedDocument2Node", processUploadedDocument2Node)   // filteredUploadedFilesSearchResults
    .addNode("retrieveSavedNoteNode", retrieveSavedNoteNode)                 // fileDescription, warningMessage
    .addNode("retrieveWorkflowNotesNode", retrieveWorkflowNotesNode)         // workflowNotes
    .addNode("processWebsiteURLsNode", websiteURLsNode)                      // filteredWebsiteURLsSearchResults
    .addNode("processSavedResponseSearchResults", savedResponsesNode)        // filteredSavedResponseSearchResults
    .addNode("processSharePointFilesNode", sharePointFilesNode)              // filteredSharePointFilesearchResults
    .addNode("processJiraIssuesNode", jiraIssuesNode)                        // filteredJiraIssueSearchResults
    .addNode("designIndexNode", designIndexesNode)                           // filteredDesignIndexSearchResults
    .addNode("createMessagesNode", createMessagesNode)                       // messages
    .addNode("chatCompletionNode", chatCompletionNode)                       // testCases (now returns test cases directly, not markdownResponse)
    .addNode("saveTemplateToBlobStorageNode", saveTemplateToBlobStorageNode) // templateDownloadUrl, message
    .addNode("completeProgressNode", completeProgressNode)                   // Finalizes progress with download link

    // Define the flow
    .addEdge(START, "systemMessagesNode")
    .addEdge("systemMessagesNode", "retrieveWorkflowNotesNode")
    .addEdge("retrieveWorkflowNotesNode", "getSourcesNode")
    .addEdge("getSourcesNode", "vectorizeOriginalPromptNode")
    .addEdge("vectorizeOriginalPromptNode", "processUploadedDocument2Node")
    .addEdge("processUploadedDocument2Node", "retrieveSavedNoteNode")
    .addEdge("retrieveSavedNoteNode", "processWebsiteURLsNode")
    .addEdge("processWebsiteURLsNode", "processSavedResponseSearchResults")
    .addEdge("processSavedResponseSearchResults", "processSharePointFilesNode")
    .addEdge("processSharePointFilesNode", "processJiraIssuesNode")
    .addEdge("processJiraIssuesNode", "designIndexNode")
    .addEdge("designIndexNode", "createMessagesNode")
    .addEdge("createMessagesNode", "chatCompletionNode")
    .addEdge("chatCompletionNode", "saveTemplateToBlobStorageNode")
    .addEdge("saveTemplateToBlobStorageNode", "completeProgressNode")
    .addEdge("completeProgressNode", END)
    .compile();

  try {
    // Execute the alternate graph with the initial state including progress ID
    const result = await altGraph.invoke({
      nuid,
      smartNoteId,
      prompt,
      teamName,
      assistantName,
      testCaseGenerationProgressId,
      llmDirections
    });
    return {
      success: !result.error,
      message: result.message || 'Test cases generated (alternate workflow)',
      error: result.error,
      filteredUploadedFilesSearchResults: result.filteredUploadedFilesSearchResults,
      fileDescription: result.fileDescription,
      workflowNotes: result.workflowNotes,
      testCases: result.testCases || [],
      testCaseGenerationProgressId: result.testCaseGenerationProgressId
    };
  } catch (error) {
    console.error('Error in alternate test case generation graph:', error);
    return {
      success: false,
      message: 'Failed to generate test cases (alternate workflow)',
      error: error.message,
      filteredUploadedFilesSearchResults: null,
      fileDescription: null,
      workflowNotes: null,
      testCases: [],
      testCaseGenerationProgressId: null
    };
  }
}
