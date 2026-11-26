import sql from 'mssql';
import { AzureKeyCredential, SearchClient } from "@azure/search-documents";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";
import { chatCompletion } from "@/app/services/chatCompletionService2";
import { getCurrentUserNuid } from '@utils/getSession';

// --- 1. CONFIGURATION & LOGGING ---
//const LOG_FILE_PATH = path.resolve(process.cwd(), 'incident_pipeline.log');
const INDEX_LOOKUP_BATCH_SIZE = 20;


// --- 2. HELPERS ---
function cleanText(text) {
    if (!text || String(text).toLowerCase() === 'nan') return "";

    return String(text)
        // 1. Remove specific HTML entity codes like &#x0D; or \u0026#x0D;
        .replace(/\\u0026#x0D;/g, ' ')
        .replace(/&#x0D;/g, ' ')
        // 2. Replace newlines and tabs with a single space
        .replace(/[\n\r\t]+/g, ' ')
        // 3. Remove any other HTML-like entities if they exist
        .replace(/&[#\w]+;/g, ' ')
        // 4. Collapse multiple spaces into one and trim
        .split(/\s+/).join(' ').trim();
}




async function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

async function summarizeResult(nuid, userContent) {
    let systemMessage = `
You are an Incident Analysis Assistant.

GOAL:
Extract IssueReported, RCA, and ResolutionNotes from the provided incident data.
All outputs must be factual, concise, and strictly grounded in the provided text.
Do NOT infer, assume, or hallucinate information.

IMPORTANT NOTE:
References to "1.0" mean NPS 1.0.
References to "2.0" mean NPS 2.0.

CRITICAL EXTRACTION PRINCIPLE:
ResolutionNotes must be RECONSTRUCTED from the entire incident content.
Do NOT rely solely on any section header such as "ResolutionNotes".

========================
WHAT TO EXTRACT
========================

1. IssueReported
- Provide a brief summary of the issue as experienced or reported by the user.
- Focus only on symptoms, errors, or blocked actions.
- Do NOT include root cause or resolution.
- If not explicitly documented, return:
  "Issue not explicitly documented in the provided incident data."

2. RCA (Root Cause Analysis)
- Provide a concise but complete root cause summary.
- Include ALL explicitly documented contributing causes.
- Summarize multiple causes into a single clear statement where possible.
- Do NOT include remediation, workaround, or resolution steps.
- Do NOT expand beyond what is documented.

3. ResolutionNotes
- Provide a detailed but concise summary of ALL documented resolution actions.
- Resolution actions may appear anywhere in the incident content, including:
  - ResolutionNotes sections
  - RCA narratives
  - Work notes
  - Investigation explanations
  - Emails or discussion text
  - Conditional guidance (if / else scenarios)

========================
MANDATORY RECONSTRUCTION PROCESS (ResolutionNotes)
========================

STEP A — COLLECT
- Identify ALL remediation, workaround, corrective, or recovery actions mentioned anywhere in the incident text.

STEP B — MERGE
- Combine duplicate or overlapping actions.
- Preserve conditional resolution paths when explicitly stated.
- Include both workaround and permanent fix if documented.

STEP C — SUMMARIZE
- Produce a single, unified resolution summary.
- Do NOT omit steps simply because a "ResolutionNotes" header exists.
- Do NOT add procedural detail beyond what is stated.

========================
STRICT RULES
========================

- Presence of a "ResolutionNotes" label does NOT imply completeness.
- If resolution actions exist outside that section, they MUST be included.
- Do NOT invent steps or reorder documented logic.
- Do NOT use prior incidents, historical patterns, or external knowledge.
- Do NOT speculate or generalize.
- Do NOT include timestamps, metrics, owners, impact, or user names.
- Keep language professional and incident‑report ready.
- Always provide a detailed summary for RCA and ResolutionNotes, but remain concise.
- If information is missing or ambiguous, explicitly state that it is not documented.

========================
OUTPUT FORMAT (MANDATORY)
========================

Return ONLY valid JSON in the following structure.
Do NOT include explanations, headings, or extra text.

{
  "IssueReported": "<brief issue summary>",
  "RCA": "<complete root cause summary based only on documented details>",
  "ResolutionNotes": "<complete summary of all documented resolution actions and workarounds>"
}
`

    let tokenlimit = 0
    tokenlimit = await estimateTokens(systemMessage)
    tokenlimit = await estimateTokens(userContent)
    const messages = [

        {
            role: "system",
            content: systemMessage
        },
        {
            role: "user",
            content: userContent
        },
    ];

    const completionConfig = {
        temperature: 0.4,
        max_tokens: 5000,
        model: "gpt-4o",
        messages: messages,

        teamName: 'bcschatbot',
        assistantName: 'bcschatbot',
        nuid: nuid
    };

    const response = await chatCompletion(completionConfig);
    const responseMessage = response;
    return responseMessage

}



async function lookupExistingIncidents(searchClient, incidents) {
    const existingMap = new Map();

    for (let i = 0; i < incidents.length; i += INDEX_LOOKUP_BATCH_SIZE) {
        const batch = incidents.slice(i, i + INDEX_LOOKUP_BATCH_SIZE);

        const lookupPromises = batch.map(async (incident) => {
            const docId = (incident.IncidentIDSource);
            try {
                const doc = await searchClient.getDocument(docId);
                return {
                    id: incident.IncidentIDSource,
                    found: true

                };
            } catch (err) {
                // 404 / RestError = document not found → genuinely new
                if (err.statusCode === 404 || err.code === 'ResourceNotFound' ||
                    (err.message && err.message.includes('404'))) {
                    return { id: incident.IncidentIDSource, found: false };
                }
                // Any other error – treat as "unknown, try to upload anyway"
                console.warn(`[lookupExisting] Error checking ${incident.number}: ${err.message}`);
                return { id: incident.IncidentIDSource, found: false, lookupError: err.message };
            }
        });

        const results = await Promise.all(lookupPromises);
        for (const r of results) {
            if (r.found) {
                existingMap.set(r.id, { content: r.WorkNotes });
            }
        }

        // Brief pause between lookup batches
        if (i + INDEX_LOOKUP_BATCH_SIZE < incidents.length) {
            await sleep(100);
        }
    }

    return existingMap;
}

function validateIncidents(incidents, existingMap) {
    const newIncidents = [];
    const unchangedIncidents = [];

    for (const incident of incidents) {
        const existing = existingMap.get(incident.IncidentIDSource);

        if (!existing) {
            // Not in index at all
            newIncidents.push(incident);
        } else {
            // In index with identical content – skip
            unchangedIncidents.push(incident.IncidentIDSource);
        }
    }

    return { newIncidents, unchangedIncidents };
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export async function serviceNowDataLoad({ sinceDate }) {


    console.log("--- API Pipeline Execution Started ---");
    try {


        let nuid = await getCurrentUserNuid();
        nuid = nuid.toUpperCase();

        console.log(`[serviceNowDataLoad] START – sinceDate=${sinceDate}`);
        const envName = process.env['envName'] || 'dev';

        let SNOWDB = 'SM_DW'
        const dbConfig = {
            user: process.env["kp.servicenow.reporting.database.user"],
            password: process.env["kp.servicenow.reporting.database.password"],
            server: process.env["kp.servicenow.reporting.database.host"],

            database: SNOWDB,// process.env["SNOWDATABASE"],
            port: 1433,
            options: { encrypt: true, trustServerCertificate: true }
        }; let indexName = "nps-incident-001"
        //if (process.env['envName']=='dev'){indexName="bcs-incident-001"}

        const searchClient = new SearchClient(
            process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.searchEndpoint`],
            indexName,
            new AzureKeyCredential(process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.aiupload.api.key`])
        );

        const pool = await sql.connect(dbConfig);
        const query = `SELECT DISTINCT
              incidentA.IncidentIDSource,
              incidentA.ShortDescription,
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
                AND SysCreatedOn >='${sinceDate}'
          ) AS incidentB
              ON incidentA.IncidentIDSource = incidentB.IncidentIDSource
          WHERE incidentA.SysCreatedOn >='${sinceDate}'
            AND incidentA.AssignmentGroup = 'NON-IT NPS TIER 1'  and incidentA.[State] in ('Closed')
            and   incidentA.WorkNotes!=''
          GROUP BY
              incidentA.IncidentIDSource,
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
              incidentA.WorkNotes,incidentA.CMDBConfigurableItem`;
        //select * from (
        //) as t where t.AssignmentGroup in ('AD HP NPG', 'NON-IT ACCENTURE NPS TIER 2')
        const result = await pool.request().query(query);
        await pool.close();

        if (result.recordset.length === 0) {
            console.log("INFO: No records found.");
            return {
                success: true, message: "No records found", verification: {
                    indexName: indexName,
                    totalDocumentsInIndex: 0,
                    status: "PASSED",
                    message: "No records Found"
                },
            };
        }

        //   let newIncidents1,unchangedIncidents1;
        //  const existingMap1 = await lookupExistingIncidents(searchClient, result.recordset);
        // ({ newIncidents1,  unchangedIncidents1 } = validateIncidents( result.recordset, existingMap1));
        let newIncidents, unchangedIncidents;
        const existingMap = await lookupExistingIncidents(searchClient, result.recordset);
        ({ newIncidents, unchangedIncidents } = validateIncidents(result.recordset, existingMap));
        let documents = [];
        const jsonBackupData = []; // NEW: Array for the JSON file
        //for (const row of result.recordset) {
        for (const row of newIncidents) {
            // --- UPDATED AGGREGATION INCLUDING RESOLVED & ENVIRONMENT ---
            const s_desc = cleanText(row.ShortDescription);
            const w_notes = cleanText(row.WorkNotes);
            const c_notes = cleanText(row.CloseNotes);
            const inc_id = String(row.IncidentIDSource || "");
            const priority = String(row.Priority || "");
            const state = String(row.State || "");
            const group = String(row.AssignmentGroup || "");
            const env = String(row.Environment || "");
            // Format the date for the content string
            const resolvedDate = row.ResolvedAt ? new Date(row.ResolvedAt).toISOString() : "Not Resolved";
            // NEW: Capture SysCreatedOn for the JSON file
            const sysCreatedOn = row.SysCreatedOn ? new Date(row.SysCreatedOn).toISOString() : null;
            const rag_parts = [];
            //rag_parts.push(`IncidentID: ${inc_id}`);
            //if (s_desc) rag_parts.push(`ShortDescription: ${s_desc}`);
            //if (priority) rag_parts.push(`Priority: ${priority}`);
            //if (state) rag_parts.push(`State: ${state}`);
            //if (group) rag_parts.push(`AssignmentGroup: ${group}`);
            //if (env) rag_parts.push(`Environment: ${env}`); // ADDED
            //if (resolvedDate) rag_parts.push(`Resolved: ${resolvedDate}`); // ADDED

            if (w_notes) rag_parts.push(`WorkNotes: ${w_notes}`);
            if (c_notes) rag_parts.push(`ResolutionNotes: ${c_notes}`);

            const content_blob = rag_parts.join(" | ");
            let response = await summarizeResult(nuid, content_blob);
            // --- 2. NEW SAFETY CHECK ---
            if (!response) {
                console.log(`❌ WARNING: AI returned 'undefined' for Incident: ${inc_id}. Skipping this record to save batch progress.`);
                continue; // This skips the bad record and safely moves to the next one!
            }
            // ---------------------------
            let updateResponse = response
                .replace(/```json/gi, "")
                .trim();
            const vector = await await vectorizePromptNode(updateResponse);

            documents.push({
                id: inc_id,
                number: inc_id,
                short_description: s_desc,
                priority: priority,
                state: state,
                assignment_group: group,
                resolution_notes: c_notes,
                resolved: row.ResolvedAt ? new Date(row.ResolvedAt).toISOString() : null,
                created_date: row.SysCreatedOn ? new Date(row.SysCreatedOn).toISOString() : null, // <--- NEWLY ADDED LINE
                environment: row.Environment ? String(row.Environment) : "production",
                description: cleanText(row.Description),
                work_notes: w_notes,
                source_name: "SQL_Server",
                content: updateResponse, // This contains the aggregated string
                content_vector: vector
            });
            // Add same data PLUS SysCreatedOn to the JSON backup array
            // Add same data PLUS SysCreatedOn to the JSON backup array
            //   jsonBackupData.push({
            //     id: inc_id,
            //     number: inc_id,
            //     short_description: s_desc,
            //     priority: priority,
            //     state: state,
            //     assignment_group: group,
            //     resolution_notes: c_notes,
            //     resolved: row.ResolvedAt ? new Date(row.ResolvedAt).toISOString() : null,
            //     created_date: row.SysCreatedOn ? new Date(row.SysCreatedOn).toISOString() : null,
            //     environment: row.Environment ? String(row.Environment) : "production",
            //     description: cleanText(row.Description),
            //     work_notes: w_notes,
            //     source_name: "SQL_Server",
            //     content: updateResponse,
            //     content_vector: vector

            // });
            // NEW ADDITION: Throttle request to avoid OpenAI 500 Error
            await sleep(500);
        }
        // const uploadResults = await searchClient.uploadDocuments(documents);
        // let successCount = 0;
        // uploadResults.results.forEach((res, i) => {
        //     if (res.succeeded) {
        //         successCount++;
        //         console.log(`UPLOAD SUCCESS: Incident ID ${documents[i].id}`);
        //     } else {
        //         console.log(`UPLOAD FAILED: Incident ID ${documents[i].id} - ${res.errorMessage}`);
        //     }
        // });



        let successCount = 0;
        const BATCH_SIZE = 50;
        //documents=newIncidents;
        console.log(`\n🚀 Starting Batch Upload (${documents.length} total records)...`);

        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
            const batch = documents.slice(i, i + BATCH_SIZE);
            console.log(`⏳ Uploading batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} records)...`);

            const uploadResults = await searchClient.uploadDocuments(batch);

            uploadResults.results.forEach((res, idx) => {
                if (res.succeeded) {
                    successCount++;
                    console.log(`UPLOAD SUCCESS: Incident ID ${batch[idx].id}`);
                } else {
                    console.log(`UPLOAD FAILED: Incident ID ${batch[idx].id} - ${res.errorMessage}`);
                }
            });

            await sleep(1000); // 1 second delay between batches
        }


        // return NextResponse.json({ success: true, uploaded: successCount });
        //uncommit the above code for final run --below is for dry run 
        // documents.forEach(doc => {
        //   console.log("==========================================");
        //   console.log("RECORD PREPARED! Dry Run View:");
        //   console.log("------------------------------------------");
        //   console.log(`id: "${doc.id}"`);
        //   console.log(`number: "${doc.number}"`);
        //   console.log(`content: "${doc.content}"`); // Verify the aggregation here
        //   console.log("==========================================\n");
        // });
        return {
            success: true,
            message: "Finished Inserting records",
           // record_count: documents.length,
            newIncidents:documents.length,
            existingIncidents:unchangedIncidents
            //preview: documents.slice(0, 2).map(d => ({ id: d.id, content: d.content })) // Returns first 2 records
        };

    } catch (err) {
        console.log(`CRITICAL ERROR: ${err.message}`);
        return { success: false, error: err.message }, { status: 500 };
    }
}