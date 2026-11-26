'use server';

import { chatCompletion } from "@/app/services/chatCompletionService2";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

/* ==========================================
   1. CLIENT HELPERS
   ========================================== */
const searchClients = {};
function getSearchClient(searchIndex) {
  if (!searchClients[searchIndex]) {
    const envName = process.env['envName'] || 'dev';
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

    if (!searchEndpoint || !searchAPIKey) {
      throw new Error("Azure Search credentials not found");
    }
    searchClients[searchIndex] = new SearchClient(searchEndpoint, searchIndex, new AzureKeyCredential(searchAPIKey));
  }
  return searchClients[searchIndex];
}


// HELPER: SUMMARIZE RESULT
async function summarizeResult(state, systemMessage) {
  const messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: `Requirement: ${state.userPrompt}` }
  ];

  const completionConfig = {
    temperature: state.config?.chatCompletion?.temperature || 0.2,
    max_tokens: state.config?.chatCompletion?.max_tokens || 2500,
    model: "gpt-4o",
    messages: messages,
    teamName: state?.teamName,
    assistantName: state?.assistantName,
  };

  const response = await chatCompletion(completionConfig);
  return response;
}

/* ==========================================
   2. MAIN NODE: GENERATE TEST CASES
   ========================================== */
export async function generateTestCases(state) {
  try {
    // A. GET USER STORY IDs
    const stories = state.userStoryMetaData?.records || [];
    const storyIds = stories.map(s => s.userstory_id).filter(Boolean);

    console.log(`\n=== JUMP 2: TEST CASE MAPPING ===`);
    console.log(`[DEBUG] Input User Story IDs: ${JSON.stringify(storyIds)}`);

    let testCaseResults = [];

    // B. PERFORM SEARCH & POST-FILTERING
    if (storyIds.length > 0) {
      try {
        let vindexName = "nps-testcase-001"
        // if (process.env['envName']=='dev'){indexName="bcs-testcase-001"}
        const indexName = vindexName;
        const searchClient = getSearchClient(vindexName);

        // 1. Broad Search: Find anything that mentions these IDs
        const luceneQuery = storyIds.map(id => `"${id}"`).join(" OR ");

        console.log(`[DEBUG] Executing Broad Search...`);

        // We fetch MORE results (top 50) to ensure the valid ones are captured even if noise exists
        const searchResults = await searchClient.search(luceneQuery, {
          searchMode: "any",
          top: 50,
          select: ["id", "userstory_id", "test_steps", "scope", "description", "content"]
        });

        // 2. STRICT FILTERING IN CODE (The Fix)
        for await (const result of searchResults.results) {
          const docIdString = result.document.userstory_id || "";

          // Check: Does this document's ID string actually contain one of our requested IDs?
          // matches "NPG3-9511" inside "NPG3-9511, NPG3-9512"
          const isRelevant = storyIds.some(reqId => docIdString.includes(reqId));

          if (isRelevant) {
            testCaseResults.push(result.document);
          }
        }
        console.log(`[DEBUG] Found ${testCaseResults.length} RELEVANT Test Cases (after filtering).`);

      } catch (searchErr) {
        console.warn(`[WARN] Internal Search Failed: ${searchErr.message}`);
      }
    } else {
      console.warn(`[WARN] No User Story IDs found. AI will generate fresh cases.`);
    }

    // C. PREPARE FOR SYNTHESIS
    const promptProfiles = state.config?.promptProfiles || {};
    const rawSynthesizer = promptProfiles['test_case_synthesizer']?.systemMessage || "";
    const synthesizerProfile = typeof rawSynthesizer === 'object' ? rawSynthesizer.content : rawSynthesizer;

    // Map data for AI
    const coverageData = testCaseResults.map(tc => ({
      id: tc.id,
      userStoryId: tc.userstory_id,
      scope: tc.scope,
      steps: tc.test_steps || tc.content || "NO STEPS FOUND IN DB"
    }));

    // Log the first RELEVANT item to confirm it matches your input list now
    if (coverageData.length > 0) {
      console.log(`[DEBUG] AI INPUT PREVIEW (First Relevant Item):`, JSON.stringify(coverageData[0]).substring(0, 200));
      // console.log(`[DEBUG] AI INPUT PREVIEW (second Relevant Item):`, JSON.stringify(coverageData[1]).substring(0, 200));
    } else {
      console.log(`[DEBUG] AI INPUT: No relevant coverage data found.`);
    }

    const existingCoverageJson = JSON.stringify(coverageData, null, 2);

    // const finalPrompt = synthesizerProfile
    //     .replace("{userInput}", state.userPrompt)
    //     .replace("{testCaseSummary}", existingCoverageJson);
    const finalPrompt = `You are a Senior QA Test Designer.

You will be given:
1. A new functional requirement (user input)
2. A list of existing coverage entries, where each entry represents test coverage derived from existing test cases

Given UserInput:${state.userPrompt}
Existing Coverages in JSON format: ${existingCoverageJson}


Each coverage entry is independent and must be evaluated separately.

Your task is to:
- Analyze the new functional requirement
- For EACH coverage entry:
  - Evaluate how well the coverage matches the functional requirement
  - Assign a coverage match score as a percentage (0–100%)
  - Identify which parts of the requirement are already covered
  - Identify gaps relative to the requirement
  - Add ONLY the missing test steps required to fully cover the requirement

  Step Detail Requirements:
- All test steps MUST be detailed, executable steps
- Each step must describe a concrete user or system action and expected result
- Do NOT summarize steps into single-line descriptions
- When using existing coverage, expand covered areas into full test steps based on the provided coverage details
- When adding additional steps, write them at the same level of detail as existing test steps
- Each test step must be self-contained and clear enough to be automated

Decision Rules:
- If a coverage entry has matching coverage, expand that coverage into complete test steps rather than summarizing it
- If a coverage entry meets the requirement completely (100% match), explicitly state that full coverage is met and do NOT add new steps
- If a coverage entry partially matches the requirement, extend it by adding only the missing test steps
- If NONE of the coverage entries have meaningful matching coverage (all below minimal relevance), create a new set of test steps using the provided coverage as reference patterns

Strict Rules:
- Do NOT rewrite or rephrase existing test steps
- Do NOT remove existing coverage
- Do NOT invent functionality not stated or clearly implied by the requirement
- Use existing steps as reference patterns when creating new steps
- Keep test steps clear, atomic, and executable

Output Requirements:
- Respond ONLY in JSON
- Do NOT include explanations outside JSON
- Follow the exact structure below

Expected Output Format:
{
  "coverageAnalysis": [
    {
      "coverageId": "<identifier if available>",
      "matchPercentage": "<0–100>",
      "coverageStatus": "Full | Partial | No Match",
      "coveredAreas": [
        "<what is already covered - List out >"
      ],
      "additionalTestSteps": [
        "<new test step needed to fully cover the requirement>"
      ]
    }
  ],
  "newTestSteps": [
    "<steps created ONLY if no coverage entries are relevant>"
  ]
}	  `

    // D. CALL LLM
    console.log(`[DEBUG] Analyzing Coverage with AI...`);
    const finalResponse = await summarizeResult(state, finalPrompt);

    // E. CLEANUP & PARSE RESPONSE
    const cleanFinal = finalResponse.replace(/```json|```/g, "").trim();
    let parsedFinal = {};

    try {
      parsedFinal = JSON.parse(cleanFinal);

      console.log("\n================ COVERAGE REPORT ================");
      if (parsedFinal.coverageAnalysis && parsedFinal.coverageAnalysis.length > 0) {
        parsedFinal.coverageAnalysis.forEach(a => {
          console.log(`[ANALYSIS] ID: ${a.coverageId} | Match: ${a.matchPercentage}% | Status: ${a.coverageStatus}`);
        });
      }
      if (parsedFinal.newTestSteps && parsedFinal.newTestSteps.length > 0) {
        console.log(`\n[ACTION] NO MATCH FOUND. Creating ${parsedFinal.newTestSteps.length} new steps.`);
      }
      console.log("=================================================\n");

    } catch (e) {
      console.warn("[WARN] Failed to parse AI JSON.");
      parsedFinal = { generatedTestCases: [], raw: cleanFinal };
    }

    return {
      ...state,
      testCaseMetaData: {
        records: parsedFinal,
        matchingTestCases: testCaseResults,
        recordCount: testCaseResults.length,
        recordFound: testCaseResults.length > 0,
        timestamp: new Date().toISOString()
      },
      searchSuccess: true
    };

  } catch (testCaseError) {
    console.error('[ERROR] TestCase Node Failed:', testCaseError.message);
    return {
      ...state,
      testCaseMetaData: { recordCount: 0, recordFound: false, error: testCaseError.message }
    };
  }
}