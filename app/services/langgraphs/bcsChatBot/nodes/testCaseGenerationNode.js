'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

import { chatCompletion } from "@/app/services/chatCompletionService2";

// Index configuration for test cases
let indexName = "nps-testcase-001"
//if (process.env['envName']=='dev'){indexName="bcs-testcase-001"}
const TESTCASE_INDEX_NAME = indexName;

let searchClient = null;


function getSearchClient() {
  if (!searchClient) {
    const envName = process.env['envName'] || 'dev';
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

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
    // vectorSearchOptions: {
    //   queries: [{
    //     kind: "vector",
    //     vector: promptEmbedding,
    //     kNearestNeighborsCount: 20,
    //     fields: ["content_vector"]
    //   }]
    //}
  };

  // const luceneQuery = userStoryIds.map(id => `"${id}"`).join(" OR ");

  //           console.log(`[DEBUG] Executing Broad Search...`);

  //           // We fetch MORE results (top 50) to ensure the valid ones are captured even if noise exists
  //           const searchResults1 = await client.search(luceneQuery, {
  //               searchMode: "any",
  //               top: 1500, 
  //               select: ["id", "userstory_id", "test_steps", "scope", "description", "content","scenario_name", "prerequisite"]
  //           });
  //           let testCaseResults=[]
  //           const test=await searchResults1.results
  //           // 2. STRICT FILTERING IN CODE (The Fix)
  //           for await (const result of searchResults1.results) {
  //               const docIdString = result.document.userstory_id || "";

  //               // Check: Does this document's ID string actually contain one of our requested IDs?
  //               // matches "NPG3-9511" inside "NPG3-9511, NPG3-9512"
  //               const isRelevant = userStoryIds.some(reqId => docIdString.includes(reqId));

  //               if (isRelevant) {
  //                   testCaseResults.push(result.document);
  //               }
  //           }
  //           console.log(`[DEBUG] Found ${testCaseResults.length} RELEVANT Test Cases (after filtering).`);



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
    //userStoryResult=state.userStoryMetaData.records

    //console.log(userStoryList)
    //Get List of User Story 

    // const result = userStories.map((story) => {
    //   // Find test cases that contain this user story ID
    //   const matchedTestCases = testCases
    //     .filter(tc =>
    //       tc.userStorymapping
    //         .split(",")
    //         .map(id => id.trim())
    //         .includes(story.ID)
    //     )
    //     .map(tc => ({
    //       testcaseName: tc.testCase,
    //       teststeps: tc.testSteps
    //     }));

    //   return {
    //     userStoryID: story.ID,
    //     userStoryDesc: story.description,
    //     testcases: matchedTestCases
    //   };
    // });

    // console.log(result);




    // //Get List of TestCases from Mapping User Story
    // const testcaseResponse = await fetch(`${baseUrl}/api/vector/testCases`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({useCase:"TestCasesMapping","metaData":userStoryResult})
    // });

    // if (testcaseResponse.ok) {
    //   const testCaseData = await testcaseResponse.json();
    //   testCaseResult = testCaseData.results || [];
    //   console.log(`TestCase Mapping returned ${testCaseResult.length} records`);
    // }

    // results = array of user story records
    // Each record: { userStory, testcases: [], automationScripts: [] }
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

    // Build coverage summary for each user story
    //const testCaseSummaries = [];

    // for (const userStory of userStoryRecords) {
    //   const relatedTestCases = existingTestCases.filter(
    //     tc => tc.userStoryID === userStory.userStoryID
    //   );

    //   if (relatedTestCases.length > 0) {
    //     const tcSummary = {
    //       userStoryID: userStory.userStoryID,
    //       userStoryDesc: userStory.userStoryDesc,
    //       testCases: relatedTestCases.map(tc => ({
    //         testCaseName: tc.testCaseName,
    //         scope: tc.scope,
    //         preRequisite: tc.preRequisite,
    //         teststeps: tc.testSteps
    //       }))
    //     };
    //     testCaseSummaries.push(tcSummary);
    //   }
    // }

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
    //     const testCaseSummarySystemMessage = `
    //     CRITICAL VERBOSITY & REASONING RULES (NON‑NEGOTIABLE):
    // - Use the absolute minimum number of tokens.
    // - Do NOT provide chain‑of‑thought, reasoning steps, analysis, or internal thinking.
    // - Do NOT explain decisions, logic, or rationale.
    // - Do NOT elaborate unless explicitly asked.
    // - Do NOT restate the user input.
    // - Do NOT add background, narrative, or examples.
    // - Output only final results.
    // - Short, factual statements only.
    // - Silence is acceptable when information is missing.
    // - You must not reveal or generate chain‑of‑thought, analysis, or internal reasoning. Only output final JSON.



    // ROLE:
    // You are a Senior QA Test Designer specializing in reusing existing test case navigation flows to design new test cases.

    // INPUTS:
    // 1. New functional requirement:
    //    ${state.userPrompt} - ${state.jiraMetaData}

    // 2. Existing test cases (JSON):
    //    ${JSON.stringify(testCaseSummary)}

    // TASK:
    // - Analyze the new functional requirement.
    // - Reuse existing test step navigation flows as the PRIMARY source.
    // - Identify existing coverage applicable to the new requirement.
    // - Generate new test cases only where coverage is insufficient.
    // - Add additional validation steps ONLY when strictly required.

    // TEST CASE RULES:
    // - Reuse existing test steps wherever applicable.
    // - Navigation flows MUST come from provided navigationSteps.
    // - Do NOT assume or invent navigation.
    // - Do NOT start test steps directly from coverage; always derive from navigationSteps.
    // - Each test step must include:
    //   - Concrete user/system action
    //   - **Expected Result**
    // - All steps must be self‑contained and automatable (Selenium‑ready).
    // - Additional steps must match the detail level of existing steps.

    // STRICT CONSTRAINTS:
    // - Do NOT invent functionality not stated or implied.
    // - Do NOT generate more than 3 test cases.
    // - Do NOT create duplicate or near‑duplicate test cases.
    // - Adhere strictly to provided navigation flows unless missing.
    // - If navigation context is missing, generate only partial coverage.

    // CRITICAL NAVIGATION RULE:
    // Always use navigationSteps EXACTLY as provided.
    // Never infer, modify, or reorder navigation steps.
    // These steps will be used directly for Selenium automation.

    // FALLBACK GUARDRAIL:
    // - If full test case generation is not possible:
    //   - Generate partial test cases using available navigationSteps.
    // - If no generation is possible, return the fallback error JSON.

    // OUTPUT RULES:
    // - Respond ONLY in valid JSON.
    // - No markdown.
    // - No commentary.
    // - Follow the exact structure below.

    // EXPECTED OUTPUT FORMAT:
    // {
    //   "generatedTestCases": [
    //     {
    //       "testCaseName": "<concise name>",
    //       "testScenario": "<specific scenario>",
    //       "testScope": "<detailed scope>",
    //       "testSteps": [
    //         "<step 1>. **Expected**: <result>",
    //         "<step 2>. **Expected**: <result>"
    //       ]
    //     }
    //   ]
    // }

    // FALLBACK OUTPUT:
    // {
    //   "generatedTestCases": {
    //     "Error": "<<reason>>"
    //   }
    // }
    // `
    // testCaseResponse = await summarizeResult(state, testCaseSummarySystemMessage)
    //console.log(testCaseResponse)


    // const cleanedtestCase = testCaseResponse
    //   .replace(/```json/gi, "")
    //   .replace(/```/g, "")
    //   .trim();
    // const jsonTestCaseResponse = (JSON.parse(cleanedtestCase))
    // // response.coverageAnalysis[], response.newTestSteps[]

    // let finalTestCases = [];

    //  Build test cases from each coverage entry
    // jsonTestCaseResponse.coverageAnalysis.forEach((coverage) => {
    //   const steps = [];

    //   // pull covered areas as steps
    //   if (Array.isArray(coverage.coveredAreas)) {
    //     steps.push(...coverage.coveredAreas);
    //   }

    //   // append additional steps
    //   if (Array.isArray(coverage.additionalTestSteps)) {
    //     steps.push(...coverage.additionalTestSteps);
    //   }

    //   // create test case only if steps exist
    //   if (steps.length > 0) {
    //     finalTestCases.push({
    //       testCaseName: `TestCase_${coverage.coverageId || "Coverage"}`,
    //       testSteps: steps
    //     });
    //   }
    // });

    // 2️⃣ Handle brand nejsonTestCaseResponsew test case (no matching coverage)
    //if (Array.isArray(jsonTestCaseResponse.generatedTestCases) && jsonTestCaseResponse.generatedTestCases.length > 0) {
    // finalTestCases.push({
    //   testCaseName: jsonTestCaseResponse.generatedTestCases.testCaseName,
    //   testSteps: jsonTestCaseResponse.generatedTestCases.testSteps
    // });
    //finalTestCases = jsonTestCaseResponse.generatedTestCases;
    //}









    //          const testScriptResponse = await fetch(`${baseUrl}/api/vector/testScripts`, {
    //           method: "POST",
    //           headers: { "Content-Type": "application/json" },
    //           body: JSON.stringify({useCase:"TestCasesMapping","metaData":userStoryResult})
    //         });

    //         if (testScriptResponse.ok) {
    //           const testScriptData = await testScriptResponse.json();
    //           testScriptResult = testScriptData.results || [];
    //           console.log(`TestScript  Mapping returned ${testScriptResult.length} records`);
    //         }



    //       systemMessage= `You are an expert QA Automation Engineer.

    // You will be given structured input for a SINGLE user story containing:
    // 1. User Story details (ID and description)
    // 2. Related manual test cases (test steps and scope)
    // 3. Existing automation test scripts (script name and description)

    // Your task is to:
    // - Understand the user story intent and expected behavior
    // - Analyze provided manual test cases to understand functional coverage
    // - Analyze existing automation scripts to identify what is already automated
    // - Identify gaps in automation coverage, if any
    // - Generate NEW automation test scripts ONLY for uncovered scenarios

    // Strict Rules:
    // - Do NOT regenerate scripts that already exist
    // - Do NOT invent functionality not mentioned in the user story or test cases
    // - Do NOT merge multiple user stories together
    // - Use ONLY the provided input data
    // - If automation coverage is complete, explicitly say "No new automation scripts are required"

    // UserStory:




    // Output Requirements:
    // - Respond ONLY in JSON
    // - Do NOT include explanations outside JSON
    // - Follow the exact structure below

    // Expected Output Format:
    // {
    //   "userStoryID": "<ID>",
    //   "userStorySummary": "<concise summary of the user story>",
    //   "existingAutomationCoverage": [
    //     {
    //       "testScriptName": "<name>",
    //       "description": "<what it covers>"
    //     }
    //   ],
    //   "automationGaps": [
    //     "<short description of uncovered scenario>"
    //   ],
    //   "recommendedNewAutomationScripts": [
    //     {
    //       "testScriptName": "<suggested script name>",
    //       "description": "<what the script should validate>"
    //     }
    //   ]
    // }
    // `

    //   // results = array of user story records
    // // Each record: { userStory, testcases: [], automationScripts: [] }

    // for (const record of testScriptResult) {
    //   const userStoryDesc = record.userStory?.description || "";
    //   const userStoryId = record.userStory?.ID || "";

    //   const testCases = record.testcases || [];
    //   const automationScripts = record.automationScripts || [];

    //   // Example: build payload per LLM call
    //   const llmPayload = {
    //     userStory: {
    //       ID: userStoryId,
    //       description: userStoryDesc
    //     },
    //     testcases: testCases.map(tc => ({
    //       testSteps: tc.testSteps,
    //       scope: tc.scope
    //     })),
    //     automationScripts: automationScripts.map(as => ({
    //       testScriptName: as.testScriptName,
    //       description: as.description
    //     }))
    //   };

    //   // invoke LLM here with llmPayload
    //   // await callLLM(llmPayload);
    // }


    //   const messages = [

    //       {
    //         role: "system",
    //         content: systemMessage
    //       }
    //     ];

    //     const completionsClient = await getCompletionsClient();

    //     // Make the main chat completion request
    //     const completionConfig = {
    //       temperature: state.config?.chatCompletion?.temperature || 0.7,
    //       max_tokens: state.config?.chatCompletion?.max_tokens || 1000,
    //       model: "gpt-4o",
    //       messages: messages
    //     };

    //     // Extract the main response
    //     const response = await completionsClient.chat.completions.create(completionConfig);
    //     console.log(response.choices[0].message.content)

    //console.log(finalTestCases)

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