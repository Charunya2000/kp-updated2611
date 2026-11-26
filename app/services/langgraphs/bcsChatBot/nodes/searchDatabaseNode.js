'use server';

import { chatCompletion } from "@/app/services/chatCompletionService2";

// =========================================================
// IDENTIFIER EXTRACTION
// =========================================================
async function extractIdentifiers(userPrompt, state) {
  const extractionPrompt = `
Extract identifiers from the user query. Return ONLY valid JSON, no explanations.
User Query: "${userPrompt}"
Extract these identifiers if present:
{
  "quote_id": string | string[] | null,
  "rqr_id": string | string[] | null,
  "base_instruction_set_id": string | null,
  "query_type": "quote" | "rqr" | "perf_log" | "rate_summary" | "rate_tier" | "rate_benefit_plan" | "general",
  "search_text": string | null
  "transaction_id": string | null
}
Examples:
- "Get RQR 15064286" -> {"rqr_id":"15064286","query_type":"rqr"}
- "Quote 29707543 details" -> {"quote_id":"29707543","query_type":"quote"}
- "Performance logs for RQR 16481485" -> {"rqr_id":"16481485","query_type":"perf_log"}
- "Find base instruction set b8f227baa33c4c84bd9346fe123a24c1" -> {"base_instruction_set_id":"b8f227baa33c4c84bd9346fe123a24c1","query_type":"rqr"}
-"Find transactiton id 92dc48a5-927a-4270-b016-81971245b40d29872" -> {"transaction_id":"92dc48a5-927a-4270-b016-81971245b40d29872","query_type":"rqr"}
Re
Return JSON only.`;

  const response = await chatCompletion({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 500,
    messages: [
      { role: "system", content: "You extract database identifiers from user queries. Return only valid JSON." },
      { role: "user", content: extractionPrompt }
    ],
    teamName: state?.teamName,
    assistantName: state?.assistantName,
    nuid: state?.nuid
  });

  try {
    const content = response.trim();
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/({[\s\S]*})/);
    return JSON.parse(jsonMatch ? jsonMatch[1] : content);
  } catch (e) {
    console.warn('[extractIdentifiers] Failed to parse:', e.message);
    return { query_type: 'general' };
  }
}

