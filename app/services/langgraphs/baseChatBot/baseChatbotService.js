'use server';

import { Annotation, StateGraph, START, END, interrupt, Command } from "@langchain/langgraph";

import { vectorizePromptNode } from './nodes/vectorizePromptNode.js';
import { getConfigNode } from './nodes/getConfigNode.js';

import { getProfilePromptNode } from "./nodes/getProfilePromptNode.js";
import { chatCompletionNode } from "./nodes/chatCompletionNode.js";
import { searchIndexNode } from './nodes/searchIndexNode.js';


import { formatResponseNode } from "./nodes/formatResponseNode.js";
import { getKnowledgeBase } from "./nodes/knowledgeBaseNode.js";

// TEST CASE & SCRIPT NODES
import { getUserStoryMapping } from "./nodes/getUserStoryListNode.js";
import { generateTestCases } from "./nodes/testCaseGenerationNode.js";


import { detectIntent } from "./nodes/intent.js";
import { getSapPaymentNode } from "./nodes/getSapPaymentNode.js";
import { getRejectSummaryNode } from "./nodes/getRejectSummaryNode.js";
import { medicarePaymentDiagnosticNode } from './nodes/medicarePaymentDiagnosticNode.js';
import { agentArchivalNode } from './nodes/agentArchivalNode.js';
import { kpifInquiryNode } from './nodes/kpifInquiryNode.js';
import { activateSuspendUserNode } from './nodes/activateUserNode.js';
import { apValidationNode } from "./nodes/apValidationsNode.js";
import { MemorySaver } from "@langchain/langgraph";
import { validationNode } from "./nodes/validationNode.js";
import { NextResponse } from "next/server.js";
import { backgroundGraph } from "./baseBackgroundService.js";
import { getRejectsTrend } from "./nodes/getrejectsTrend.js";
import { getSNOWData } from "./nodes/getServiceNowDataNode.js";
import { sharedWorkflowState } from "./workflowState.js";
import { after } from "next/server.js";
//import { backgroundGraph } from "./baseBackgroundService.js";
const StateAnnotation=Annotation.Root({
  ...sharedWorkflowState
})
/* STATE DEFINITION */
// const StateAnnotation = Annotation.Root({
//   teamName: Annotation,
//   assistantName: Annotation,    //message
//   messages: Annotation,
//   structuredMemory: Annotation,

//   tokenCount: Annotation,


//   // Input states
//   userMessage: Annotation,
//   userResponse: Annotation,
//   userPrompt: Annotation,
//   promptEmbedding: Annotation,
//   completionsClient: Annotation,
//   context: Annotation,
//   timeRange: Annotation,
//   sessionID: Annotation,

//   //Intent
//   intent: Annotation,
//   intentRaw: Annotation,
//   analyticsContext: Annotation,
//   //identifiers: Annotation,
//   userContext: Annotation,
//   identifier_needed: Annotation,
//   identifier_question: Annotation,
//   continueFlow: Annotation,

//   // Extracted identifiers (quote_id, rqr_id, etc.)
//   identifiers: Annotation,
//   nuid: Annotation,
//   config: Annotation,
//   metadata: Annotation,

//   searchPattern: Annotation,
//   searchResults: Annotation,
//   indexMetadata: Annotation,
//   parsedSearchIntent: Annotation,
//   snowMetadata: Annotation,
//   //intent: Annotation,
//   indexHit: Annotation,

//   knowledgeBaseMetaData: Annotation,
//   userStoryMetaData: Annotation,
//   jiraMetaData: Annotation,
//   testCaseMetaData: Annotation,
//   paymentResults: Annotation,//Payment Summary
//   rejectResults: Annotation,//Reject Summary
//   medicareMetadata: Annotation,//Medicare
//   generatedFiles: Annotation,//Medicare
//   kpifResults: Annotation,//KPIF Inquiry
//   archiveAgentResults: Annotation,//ArchiveAgent
//   reactivateUserResults: Annotation,//Activate User
//   apValidationResults: Annotation,//APValidation
//   chatResponse: Annotation,
//   formattedResponse: Annotation,
//   chatNewResponseSummary: Annotation,
//   searchSuccess: Annotation,
//   promptSuccess: Annotation,
//   chatSuccess: Annotation,
//   formatSuccess: Annotation,
//   summary: Annotation,



// });

const graphBuilder = new StateGraph(StateAnnotation);

/** ADD NODES */
graphBuilder
  .addNode("getConfigNode", getConfigNode)
  .addNode("vectorizePromptNode", vectorizePromptNode)
  .addNode("determineIntent", detectIntent)
  .addNode("validateNode", validationNode)
  .addNode("searchIndexNode", searchIndexNode)
  .addNode("getKnowledgeBase", getKnowledgeBase)
  .addNode("userStoryMappingNode", getUserStoryMapping)
  .addNode("testCaseNode", generateTestCases)
  .addNode("getSNOWData", getSNOWData)
  .addNode("getSapPaymentNode", getSapPaymentNode)
  .addNode("getRejectsNode", getRejectSummaryNode)
  .addNode("medicarePaymentDiagnosticNode", medicarePaymentDiagnosticNode)
  .addNode("agentArchivalNode", agentArchivalNode)
  .addNode("kpifInquiryNode", kpifInquiryNode)
  .addNode("activateSuspendUserNode", activateSuspendUserNode)
  .addNode("apValidationNode", apValidationNode)
