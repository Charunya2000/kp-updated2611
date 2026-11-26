import { Annotation,} from "@langchain/langgraph";


/* STATE DEFINITION */
export const  sharedWorkflowState={
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
  testCaseMetaData: Annotation,
  paymentResults: Annotation,//Payment Summary
  rejectResults: Annotation,//Reject Summary
  medicareMetadata: Annotation,//Medicare
  generatedFiles: Annotation,//Medicare
  kpifResults: Annotation,//KPIF Inquiry
  archiveAgentResults: Annotation,//ArchiveAgent
  reactivateUserResults: Annotation,//Activate User
  apValidationResults: Annotation,//APValidation
  trueupSummary:Annotation,
  rejectTrendResults:Annotation,
  chatResponse: Annotation,
  formattedResponse: Annotation,
  chatNewResponseSummary: Annotation,
  searchSuccess: Annotation,
  promptSuccess: Annotation,
  chatSuccess: Annotation,
  formatSuccess: Annotation,
  summary: Annotation,
  bsadProcessRequest:Annotation,
  requiresArchiveAgentApproval:Annotation,
  
brokerSplitTable:
    Annotation,

jiraIssueKey:
    Annotation,

jiraIssueUrl:
    Annotation,

summary:
    Annotation


};