// =========================================================
// SQL QUERY GENERATION
// =========================================================
function generateSQL(identifiers) {
  const { quote_id, rqr_id, base_instruction_set_id, transaction_id, query_type } = identifiers;
  const formatIds = (ids) => {
    if (!ids) return null;
    const idArray = Array.isArray(ids) ? ids : [ids];
    return idArray.map(id => `'${id}'`).join(', ');
  };
  const formattedQuoteIds = formatIds(quote_id);
  const formattedRqrIds = formatIds(rqr_id);

  switch (query_type) {
    case 'quote':
      if (formattedQuoteIds) return `SELECT rqr_id FROM ruw.quote WHERE quote_id IN (${formattedQuoteIds}) WITH UR`;
      if (formattedRqrIds) return `SELECT quote_id FROM ruw.quote WHERE rqr_id IN (${formattedRqrIds}) WITH UR`;
      break;
    case 'rqr':
      if (formattedRqrIds) return `SELECT * FROM ruw.rqr WHERE rqr_id IN (${formattedRqrIds}) WITH UR`;
      if (base_instruction_set_id) return `SELECT * FROM ruw.rqr WHERE base_instruction_set_id IN ('${base_instruction_set_id}') WITH UR`;
      break;
    case 'perf_log':
      if (formattedQuoteIds) return `SELECT * FROM admin.perf_log_data WHERE quote_id IN (${formattedQuoteIds}) ORDER BY timestamp DESC FETCH FIRST 50 ROWS ONLY WITH UR`;
      if (formattedRqrIds) return `SELECT * FROM admin.perf_log_data WHERE quote_id IN (SELECT quote_id FROM ruw.quote WHERE rqr_id IN (${formattedRqrIds})) ORDER BY timestamp DESC FETCH FIRST 50 ROWS ONLY WITH UR`;
      if (base_instruction_set_id) return `SELECT * FROM admin.perf_log_data WHERE rqr_id IN (SELECT rqr_id FROM ruw.rqr WHERE base_instruction_set_id IN ('${base_instruction_set_id}')) ORDER BY timestamp DESC FETCH FIRST 50 ROWS ONLY WITH UR`;
      break;
    case 'rate_summary':
      if (formattedQuoteIds) return `SELECT * FROM ruw.rate_summary WHERE quote_id IN (${formattedQuoteIds}) WITH UR`;
      if (formattedRqrIds) return `SELECT * FROM ruw.rate_summary WHERE quote_id IN (SELECT quote_id FROM ruw.quote WHERE rqr_id IN (${formattedRqrIds})) WITH UR`;
      break;
    case 'rate_tier':
      if (formattedQuoteIds) return `SELECT * FROM ruw.rate_tier_summary WHERE quote_id IN (${formattedQuoteIds}) WITH UR`;
      if (formattedRqrIds) return `SELECT * FROM ruw.rate_tier_summary WHERE quote_id IN (SELECT quote_id FROM ruw.quote WHERE rqr_id IN (${formattedRqrIds})) WITH UR`;
      break;
    case 'rate_benefit_plan':
      if (formattedQuoteIds) return `SELECT * FROM ruw.rate_summary_benefit_plan WHERE quote_id IN (${formattedQuoteIds}) WITH UR`;
      if (formattedRqrIds) return `SELECT * FROM ruw.rate_summary_benefit_plan WHERE quote_id IN (SELECT quote_id FROM ruw.quote WHERE rqr_id IN (${formattedRqrIds})) WITH UR`;
      break;
    case 'general':
    default:
      if (formattedRqrIds) return `SELECT * FROM ruw.rqr WHERE rqr_id IN (${formattedRqrIds}) WITH UR`;
      if (formattedQuoteIds) return `SELECT * FROM ruw.quote WHERE quote_id IN (${formattedQuoteIds}) WITH UR`;
      if (base_instruction_set_id) return `SELECT * FROM ruw.rqr WHERE base_instruction_set_id IN ('${base_instruction_set_id}') WITH UR`;
      if (transaction_id) return `SELECT * FROM ruw.rqr WHERE transaction_id IN ('${transaction_id}') WITH UR`;

      break;
  }
  return null;
}

// =========================================================
// SPLUNK QUERY GENERATION
// =========================================================
function generateSplunkQuery(identifiers) {
  const { quote_id, rqr_id, base_instruction_set_id, transaction_id, search_text } = identifiers;
  const searchTerms = [];
  if (quote_id) {
    const ids = Array.isArray(quote_id) ? quote_id : [quote_id];
    ids.forEach(id => searchTerms.push(`"${id}"`));
  }
  if (rqr_id) {
    const ids = Array.isArray(rqr_id) ? rqr_id : [rqr_id];
    ids.forEach(id => searchTerms.push(`"${id}"`));
  }
  if (base_instruction_set_id) searchTerms.push(`"${base_instruction_set_id}"`);
  if (transaction_id) searchTerms.push(`"${transaction_id}"`);
  if (search_text) searchTerms.push(`"${search_text}"`);
  return searchTerms.length === 0 ? null : searchTerms.join(' ');
}

