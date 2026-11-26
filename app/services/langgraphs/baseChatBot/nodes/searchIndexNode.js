'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";

import { connectToDatabase } from '@/db/connection';
import { getSNOWRecords } from "../querySNOW";
import { chatCompletion } from "@/app/services/chatCompletionService2";

/* ==========================================
   SEARCH CLIENT CACHE
========================================== */
const searchClients = {};
let completionsClient = null;
let diagnosticResults = [];
let allQuoteIds = [];
let splunkLogs = [];
let targetRqrId = ""
let targetBaseId = ""
let incidentIndexName = "bcs-incident-001"


let searchClient = null;
function getSearchClient_() {
  if (!searchClient) {
    const envName = process.env['envName'] || 'dev';
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

    if (!searchEndpoint || !searchAPIKey) {
      throw new Error('Azure Search credentials not found in environment variables');
    }

    searchClient = new SearchClient(
      searchEndpoint,
      incidentIndexName,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClient;
}

function getSearchClient(indexName) {
  if (!searchClient) {
    const envName = process.env['envName'] || 'dev';
    const searchEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint.new.t3`];
    const searchAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.new.t3.api.key`];

    if (!searchEndpoint || !searchAPIKey) {
      throw new Error('Azure Search credentials not found in environment variables');
    }

    searchClient = new SearchClient(
      searchEndpoint,
      indexName,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClient;
}


function splitIntoBatches(array, batchSize = 50) {
  const batches = [];

  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }

  return batches;
}

async function aggregateMetric({ aggregationType, filter }) {
  if (aggregationType !== "count") {
    throw new Error("Only count aggregation supported");
  }
  const searchOptions = {
    search: "*",
    filter: filter || undefined,
    top: 0,
    includeTotalCount: true
  };
  const searchClient = getSearchClient(incidentIndexName);
  const searchResults = await searchClient.search("*", searchOptions);

  const records = [];

  const data = await searchResults.count;
  records.push({ filter: filter, records: data });

  // if(data==1){
  //   const searchOptions = {
  //     search: "*",
  //     filter: filter || undefined,
  //     top: 1,

  //   };

  //   const searchClient = getSearchClient();
  //  const searchResults = await searchClient.search("*", searchOptions);

  //   for await (const result of searchResults.results) {
  //      records.push({result
  //      });
  //    }
  // }

  return records;
}


async function hybridSearch({ searchText, filter, topK = 3 }, vector) {


  const searchOptions = {
    top: topK,
    filter: filter || undefined,
    includeTotalCount: true,
    select: ["content", "number", "short_description", "priority", "state"],
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


  const searchClient =getSearchClient(incidentIndexName);



  const searchResults = await searchClient.search('*', searchOptions);
  const records = [];
  const total_records = await searchResults.count
  // records.push({score: '',
  //                 rerankerScore: '',
  //                 vectorScore:'',
  //                 document: {recordsCount:total_records}});

  for await (const r of searchResults.results) {
    records.push({
      score: r.score,
      rerankerScore: r.rerankerScore,
      vectorScore: r.vectorScore,
      document: r.document
    });

  }


  return records || [];
}


function normalizeToArray(input) {
  if (Array.isArray(input)) return input;

  if (typeof input === "string") return input.split(",");

  if (typeof input === "object" && input !== null) {
    return Object.values(input);
  }

  return [];
}
async function groupByAnalysis({ groupField, dataBucketMonths, filter, topK = 10 }, vector) {

  const searchOptions = {
    search: '*',
    filter: filter || undefined,
    top: 1000,
    select: ['number', groupField]

  };
  const records = [];
  let dateRange = normalizeToArray(dataBucketMonths);
  if (groupField == 'short_description') {

    const db = await connectToDatabase('team-nps-db');
    const collection = db.collection('NPS_IncidentAnalytics');
    const analyticsResult = await collection
      .find({
        date_bucket: { $in: dateRange }
      }).toArray();


    for await (const r of analyticsResult) {
      records.push({
        category: r.category,
        error_type: r.error_type,
        occurrence_count: r.occurrence_count,
        summaries: r.summaries,
        incidents: r.incidents,
        dateRange: r.date_bucket

      });

    }
  }
  else {

    const searchClient = getSearchClient(incidentIndexName);
    const searchResults = await searchClient.search("*", searchOptions);


    const grouped = {};

    for await (const result of searchResults.results) {
      const doc = result.document;
      const key = doc[groupField] || "Unknown";

      grouped[key] = (grouped[key] || 0) + 1;
    }

    records.push({ filter: filter + ' and GroupBy Field: ' + groupField, records: grouped });
  }
  return records
}



async function getIncidentById({ id }) {

  let filter = `number eq '${id}'`

  const searchOptions = {
    filter: filter || undefined,
    top: 1,
    includeTotalCount: true,

  };

  const searchClient = getSearchClient(incidentIndexName);
  const searchResults = await searchClient.search("*", searchOptions);
  const records = [];
  const total_records = await searchResults.count

  if (total_records > 0) {
    let document = []
    for await (const r of searchResults.results) {

      document.push({ document: r.document });


    }

    records.push({ records: document })
  }

  else {
    const dbQuery = `select distinct IncidentIDSource,ShortDescription,Priority,[State],AssignmentGroup,SysCreatedOn,CloseNotes,ResolvedAt,WorkNotes from [SM_DW].[dbo].[IncidentDetail] where IncidentIDSource='${id}'`;

    const snowResult = await getSNOWRecords(dbQuery)
    //const snowData = await snowResult;
    let documents = []
    if (snowResult.length > 0) {

      for (const result of snowResult) {
        documents.push({
          number: result.IncidentIDSource,
          short_description: result.ShortDescription,
          state: result.State,
          priority: result.Priority,
          content: `Created Date: ${result.SysCreatedOn}, AssignmentGroup:${result.AssignmentGroup}, WorkNotes: ${result.WorkNotes}`,
          notes: result.CloseNotes
          //  DateCreated:result.DateCreated

        });
      }
      records.push({ records: documents })
    }

  }



  return records || [];
}








async function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
async function searchIncidentNode(state) {
  //let analyticsContext={}
  const currentDate = new Date().toString();
  let parms = {};
  let parsedSearchIntent;
  let currentAssistantResponse = '';
  let vectorEmbedding = state.promptEmbedding;
  if (state.userContext == 'FOLLOW_UP') {
    if (state.chatNewResponseSummary != '') {
      vectorEmbedding = await vectorizePromptNode(state.chatNewResponseSummary);

    }

  }

  //  const systemPrompt = config?.configurable?.userIntent?.intentMessage?.content || `
  let previousIdentifier = ''
  if (state.structuredMemory.activeDomain == 'incident_management') { previousIdentifier = state.structuredMemory.domains['incident_management'].lastIdentifier }


  let systemPrompt = `

You are an Incident Analytics Tool Router.

Your job is to analyze the user question and decide which tool to call based on details provided. Final tool call will be only one. 
You must always return only one tool call when analytics, filtering, counting, grouping, or searching is required.

Current Date: ${currentDate}

You are NOT allowed to:
- Perform mathematical calculations
- Estimate counts
- Hallucinate numbers
- Invent fields

Current Input query (This will be NEW request or FOLLOW-UP): ${state.userContext} 
Previous Tool and Filter Query available below. 
    Filter:${state.analyticsContext?.baseFilter?.filter}. 
    Tool:${state.analyticsContext?.lastTool}. 

    - If previous query filter and tool is provided and user asks a refinement question, you must reuse the previous filter and extend it.
    - If previous query filter and tool is undefined, ignore this details on evaluation



    You can ONLY use the following index fields:
-------------------------------------------------
INCIDENT INDEX SCHEMA (IMPORTANT)
-------------------------------------------------
Fields available:

- number (filterable, searchable)
- short_description (searchable)
- priority (filterable, searchable)
- resolution_notes (searchable)
- resolved (filterable, sortable)
- description (searchable)
- work_notes (searchable)
- content (searchable)
- content_vector (searchable, vectorized)
- assignment_group  (filterable, searchable)


Filtering Rules:
- Only "resolved", "assignment_group" and "priority" can be used in OData filters.
- Date filters must use ISO 8601 format.
- Use operators: ge, le, eq, ne
- Combine filters using "and"

Examples:
Last month:
resolved ge 2026-01-01T00:00:00Z and resolved le 2026-01-31T23:59:59Z

High priority: priority eq '2 - High'
Low priority: priority eq '4 - Low'
Critical: priority eq '1 - Critical'
Medium: priority eq '3 - Medium'

assignment_group: Always use three values 'AD HP NPG', 'NON-IT ACCENTURE NPS TIER 2','NON-IT NPS TIER 1'.
Always 

Available Tools:

1) aggregateMetric
- Used for counts and total number queries.
- Used for Counts based on dates or general
- Only aggregationType = "count" is allowed.
-  If user asks for:
   - average
   - total
   - count
   - minimum
   - maximum
   - resolution time metrics

  
2) groupByAnalysis
- Used for grouping and finding repeating incidents.
- Allowed groupField values: priority, short_description,assignment_group
- If user asks for 
   - repeating incidents
   - most common category
   - incidents by priority
   - incident by assignment group/assigned group/group
   - distribution by assigned group

3) hybridSearch
- Used for RCA lookup, functional issues, semantic similarity queries.
- Uses vector search on context field
- USed for count of incidents based on functional issues reported only
- Can optionally include filters on resolved or priority.
- If user asks for:
   - payment related issues
   - timeout incidents
   - RCA for functional issue
   - resolution guidance
   - any issues related to functional

4) getIncidentById
- Used when user refers to a specific incident ID.
- Example: "Summarize incident INC12345"
- Example: "What RCA was done for INC56789?"
- Example: "Preventive action for INC10001"
- Must extract exact incident ID from user question.
- Must pass only the ID value in arguments.

Decision Logic:
If question involves:
- "how many", "count", "total", "aging" → use aggregateMetric
- "repeating", "most common", "top issues", → use groupByAnalysis
- "RCA", "functional issue", "payment timeout", "similar incidents", "summary" → use hybridSearch
- If semantic meaning is required → use hybridSearch
- If the user explicitly mentions an incident ID (pattern like INC followed by numbers),you MUST call getIncidentById.
- If the user question contains:
    - "rqr_id <id>"
    - "base_instruction_id <id>"
    - and mentions rating error, timeout, failure, processing issue 
    - You MUST call investigateSystemErrorIssue.
    - Do NOT use hybridSearch for these transactional investigations.
- Do NOT use hybridSearch for direct ID lookup.
- Do NOT use aggregateMetric for ID-specific queries.

Incident ID Rules:
- Incident IDs start with "INC" followed by alphanumeric characters.
- Extract the exact ID from the user question.
- Do not modify or partially match the ID.
- Pass the ID exactly as provided.

If user mentions time periods like:
- "last month"
- "last 3 months"
- "this year"
Convert them into proper resolved date filters.


Tool Schema:
[
{
  "name": "aggregateMetric",
  "description": "Compute aggregate metrics on incidents",
  "parameters": {
    "type": "object",
    "properties": {
      "aggregationType": {
        "type": "string",
        "enum": ["count"]
      },
      "filter": {
        "type": "string",
        "description": "Azure AI Search OData filter using resolved and priority fields"
      }
    },
    "required": ["aggregationType"]
  }
},
{
  "name": "groupByAnalysis",
  "description": "Group incidents by a field and return counts",
  "parameters": {
    "type": "object",
    "properties": {
      "groupField": {
        "type": "string",
        "enum": ["priority", "short_description","assignment_group"]
      },
      
        "dataBucketMonths": {
        "type": "array",
        "items": {
            "type": "string",
            "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$"
        },
        "description": "List of month buckets in YYYY-MM format"
        },

      "filter": {
        "type": "string",
        "description": "Azure AI Search OData filter"
      },
      "topN": {
        "type": "number",
        "description": "Limit number of groups returned"
      }
    },
    "required": ["groupField","dataBucketMonths"]
  }
},
  
{
  "name": "hybridSearch",
  "description": "Perform hybrid search on incident index using vector search on context field and optional filters",
  "parameters": {
    "type": "object",
    "properties": {
      "searchText": {
        "type": "string"
      },
      "filter": {
        "type": "string",
        "description": "Optional OData filter using resolved or priority"
      },
      "topK": {
        "type": "number"
      }
    },
    "required": ["searchText"]
  }
},
{
  "name": "getIncidentById",
  "description": "Retrieve a single incident by its exact ID. Used when the user asks about a specific incident such as summary, RCA, resolution, or preventive actions.",
  "parameters": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "Exact incident ID (e.g., INC12345)"
      }
    },
    "required": ["id"]
  }
},
]


IMPORTANT:
- Tool schema uses "parameters"
- Runtime tool call MUST use "arguments"
- Never output "parameters" in the response
- Return exactly ONE JSON object
- Do NOT repeat the tool call
- Do NOT add explanations or additional text
- Return exactly ONE tool call and STOP immediately.
- Example: 
    {
      "name": "groupByAnalysis",
      "arguments": {
        "groupField": "assignment_group",
        "dataBucketMonths": ["2026-01"],
        "filter": "resolved ge 2026-01-01T00:00:00Z and resolved le 2026-01-31T23:59:59Z"
      }
    }


STRICT RULE for Leap Year on date filter: 
- Check if the current Year from ${currentDate} date is Leap year.
- If 2026 is current year, it is not leap year so, February has only 28 dates. Filter should be resolved le 2026-02-28T23:59:59Z for end date any if needed
- If 2024 is current year, it is leap year so, February has 29 dates. Filter should be resolved le 2024-02-29T23:59:59Z for end date any if needed
- Ex: "resolved ge 2025-12-01T00:00:00Z and resolved le 2026-02-28T23:59:59Z" - If Not a leap Year fir last 3 months filter query

FallBack Logic:
- Always output should in JSON with only one tool schema
- If follow-up request, no new new identifer is provided, only then use the previous identifier : ${previousIdentifier}
- Use Hybrid Search for general queries like rating issue, sold issue, rate not working or other general queries
- Use HybridSearch if you could not determine which one to choose



If query asks for specific items from a grouped category → use search tool with filter like hyrbid search, not groupBy.


`;

  let messages = []
  if (state.userContext == 'FOLLOW_UP' && state.chatResponse?.content != '') {
    systemPrompt = systemPrompt + `
Use Below Context only when 
    - it is a Follow_Up request related to specific issue like RCA,resolution, analysis AND
    - last tool was related to  (investigateSystemErrorIssue or investigateAdminPeformanceRatingIssue ) AND
    - if no new identifier is provided -> then No change in identifier, so last tool (investigateSystemErrorIssue or investigateAdminPeformanceRatingIssue ) cannot be used as already analysis is done AND
    - Use Hybrid search with below 
         Initial Context Summary of Analysis: ${state.chatNewResponseSummary}.

If Follow_Up request was related to metric or groupByanalysis, use them appropriately.
`
    messages = [
      { role: "system", content: systemPrompt },
      // { role: "user", content: state.userPrompt+"\n\n"+state.chatResponse?.content },
      { role: "user", content: state.userPrompt },
    ];

  }
  else {

    messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: state.userPrompt },
    ];

  }
  let tokenCnt = await estimateTokens(systemPrompt)
  tokenCnt = await estimateTokens(state.userPrompt)



  const completionConfig = {
    temperature: 0,
    max_tokens: 3500,
    model: "gpt-4o",
    messages: messages,

    teamName: state?.teamName,
    assistantName: state?.assistantName,
    nuid: state?.nuid
  };

  const response = await chatCompletion(completionConfig);
  const responseMessage = response//.choices[0].message.content;

  // Safe JSON parsing

  try {
    const jsonMatch = /({[\s\S]*})/.exec(responseMessage);
    parsedSearchIntent = JSON.parse(jsonMatch[1]);
  } catch (catchErr) {
    parsedSearchIntent = {};
  }
  let result = []
  if (parsedSearchIntent.arguments.properties) {
    parms = parsedSearchIntent.arguments.properties
  }
  else { parms = parsedSearchIntent.arguments }

  console.log(`[searchIndexNode] Tool Called: ${parsedSearchIntent.name}`);
  switch (parsedSearchIntent.name) {

    case "aggregateMetric":

      result = await aggregateMetric(parms);
      break;

    case "groupByAnalysis":
      result = await groupByAnalysis(parms);
      break;

    case "hybridSearch":
      result = await hybridSearch(parms, vectorEmbedding);
      break;
    case "getIncidentById":
      result = await getIncidentById(parms);
      break;
    default:
      return 'Invalid';
  }

  return [result, parms, parsedSearchIntent.name];

}


/* ==========================================
   MAIN NODE
========================================== */
export const searchIndexNode = async (state) => {
  try {



    diagnosticResults = [];
    allQuoteIds = [];
    splunkLogs = [];
    targetRqrId = ""
    targetBaseId = ""
    if (state.userContext == 'FOLLOW_UP' && state.analyticsContext?.lastTool != 'investigateAdminPeformanceRatingIssue' && state.analyticsContext?.lastTool != 'investigateSystemErrorIssue') return {}
    // if(state.userContext!='NEW')return{}
    if (state.userContext == 'FOLLOW_UP' && state.intentRaw == 'knowledge_base') return {}
    let results = [];
    let parms;
    let parsedSearchIntent;



    [results, parms, parsedSearchIntent] = await searchIncidentNode(state)



    //   const searchClient = getSearchClient(incidentIndexName);

    //   console.log(`[searchIndexNode] Index: ${incidentIndexName}`);

    //   const {
    //     searchQueryString,
    //     selectedFields,
    //     searchFields,
    //     filter,
    //     top = 10,
    //     count = true,
    //     vectorSearch,
    //     semanticSearch,
    //     orderBy
    //   } = indexMetadata;

    //   const searchOptions = { includeTotalCount: count };

    //   if (selectedFields?.length) searchOptions.select = selectedFields;
    //   if (searchFields?.length) searchOptions.searchFields = searchFields;
    //   if (filter) searchOptions.filter = filter;
    //   if (typeof top === "number") searchOptions.top = top;
    //   if (orderBy) searchOptions.orderBy = orderBy;

    //   /* ==========================================
    //      PRIMARY SEARCH
    //   ========================================== */
    //   const searchResults = await searchClient.search(
    //     searchQueryString || "*",
    //     searchOptions
    //   );


    //   for await (const r of searchResults.results) {
    //     results.push({
    //       score: r.score,
    //       rerankerScore: r.rerankerScore,
    //       vectorScore: r.vectorScore,
    //       document: r.document
    //     });
    //   }

    //   console.log(`[searchIndexNode] Results with filter: ${results.length}`);

    // /* ==========================================
    //    INCIDENT-ONLY FALLBACK (SAFE)
    // ========================================== */
    // if (

    //   results.length === 0 && diagnosticResults.length === 0
    //   && splunkLogs.length == 0
    // ) {
    //   console.warn(
    //     "[searchIndexNode] No exact ID match. Running semantic fallback search."
    //   );
    //   results = await hybridSearch({ filter: '' }, state.promptEmbedding)
    //   // const semanticOptions = {
    //   //     includeTotalCount: true,
    //   //     top: 5,
    //   //     queryType: "semantic",
    //   //     semanticSearchOptions: {
    //   //         configurationName:
    //   //             semanticSearch?.configuration || "default"
    //   //     },
    //   //     queryLanguage: "en-us"
    //   // };

    //   // if (vectorSearch?.enabled && state.promptEmbedding) {
    //   //     semanticOptions.vectorSearchOptions = {
    //   //         queries: [
    //   //             {
    //   //                 kind: "vector",
    //   //                 vector: state.promptEmbedding,
    //   //                 fields: [vectorSearch.field],
    //   //                 kNearestNeighborsCount:
    //   //                     vectorSearch.nearestNeighbors || 5
    //   //             }
    //   //         ]
    //   //     };
    //   // }

    //   // // 🔥 FIX: renamed variable to avoid TDZ error
    //   // const semanticSearchResults = await searchClient.search(
    //   //     searchQueryString || "*",
    //   //     semanticOptions
    //   // );

    //   // for await (const r of semanticSearchResults.results) {
    //   //     results.push({
    //   //         score: r.score,
    //   //         rerankerScore: r.rerankerScore,
    //   //         vectorScore: r.vectorScore,
    //   //         document: r.document
    //   //     });
    //   // }

    //   // console.log(
    //   //     `[searchIndexNode] Results after fallback: ${results.length}`
    //   // );
    // }

    /* ==========================================
       SORT & TRIM
    ========================================== */
    if (results.length > 10) {
      results = results
        .sort((a, b) => (b.rerankerScore || b.score || 0) -
          (a.rerankerScore || a.score || 0))
        .slice(0, 10);
    }

    /* ==========================================
       DEBUG SCORES
    ========================================== */
    if (results.length > 0) {
      console.log("[searchIndexNode] Final Ranked Results:");
      if (results[0].document) {
        results.forEach((r, i) => {
          console.log(
            `#${i + 1}`,
            "score=", r.score,
            "reranker=", r.rerankerScore,
            "vector=", r.vectorScore,
            "incident=", r.document?.number
          );
        });
      }
    }

    const indexHit = results.length > 0;

    return {
      ...state,
      analyticsContext: {
        baseFilter: parms,
        lastTool: parsedSearchIntent
      },
      searchResults: {
        totalCount: results.length,
        items: results
      },
      indexHit,
      searchSuccess: true,

      databaseMetadata: {
        targetId: targetRqrId,
        records: diagnosticResults,
        recordFound: diagnosticResults.length > 0,
        queryType: 'SYSTEM_RATING_DIAGNOSTIC/AdminPerfLog'
      },
      splunkMetadata: {
        logs: splunkLogs,
        timelineLogs: [],
        query: "System Rating Splunk Query",
        recordFound: splunkLogs.length > 0
      }
    };

  } catch (error) {
    console.error("Error in searchIndexNode:", error);
    return {
      ...state,
      searchResults: { totalCount: 0, items: [] },
      indexHit: false,
      searchSuccess: false,
      error: error.message,
      databaseMetadata: { recordFound: false },
      splunkMetadata: { recordFound: false }
    };
  }
};