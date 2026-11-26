'use server';

import { Annotation, StateGraph, START, END, interrupt, Command } from "@langchain/langgraph";

import { vectorizePromptNode } from './nodes/vectorizePromptNode.js';
import { getConfigNode } from './nodes/getConfigNode.js';
import { parseUserIntentNode } from './nodes/searchIntentNode2.js';
import { searchIndexNode } from './nodes/searchIndexNode2.js';
import { getMetadataFromGitHubNode } from "./nodes/searchGitHubNode.js";
import { getProfilePromptNode } from "./nodes/getProfilePromptNode2.js";
import { chatCompletionNode } from "./nodes/chatCompletionNode2.js";
import { queryDatabaseNode as searchDatabaseNode } from "./nodes/searchDatabaseNode.js";
// import { adminPerfLogNode } from "./nodes/adminPerfLogNode.js";
import { formatResponseNode } from "./nodes/formatResponseNode.js";
import { getKnowledgeBase } from "./nodes/knowledgeBaseNode.js";

//Addd For Policy
import { getpolicyData } from "./nodes/policydataNode.js"

// TEST CASE & SCRIPT NODES
import { getUserStoryMapping } from "./nodes/getUserStoryListNode.js";
import { generateTestCases } from "./nodes/testCaseGenerationNode.js";
import { generateTestScript } from "./nodes/testScriptGenerationNode2.js";
import { detectIntent } from "./nodes/intent.js";
// SCORECARD NODE
import { scorecardAnalysisNode } from "./nodes/scorecardAnalysisNode.js";
import { MemorySaver } from "@langchain/langgraph";
import { validationNode } from "./nodes/validationNode.js";
import { NextResponse } from "next/server.js";

import { releaseManagementNode } from "./nodes/releaseManagementNode.js";
import { getSNOWData } from "./nodes/getServiceNowDataNode.js";

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
  //userMessage: Annotation,
  //userPrompt: Annotation,
  //promptEmbedding: Annotation,
  searchPattern: Annotation,
  searchResults: Annotation,
  indexMetadata: Annotation,
  parsedSearchIntent: Annotation,
  snowMetadata: Annotation,
  //intent: Annotation,
  indexHit: Annotation,
  databaseMetadata: Annotation,
  perfLogMetadata: Annotation,
  splunkMetadata: Annotation,
  identifiers: Annotation,
  knowledgeBaseMetaData: Annotation,
  policyMetadata: Annotation,
  userStoryMetaData: Annotation,
  jiraMetaData: Annotation,
  testCaseMetaData: Annotation,
  testScriptMetaData: Annotation,
  scorecardMetaData: Annotation,
  releaseMetadata: Annotation,
  githubMetadata: Annotation,
  organization: Annotation,
  repository: Annotation,
  branch: Annotation,
  targetPath: Annotation,
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
  .addNode("parseUserIntentNode", parseUserIntentNode)
  .addNode("validateNode", validationNode)
  .addNode("searchIndexNode", searchIndexNode)
  .addNode("searchDatabaseNode", searchDatabaseNode)
  //.addNode("adminPerfLogNode", adminPerfLogNode)
  .addNode("determineIntent", detectIntent)
  .addNode("getKnowledgeBase", getKnowledgeBase)
  .addNode("getPolicyNode", getpolicyData)
  .addNode("userStoryMappingNode", getUserStoryMapping)
  .addNode("testCaseNode", generateTestCases)
  .addNode("testScriptNode", generateTestScript)
  .addNode("scorecardAnalysisNode", scorecardAnalysisNode)
  .addNode("releaseManagementNode", releaseManagementNode)
  .addNode("githubNode", getMetadataFromGitHubNode)
  .addNode("getSNOWData", getSNOWData)
  .addNode("getProfilePromptNode", getProfilePromptNode)
  .addNode("chatCompletionNode", chatCompletionNode)
  .addNode("formatResponseNode", formatResponseNode);

let incidentIndexName = "nps-incident-001"
let knowledgeIndexName = "nps-knowledge-001"
let userStoryIndexName = "nps-userstory-001"


/** ROUTING LOGIC */
const routeByIntent = (state) => {
  //const type = state.intent?.type;
  const type = state.structuredMemory.activeDomain
  console.log(`[routeByIntent] Intent type: "${type}"`);

  // if (type === "INCIDENT") {
  if (type === "incident_management") {
    return "searchIndexNode";
    //  } else if (type === "KNOWLEDGE_BASE") {
  } else if (type === "knowledge_base") {
    return "getKnowledgeBase";

    // } else if (type === "TEST_CASE" || type === "TEST_SCRIPT") {
  }
  else if (type === "policy_data") {
    return "getPolicyNode";
  }
  else if (type === "testcase_generation" || type === "testscript_generation") {
    return "userStoryMappingNode";
    //  } else if (type === "AI_SCORECARD") {
  } else if (type === "ai_scorecard_analysis") {
    return "scorecardAnalysisNode";

    //  } else if (type == "RELEASE_MANAGEMENT") {
  } else if (type == "release_management") {
    return "releaseManagementNode"; // <--- ADD THIS BLOCK
  }
  else if (type == "getservicenowRecords") { return "getSNOWData" }
  return "getProfilePromptNode";
};

// Handles flow inside the User Story / Test Case path
const routeUserStory = (state) => {
  if (state.userStoryMetaData?.recordFound === true) {
    return "testCaseNode";
  }
  return "searchIndexNode";
};

// Router for Generic Search Node
const routeAfterIndex = (state) => {
  //const type = state.intent?.type;
  const type = state.structuredMemory.activeDomain
  const currentIndex = state.indexMetadata?.indexName;

  if (type === "incident_management") return "getProfilePromptNode";
  if (type === "knowledge_base") return "getProfilePromptNode";

  if ((type === "testcase_generation" || type === "testscript_generation") && currentIndex === userStoryIndexName) {
    return "userStoryMappingNode";
  }


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
  .addEdge("vectorizePromptNode", "parseUserIntentNode")

  .addConditionalEdges("parseUserIntentNode", routeByIntent)

  // INCIDENT PATH
  .addEdge("searchDatabaseNode", "getProfilePromptNode")

  // KNOWLEDGE BASE PATH
  .addEdge("getKnowledgeBase", "searchIndexNode")
  // Policy Data Node
  .addEdge("getPolicyNode", "searchIndexNode")
  .addConditionalEdges("searchIndexNode", routeAfterIndex)

  //Policy Node Path

  // TEST CASE / TEST SCRIPT PATH
  .addEdge("userStoryMappingNode", "testCaseNode")
  .addEdge("testCaseNode", "testScriptNode")
  .addEdge("testScriptNode", "getProfilePromptNode")

  // AI SCORECARD PATH — bypasses getProfilePromptNode, goes directly to chatCompletionNode
  .addEdge("scorecardAnalysisNode", "chatCompletionNode")
  // RELEASE MANAGEMENT PATH
  .addEdge("releaseManagementNode", "getProfilePromptNode")

  //Get SNOW data
  .addEdge("getSNOWData", "getProfilePromptNode")

  //testscript_withoutreference
  //.addEdge("testscript_withoutreference", "getProfilePromptNode")
  // FINAL SYNTHESIS
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
export async function bcsChatBotGraphStream({ assistantName, userMessage, metadata = {}, sessionId, teamName }) {
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
