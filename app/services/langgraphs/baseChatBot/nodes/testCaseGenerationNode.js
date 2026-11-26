'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

import { chatCompletion } from "@/app/services/chatCompletionService2";

// Index configuration for test cases
let indexName = "bcs-testcase-001"
//if (process.env['envName']=='dev'){indexName="bcs-testcase-001"}
const TESTCASE_INDEX_NAME = indexName;

let searchClient = null;


function getSearchClient() {
  if (!searchClient) {
    const envName = process.env['envName'] || 'dev';
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`];


    if (!searchEndpoint || !searchAPIKey) {
      throw new Error('Azure Search credentials not found in environment variables');
    }

    searchClient = new SearchClient(
      searchEndpoint,
      TESTCASE_INDEX_NAME,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClient;
}



async function summarizeResult(state, systemMessage) {

  const messages = [

    {
      role: "system",
      content: systemMessage
    }
  ];


  const completionConfig = {
    temperature: state.config?.chatCompletion?.temperature || 0.4,
    max_tokens: state.config?.chatCompletion?.max_tokens || 8000,
    model: "gpt-4o",
    messages: messages,
    teamName: state?.teamName,
    assistantName: state?.assistantName,
    nuid: state?.nuid
  };

  const response = await chatCompletion(completionConfig);
  return response;
}

async function searchTestCases(userStoryIds, promptEmbedding) {
  const client = getSearchClient();

  // Build filter for user story IDs
  let filter = null;
  if (userStoryIds && userStoryIds.length > 0) {
    const filterParts = userStoryIds.map(id => `t eq '${id}'`);
    filter = "userstory_id/any(t: " + filterParts.join(' or ') + ")";
  }

  const searchOptions = {
    select: ["id", "scenario_name", "userstory_id", "prerequisite", "scope", "description", "test_steps", "source_file", "content"],
    top: 2,
    filter: filter,

  };


  const searchResults = await client.search("*", searchOptions);

  const records = [];
  for await (const result of searchResults.results) {
    records.push({
      score: result.score,
      testCaseName: result.document.scenario_name,
      userStoryID: result.document.userstory_id,
      preRequisite: result.document.prerequisite,
      scope: result.document.scope,
      description: result.document.description,
      testSteps: result.document.test_steps,
      sourceFile: result.document.source_file,
      content: result.document.content,
      document: result.document
    });
  }

  return records.sort((a, b) => (b.score || 0) - (a.score || 0));
  //return testCaseResults
}


export async function generateTestCases(state) {
  if (state.userContext != 'NEW') return {}
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  let userStoryResult = [], testCaseResult = [], testCaseSummary = [], testCaseResponse = {}

  try {

    const userStoryRecords = state.userStoryMetaData?.records || [];
    const promptEmbedding = state.promptEmbedding;

    if (!promptEmbedding || !Array.isArray(promptEmbedding)) {
      throw new Error('Prompt embedding not available for vector search');
    }

    // Extract user story IDs
    const userStoryIds = userStoryRecords.map(r => r.userStoryID).filter(Boolean);
    console.log(`[generateTestCases] Searching test cases for ${userStoryIds.length} user stories`);

    // Search for existing test cases
    const existingTestCases = await searchTestCases(userStoryIds, promptEmbedding);
    console.log(`[generateTestCases] Found ${existingTestCases.length} existing test cases`);


    testCaseResult = existingTestCases
    for (const record of testCaseResult) {
      // const userStoryDesc = record.userStoryDesc || "";
      // const userStoryId = record.userStoryID || "";

      // const testCases = record.testCases || [];
      // const teststeps=testCases[0].teststeps ||"";
      // const scope=testCases[0].scope || "";
      // const prerequisite=testCases[0].preRequisite || "";
      const userStoryId = record.userStoryID || ""
      const teststeps = record.content || ""
      const scope = record.scope || ""
      //       const tcSystemMessage = `You are a QA Analyst.

      // You will be given a single test case with detailed test steps.

      // Your task is to:
      // - Identify what functionality and scenarios the test steps cover
      // - Produce a concise, lossless summary of coverage
      // - Maintain navigation flow from test steps and then have coverage summary

      // UserStoryID: ${userStoryId}

      // Related Test Scope and Test Steps for the identifed User Story:
      // Scope: ${scope}
      // TestSteps: ${teststeps}

      // Strict Rules:
      // - Do NOT generate new test steps
      // - Do NOT remove coverage details
      // - Do NOT infer behavior not present in the steps
      // - Summarize only what is explicitly covered

      // Output only JSON:
      // {
      //   "userStoryID": "<ID>",
      //    "testScope:"<scope from TestCase>",
      //    "testScenario":"<scenario from TestCase>",
      //    "navigationSteps":["..How to navigate in application flow.."]
      //   "coverageSummary": ["..."]
      // }


      // `
      ///      testCaseResponse = await summarizeResult(state, tcSystemMessage)
      const cleanedOutput = teststeps
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      testCaseSummary.push(JSON.parse(cleanedOutput))


      //const automationScripts = record.automationScripts || [];


    }


    return {
      ...state,


      testCaseMetaData: {
        records: testCaseSummary,//jsonTestCaseResponse.generatedTestCases,
        testCases: testCaseSummary,
        //referenceTestCases: testCaseSummary,
        //matchingTestases: testCaseResult,
        recordCount: testCaseSummary.length,
        recordFound: testCaseSummary.length > 0,
        timestamp: new Date().toISOString()
      },
      //    testScriptMetaData: {

      //     records: testScriptResult,
      //     recordCount: testScriptResult.length,
      //      recordFound: testScriptResult.length > 0,
      //     timestamp: new Date().toISOString()
      //   }

    };
  } catch (testCaseError) {
    console.warn(' testCase query failed:', testCaseError.message);
    return {
      ...state,



      testCaseMetaData: {
        recordCount: 0,
        recordFound: false,
        timestamp: new Date().toISOString()
      },
      //    testScriptMetaData: {
      //      recordCount: 0,
      //      recordFound: false,
      //     timestamp: new Date().toISOString()
      //   }

    };
  }






};