.addNode("getRejectsTrend",getRejectsTrend)
  .addNode("getProfilePromptNode", getProfilePromptNode)
  .addNode("chatCompletionNode", chatCompletionNode)
  .addNode("formatResponseNode", formatResponseNode);

let incidentIndexName = "bcs-incident-001"
let knowledgeIndexName = "bcs-knowledge-001"
let userStoryIndexName = "bcs-userstory-001"
/** ROUTING LOGIC */
const routeByIntent = (state) => {
  //const type = state.intent?.type;
  const type = state.structuredMemory.activeDomain
  console.log(`[routeByIntent] Intent type: "${type}"`);


  if (type === "incident_management") { return "searchIndexNode"; }
  else if (type === "knowledge_base") { return "getKnowledgeBase"; }
  else if (type === "payment_summary") { return "getSapPaymentNode"; }
  else if (type === "reject_summary") { return "getRejectsNode"; }
  else if (type === "medicare_payment") { return "medicarePaymentDiagnosticNode"; }
  else if (type === "agent_archival") { return "agentArchivalNode"; }
  else if (type === "activate_suspendeduser") { return "activateSuspendUserNode"; }
  else if (type === "kpif_inquiry") { return "kpifInquiryNode"; }
  else if (type === "apValidations") { return "apValidationNode"; }
  else if (type === "testcase_generation" || type === "testscript_generation") { return "userStoryMappingNode"; }
  else if (type == "getservicenowRecords") { return "getSNOWData" }
    else if (type == "rejectTrend") { return "getRejectsTrend" }
  return "getProfilePromptNode";
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

  .addConditionalEdges("vectorizePromptNode", routeByIntent)

  // Incident PATH
  .addEdge("searchIndexNode", "getProfilePromptNode")

  // KNOWLEDGE BASE PATH
  .addEdge("getKnowledgeBase", "getProfilePromptNode")



  // TEST CASE / TEST SCRIPT PATH
  .addEdge("userStoryMappingNode", "testCaseNode")
  .addEdge("testCaseNode", "getProfilePromptNode")


  //Get SNOW data
  .addEdge("getSNOWData", "getProfilePromptNode")
  .addEdge("getSapPaymentNode", "getProfilePromptNode")  //Payment Summary
  .addEdge("getRejectsNode", "getProfilePromptNode")  //Reject Summary
  .addEdge("medicarePaymentDiagnosticNode", "chatCompletionNode") //Medicare Service Request
  .addEdge("kpifInquiryNode", "getProfilePromptNode")   //KPIF Inquiry Request
  .addEdge("activateSuspendUserNode", "getProfilePromptNode")  //Activate Suspended Uer Request
  .addEdge("agentArchivalNode", "getProfilePromptNode")    //Agent Archival  Request
  .addEdge("apValidationNode", "getProfilePromptNode")    //Agent Archival  Request
    .addEdge("getRejectsTrend", "getProfilePromptNode")    //Agent Archival  Request
  .addEdge("getProfilePromptNode", "chatCompletionNode")
  .addEdge("chatCompletionNode", "formatResponseNode")
  .addEdge("formatResponseNode", END);


  getRejectsTrend
// Compile
//const graph = graphBuilder.compile();
// Compile the graph
const memory = new MemorySaver();
const graph = graphBuilder.compile({ checkpointer: memory });
//const sessionId = "123-session";

let finalState = []


// Streaming chat bot function
export async function baseChatBotGraphStream({ assistantName, userMessage, metadata = {}, sessionId, teamName }) {
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
      generatedFiles: [],

      searchSuccess: false,
      promptSuccess: false,
      chatSuccess: false,
      formatSuccess: false,
      // Additional configuration from the client
      // };
      ...metadata,  // Additional configuration from the client
    };
    finalState = await graph.invoke(initialState, config);
     after(async()=>{
      try{
        if(finalState.requiresArchiveAgentApproval){
        await backgroundGraph.invoke({
          requiresArchiveAgentApproval:finalState.requiresArchiveAgentApproval,...finalState

        },config)}
      }
      catch(error){
        console.error("Background Graph Failed",error)
      }
    })
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
    return {
      formattedResponse: finalState.formattedResponse,
      generatedFiles: finalState.generatedFiles || []
    }
    //  after(async()=>{
    //   try{
    //     await backgroundGraph.invoke({
    //       requiredArchiveAgentApproval:finalState.requiredArchiveAgentApproval

    //     })
    //   }
    //   catch(error){
    //     console.error("Background Graph Failed",error)
    //   }
    // })

    
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