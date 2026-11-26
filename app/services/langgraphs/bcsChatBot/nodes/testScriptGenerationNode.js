'use server';
import { chatCompletion } from "@/app/services/chatCompletionService2";

async function summarizeResult(state, systemMessage) {

  const messages = [

    {
      role: "system",
      content: systemMessage
    }
  ];

  // Make the main chat completion request
  const completionConfig = {
    temperature: state.config?.chatCompletion?.temperature || 0.7,
    max_tokens: state.config?.chatCompletion?.max_tokens || 1000,
    model: "gpt-4o",
    messages: messages,
    teamName: state?.teamName,
    assistantName: state?.assistantName,
    nuid: state?.nuid
  };

  // Extract the main response
  const response = await chatCompletion(completionConfig);
  return response;

}


export async function generateTestScript(state) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  let userStoryResult = [], testCaseResult = [], testScriptSummary = [], testScriptResponses = {}, githubResponse = {}, gitHubData = {}, testScriptResult = []
  if (state.intent.type == "TEST_SCRIPT") {
    try {
      userStoryResult = state.userStoryMetaData.records

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


      const testScriptResponse = await fetch(`${baseUrl}/api/vector/testScripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useCase: "TestScriptsMapping", "metaData": userStoryResult })
      });

      if (testScriptResponse.ok) {
        const testScriptData = await testScriptResponse.json();
        testScriptResult = testScriptData.results || [];
        console.log(`TestScript  Mapping returned ${testScriptResult.length} records`);
      }
      const testCases = state.testCaseMetaData.testCases
      for (const testrecord of testCases) {
        const testSteps = testrecord.testSteps

        for (const record of testScriptResult) {
          const userStoryDesc = record.userStoryDesc || "";
          const userStoryId = record.userStoryID || "";

          const testScripts = record.testScripts || [];
          const testCaseName = testScripts[0].testCaseName || "";
          const dataSheetName = testScripts[0].dataSheetName || "";
          const description = testScripts[0].description || "";
          const sourceFile = testScripts[0].sourceFile || "";
          githubResponse = await fetch(`${baseUrl}/api/nps/npschatbot/github`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetFile: testCaseName + ".java" })
          });

          if (githubResponse.ok) {
            gitHubData = await githubResponse.json();

            const cleanedScript = gitHubData.results

              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '    ')
              .replace(/\n[ ]{8,}/g, '\n    ');

            //const jsonScript = JSON.parse(cleanedScript);




            const tcSystemMessage = `You are a Senior QA Automation Engineer.

You will be given:
1. A set of FINAL test steps (validated and complete)
2. An EXISTING automation Selenium test script (test name and code). This will be a .java file from Selenium

TestSteps:${testSteps}
Automation Script Name:${testCaseName}
Selenium Java Class Code: ${cleanedScript}
Your task is to:
- Analyze the existing automation script
- Compare it against the provided test steps
- Identify which test steps are already implemented in the script
- Extend or update the script to cover ONLY the missing test steps
- Preserve all existing logic, structure, and naming conventions
- Follow the same framework, patterns, and assertions used in the existing script

Strict Rules:
- Do NOT rewrite or refactor existing code unless required to add missing coverage
- Do NOT remove existing logic or assertions
- Do NOT introduce new test scenarios beyond the provided test steps
- Do NOT change the test framework, libraries, or style
- If all test steps are already covered, return the original script unchanged

Output Requirements:
- Respond ONLY in JSON
- Do NOT include explanations outside JSON
- Follow the exact structure below

Expected Output Format:
{
  "testScriptName": "<existing test script name>",
  "updated": true | false,
  "updatedTestScript": "<full updated automation script code>"
}
`
            testScriptResponses = await summarizeResult(state, tcSystemMessage)
            console.log(testScriptResponses)
            const cleanedtestScripts = testScriptResponses
              .replace(/```json/gi, "")
              .replace(/```/g, "")
              .trim();
            testScriptSummary.push(JSON.parse(cleanedtestScripts))


            //const automationScripts = record.automationScripts || [];


          }
        }
      }


      return {
        ...state,

        //   userStoryMetaData: {

        //     records: userStoryResult,
        //     recordCount: userStoryResult.length,
        //      recordFound: userStoryResult.length > 0,
        //     timestamp: new Date().toISOString()
        //   },
        //  testCaseMetaData: {

        //   records: testCaseResult,
        //   recordCount: testCaseResult.length,
        //    recordFound: testCaseResult.length > 0,
        //   timestamp: new Date().toISOString()
        // },
        testScriptMetaData: {

          records: testScriptSummary,
          recordCount: testScriptResult.length,
          recordFound: testScriptResult.length > 0,
          timestamp: new Date().toISOString()
        }

      };
    } catch (testscriptError) {
      console.warn(' testScript query failed:', testscriptError.message);
      return {
        ...state,


        userStoryMetaData: {
          recordCount: 0,
          recordFound: false,
          timestamp: new Date().toISOString()
        },
        // testCaseMetaData: {
        //   recordCount: 0,
        //    recordFound: false,
        //   timestamp: new Date().toISOString()
        // },
        testScriptMetaData: {
          recordCount: 0,
          recordFound: false,
          timestamp: new Date().toISOString()
        }

      };
    }
  }

};