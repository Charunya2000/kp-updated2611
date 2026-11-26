'use server';

import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";
import { queryDB2 } from "../db2";
import { connectToDatabase } from '@/db/connection';
import { getSplunkLogs } from "../splunk";
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
let incidentIndexName = "nps-incident-001"


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


function getSearchClient(searchIndex) {
  if (!searchClients[searchIndex]) {
    const envName = process.env['envName'] || 'dev';
    const searchEndpoint =
      process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`];
    const searchAPIKey =
      process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aisearch.api.key`];

    if (!searchEndpoint || !searchAPIKey) {
      throw new Error("Azure Search credentials not found");
    }

    searchClients[searchIndex] = new SearchClient(
      searchEndpoint,
      searchIndex,
      new AzureKeyCredential(searchAPIKey)
    );
  }
  return searchClients[searchIndex];
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
  const searchClient = getSearchClient_();
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


async function hybridSearch({ searchText, filter, topK = 10 }, vector) {


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


  const searchClient = getSearchClient_();



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

    const searchClient = getSearchClient_();
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


// async function groupByIssueAnalysis({ groupField, filter, topK =10 },vector) {

//   const searchOptions = {
//     search: '*',
//     filter: filter || undefined,
//     top: 1000,
//     select:["number","short_description","resolution_notes","assignment_group"]

//   };




//   const searchClient = getSearchClient_();
//  const searchResults = await searchClient.search("*", searchOptions);
//  const records = [];

//  const grouped = {};

// for await (const result of searchResults.results) {



//   records.push({Description:result.document.short_description,
//     CloseNotes:result.document.resolution_notes,
//     team:result.document.assignment_group,
//     incident:result.document.number});

//   }

//   const batches = splitIntoBatches(records, 50);

// let summaryArray={}

//         for (const batch of batches) {


//  let systemPrompt= `You are an incident analysis assistant.

// You are given a batch of incident records. Each record contains a short description of an issue.

// Your task:
// 1. Group similar issues together
// 2. Identify the error type (e.g., Rating Error, Authentication, Database, User Request, Network, Others,etc.)
// 3. Create a meaningful category name based on Error Type (e.g., Missing subgroup, Missing census, Missing Rate tier, Modle Version Mismmatch, Rounding rates, Revenue Mismatch, )
// 4. Provide a concise summary of the issue
// 5. Count occurrences
// 6. Identify top impacted teams

// Return ONLY structured JSON.

// Output format:
// [
//   {
//     "error_type": "",
//     "category": "",
//     "summary": "",
//     "occurrence_count": number,
//     "teams": ["", ""]
//   }
// ]
// `
// let userContent=`Records:${batch}`

//     const messages = [
//             { role: "system", content: systemPrompt },
//             { role: "user", content: userContent },
//         ];


//       const client = await getCompletionsClient();

//         const response = await client.chat.completions.create({
//             model: "gpt-4o",
//             messages,
//             temperature: 0.7,
//             max_tokens: 6000,
//         });

//         const responseMessage = response.choices[0].message.content;

//         // Safe JSON parsing


//             const jsonMatch = /({[\s\S]*})/.exec(responseMessage);
//             let summaryData = JSON.parse(jsonMatch[1]);

//             summaryArray.push(summaryData)


// }

//   return summaryArray



// }

async function getIncidentById({ id }) {

  let filter = `number eq '${id}'`

  const searchOptions = {
    filter: filter || undefined,
    top: 1,
    includeTotalCount: true,

  };

  const searchClient = getSearchClient_();
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

//Location Metrics:

async function getLocationMetrics({ location, startDate, endDate }) {
  const records = [];
  let loc = ''
  if (location != null) { loc = location }
  const dbQuery = `
     Select count([Location]) as Location_Cnt,[Location] from (SELECT DISTINCT
    incidentA.IncidentIDSource,
    incidentA.ShortDescription,
     incidentA.[Location],
    incidentA.Priority,
    incidentA.[State],
    case when incidentA.WorkNotes like '%Prasannavenkatesan Vasudevan%' and incidentA.CMDBConfigurableItem in ('Nationally Priced Groups','NPS WebApps') then 'AD HP NPG'
        when incidentA.WorkNotes like '%Prasannavenkatesan Vasudevan%'  then 'NON-IT ACCENTURE NPS TIER 2'
        Else   COALESCE(incidentB.AssignmentGroup, incidentA.AssignmentGroup, '') END AS AssignmentGroup,
    incidentA.SysCreatedOn,
    incidentA.CloseNotes,
    incidentA.ResolvedAt,
    incidentA.Environment,
    incidentA.Description,
    incidentA.WorkNotes
  
FROM [SM_DW].[dbo].[IncidentDetail] AS incidentA
LEFT JOIN (
    SELECT IncidentIDSource, AssignmentGroup
    FROM [SM_DW].[dbo].[IncidentDetailHistory]
    WHERE AssignmentGroup IN ('AD HP NPG', 'NON-IT ACCENTURE NPS TIER 2')
      AND SysCreatedOn BETWEEN '${startDate}' AND '${endDate}'
) AS incidentB
    ON incidentA.IncidentIDSource = incidentB.IncidentIDSource
WHERE incidentA.SysCreatedOn BETWEEN  '${startDate}' AND '${endDate}'
  AND incidentA.AssignmentGroup = 'NON-IT NPS TIER 1'  and incidentA.[State] in ('Closed')
  and   incidentA.WorkNotes!='' and ('${loc}' ='' or incidentA.location in ('${loc}'))
GROUP BY
    incidentA.IncidentIDSource,
    incidentA.[Location],
    incidentA.ShortDescription,
    incidentA.Priority,
    incidentA.[State],
    incidentB.AssignmentGroup,
    incidentA.AssignmentGroup,
    incidentA.SysCreatedOn,
    incidentA.CloseNotes,
    incidentA.ResolvedAt,
    incidentA.Environment,
    incidentA.Description,
    incidentA.WorkNotes,incidentA.CMDBConfigurableItem) as t1 group by t1.Location


    `;

  const snowResult = await getSNOWRecords(dbQuery)
  //const snowData = await snowResult;
  let documents = []
  if (snowResult.length > 0) {

    for (const result of snowResult) {
      documents.push({
        Count: result.Location_Cnt,
        Location: result.Location,

        //  DateCreated:result.DateCreated

      });
    }
    records.push({ records: documents })
  }





  return records || [];
}

async function getIncidentsByLocation({ location, startDate, endDate }) {
  const records = [];
  let loc = ''
  if (location != null) {
    loc = location.map(item => `'${item}'`).join(',');
    loc = loc.replace(/^'|'$/g, '');
  }
  const dbQuery = `
     SELECT DISTINCT
    incidentA.IncidentIDSource,
    incidentA.ShortDescription,
     incidentA.[Location],
    incidentA.Priority,
    incidentA.[State],
    case when incidentA.WorkNotes like '%Prasannavenkatesan Vasudevan%' and incidentA.CMDBConfigurableItem in ('Nationally Priced Groups','NPS WebApps') then 'AD HP NPG'
        when incidentA.WorkNotes like '%Prasannavenkatesan Vasudevan%'  then 'NON-IT ACCENTURE NPS TIER 2'
        Else   COALESCE(incidentB.AssignmentGroup, incidentA.AssignmentGroup, '') END AS AssignmentGroup,
    incidentA.SysCreatedOn,
    incidentA.CloseNotes,
    incidentA.ResolvedAt,
    incidentA.Environment,
    incidentA.Description,
    incidentA.WorkNotes
   
  
FROM [SM_DW].[dbo].[IncidentDetail] AS incidentA
LEFT JOIN (
    SELECT IncidentIDSource, AssignmentGroup
    FROM [SM_DW].[dbo].[IncidentDetailHistory]
    WHERE AssignmentGroup IN ('AD HP NPG', 'NON-IT ACCENTURE NPS TIER 2')
      AND SysCreatedOn BETWEEN '${startDate}' AND '${endDate}'
) AS incidentB
    ON incidentA.IncidentIDSource = incidentB.IncidentIDSource
WHERE incidentA.SysCreatedOn BETWEEN  '${startDate}' AND '${endDate}'
  AND incidentA.AssignmentGroup = 'NON-IT NPS TIER 1'  and incidentA.[State] in ('Closed')
  and   incidentA.WorkNotes!='' and incidentA.location in ('${loc}')
GROUP BY

 incidentA.IncidentIDSource,
    incidentA.[Location],
    incidentA.ShortDescription,
    incidentA.Priority,
    incidentA.[State],
    incidentB.AssignmentGroup,
    incidentA.AssignmentGroup,
    incidentA.SysCreatedOn,
    incidentA.CloseNotes,
    incidentA.ResolvedAt,
    incidentA.Environment,
    incidentA.Description,
    incidentA.WorkNotes,incidentA.CMDBConfigurableItem


    `;

  const snowResult = await getSNOWRecords(dbQuery)
  //const snowData = await snowResult;
  let documents = []
  if (snowResult.length > 0) {

    for (const result of snowResult) {
      documents.push({
        number: result.IncidentIDSource,
        short_description: result.ShortDescription,

        location: result.Location,
        date: result.SysCreatedOn


        //  DateCreated:result.DateCreated

      });
    }
    records.push({ records: documents })
  }





  return records || [];
}


async function investigateSystemErrorIssue({ typeIdentifier, transactionId }, state) {
  console.log(`\n======================================================`);
  console.log(`[SYSTEM RATING DIAGNOSTIC] Initiating Optimized Flow...`);
  console.log(`======================================================\n`);

  // 1. AI Extraction for RQR ID & Base Instruction Set ID
  //const extracted = await extractIdsWithAI(state.userPrompt);

  targetRqrId = ""
  if (typeIdentifier == "rqr_id") { targetRqrId = transactionId }
  else { targetBaseId = transactionId }

  //(extracted.rqrId && extracted.rqrId !== "null") ? extracted.rqrId : null;
  //const targetBaseId = (extracted.baseId && extracted.baseId !== "null") ? extracted.baseId : null;

  // 2. Base ID Lookup Logic
  if (!targetRqrId && targetBaseId) {
    console.log(`[DEBUG] Base Instruction Set ID detected: ${targetBaseId}. Fetching RQR ID...`);
    try {
      const lookupRes = await queryDB2(`SELECT RQR_ID FROM ruw.RQR WHERE base_instruction_set_id = ?`, [targetBaseId]);
      if (lookupRes && lookupRes.length > 0) {
        targetRqrId = lookupRes[0].RQR_ID;
        console.log(`[DEBUG] Successfully mapped Base ID to RQR ID: ${targetRqrId}`);
      } else {
        console.error("[SYSTEM RATING ERROR] No RQR ID found for that Base Instruction Set ID.");
      }
    } catch (err) {
      console.error(`[DB ERROR] Failed to lookup RQR ID for Base ID:`, err.message);
    }
  }

  if (!targetRqrId) {
    console.log(`[DEBUG] RQR ID missing in state. AI extraction result: ${targetRqrId}`);
    return {
      ...state,
      systemRatingMetadata: { recordFound: false, error: "RQR ID or Base Instruction Set ID required." },
      databaseMetadata: { recordFound: false }
    };
  } else {
    console.log(`[DEBUG] Proceeding with RQR ID: ${targetRqrId}`);
  }



  try {
    // STEP 1: Get Quote IDs
    console.log(`[STEP 1] Fetching Quotes for RQR_ID: ${targetRqrId}`);
    const quotes = await queryDB2(`SELECT QUOTE_ID, MODEL_VERSION_BOB_ID,BOB_ID FROM ruw.quote WHERE rqr_id = ?`, [targetRqrId]);

    console.log(`[STEP 1 RESULT] Found ${quotes.length} Quotes: `, quotes);

    if (quotes.length === 0) {
      throw new Error("No RQR ID provided for System Rating Diagnostic.");
    }

    for (const quote of quotes) {
      allQuoteIds.push(quote.QUOTE_ID);
    }

    // FETCH SPLUNK LOGS
    if (allQuoteIds.length > 0) {
      console.log(`\n[SPLUNK] Fetching error logs for Quote IDs: ${allQuoteIds.join(', ')}`);
      const quoteSearchTerms = allQuoteIds.map(id => `"${id}"`).join(' OR ');
      const splunkQuery = `search index="kube_kp-hpbio-aks-nps2_phi_idx" (${quoteSearchTerms}) "success=false" | head 20`;
      console.log(`[DEBUG] --- FINAL SPLUNK SEARCH QUERY ---\n${splunkQuery}\n-----------------------------------------`);

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      try {
        // const splunkRes = await fetch(`${baseUrl}/api/nps/npschatbot/splunk`, {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ identifier: splunkQuery })
        // });
        const splunkRes = await getSplunkLogs(splunkQuery)
        const splunkData = await splunkRes.json();
        splunkLogs = splunkData.logs || splunkData.results || [];
        console.log(`[SPLUNK] Found ${splunkLogs.length} error logs.`);
      } catch (e) {
        console.error(`[SPLUNK ERROR]`, e.message);
      }
    }

    // YOUR ORIGINAL VALIDATION LOOP (WITH ALL ORIGINAL DEBUG STATEMENTS)
    //for (const quote of quotes) {
    const quotePromises = quotes.map(async (quote) => {
      const currentQuoteId = quote.QUOTE_ID;
      const modelVersionBobId = quote.MODEL_VERSION_BOB_ID;
      const actualBOBID = quote.BOB_ID;

      console.log(`\n---> PROCESSING QUOTE ID: ${currentQuoteId} <---`);
      let quoteData = { quoteId: currentQuoteId, modelVersionBobId: modelVersionBobId, actualBobId: actualBOBID };

      //   // STEP 2
      //   console.log(`[STEP 2] Running: SELECT PLAN_CATEGORY_CODE FROM ruw.quote WHERE quote_id = ? with [${currentQuoteId}]`);
      //   const res2 = await queryDB2(`SELECT PLAN_CATEGORY_CODE FROM ruw.quote WHERE quote_id = ?`, [currentQuoteId]);
      //   quoteData.planCategoryCode = res2[0]?.PLAN_CATEGORY_CODE || null;
      //   console.log(`[STEP 2 RESULT] Plan Category Code: ${quoteData.planCategoryCode}`);

      //   // STEP 3
      //   console.log(`[STEP 3] Running: SELECT PRODUCT_CODE, PRODUCT_CATEGORY_CODE FROM ruw.plan_category_product WHERE plan_category_code = ? with [${quoteData.planCategoryCode}]`);
      //   const res3 = await queryDB2(`SELECT PRODUCT_CODE, PRODUCT_CATEGORY_CODE FROM ruw.plan_category_product WHERE plan_category_code = ?`, [quoteData.planCategoryCode]);
      //   quoteData.productCode = res3[0]?.PRODUCT_CODE || null;
      //   quoteData.productCategoryCode = res3[0]?.PRODUCT_CATEGORY_CODE || null;
      //   console.log(`[STEP 3 RESULT] Product Code: ${quoteData.productCode}, Product Category: ${quoteData.productCategoryCode}`);

      //   // STEP 4
      //   console.log(`[STEP 4] Running: SELECT GROUP_ID, PROCESSING_DATE, RATING_REGION_CODE, EFF_DATE_FROM, EFF_DATE_TO FROM ruw.RQR WHERE rqr_id = ? with [${targetRqrId}]`);
      //   const res4 = await queryDB2(`SELECT GROUP_ID, PROCESSING_DATE, RATING_REGION_CODE, EFF_DATE_FROM, EFF_DATE_TO FROM ruw.RQR WHERE rqr_id = ?`, [targetRqrId]);
      //   quoteData.groupId = res4[0]?.GROUP_ID || null;
      //   quoteData.processingDate = res4[0]?.PROCESSING_DATE || null;
      //   quoteData.ratingRegionCode = res4[0]?.RATING_REGION_CODE || null;
      //   quoteData.effDateFrom = res4[0]?.EFF_DATE_FROM || null;
      //   quoteData.effDateTo = res4[0]?.EFF_DATE_TO || null;
      //   console.log(`[STEP 4 RESULT] GroupID: ${quoteData.groupId}, ProcDate: ${quoteData.processingDate}, Region: ${quoteData.ratingRegionCode}, EffFrom: ${quoteData.effDateFrom}, EffTo: ${quoteData.effDateTo}`);

      //   // STEP 5
      //   console.log(`[STEP 5] Running: SELECT MARKET_SEGMENT_CODE, LOCAL_COMMERCIAL_ELIGIBLE_NUM FROM ruw.group WHERE group_id = ? with [${quoteData.groupId}]`);
      //   const res5 = await queryDB2(`SELECT MARKET_SEGMENT_CODE, LOCAL_COMMERCIAL_ELIGIBLE_NUM FROM ruw.group WHERE group_id = ?`, [quoteData.groupId]);
      //   quoteData.marketSegmentCode = res5[0]?.MARKET_SEGMENT_CODE || null;
      //   quoteData.localCommEligibleNum = res5[0]?.LOCAL_COMMERCIAL_ELIGIBLE_NUM || null;
      //   console.log(`[STEP 5 RESULT] Market Seg: ${quoteData.marketSegmentCode}, Local Comm Num: ${quoteData.localCommEligibleNum}`);

      //   // VALIDATION 1
      //   const mainModelVersionQuery = `
      //             SELECT MV.MODEL_VERSION_ID FROM RUW.MODEL_VERSION_BOB MVB
      //             INNER JOIN RUW.MODEL_VERSION MV ON MVB.MODEL_VERSION_ID = MV.MODEL_VERSION_ID
      //             WHERE MVB.BOB_ID IN (
      //                 SELECT BOB.BOB_ID FROM RUW.BLOCK_OF_BUSINESS BOB 
      //                 INNER JOIN RUW.BOB_PRODUCT BOBPRODUCT ON BOB.BOB_ID=BOBPRODUCT.BOB_ID
      //                 INNER JOIN RUW.BOB_PRODUCT_CATEGORY BOBPRODUCTCAT ON BOB.BOB_ID=BOBPRODUCTCAT.BOB_ID
      //                 INNER JOIN RUW.BOB_MARKET_SEGMENT BOBMARKETS ON BOB.BOB_ID=BOBMARKETS.BOB_ID
      //                 WHERE BOB.VALID_DATE_FROM <= ? AND BOB.VALID_DATE_TO >= ?
      //                 AND BOBPRODUCT.PRODUCT_CODE = ? AND BOBPRODUCTCAT.PRODUCT_CATEGORY_CODE = ?
      //                 AND BOBMARKETS.MARKET_SEGMENT_CODE = ? AND BOB.GROUP_SIZE_MIN <= ?
      //                 AND BOB.GROUP_SIZE_MAX >= ? AND BOB.RATING_REGION_CODE = ?
      //             ) 
      //             AND MVB.EFF_DATE_FROM <= ? AND (MVB.EFF_DATE_TO >= ? OR MVB.EFF_DATE_TO IS NULL)
      //             AND MVB.VALID_DATE_FROM <= ? AND (MVB.VALID_DATE_TO >= ? OR MVB.VALID_DATE_TO IS NULL)
      //             ORDER BY MVB.VALID_DATE_FROM DESC FETCH FIRST 1 ROW ONLY
      //         `;
      //   const modelParams = [
      //     quoteData.processingDate, quoteData.processingDate, quoteData.productCode, quoteData.productCategoryCode,
      //     quoteData.marketSegmentCode, quoteData.localCommEligibleNum, quoteData.localCommEligibleNum, quoteData.ratingRegionCode,
      //     quoteData.effDateFrom, quoteData.effDateTo, quoteData.processingDate, quoteData.processingDate
      //   ];

      //   console.log(`[VALIDATION 1] Running Main Model Version Query with params:\n`, modelParams);
      //   const mainModelRes = await queryDB2(mainModelVersionQuery, modelParams);
      //   const calculatedModelVersionId = mainModelRes[0]?.MODEL_VERSION_ID || null;
      //   console.log(`[VALIDATION 1 RESULT] Calculated Model Version ID: ${calculatedModelVersionId}`);

      //   console.log(`[VALIDATION 1] Checking existing Model Version ID for bob_id [${modelVersionBobId}]`);
      //   const checkModelRes = await queryDB2(`SELECT MODEL_VERSION_ID FROM ruw.model_version_bob WHERE model_version_bob_id = ?`, [modelVersionBobId]);
      //   const actualModelVersionId = checkModelRes[0]?.MODEL_VERSION_ID || null;
      //   console.log(`[VALIDATION 1 RESULT] Actual Model Version ID: ${actualModelVersionId}`);

      //   quoteData.modelVersionMatch = (String(calculatedModelVersionId) === String(actualModelVersionId));
      //   quoteData.calculatedModelVersionId = calculatedModelVersionId;
      //   quoteData.actualModelVersionId = actualModelVersionId;

      //   // VALIDATION 2
      //   const mainBobQuery = `
      //             SELECT BOB.BOB_ID FROM RUW.BLOCK_OF_BUSINESS BOB 
      //             INNER JOIN RUW.BOB_PRODUCT BOBPRODUCT ON BOB.BOB_ID=BOBPRODUCT.BOB_ID
      //             INNER JOIN RUW.BOB_PRODUCT_CATEGORY BOBPRODUCTCAT ON BOB.BOB_ID=BOBPRODUCTCAT.BOB_ID
      //             INNER JOIN RUW.BOB_MARKET_SEGMENT BOBMARKETS ON BOB.BOB_ID=BOBMARKETS.BOB_ID
      //             WHERE BOB.VALID_DATE_FROM <= ? AND BOB.VALID_DATE_TO >= ?
      //             AND BOBPRODUCT.PRODUCT_CODE = ? AND BOBPRODUCTCAT.PRODUCT_CATEGORY_CODE = ?
      //             AND BOBMARKETS.MARKET_SEGMENT_CODE = ? AND BOB.GROUP_SIZE_MIN <= ?
      //             AND BOB.GROUP_SIZE_MAX >= ? AND BOB.RATING_REGION_CODE = ?
      //             FETCH FIRST 1 ROW ONLY
      //         `;
      //   const bobParams = [
      //     quoteData.processingDate, quoteData.processingDate, quoteData.productCode, quoteData.productCategoryCode,
      //     quoteData.marketSegmentCode, quoteData.localCommEligibleNum, quoteData.localCommEligibleNum, quoteData.ratingRegionCode
      //   ];

      //   console.log(`[VALIDATION 2] Running Main BOB ID Query with params:\n`, bobParams);
      //   const mainBobRes = await queryDB2(mainBobQuery, bobParams);
      //   const calculatedBobId = mainBobRes[0]?.BOB_ID || null;
      //   console.log(`[VALIDATION 2 RESULT] Calculated BOB ID: ${calculatedBobId}`);

      //   console.log(`[VALIDATION 2] Checking Quote Table BOB ID for quote [${currentQuoteId}]`);
      //   const checkBobRes = await queryDB2(`SELECT BOB_ID FROM ruw.quote WHERE quote_id = ?`, [currentQuoteId]);
      //   const actualBobId = checkBobRes[0]?.BOB_ID || null;
      //   console.log(`[VALIDATION 2 RESULT] Actual BOB ID in Quote: ${actualBobId}`);

      //   quoteData.bobIdMatch = (String(calculatedBobId) === String(actualBobId));
      //   quoteData.calculatedBobId = calculatedBobId;
      //   quoteData.actualBobId = actualBobId;

      //   diagnosticResults.push(quoteData);
      // }
      const mainQuery = `
      With cte_rqr as (SELECT GROUP_ID, PROCESSING_DATE, RATING_REGION_CODE, EFF_DATE_FROM, EFF_DATE_TO FROM ruw.rqr WHERE rqr_id = ? FETCH FIRST 1 ROW ONLY),
      cte_quote as (SELECT PLAN_CATEGORY_CODE FROM ruw.quote WHERE quote_id = ? FETCH FIRST 1 ROW ONLY),
      cte_product as ( SELECT PRODUCT_CODE, PRODUCT_CATEGORY_CODE FROM ruw.plan_category_product WHERE plan_category_code in (select PLAN_CATEGORY_CODE from cte_quote) FETCH FIRST 1 ROW ONLY),
      cte_group as ( SELECT MARKET_SEGMENT_CODE, LOCAL_COMMERCIAL_ELIGIBLE_NUM FROM ruw.group WHERE group_id in (select GROUP_ID from cte_rqr) FETCH FIRST 1 ROW ONLY), 
      cte_aMV as (SELECT MODEL_VERSION_ID as ACTUAL_MODEL_VERSIONID FROM ruw.model_version_bob WHERE model_version_bob_id = ?),
      cte_cMV as ( SELECT MV.MODEL_VERSION_ID as CALCULATED_MODEL_VERSIONID FROM RUW.MODEL_VERSION_BOB MVB INNER JOIN RUW.MODEL_VERSION MV ON MVB.MODEL_VERSION_ID = MV.MODEL_VERSION_ID WHERE MVB.BOB_ID IN ( SELECT BOB.BOB_ID FROM RUW.BLOCK_OF_BUSINESS BOB INNER JOIN RUW.BOB_PRODUCT BOBPRODUCT ON BOB.BOB_ID=BOBPRODUCT.BOB_ID INNER JOIN RUW.BOB_PRODUCT_CATEGORY BOBPRODUCTCAT ON BOB.BOB_ID=BOBPRODUCTCAT.BOB_ID INNER JOIN RUW.BOB_MARKET_SEGMENT BOBMARKETS ON BOB.BOB_ID=BOBMARKETS.BOB_ID WHERE BOB.VALID_DATE_FROM <=(select PROCESSING_DATE from cte_rqr) AND BOB.VALID_DATE_TO >= (select PROCESSING_DATE from cte_rqr) AND BOBPRODUCT.PRODUCT_CODE = (select PRODUCT_CODE from cte_product) AND BOBPRODUCTCAT.PRODUCT_CATEGORY_CODE = (select PRODUCT_CATEGORY_CODE from cte_product) AND BOBMARKETS.MARKET_SEGMENT_CODE = (select MARKET_SEGMENT_CODE from cte_group) AND BOB.GROUP_SIZE_MIN <= (select LOCAL_COMMERCIAL_ELIGIBLE_NUM from cte_group) AND BOB.GROUP_SIZE_MAX >= (select LOCAL_COMMERCIAL_ELIGIBLE_NUM from cte_group) AND BOB.RATING_REGION_CODE = (select RATING_REGION_CODE from cte_rqr) ) AND MVB.EFF_DATE_FROM <= (select EFF_DATE_FROM from cte_rqr) AND (MVB.EFF_DATE_TO >= (select EFF_DATE_TO from cte_rqr) OR MVB.EFF_DATE_TO IS NULL) AND MVB.VALID_DATE_FROM <= (select PROCESSING_DATE from cte_rqr) AND (MVB.VALID_DATE_TO >= (select PROCESSING_DATE from cte_rqr) OR MVB.VALID_DATE_TO IS NULL) ORDER BY MVB.VALID_DATE_FROM DESC FETCH FIRST 1 ROW ONLY) , 
      cte_cBOB as (SELECT BOB.BOB_ID as CALCULATED_BOBID FROM RUW.BLOCK_OF_BUSINESS BOB INNER JOIN RUW.BOB_PRODUCT BOBPRODUCT ON BOB.BOB_ID=BOBPRODUCT.BOB_ID INNER JOIN RUW.BOB_PRODUCT_CATEGORY BOBPRODUCTCAT ON BOB.BOB_ID=BOBPRODUCTCAT.BOB_ID INNER JOIN RUW.BOB_MARKET_SEGMENT BOBMARKETS ON BOB.BOB_ID=BOBMARKETS.BOB_ID WHERE BOB.VALID_DATE_FROM <= (select PROCESSING_DATE from cte_rqr) AND BOB.VALID_DATE_TO >= (select PROCESSING_DATE from cte_rqr) AND BOBPRODUCT.PRODUCT_CODE = (select PRODUCT_CODE from cte_product) AND BOBPRODUCTCAT.PRODUCT_CATEGORY_CODE = (select PRODUCT_CATEGORY_CODE from cte_product) AND BOBMARKETS.MARKET_SEGMENT_CODE = (select MARKET_SEGMENT_CODE from cte_group) AND BOB.GROUP_SIZE_MIN <= (select LOCAL_COMMERCIAL_ELIGIBLE_NUM from cte_group) AND BOB.GROUP_SIZE_MAX >= (select LOCAL_COMMERCIAL_ELIGIBLE_NUM from cte_group) AND BOB.RATING_REGION_CODE = (select RATING_REGION_CODE from cte_rqr) ) 
      select * from cte_rqr,cte_quote,cte_group,cte_product,cte_cMV,cte_aMV,cte_cBOB`
      const bobParams = [
        targetRqrId, quoteData.quoteId, quoteData.modelVersionBobId
      ];

      console.log(`[Execution] Running Main Query with params:\n`, bobParams);
      const mainRes = await queryDB2(mainQuery, bobParams);
      const calculatedBobId = mainRes[0]?.CALCULATED_BOBID || null;
      const calculatedModelVersionId = mainRes[0]?.CALCULATED_MODEL_VERSIONID || null;
      const actualModelVersionId = mainRes[0]?.ACTUAL_MODEL_VERSIONID || null;
      console.log(`[VALIDATION RESULT] Actual BOB ID: ${quoteData.actualBobId}`);
      console.log(`[VALIDATION RESULT] Calculated BOB ID: ${calculatedBobId}`);
      console.log(`[VALIDATION RESULT] Actual ModelVersion ID: ${actualModelVersionId}`);
      console.log(`[VALIDATION RESULT] Calculated ModelVersion ID: ${calculatedModelVersionId}`);
      quoteData.bobIdMatch = (String(calculatedBobId) === String(quoteData.actualBobId));
      quoteData.calculatedBobId = calculatedBobId;
      quoteData.modelVersionMatch = (String(calculatedModelVersionId) === String(actualModelVersionId));
      quoteData.calculatedModelVersionId = calculatedModelVersionId;
      quoteData.actualModelVersionId = actualModelVersionId;
      quoteData.marketSegmentCode = mainRes[0]?.MARKET_SEGMENT_CODE || null;
      quoteData.localCommEligibleNum = mainRes[0]?.LOCAL_COMMERCIAL_ELIGIBLE_NUM || null;
      quoteData.groupId = mainRes[0]?.GROUP_ID || null;
      quoteData.processingDate = mainRes[0]?.PROCESSING_DATE || null;
      quoteData.ratingRegionCode = mainRes[0]?.RATING_REGION_CODE || null;
      quoteData.effDateFrom = mainRes[0]?.EFF_DATE_FROM || null;
      quoteData.effDateTo = mainRes[0]?.EFF_DATE_TO || null;
      quoteData.productCode = mainRes[0]?.PRODUCT_CODE || null;
      quoteData.productCategoryCode = mainRes[0]?.PRODUCT_CATEGORY_CODE || null;
      quoteData.planCategoryCode = mainRes[0]?.PLAN_CATEGORY_CODE || null;

      return quoteData;
    });


    const allQuoteData = await Promise.all(quotePromises);
    //   for(const index,quoteResult in allQuoteData[0] ){
    diagnosticResults.push(...allQuoteData);//}
    //}


    // console.log(`\n======================================================`);
    console.log(`[SYSTEM RATING DIAGNOSTIC] Flow Complete.`);
    // console.log(`======================================================\n`);
  }
  catch (error) {
    console.error('\n[SYSTEM RATING ERROR]:', error);
  }
  return diagnosticResults
}

async function investigateAdminPeformanceRatingIssue({ typeIdentifier, transactionId }, state) {


  targetRqrId = ""
  if (typeIdentifier == "rqr_id") { targetRqrId = transactionId }
  //else{targetBaseId=transactionId}

  //(extracted.rqrId && extracted.rqrId !== "null") ? extracted.rqrId : null;
  //const targetBaseId = (extracted.baseId && extracted.baseId !== "null"
  console.log(`\n======================================================`);
  console.log(`[ADMIN PERF LOG] Initiating Flow...`);
  console.log(`======================================================\n`);


  if (!targetRqrId || targetRqrId == 'undefined') {
    console.error("[ADMIN PERF LOG ERROR] No RQR ID extracted.");
    return {
      ...state,
      databaseMetadata: { recordFound: false, error: "RQR ID required." },
      splunkMetadata: { recordFound: false }
    };
  }

  // const diagnosticResults = [];
  let splunkLogs = [];

  try {
    // STEP 1: Get Assigned Underwriter
    // console.log(`[STEP 1] Fetching Underwriter for RQR_ID: ${targetRqrId}`);
    //const rqrRes = await queryDB2(`SELECT ASSIGN_TO_UNDERWRITER FROM ruw.rqr WHERE rqr_id = ?`, [targetRqrId]);
    //const userId = rqrRes[0]?.ASSIGN_TO_UNDERWRITER || null;
    //console.log(`[STEP 1 RESULT] Assigned Underwriter: ${userId}`);

    //if (!userId) throw new Error("Could not find ASSIGN_TO_UNDERWRITER for this RQR ID.");

    // STEP 2: Get Quote IDs
    console.log(`[STEP 1] Fetching Quotes & Underwriter for RQR_ID: ${targetRqrId}`);
    const quotes = await queryDB2(`with cte_rqr as (SELECT ASSIGN_TO_UNDERWRITER FROM ruw.rqr WHERE rqr_id = ?), cte_quote as (SELECT QUOTE_ID FROM ruw.quote WHERE rqr_id = ?) select * from cte_rqr,cte_quote`, [targetRqrId, targetRqrId]);
    console.log(`[STEP 2 RESULT] Found ${quotes.length} Quotes.`);
    const userId = quotes[0]?.ASSIGN_TO_UNDERWRITER || null;
    console.log(`[STEP 2 RESULT] Assigned Underwriter: ${userId}`);

    if (!userId) throw new Error("Could not find ASSIGN_TO_UNDERWRITER for this RQR ID.");
    // FETCH SPLUNK LOGS
    const allQuoteIds = quotes.map(q => q.QUOTE_ID);
    if (allQuoteIds.length > 0) {
      console.log(`\n[SPLUNK] Fetching error logs for Quote IDs: ${allQuoteIds.join(', ')}`);
      const quoteSearchTerms = allQuoteIds.map(id => `"${id}"`).join(' OR ');
      const splunkQuery = `search index="kube_kp-hpbio-aks-nps2_phi_idx" (${quoteSearchTerms}) "success=false" | head 20`;

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      try {
        // const splunkRes = await fetch(`${baseUrl}/api/nps/npschatbot/splunk`, {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ identifier: splunkQuery })
        // });
        const splunkRes = await getSplunkLogs(splunkQuery)


        const splunkData = await splunkRes.json();
        splunkLogs = splunkData.logs || splunkData.results || [];
        console.log(`[SPLUNK] Found ${splunkLogs.length} error logs.`);
      } catch (e) {
        console.error(`[SPLUNK ERROR]`, e.message);
      }
    }

    // STEP 3: Validate Rate Summary Tables
    //for (const q of quotes) {
    const quotePromises = quotes.map(async (q) => {
      const quoteId = q.QUOTE_ID;
      console.log(`\n---> VALIDATING QUOTE: ${quoteId} <---`);

      // const [rateSummary, benefitPlan] = await Promise.all([
      //   queryDB2(`SELECT RATING_CALC_METHOD, CREATION_TIMESTAMP FROM ruw.rate_summary WHERE quote_id = ?`, [quoteId]),
      //   queryDB2(`SELECT RATING_CALC_METHOD, CREATION_TIMESTAMP FROM ruw.rate_summary_benefit_plan WHERE quote_id = ?`, [quoteId])
      // ]);
      const allRecords = await queryDB2(`with cte_rsummary as (SELECT RATING_CALC_METHOD, CREATION_TIMESTAMP, 'rating_summary' as tableName FROM ruw.rate_summary WHERE quote_id = ?),
             cte_rsummarybenefit as (SELECT RATING_CALC_METHOD, CREATION_TIMESTAMP,'rate_summary_benefit_plan' as tableName FROM ruw.rate_summary_benefit_plan WHERE quote_id = ?)
             select * from cte_rsummary union all select * from cte_rsummarybenefit`, [quoteId, quoteId])
      // rateSummary.forEach(r => r.tableName = 'rating_summary');
      //benefitPlan.forEach(r => r.tableName = 'rate_summary_benefit_plan');

      // const allRecords = [...rateSummary, ...benefitPlan];
      const methods = allRecords.map(r => parseInt(r.RATING_CALC_METHOD));

      const hasMethodOne = methods.includes(1);
      const hasOtherMethods = methods.some(m => [3, 7, 8, 9].includes(m));

      let quoteStatus = {
        underwriter: userId,
        quoteId: quoteId,
        quoteCreationTimestamp: '',
        methodsFound: [...new Set(methods)].sort(),
        issueFound: false,
        tableStatus: "",
        tablesWithMethod1: "",
        tablesWithoutMethod1: "",
        editLogsFound: false,
        logs: [],
        time: ''

      };

      // If it ONLY has method 1 and lacks 3, 7, 8, 9
      if (hasMethodOne && !hasOtherMethods) {
        console.log(`[STEP 3 RESULT] ISSUE DETECTED for Quote ${quoteId}. Only Method 1 found.`);
        quoteStatus.issueFound = true;
        //Check Both Tables:

        const method1Records = allRecords.filter(r => parseInt(r.RATING_CALC_METHOD) === 1);

        // 1. Figure out which tables HAVE Method 1 and which DO NOT
        const tablesWithMethod1 = [...new Set(method1Records.map(r => r.tableName))];
        const allTables = ['rating_summary', 'rate_summary_benefit_plan'];
        const tablesWithoutMethod1 = allTables.filter(t => !tablesWithMethod1.includes(t));

        if (method1Records.length === 0) {
          console.log(`[STEP 3 RESULT] No Rating Calc Method 1 found in ANY table for Quote ${quoteId}.`);
          quoteStatus.issueFound = false;
          quoteStatus.tableStatus = "Missing RATING_CALC_METHOD 1 in both tables.";
        } else {
          // 2. Log exactly which tables have the data and which are missing
          console.log(`[STEP 3 RESULT] RATING_CALC_METHOD 1 FOUND IN: ${tablesWithMethod1.join(', ')}`);
          if (tablesWithoutMethod1.length > 0) {
            console.log(`[STEP 3 RESULT] NO DATA / MISSING IN: ${tablesWithoutMethod1.join(', ')}`);
          }

          // Save this to quoteStatus so you can display it in the UI later!
          quoteStatus.tablesWithMethod1 = tablesWithMethod1;
          quoteStatus.tablesWithoutMethod1 = tablesWithoutMethod1;



          // Extract Timestamp Data
          const record1 = allRecords.find(r => parseInt(r.RATING_CALC_METHOD) === 1);
          const tsString = String(record1.CREATION_TIMESTAMP);
          quoteStatus.quoteCreationTimestamp = tsString;
          const datePart = tsString.split('T')[0];
          const hourPart = parseInt(tsString.split('T')[1].split(':')[0], 10);

          // STEP 4: Query Perf Log
          console.log(`[STEP 4] Querying perf_log_data for Date: ${datePart}, Hour: ${hourPart}`);
          const perfQuery = `SELECT TIMESTAMP, PATH_STRUTS_METHOD FROM admin.perf_log_data WHERE userid=? AND rqr_id=? AND DATE(timestamp)=? AND HOUR(timestamp)>=? ORDER BY timestamp DESC WITH UR`;
          const perfLogs = await queryDB2(perfQuery, [userId, targetRqrId, datePart, hourPart]);

          // STEP 5: Check Keywords
          const editKeywords = ['.clear', '.save', '.edit', '.rate', '.update'];
          const matchingLogs = perfLogs.filter(log => editKeywords.some(kw => log.PATH_STRUTS_METHOD?.toLowerCase().includes(kw)));

          if (matchingLogs.length > 0) {
            console.log(`[STEP 5 RESULT] Edit operations found! Count: ${matchingLogs.length}`);
            quoteStatus.editLogsFound = true;
            quoteStatus.logs = matchingLogs.map(l => l.PATH_STRUTS_METHOD);
            quoteStatus.time = matchingLogs.map(l => l.TIMESTAMP);
          } else {
            console.log(`[STEP 5 RESULT] No matching edit operations found.`);
          }
        }
      }
      else {
        console.log(`[STEP 3 RESULT] Quote ${quoteId} is OK.`);
      }

      return quoteStatus;
    });
    //  diagnosticResults.push(quoteStatus);
    const allQuoteData = await Promise.all(quotePromises);
    diagnosticResults.push(...allQuoteData);
    //}

    console.log(`\n======================================================`);
    console.log(`[ADMIN PERF LOG] Flow Complete.`);
    console.log(`======================================================\n`);


  }
  catch (error) {
    console.error('\n[Admin Performance ERROR]:', error);
  }
  return diagnosticResults
}


async function rpsStatusCheckNode({ typeIdentifier, transactionId }, state) {
  console.log(`\n======================================================`);
  console.log(`[RPS STATUS CHECK] Initiating Flow...`);
  console.log(`======================================================\n`);

  //const extracted = await extractRqrIdWithAI(state.userPrompt);
  //const targetRqrId = (extracted.rqrId && extracted.rqrId !== "null") ? extracted.rqrId : null;

  targetRqrId = ""
  if (typeIdentifier == "rqr_id") { targetRqrId = transactionId }


  if (!targetRqrId) {
    return { ...state, databaseMetadata: { recordFound: false, error: "RQR ID required." } };
  }

  try {
    // 1. Check RQR Table
    console.log(`[RPS] Fetching RQR Status for: ${targetRqrId}`);
    // NOTE: Make sure the schema (ruw.rqr or just rqr) matches your DB environment!
    const rqrRes = await queryDB2(`SELECT RQR_STATUS_CODE, EXTERNAL_RQR_ID FROM ruw.rqr WHERE rqr_id = ? WITH UR`, [targetRqrId]);

    if (rqrRes.length === 0) {
      throw new Error("No record found in RQR table for this ID.");
    }

    const statusCode = rqrRes[0].RQR_STATUS_CODE;
    const extRqrId = rqrRes[0].EXTERNAL_RQR_ID;
    console.log(`[RPS] Found: Status=${statusCode}, Ext_ID=${extRqrId}`);

    // 2. Check INTERFACE_AUDIT Table
    console.log(`[RPS] Fetching Interface Audit for Ext_ID: ${extRqrId}`);
    const auditRes = await queryDB2(`SELECT INTERFACE_TRANSACTION_TYPE, TRANSACTION_STATUS,PAYLOAD FROM ruw.INTERFACE_AUDIT WHERE EXTERNAL_TRANSACTION_ID = ? WITH UR`, [extRqrId]);

    let analysisResult = "";
    let isNegativeScenario = false;
    let extractedPayload = null;

    // 3. Evaluate the Rules
    const failedRpsrbRecord = auditRes.find(r => r.INTERFACE_TRANSACTION_TYPE === 'RPSRb' && r.TRANSACTION_STATUS === 'FAILED');
    const hasRpsraForsale = auditRes.some(r => r.INTERFACE_TRANSACTION_TYPE === 'RPSRa' && r.TRANSACTION_STATUS === 'FORSALE');

    if (failedRpsrbRecord) {
      // We still extract it so we can pass it to the UI bypass...
      extractedPayload = failedRpsrbRecord.PAYLOAD || "No payload data available in DB.";

      // ...but we REMOVE it from the analysis string so the AI doesn't have to read it!
      analysisResult = `The RQR_STATUS_CODE is ${statusCode}. The audit logs confirm RPSRb was generated with a FAILED status. Rates were not sent. Issue in NPS itself. Please check NPS logs.`;
      isNegativeScenario = true;
    } else if (hasRpsraForsale) {
      analysisResult = `The RQR_STATUS_CODE is ${statusCode}. The audit logs confirm RPSRa was generated successfully with a FORSALE status, and successful rates were sent.`;
    } else {
      analysisResult = `The RQR_STATUS_CODE is ${statusCode}. Expected RPSRb/FAILED or RPSRa/FORSALE patterns were not found in the audit logs.`;
    }
    // --- DEBUG BEACONS ---
    console.log(`\n=== DEBUG 1: RPS DB NODE ===`);
    console.log(`Is Negative Scenario? : ${isNegativeScenario}`);
    console.log(`Payload Extracted?    : ${extractedPayload ? 'YES' : 'NO'}`);
    if (extractedPayload) {
      console.log(`Payload Preview       : ${extractedPayload.substring(0, 150)}...`);
    }

    diagnosticResults.push({
      targetId: targetRqrId,
      extRqrId: extRqrId,
      statusCode: statusCode,
      auditRecords: auditRes,
      analysis: analysisResult,
      isNegativeScenario: isNegativeScenario,
      payload: extractedPayload,
      recordFound: true,
      queryType: 'RPS_STATUS_CHECK'
    })
    return diagnosticResults;

  } catch (error) {
    console.error('\n[Admin Performance ERROR]:', error);
    return diagnosticResults
  }

};


async function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}


function extractFirstJson(text) {
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.substring(start, i + 1);
      }
    }
  }

  throw new Error("No valid JSON found");
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
  if (state.structuredMemory.activeDomain == 'incident_Management') { previousIdentifier = state.structuredMemory.domains['incident_management'].lastIdentifier }


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

