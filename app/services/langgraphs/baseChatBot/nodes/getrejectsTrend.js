import { connectToDatabase } from '@/db/connection';
import oracledb from 'oracledb';
import { chatCompletion } from "@/app/services/chatCompletionService2";
import { queryOracleDB } from '../queryOracleDB';

// async function queryOracleDB(sqlQuery, bindParams = []) {
//   let connection;
//   try {
//     const envName = process.env['envName'] || 'dev';
//     connection = await oracledb.getConnection({

//       user: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.user`],//process.env.BASE_ORACLE_USER
//       password: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.password`],//process.env.BASE_ORACLE_PASSWORD
//       connectString: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.dsn`]//process.env.BASE_ORACLE_DSN,
//     });
//     const options = {
//       outFormat: oracledb.OUT_FORMAT_OBJECT // Returns rows as JS objects instead of arrays
//     };
//     const result = await connection.execute(sqlQuery, bindParams, options);
//     return result.rows;
//   } finally {
//     if (connection) {
//       try { await connection.close(); } catch (err) { }
//     }
//   }
// }






async function groupAvgRecords(records, categoryDict) {
  const result = {};
  const last6Months = {};

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 6);

  // Group rejection reasons by REJECTCODE
  const reasonsByCode = {};

  for (const item of categoryDict) {
    const code = item.REJECTCODE;
    const reason = item.REJECTREASON;

    if (!reasonsByCode[code]) {
      reasonsByCode[code] = [];
    }

    if (
      reason &&
      !reasonsByCode[code].includes(reason)
    ) {
      reasonsByCode[code].push(reason);
    }
  }

  for (const record of records) {
    const date = new Date(record.DATERANGE );
    const { REJECTCODE, TRANSACTIONS } = record;

    // Group by Year-Month-Week
    const year = date.getFullYear();
    const month = date.toLocaleString("en-US", {
      month: "long"
    });
    const week = Math.ceil(date.getDate() / 7);
    const key = `${year}-${month}-Week${week}`;

    // Initialize weekly group
    if (!result[key]) {
      result[key] = {};
    }

    if (!result[key][REJECTCODE]) {
      result[key][REJECTCODE] = {
        TRANSACTIONS: 0//,
       // REJECTREASONS: []
      };
    }

    result[key][REJECTCODE].TRANSACTIONS += TRANSACTIONS;

    // // Append unique rejection reasons
    // result[key][REJECTCODE].REJECTREASONS = [
    //   ...new Set([
    //     ...result[key][REJECTCODE].REJECTREASONS,
    //     ...(reasonsByCode[REJECTCODE] || [])
    //   ])
    // ];

    // Calculate rolling six-month totals
    if (date >= cutoff && date <= now) {
      if (!last6Months[REJECTCODE]) {
        last6Months[REJECTCODE] = {
          total: 0,
          average: 0,
          REJECTREASONS: []
        };
      }

      last6Months[REJECTCODE].total += TRANSACTIONS;

      last6Months[REJECTCODE].REJECTREASONS = [
        ...new Set([
          ...last6Months[REJECTCODE].REJECTREASONS,
          ...(reasonsByCode[REJECTCODE] || [])
        ])
      ];
    }
  }

  // Average transactions per month over six months
  for (const REJECTCODE in last6Months) {
    last6Months[REJECTCODE].average =
      last6Months[REJECTCODE].total / 6;
  }

  result.Last6Months = last6Months;

  return result;
}



// Invoke
//const output = await groupRecords(records, categoryDict);

async function groupAverageRecords(records) {
  const result = {};
  const last6Months = {};

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 6);

  for (const row of records) {
    const date = new Date(row.DATERANGE);
    const { REJECTCODE, TRANSACTIONS } = row;

    // Weekly grouping
    const year = date.getFullYear();
    const month = date.toLocaleString("en-US", {
      month: "long",
    });
    const week = Math.ceil(date.getDate() / 7);
    const key = `${year}-${month}-Week${week}`;

    if (!result[key]) result[key] = {};

    result[key][REJECTCODE] =
      (result[key][REJECTCODE] || 0) + TRANSACTIONS;

    // Last 6 months: total and average per category
    if (date >= cutoff && date <= now) {
      if (!last6Months[REJECTCODE]) {
        last6Months[REJECTCODE] = { total: 0, average: 0 };
      }

      last6Months[REJECTCODE].total += TRANSACTIONS;
    }
  }

  for (const REJECTCODE in last6Months) {
    last6Months[REJECTCODE].average =
      last6Months[REJECTCODE].total / 6;
  }

  result["Last6Months"] = last6Months;

  return result;
}

async function groupRecords(records) {
  const grouped = {};

  records.forEach(row => {
    const date = new Date(row.DATERANGE);
    const week = Math.ceil(date.getDate() / 7);

    const key = `${date.getFullYear()}-${date.getMonth() + 1}-Week${week}`;

    if (!grouped[key]) {
      grouped[key] = {};
    }

    if (!grouped[key][row.REJECTCODE]) {
      grouped[key][row.REJECTCODE] = 0;
    }

    grouped[key][row.REJECTCODE] += row.TRANSACTIONS;
  });

  console.log(grouped);
  return grouped

}

export async function getRejectsTrend(state) {
  try {

    const defaultSystemMessage = {
      role: "system",
      content: `
Role:You are a date Range query generator agent.Your job is to generate Start and end date based on the given dateperiod

Input Query: ${state.userPrompt}
Identifiers: ${state.identifiers}

Output Format:
{"startDate":"","endDate":""}

Output Rule:
Only provide the output in format asked
give date format as YYYY-MM-DD
No Explanation or additional formation needed
`
    };

    const systemMessage = defaultSystemMessage;
    const userMessage = { role: "user", content: `User input: Generate data query as per format ` };


    const messages = [
      //{ role: "system", content:prompt},// "You extract database identifiers from user queries. Return only valid JSON." },
      systemMessage,
      userMessage];

    const response = await chatCompletion({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 500,
      messages: messages,
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    });

    let identifiers = '';
    const intentResponse = response.replace(/```json|```/g, "").trim();



    let parseQuery = JSON.parse(intentResponse)
    let startDate = parseQuery.startDate
    let endDate = parseQuery.endDate


    const db = await connectToDatabase('team-bcs-db');
    const collection = db.collection('BCS_Rejects_History');

    const query = {

      $gte: startDate,
      $lte: endDate
    }
      ;
    const records = await collection.find(
      { DATERANGE: { "$gte": startDate, "$lte": endDate } }
    ).toArray();

    let sqlQuery = `select LTRR_REJ_RSN_NB as rejectCode, LTRR_REJ_RSN_DS as RejectReason from ltrr_rej_rsn_t`
   // let groupResult = await groupRecords(records)
    let dbResults = await queryOracleDB(sqlQuery)
    let groupAverage = await groupAvgRecords(records,dbResults)
    
    
    //dbResults = await queryOracleDB(sqlQuery)
    if (!groupAverage) return [];

    // Convert stored conversation into messages format

    return {
      ...state, rejectTrendResults: { "trendResult": groupAverage, "rejectCodes": dbResults }
    };
  } catch (error) {
    console.error('[getExistingArchivalRequest] Error:', error.message);
    return {
      ...state, rejectTrendResult: []
    };
  }
}
