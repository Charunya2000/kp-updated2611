'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";

const envName = process.env['envName'];
const JIRA_CONFIG = {
  baseUrl: 'https://jira-aes.kp.org',
  token: process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.jira.api.key`]
};
// Index configuration for user stories
let indexName = "nps-userstory-001"

const USERSTORY_INDEX_NAME = indexName;

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
      USERSTORY_INDEX_NAME,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClient;
}


async function fetchJiraIssue(issueKey) {
  const headers = {
    'Authorization': `Bearer ${JIRA_CONFIG.token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const issueUrl = `${JIRA_CONFIG.baseUrl}/rest/api/2/issue/${issueKey}?expand=changelog,comments,renderedFields,names,transitions`;

    console.log(`[fetchJiraIssue] Fetching: ${issueUrl}`);

    const response = await fetch(issueUrl, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[fetchJiraIssue] Issue not found: ${issueKey}`);
        return null;
      }
      const errorText = await response.text();
      console.error(`[fetchJiraIssue] API Error: ${response.status} - ${errorText}`);
      throw new Error(`JIRA API error: ${response.status} ${response.statusText}`);
    }

    const issueData = await response.json();
    const fields = issueData.fields || {};

    // Try to get acceptance criteria from common custom field names
    let acceptanceCriteria = '';
    const acFieldNames = ['customfield_10004', 'customfield_10001', 'customfield_10207', 'customfield_10300'];
    for (const fieldName of acFieldNames) {
      if (fields[fieldName]) {
        acceptanceCriteria = fields[fieldName];
        break;
      }
    }
    let result = {
      summary: fields.summary || '',
      description: fields.description || '',
      acceptanceCriteria: acceptanceCriteria
    }
    return result;

  } catch (error) {
    console.error(`[fetchJiraIssue] Error fetching ${issueKey}:`, error.message);
    return null;
  }
}

async function getUSerStoryDetails(jiraId) {
  let userStoryResult = [];
  let jiraDetails = null;
  let jiraContent = null;
  //let jiraId = null;
  let releaseData = null;
  let releaseName = null;
  let isReleaseQuery = false;


  try {
    console.log('[getUserStoryMapping] Processing with User Story :', jiraId);
    // console.log('[getUserStoryMapping] Intent:', state.intent);


    // Step 1: Check if user prompt contains a JIRA ID
    // jiraId = extractJiraId(state.userPrompt);

    //if (jiraId) {
    // console.log(`[getUserStoryMapping] JIRA ID detected: ${jiraId}`);

    // Fetch complete JIRA issue details
    jiraDetails = await fetchJiraIssue(jiraId);

    if (jiraDetails) {
      console.log(`[getUserStoryMapping] JIRA details fetched for: ${jiraId}`);

      // Build searchable content from JIRA details for vector search
      jiraContent = [
        jiraDetails.summary,
        jiraDetails.description,
        jiraDetails.acceptanceCriteria
      ].filter(Boolean).join(' ');


    }

    return jiraContent
  }
  catch (error) {
    console.error(`[fetchJiraIssue] Error fetching ${issueKey}:`, error.message);
    return null;
  }

}
export async function getUserStoryMapping(state) {
  if (state.userContext != 'NEW') return {}
  console.log('[getUserStoryMapping] Starting user story search...');

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  let userStoryResult = [], testCaseResult = [], testScriptResult = []
  let prompt = state.userPrompt
  let identifer = state?.structuredMemory?.domains[state.intentRaw]?.lastIdentifier
  let jiraContent = ''
  let promptEmbed = state.promptEmbedding

  try {
    if (!identifer == '') {
      jiraContent = await getUSerStoryDetails(identifer)
      promptEmbed = await vectorizePromptNode(jiraContent);


    }
    const client = getSearchClient();
    const promptEmbedding = promptEmbed;

    if (!promptEmbedding || !Array.isArray(promptEmbedding)) {
      throw new Error('Prompt embedding not available for vector search');
    }

    // Search options for user stories
    const searchOptions = {
      select: ["id", "userstory_id", "description", "acceptance_criteria", "content"],
      top: 10,
      vectorSearchOptions: {
        queries: [{
          kind: "vector",
          vector: promptEmbedding,
          kNearestNeighborsCount: 10,
          fields: ["content_vector"]
        }]
      }
    };

    // Perform the search
    const searchResults = await client.search("*", searchOptions);

    // Collect results
    const records = [];
    for await (const result of searchResults.results) {
      records.push({
        score: result.score,
        userStoryID: result.document.userstory_id,
        userStoryDesc: result.document.description,
        acceptanceCriteria: result.document.acceptance_criteria,
        content: result.document.content,
        document: result.document
      });
    }

    // Sort by score and take top results
    userStoryResult = records
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);

    console.log(`[getUserStoryMapping] Found ${userStoryResult.length} user stories`);





    return {
      ...state,
      // indexMetadata: indexMetadata, // Pass metadata for the next search loop if needed


      userStoryMetaData: {

        records: userStoryResult,
        recordCount: userStoryResult.length,
        recordFound: userStoryResult.length > 0,
        timestamp: new Date().toISOString()
      }, jiraMetaData: jiraContent

    };
  } catch (userStoryError) {
    console.warn(' User Story Mapping query failed:', userStoryError.message);
    return {
      ...state,
      userStoryMetaData: {
        recordCount: 0,
        recordFound: false,
        timestamp: new Date().toISOString()
      },
      jiraMetaData: jiraContent


    };
  }






};