5) investigateSystemErrorIssue
- Used when the user refers to a system rating issues for given rqr or base instruction or workitem failing for given rqr.
- Extract typeIdentifier (rqr_id or base_instruction_id).
- Extract transaction ID exactly as provided as per below
    - Sample BASE INSTRUCTION ID -> 6117079da34a42eabe19241c52e02c00
    - Sample rqr id -> 16018369
- Extract short issue context if available (e.g., rating error, timeout).
- Do NOT generate database queries.
- Do NOT generate Splunk queries.
- Backend will handle investigation

6) investigateAdminPeformanceRatingIssue
-  If the user explicitly mentions issues like "revenue tracking not matching", "rounded rates not available", "duplicate workitem failing", "sold_process not working", "rounding error", or "admin perf log" for the given RQR ID
-  Extract typeIdentifier (rqr_id).
- Extract transaction ID exactly as provided as per below
    - Sample rqr id -> 16018369
  Extract short issue context if available (e.g., rounded rates not available, duplicate item failing).
- Do NOT generate database queries.
- Do NOT generate Splunk queries.
- Backend will handle investigation
7) rpstateucheck


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
{
  "name": "investigateSystemErrorIssue",
  "description": "Investigate rating or transaction related issues by looking up rqr id or base instruction set details in database and Splunk logs.",
  "parameters": {
    "type": "object",
    "properties": {
      "typeIdentifier": {
        "type": "string",
        "enum": ["rqr_id", "base_instruction_set_id"]
      },
      "transactionId": {
        "type": "string",
        "description": "The rqr or base instuction id mentioned by the user"
      },
      "issueContext": {
        "type": "string",
        "description": "Short description of the issue such as rating error, timeout, failure"
      }
    },
    "required": ["typeIdentifier", "transactionId"]
  }
},
{
  "name": "investigateAdminPeformanceRatingIssue",
  "description": "Investigate rounding rates or sold quote not working related issues by looking up rqr id in database and Splunk logs.",
  "parameters": {
    "type": "object",
    "properties": {
      "typeIdentifier": {
        "type": "string",
        "enum": ["rqr_id"]
      },
      "transactionId": {
        "type": "string",
        "description": "The rqr id mentioned by the user"
      },
      "issueContext": {
        "type": "string",
        "description": "Short description of the issue such as rounding rates not available, revenue tracking mismatch, sold quote not working"
      }
    },
    "required": ["typeIdentifier", "transactionId"]
  }
},
{
  "name": "rpsStatusCheck",
  "description": "Investigate issues like "status is not updated to rated" or asks why an RQR ID status is stuck..",
  "parameters": {
    "type": "object",
    "properties": {
      "typeIdentifier": {
        "type": "string",
        "enum": ["rqr_id"]
      },
      "transactionId": {
        "type": "string",
        "description": "The rqr id mentioned by the user"
      },
      "issueContext": {
        "type": "string",
        "description": "Short description of the issue like "status is not updated to rated" or asks why an RQR ID status is stuck."
      }
    },
    "required": ["typeIdentifier", "transactionId"]
  }
},
{
  "name": "getLocationMetrics",
  "description": "Extract incident counts grouped by location for a specified date range. Convert relative date expressions such as 'April month', 'last 2 months', 'this month', or 'last quarter' into explicit date boundaries based on the current date available in the system prompt.",
  "parameters": {
    "type": "object",
    "properties": {
      "startDate": {
        "type": "string",
        "description": "Start date in YYYY-MM-DD format. Derived from the user's requested time period."
      },
      "endDate": {
        "type": "string",
        "description": "Exclusive end date in YYYY-MM-DD format. Derived from the user's requested time period."
      },
      "location": {
        "type": "string",
        "description": "Optional location filter provided by the user. If omitted, return counts for all locations."
      }
    },
    "required": ["startDate", "endDate"]
  }
},
{
  "name": "getIncidentsByLocation",
  "description": "Extract incident list for one or more locations. If the user provides a date expression such as 'April month', 'last 2 months', 'this month', or 'last quarter', convert it into explicit startDate and endDate values based on the current date available in the system prompt. If the user does not provide a date range, do not populate startDate or endDate and use the previously available date range context.",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "One or more locations provided by the user. Always return as an array, even if only one location is provided."
      },
      "startDate": {
        "type": "string",
        "description": "Optional start date in YYYY-MM-DD format. Populate only when the user provides a date range or relative date expression."
      },
      "endDate": {
        "type": "string",
        "description": "Optional exclusive end date in YYYY-MM-DD format. Populate only when the user provides a date range or relative date expression."
      }
    },
    "required": ["location"]
  }
}
]



