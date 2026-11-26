'use server';

import { chatCompletion } from "@/app/services/chatCompletionService2";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";

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


async function callLLM(systemMessage, state) {
  const messages = [

    {
      role: "system",
      content: systemMessage
    }
  ];

  // Make the main chat completion request
  const completionConfig = {
    temperature: state.config?.chatCompletion?.temperature || 0.7,
    max_tokens: state.config?.chatCompletion?.max_tokens || 5000,
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
async function missingMethodGenerator(missingMethod, state) {

  const methodGenerationPrompt = `You are a Selenium Page Object Method Generator Agent.
Your responsibility is strictly limited to generating new Page Object methods for test steps that were marked as unmatched.
You are NOT allowed to:
  -Modify/Rename existing methods
  -Generate test classes and test flow
  -Output explanations
  - Output anything other than valid JSON
You generate only missing Page Object methods.

INPUT YOU WILL RECEIVE
  -Unmatched test step(s)
  -Page Object class name - If not provided, add as Page and call out comment to replace
  -Page name - If not provided, create using test step and call out comment to replace
  -Available XPath field variables (already defined in class)
  -Sample existing method(s) from same class (for style reference)
  -Naming convention rules

YOUR TASK

For each unmatched step:
  -Design an appropriate method name following existing naming conventions.
  -Use available XPath field variables if applicable.
  -If no appropriate XPath exists: 
    -Create a new private WebElement or By field definition.
    - Name it clearly and consistently.
  -Follow Page Object Model best practices.
  -Keep method atomic unless step explicitly requires composite logic.
  -Use explicit waits when dealing with visibility, popup, dynamic loading, or async behavior.
  -Maintain coding style consistent with provided sample method.

METHOD DESIGN RULES
Naming
  -Use camelCase.
  -Start with action verb.
  -Be business-aware and specific.
  -Avoid generic names like performAction, handleStep.
Good examples: 
waitForDeleteConfirmationPopup | confirmPolicyDeletion | selectClaimTypeFromDropdown | verifyPremiumAmountDisplayed

Method Structure:

Follow this structure:
  Use existing WebDriver instance.
  Use WebDriverWait for dynamic elements.
  Use existing xpath variables when provided.
  Return void unless sample methods return something else.
  Throw exceptions only if consistent with sample.

Wait Handling Rules:
  If step includes: "wait" | "load"| "popup" | "modal" | "visible" | "displayed"
  You MUST use explicit wait: WebDriverWait + ExpectedConditions
  Do NOT use Thread.sleep unless sample shows that pattern.

If XPath Is Missing
  If no suitable xpath variable is provided:
  Create a new private By locator at class level.
  Name it meaningfully.
  Assume reasonable xpath structure.
  Use consistent naming style as existing fields.

OUTPUT FORMAT (STRICT MultiLine String ONLY)
Return a single JSON object with methods seperated for each new method:
Make sure JSON formatted and all fields values should be within double quotes. For methodcode, add newline for linespacing as \n between
Do not add any comments after fields values. 
XPATH with double quotes will cause parse error. Make sure it is taken care 


  "newMethods": [
    {
      "className": "LoginPage",
      "methodName": "waitForLoginSuccessPopup",
      "newFieldAdded": "true",
      "fieldDefinition": "private By loginSuccessPopup = By.xpath(\"//div[@id='loginSuccess']\");",
      "methodCode": "public void waitForLoginSuccessPopup() {\n    WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));\n    wait.until(ExpectedConditions.visibilityOfElementLocated(loginSuccessPopup));\n}"
    }
  ]


Example Method:

    public QuoteAssociation selectQuoteAssociationDropdownValue1() throws InterruptedException{
    String QuoteAssociationDropdownValue1_Xpath = "Value1!//*[@id=\"L03-CreateQuoteAssociation1\"]";
		String[] elementValue = getElementValue(QuoteAssociationDropdownValue1_Xpath);
		Tabletxt = driver.findElement(By.xpath(elementValue[1])).getText(); 
		clickByXpath(QuoteAssociationDropdownValue1_Xpath);
		Thread.sleep(5000);
		return this;
	}
IMPORTANT CONSTRAINTS

  Output ONLY valid JSON.
  Do NOT include markdown.
  Do NOT include explanation text.
  Do NOT generate test class.
  Do NOT generate full page class.
  Only generate the missing method(s).
  Maintain formatting consistency.
  Be deterministic and clean.

You are a controlled code generator operating inside an enterprise Selenium framework.

Unmatched Test steps:
${missingMethod}`

  const missingmethodSummary = await callLLM(methodGenerationPrompt, state);

  return missingmethodSummary

}

let testScriptIndexName = "nps-testscript-001"


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
      testScriptIndexName,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClient;
}
async function pomSearch(filter, topK = 25, vector) {


  const searchOptions = {
    top: topK,
    filter: filter || undefined,
    includeTotalCount: true,
    select: ["content", "method_content"],
    vectorSearchOptions: {
      queries: [
        {
          kind: "vector",
          vector: vector,
          fields: ["content_vector"],
          kNearestNeighborsCount: 50
        }
      ]
    }
  };


  const searchClient = getSearchClient();

  const searchResults = await searchClient.search('*', searchOptions);
  const records = [];
  const total_records = await searchResults.count

  for await (const r of searchResults.results) {
    records.push({

      document: r.document
    });

  }


  return records || [];
}



export async function generateTestScript(state) {
  if (state.userContext != 'NEW') return {}
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  let userStoryResult = [], testCaseResult = [], testScriptSummary = [], testScriptResponses = {}, githubResponse = {}, gitHubData = {}, testScriptResult = []
  if (state.intent.type == "TEST_SCRIPT") {
    try {
      userStoryResult = state.userStoryMetaData.records


      const testCases = state.testCaseMetaData.testCases
      for (const testrecord of testCases) {
        // const testSteps = testrecord.testSteps
        const testSteps = JSON.stringify(testrecord.navigationSteps)

        //  const res1 = await fetch("http://localhost:3000/api/nps/npschatbot/pom", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   //body: JSON.stringify({useCase:"POMMapping",className:["nSQ","MedicareRateBuildUp","MyWork","FindRQRS","WorkItem","TotalRateCalculation"],content:testSteps})
        // body: JSON.stringify({useCase:"POMMapping",className:["QuoteAssociation.java","Capping.java","MyWork","HomePage.java","WorkItem","TotalRateCalculation","ManageWork.java","nSQ"],content:testSteps})

        // });
        const vectorEmbedding = await vectorizePromptNode(testSteps);
        const searchResults = await pomSearch('', 25, vectorEmbedding)



        const records = [];
        for await (const result of searchResults) {
          records.push({

            metadata: result.document.method_content,

          });
        }
        let methodsList = JSON.stringify(records);
        let parsedData = JSON.parse(methodsList);
        const transformed = parsedData.map(o => {
          const inner = JSON.parse(o.metadata);
          return {
            method: inner.methodName,
            class: inner.className,
            summary:
              inner.pageName + "|" +
              inner.intent + "|" +
              inner.uiElementType + "|" +
              inner.businessAction + "|" +
              inner.businessMeaning +
              "|Module:" + inner.module +
              "|Precondition:" + inner.precondition +
              "|Postcondition:" + inner.postcondition
          };
        });

        const llmInput = JSON.stringify(transformed)

        //console.log(llmInput)

        //Test Script Methods Planner

        const testScriptPlannerPrompt = `You are a senior Selenium test automation architect.

          Your task is to build a structured Selenium test execution plan 
          from high-level test steps using provided Page Object methods.

          The user will provide:
          1. High-level test steps (in sequence)
          2. A list of retrieved candidate Page Object methods with metadata

          Your responsibilities:

          1. For each test step:
            - Identify the most relevant method(s) from the candidate list.
            - IF more than one methods are matching, tag most relveant methods with high confidence say 2-3 methods
            - You MUST select only from provided methods.
            - Do NOT invent new methods.
            - If no suitable method exists, add it under unmathed test steps
            - Use the Test scenario and Scope along with each test step to determine the relevant methods

          2. Preserve the order of execution according to test steps.

          3. If a test step requires multiple methods (e.g., login → enter username + enter password + submit), include all necessary methods in correct logical order.

          4. Prefer:
            - composite methods if they fully satisfy the step
            - otherwise select atomic methods in correct order

          5. Do NOT generate Java code.
          6. Do NOT explain reasoning.
          7. Each test steps provide summary when we populate on JSON and do not paste whole content
          8. Output structured JSON only.

          ---------------------------------------------------------
          OUTPUT STRUCTURE
          ---------------------------------------------------------

          {
          "TestCaseName":"",
          "TestScenario":"",
          "TestScope":"",
          "mappedSteps": [
              {
                "stepIndex": 1,
                "testStep": "",
                "selectedMethods": {
                  "className": "",
                  "methodName": ""
                  "intent":""
                },
              }
            
            ], "unmatchedSteps": [
              {
                "stepIndex": 4,
                "testStep": "Wait for popup X to load",
                "reason": "No popup wait or visibility validation method found"
              }
            ]
          }
          TestCaseName:${testrecord.testCaseName}
          TestScenario:${testrecord.testScenario}
          TestScope:${testrecord.testScope}
          Test Steps in order: ${testSteps}
          List of Methods:
            ${llmInput}
            `;

        const testScriptPlannerSummary = await callLLM(testScriptPlannerPrompt, state);

        // summaries.push(summary);


        //UnMatched Steps:
        const cleanedJsonResponse = testScriptPlannerSummary
          .replace(/```json|```/g, "")
          .trim();
        let testScriptplannerOutput = {}
        const parsedJsonSummary = JSON.parse(cleanedJsonResponse);
        testScriptplannerOutput = JSON.stringify(testScriptPlannerSummary);
        const unmatched = parsedJsonSummary.unmatchedSteps;

        let missingTestScript = []

        // //Comented below for Phase 1
        // if (unmatched.length > 0) {
        // missingTestScript=await missingMethodGenerator(unmatched)
        // console.log(missingTestScript)
        //   const cleanedJsonmissingResponse = missingTestScript
        //     .replace(/```json|```/g, "")
        //     .trim();
        // //const parsedmissingStepSummary = JSON.parse(cleanedJsonmissingResponse);
        // const finalSummary=[...parsedJsonSummary.TestCaseName,...parsedJsonSummary.TestScenario,...parsedJsonSummary.TestScope,...parsedJsonSummary.mappedSteps,...cleanedJsonmissingResponse]
        // testScriptplannerOutput=JSON.stringify(finalSummary)

        // }     
        //Commented until here 

        //Generation:

        const testGenerationPrompt = `You are a senior Selenium test automation engineer.

        Your task is to generate a clean Java Selenium test class 
        using Page Object Model (POM) structure.

        You will receive:
        1. A structured executionPlan (ordered).
        2. Page Object class names and method names to invoke.

        CRITICAL RULES:

        1. You MUST ONLY use the provided className and methodName.
        2. DO NOT invent new methods.
        3. DO NOT modify method names.
        4. DO NOT add additional logic not present in executionPlan.
        5. Assume all Page Object classes have a constructor that accepts WebDriver.
        6. Generate clean, readable, production-style Java code.
        7. Use TestNG annotations.
        8. Include driver setup placeholder.
        9. Instantiate each Page Object only once.
        10. Call methods in exact execution order.
        11. Do NOT include explanations.
        12. Output only valid Java code.
        13. Add High level Comments from Test steps to the methods generated so we know for which test steps these methods fit in. As //Step 1: ....
        14. Use the Test Scenario , Scope and test steps to order and align the methods
        15. Each Automation test script should have TestCasename as its name above the import statement as TestScript#- <<TestCaseName>>
        ---------------------------------------------------------
        STRUCTURE REQUIREMENTS
        ---------------------------------------------------------

        - Import statements
        - Class definition
        - WebDriver declaration
        - @BeforeMethod setup()
        - @Test method
        - @AfterMethod teardown()

        - Instantiate Page Objects inside test method.
        - Use camelCase variable naming for page objects.
        - Name test method descriptively based on scenario.

        ---------------------------------------------------------

        If executionPlan contains a step with status = "MISSING_METHOD",
        add a comment in test method:

        // TODO:  Implement missing method for step: <step text>
        Note - Include TestCaseName  Test Scenarios, Test Scope as header from execution plan provided to populate on final code
        Execution Plan: 
          ${testScriptplannerOutput}
          `;

        const testscriptGenerationSummary = await callLLM(testGenerationPrompt, state);

        //summaries.push(summary);
        // console.log(testscriptGenerationSummary)

        //        testScriptResponses=await summarizeResult(state,tcSystemMessage)
        //      console.log(testScriptResponses)
        const cleanedtestScripts = testscriptGenerationSummary
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();
        testScriptSummary.push((cleanedtestScripts))


        //const automationScripts = record.automationScripts || [];


      }



      return {
        ...state,

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


        testScriptMetaData: {
          recordCount: 0,
          recordFound: false,
          timestamp: new Date().toISOString()
        }

      };
    }
  }

};