// =========================================================
// MAIN NODE
// =========================================================
export const queryDatabaseNode = async (state) => {
  let sqlQuery = '';
  let splunkQuery = null;
  let identifiers = {};

  try {
    console.log('[queryDatabaseNode] Extracting identifiers from:', state.userPrompt);
    identifiers = await extractIdentifiers(state.userPrompt, state);
    console.log('[queryDatabaseNode] Extracted identifiers:', JSON.stringify(identifiers));

    sqlQuery = generateSQL(identifiers);

    // EARLY EXIT
    if (!sqlQuery) {
      console.log('[DEBUG] Early Exit: No valid identifier found. Skipping API calls.');
      return {
        ...state,
        identifiers,
        databaseMetadata: { sqlQuery: '', recordFound: false, message: 'No identifiable parameters (RQR/Quote ID) found for database query.' },
        splunkMetadata: { query: '', recordFound: false, logs: [], message: 'No identifiable parameters found for Splunk query.' },
        searchSuccess: false
      };
    }

    console.log('[DEBUG DB] SQL Query Generated:', sqlQuery);
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    // 1. DATABASE FETCH & REFINED FILTERING
    const dbResponse = await fetch(`${baseUrl}/api/nps/npschatbot/db2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: sqlQuery })
    });

    let dbResults = [];
    if (dbResponse.ok) {
      const dbData = await dbResponse.json();
      const rawResults = dbData.data || dbData.results || dbData || [];
      const resultsArray = Array.isArray(rawResults) ? rawResults : [rawResults];
      console.log('[DEBUG DB] SQL answer raw:', dbData);
      console.log('[DEBUG DB] Processed array result:', resultsArray);
      // FIX: Only filter out records that are EXPLICITLY security error objects, 
      // not valid data that might contain those strings.
      dbResults = resultsArray.filter(record => {
        // Check if the record IS the error, rather than just containing the string
        const isSecurityError = record.SQLCODE === -30082 ||
          (record.message && record.message.includes("SQL30082N"));
        return !isSecurityError;
      });
      console.log('main result', dbResults)
      console.log('[DEBUG DB] Valid Database Records Found:', dbResults.length);
    }

    // 2. SPLUNK CALL
    splunkQuery = generateSplunkQuery(identifiers);
    let splunkLogs = [];
    if (splunkQuery) {
      try {
        const splunkResponse = await fetch(`${baseUrl}/api/nps/npschatbot/splunk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: splunkQuery })
        });
        if (splunkResponse.ok) {
          const splunkData = await splunkResponse.json();
          splunkLogs = splunkData.logs || splunkData.results || [];
          console.log('[DEBUG SPLUNK] Normalized logs count:', splunkLogs.length);
        }
      } catch (e) {
        console.warn('[queryDatabaseNode] Splunk query failed:', e.message);
      }
    }

    // UPDATING STATE WITH EXPLICIT OBJECTS
    const updatedState = {
      ...state,
      identifiers: identifiers,
      databaseMetadata: {
        sqlQuery: sqlQuery || '',
        recordFound: Array.isArray(dbResults) ? dbResults.length > 0 : (!!dbResults && Object.keys(dbResults).length > 0),
        records: dbResults,
        recordCount: Array.isArray(dbResults) ? dbResults.length : (dbResults ? 1 : 0),
        queryType: identifiers.query_type,
        timestamp: new Date().toISOString()
      },
      splunkMetadata: {
        query: splunkQuery || '',
        recordFound: splunkLogs.length > 0,
        logs: splunkLogs,
        logCount: splunkLogs.length,
        timestamp: new Date().toISOString()
      },
      searchSuccess: true
    };

    console.log('[queryDatabaseNode] Final State Snapshot:', {
      dbRecordFound: updatedState.databaseMetadata.recordFound,
      dbCount: updatedState.databaseMetadata.recordCount,
      splunkRecordFound: updatedState.splunkMetadata.recordFound,
      splunkLogCount: updatedState.splunkMetadata.logCount
    });

    return updatedState;

  } catch (error) {
    console.error('Error in queryDatabaseNode:', error);
    return {
      ...state,
      identifiers,
      databaseMetadata: { sqlQuery, recordFound: false, error: error.message, timestamp: new Date().toISOString() },
      splunkMetadata: { query: splunkQuery || '', recordFound: false, error: error.message },
      searchSuccess: false
    };
  }
};