OUTPUT SCHEMA (MANDATORY)

{
  "name": "<tool_name>",
  "arguments": {}
}


IMPORTANT:
- Tool schema uses "parameters"
- Runtime tool call MUST use "arguments"
- Never output "parameters" in the response
- The response MUST contain exactly one root JSON object.
- The response MUST NOT contain newline separated JSON objects.
- The response MUST NOT contain a JSON array.
- The response MUST NOT contain multiple tool calls.
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
    max_tokens: 5000,
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

    const jsonMatch = extractFirstJson(responseMessage);
    parsedSearchIntent = JSON.parse(jsonMatch);

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
    case "investigateSystemErrorIssue":
      // await investigateSystemErrorIssue_Dummy(parsedSearchIntent.parameters,state);
      await investigateSystemErrorIssue(parms, state);
      //result=await hybridSearch({"searchText":state.userPrompt,"filter":'',},state.promptEmbedding);
      break;
    case "investigateAdminPeformanceRatingIssue":
      await investigateAdminPeformanceRatingIssue(parms, state);
      // result=await hybridSearch({"searchText":state.userPrompt,"filter":'',},state.promptEmbedding);
      break;

    case "rpsStatusCheck":
      await rpsStatusCheckNode(parms, state);
      break;

    case "getLocationMetrics":
      result = await getLocationMetrics(parms);
      break;

    case "getIncidentsByLocation":
      result = await getIncidentsByLocation(parms);
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



    const { indexMetadata } = state;
    const indexName = indexMetadata.indexName;
    //if(state.searchResults.items && indexMetadata.indexName=="bcs-incident-001" ) return {}
    if (indexMetadata.indexName == incidentIndexName) {
      [results, parms, parsedSearchIntent] = await searchIncidentNode(state)

    }
    else {
      if (!indexMetadata?.indexName) {
        throw new Error("indexMetadata.indexName is required");
      }


      const searchClient = getSearchClient(indexName);

      console.log(`[searchIndexNode] Index: ${indexName}`);

      const {
        searchQueryString,
        selectedFields,
        searchFields,
        filter,
        top = 10,
        count = true,
        vectorSearch,
        semanticSearch,
        orderBy
      } = indexMetadata;

      const searchOptions = { includeTotalCount: count };

      if (selectedFields?.length) searchOptions.select = selectedFields;
      if (searchFields?.length) searchOptions.searchFields = searchFields;
      if (filter) searchOptions.filter = filter;
      if (typeof top === "number") searchOptions.top = top;
      if (orderBy) searchOptions.orderBy = orderBy;

      /* ==========================================
         PRIMARY SEARCH
      ========================================== */
      const searchResults = await searchClient.search(
        searchQueryString || "*",
        searchOptions
      );


      for await (const r of searchResults.results) {
        results.push({
          score: r.score,
          rerankerScore: r.rerankerScore,
          vectorScore: r.vectorScore,
          document: r.document
        });
      }

      console.log(`[searchIndexNode] Results with filter: ${results.length}`);
    }
    /* ==========================================
       INCIDENT-ONLY FALLBACK (SAFE)
    ========================================== */
    if (
      indexName === incidentIndexName &&
      results.length === 0 && diagnosticResults.length === 0
      && splunkLogs.length == 0
    ) {
      console.warn(
        "[searchIndexNode] No exact ID match. Running semantic fallback search."
      );
      results = await hybridSearch({ filter: '' }, state.promptEmbedding)
      // const semanticOptions = {
      //     includeTotalCount: true,
      //     top: 5,
      //     queryType: "semantic",
      //     semanticSearchOptions: {
      //         configurationName:
      //             semanticSearch?.configuration || "default"
      //     },
      //     queryLanguage: "en-us"
      // };

      // if (vectorSearch?.enabled && state.promptEmbedding) {
      //     semanticOptions.vectorSearchOptions = {
      //         queries: [
      //             {
      //                 kind: "vector",
      //                 vector: state.promptEmbedding,
      //                 fields: [vectorSearch.field],
      //                 kNearestNeighborsCount:
      //                     vectorSearch.nearestNeighbors || 5
      //             }
      //         ]
      //     };
      // }

      // // 🔥 FIX: renamed variable to avoid TDZ error
      // const semanticSearchResults = await searchClient.search(
      //     searchQueryString || "*",
      //     semanticOptions
      // );

      // for await (const r of semanticSearchResults.results) {
      //     results.push({
      //         score: r.score,
      //         rerankerScore: r.rerankerScore,
      //         vectorScore: r.vectorScore,
      //         document: r.document
      //     });
      // }

      // console.log(
      //     `[searchIndexNode] Results after fallback: ${results.length}`
      // );
    }

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
    if (indexName === incidentIndexName && results.length > 0) {
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