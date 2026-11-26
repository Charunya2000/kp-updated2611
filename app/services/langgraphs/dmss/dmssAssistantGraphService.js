'use server';

import { Annotation, StateGraph, START, END } from "../langgraph-light.js";
import { recordAssistantPromptSubmitted } from '@services/statisticsService';
import { vectorizePromptNode } from "../shared/nodes/vectorizePromptNode";
import { searchIndexNode } from "../shared/nodes/searchIndeNode";
import { filterSourcesNode } from "../shared/nodes/filterSourcesNode";
import { enrichPromptNode } from "../shared/nodes/enrichPromptNode";
import { chatCompletionMarkdownNode } from "../shared/nodes/completions/chatCompletionsMarkdownNoade";
import { chatCompletionPromptsNode } from "../shared/nodes/completions/chatCompletionsPromptsNode";
import { addFilteredMessagesNode } from "../shared/nodes/addFilteredMessagesNode";
import { addSavedResponseMessagesNode } from "../shared/nodes/addSavedResponseMessagesNode";
// import { addConfluenceMessagesNode } from "../shared/nodes/addConfluenceMessagesNode";
import { addSharePointMessagesNode } from "../shared/nodes/addSharePointMessagesNode";
import { addWebUrlMessagesNode } from "../shared/nodes/addWebUrlMessagesNode";
import { addDesignReferenceMessagesNode } from "./nodes/addDesignReferenceMessagesNode";
import { addDesignIndexMessagesNode } from "./nodes/addDesignIndexMessagesNode";
import { addUploadedDocumentMessagesNode } from "./nodes/addUploadedDocumentMessagesNode";
import { callDmssCompletionServiceNode } from "./nodes/callDmssCompletionServiceNode";
import { callDmssWorkflowServiceNode } from './nodes/callDmssWorkflowServiceNode';
import { prepDataForDmssExternalCompletionServiceNode } from "./nodes/prepDataForDmssExternalCompletionServiceNode";

// Define the state annotations
const StateAnnotation = Annotation.Root({
  nuid: Annotation,
  smartNoteId: Annotation,
  assistantName: Annotation,
  teamName: Annotation,
  persona: Annotation,
  sources: Annotation,
  chatInteraction: Annotation,
  formData: Annotation,
  isWorkflow: Annotation,
  systemMessage: Annotation,
  promptEmbedding: Annotation,
  searchResults: Annotation,
  filteredSearchResults: Annotation,
  savedNotesContent: Annotation,
  savedResponsesContent: Annotation,
  actualSources: Annotation,
  totalMessages: Annotation,
  enrichedPrompt: Annotation,
  assignmentSheet: Annotation,
  letters: Annotation,
  testCaseTemplates: Annotation,
  uploadedNotes: Annotation,
  assignmentSheetExists: Annotation,
  lettersExists: Annotation,
  testCaseTemplatesExists: Annotation,
  uploadedNotesExists: Annotation,
  markdownResponse: Annotation,
  suggestedPrompts: Annotation,
  sendEvent: Annotation
});

const isExternalAPIRequired = async (state) => {
  // where to load selected graph 

  if (state.testCaseTemplatesExists && !state.isWorkflow) {
    return "yes";
  }
  if ((!state.testCaseTemplatesExists && (state.lettersExists || state.uploadedNotesExists || state.assignmentSheetExists))) {
    state.sendEvent({ type: 'data', data: "If you use a letter, note, or assignment sheet in context, I also need a test case template to process the request." });
    return "end";
  }
  if (state.isWorkflow) {
    return "workflow";
  }

  return "no";
};

// Build the state graph
const graphBuilder = new StateGraph(StateAnnotation);


const graph = graphBuilder
  .addNode("vectorizePromptNode", vectorizePromptNode)
  .addNode("searchIndexNode", searchIndexNode)
  .addNode("filterSourcesNode", filterSourcesNode)
  .addNode("addFilteredMessagesNode", addFilteredMessagesNode)
  .addNode("addDesignReferenceMessagesNode", addDesignReferenceMessagesNode)
  .addNode("addSavedResponseMessagesNode", addSavedResponseMessagesNode)
  .addNode("addDesignIndexMessagesNode", addDesignIndexMessagesNode)
  // .addNode("addConfluenceMessagesNode", addConfluenceMessagesNode)
  .addNode("addSharePointMessagesNode", addSharePointMessagesNode)
  .addNode("addWebUrlMessagesNode", addWebUrlMessagesNode)
  .addNode("addUploadedDocumentMessagesNode", addUploadedDocumentMessagesNode)
  .addNode("enrichPromptNode", enrichPromptNode)

  .addNode("prepDataForDmssExternalCompletionServiceNode", prepDataForDmssExternalCompletionServiceNode)
  .addNode("callDmssCompletionServiceNode", callDmssCompletionServiceNode)
  .addNode("callDmssWorkflowServiceNode", callDmssWorkflowServiceNode)


  .addNode("chatCompletionMarkdownNode", chatCompletionMarkdownNode)
  .addNode("chatCompletionPromptsNode", chatCompletionPromptsNode)

  .addEdge(START, "vectorizePromptNode")
  .addEdge("vectorizePromptNode", "searchIndexNode")
  .addEdge("searchIndexNode", "filterSourcesNode")
  .addEdge("filterSourcesNode", "addFilteredMessagesNode")
  .addEdge("addFilteredMessagesNode", "addDesignReferenceMessagesNode")
  .addEdge("addDesignReferenceMessagesNode", "addSavedResponseMessagesNode")
  .addEdge("addSavedResponseMessagesNode", "addDesignIndexMessagesNode")
  // TODO: fix conflucence indexing to add parent, then fitler by parent eq smartnoteId in addConflucenceMessagesNode
  // .addEdge("addDesignIndexMessagesNode", "addConfluenceMessagesNode") 
  // .addEdge("addConfluenceMessagesNode", "addSharePointMessagesNode")
  .addEdge("addDesignIndexMessagesNode", "addSharePointMessagesNode")
  .addEdge("addSharePointMessagesNode", "addWebUrlMessagesNode")
  .addEdge("addWebUrlMessagesNode", "prepDataForDmssExternalCompletionServiceNode")

  .addConditionalEdges("prepDataForDmssExternalCompletionServiceNode", isExternalAPIRequired, {
    "yes": "callDmssCompletionServiceNode",
    "workflow": "callDmssWorkflowServiceNode",
    "no": "addUploadedDocumentMessagesNode", // this is the standard chat process, not uploading anything
    "end": END
  })

  .addEdge("addUploadedDocumentMessagesNode", "enrichPromptNode")
  .addEdge("enrichPromptNode", "chatCompletionMarkdownNode")
  .addEdge("chatCompletionMarkdownNode", "chatCompletionPromptsNode")

  .addEdge("callDmssWorkflowServiceNode", END)
  .addEdge("callDmssCompletionServiceNode", END)
  .addEdge("chatCompletionPromptsNode", END)
  .compile();

export async function submitPromptDMSS({ nuid, smartNoteId, sources, chatInteraction, teamName, assistantName, formData, isWorkflow = false }) {
  recordAssistantPromptSubmitted(nuid, null, teamName, assistantName);
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
        formData,
        isWorkflow,
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
