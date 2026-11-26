'use server';

import { Annotation, StateGraph, START, END, interrupt, Command } from "@langchain/langgraph";

import { vectorizePromptNode } from './nodes/vectorizePromptNode.js';
import { getConfigNode } from './nodes/getConfigNode.js';

import { getProfilePromptNode } from "./nodes/getProfilePromptNode.js";
import { chatCompletionNode } from "./nodes/chatCompletionNode.js";


import { formatResponseNode } from "./nodes/formatResponseNode.js";


import { detectIntent } from "./nodes/intent.js";

import { MemorySaver } from "@langchain/langgraph";
import { validationNode } from "./nodes/validationNode.js";
import { NextResponse } from "next/server.js";


/* STATE DEFINITION */
const StateAnnotation = Annotation.Root({
  teamName: Annotation,
  assistantName: Annotation,    //message
  messages: Annotation,
  structuredMemory: Annotation,

  tokenCount: Annotation,


  // Input states
  userMessage: Annotation,
  userResponse: Annotation,
  userPrompt: Annotation,
  promptEmbedding: Annotation,
  completionsClient: Annotation,
  context: Annotation,
  timeRange: Annotation,
  sessionID: Annotation,

  //Intent
  intent: Annotation,
  intentRaw: Annotation,
  analyticsContext: Annotation,
  //identifiers: Annotation,
  userContext: Annotation,
  identifier_needed: Annotation,
  identifier_question: Annotation,
  continueFlow: Annotation,

  // Extracted identifiers (quote_id, rqr_id, etc.)
  identifiers: Annotation,
  nuid: Annotation,
  config: Annotation,
  metadata: Annotation,

  searchPattern: Annotation,
  searchResults: Annotation,
  indexMetadata: Annotation,
  parsedSearchIntent: Annotation,
  snowMetadata: Annotation,
  //intent: Annotation,
  indexHit: Annotation,

  knowledgeBaseMetaData: Annotation,
  userStoryMetaData: Annotation,
  jiraMetaData: Annotation,

  chatResponse: Annotation,
  formattedResponse: Annotation,
  chatNewResponseSummary: Annotation,
  searchSuccess: Annotation,
  promptSuccess: Annotation,
  chatSuccess: Annotation,
  formatSuccess: Annotation,
  summary: Annotation
});

const graphBuilder = new StateGraph(StateAnnotation);

/** ADD NODES */
graphBuilder
  .addNode("getConfigNode", getConfigNode)
  .addNode("vectorizePromptNode", vectorizePromptNode)
  .addNode("determineIntent", detectIntent)
  .addNode("validateNode", validationNode)


  .addNode("getProfilePromptNode", getProfilePromptNode)
  .addNode("chatCompletionNode", chatCompletionNode)
  .addNode("formatResponseNode", formatResponseNode);

let incidentIndexName = "bcs-incident-001"
let knowledgeIndexName = "bcs-knowledge-001"


/** ROUTING LOGIC */
const routeByIntent = (state) => {
  //const type = state.intent?.type;
  const type = state.structuredMemory.activeDomain
  console.log(`[routeByIntent] Intent type: "${type}"`);


  if (type === "incident_management") {
    return "searchIndexNode";

  }

  return "getProfilePromptNode";
};


// Router for Generic Search Node
const routeAfterIndex = (state) => {
  //const type = state.intent?.type;
  const type = state.structuredMemory.activeDomain
  const currentIndex = state.indexMetadata?.indexName;

  if (type === "incident_management") return "getProfilePromptNode";
  if (type === "knowledge_base") return "getProfilePromptNode";



  return "getProfilePromptNode";
};

/** EDGES */
graphBuilder
  .addEdge(START, "getConfigNode")
  .addEdge("getConfigNode", "determineIntent")
  .addConditionalEdges(
    "determineIntent",
    (state) => {

      if (!state.continueFlow && state.userContext == "out_of_scope") {
        return new Command({
          goto: "__end__"
        });
      }
      else if (!state.continueFlow) {
        return new Command({

          goto: "__end__"
        });
      }


      return "validateNode"
    })
  //  .addEdge("determineIntent", "validateNode")
  .addEdge("validateNode", "vectorizePromptNode")

  .addConditionalEdges("vectorizePromptNode", routeByIntent)



  .addEdge("getProfilePromptNode", "chatCompletionNode")
  .addEdge("chatCompletionNode", "formatResponseNode")
  .addEdge("formatResponseNode", END);

// Compile
//const graph = graphBuilder.compile();
// Compile the graph
const memory = new MemorySaver();
const graph = graphBuilder.compile({ checkpointer: memory });
//const sessionId = "123-session";

let finalState = []


// Streaming chat bot function
export async function npsCmatChatBotGraphStream({ assistantName, userMessage, metadata = {}, sessionId, teamName }) {
  // Initialize state with user message and metadata
  const config = {
    configurable: {
      thread_id: sessionId, // MUST remain same to resume
    },
  }
  //const state = await graph.getState(config);
  const currentState = await graph.getState(config);
  console.log('Retrieved State:', currentState);
  console.log('Next Node:', currentState.next);

  //let finalState;

  if (currentState && currentState.next && currentState.next.length) {
    //const resmeUser=await validateResume()
    // If there is a next node, resume from the interruption point
    //currentState.userResponse = userMessage; // Update the state with user response
    finalState = await graph.invoke(new Command({ update: { userResponse: userMessage.trim() } }), config);

  } else {
    // Initialize the state with user message and metadata if no interruption point is found
    const initialState = {
      userPrompt: userMessage.trim(),
      sessionID: sessionId,
      metadata: metadata,
      teamName: teamName,
      assistantName: assistantName,
      nuid: metadata.nuid,
      userResponse: '',

      searchSuccess: false,
      promptSuccess: false,
      chatSuccess: false,
      formatSuccess: false,
      // Additional configuration from the client
      // };
      ...metadata,  // Additional configuration from the client
    };
    finalState = await graph.invoke(initialState, config);
  }

  // Invoke the graph


  // if (state?.next?.length) {
  //   state.userResponse=userMessage
  //   //state.userMessage=userMessage
  //   finalState = await graph.invoke({...state,userResponse:userMessage},
  //  config
  // );}
  // else{
  // //if(initialState.userResponse!=''){
  // initialState.teamName=teamName;
  // initialState.userMessage=userMessage;
  // initialState.metadata=metadata;
  //  finalState = await graph.invoke(initialState,
  //   config
  // );}
  if (finalState?.__interrupt__) {
    // return {paused:true,message:finalState.__interrupt__[0].value.message};   

    return finalState.__interrupt__[0].value.message;
  }
  //else{  return {paused:false,message:finalState.formattedResponse};}
  else {
    return finalState.formattedResponse;
  }


}
//   else{
//     finalState = await graph.invoke(initialState,
//   {
//       configurable: {
//         thread_id: sessionId, // MUST remain same to resume
//       },
//     }
// );
// return finalState.formattedResponse;

//   }
