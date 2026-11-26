

import oracledb from 'oracledb';
import ExcelJS from 'exceljs-hardened';
import { chatCompletion } from "@/app/services/chatCompletionService2";
import { queryOracleDB } from '../queryOracleDB';
//import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '@/app/services/blobStorageService';
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

async function exportToExcel(records) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Result');

  if (records.length > 0) {

    const keys = Object.keys(records[0]);

    worksheet.columns = keys.map(key => ({
      header: key.toUpperCase(),
      key: key,
      width: 15
    }));


    worksheet.addRows(records);
  }

  return await workbook.xlsx.writeBuffer();

}


async function pivotAndCount(data, pivotKeys) {
  return data.reduce((acc, row) => {

    const groupKey = pivotKeys.map(key => row[key]).join(' | ');


    let group = acc.find(item => item._groupKey === groupKey);

    if (!group) {
      group = { _groupKey: groupKey, count: 0 };

      pivotKeys.forEach(key => group[key] = row[key]);
      acc.push(group);
    }


    group.count++;
    return acc;
  }, []).map(({ _groupKey, ...rest }) => rest);
}

async function encode(mrn) {
  const reversed = [...mrn].reverse().join('');
  return Buffer.from(reversed, 'utf8').toString('base64');
}

async function validateQuery(state, query, brokerID, planYear, encryptedMRN, compensation_date) {
  const defaultSystemMessage = {
    role: "system",
    content: `
Role:You are an Sql query validator agent.Your job is to validate the sql query generated using below criteria. 
Do not modify any logical changes and only need to populate substitutions ? if any are missed
SQL query using below input

Input Query: ${query}
Identifiers: ${state.identifiers}
BROKERID: ${brokerID}
PlanYear: ${planYear}
MRN :${encryptedMRN}
CompensationDate: ${compensation_date}

Input Rules:
- If any of the ? placeholders are not populated, it should be substituted
- Only Select queries should be there. 
- No other SQL type of queries should be created. 
- DO NOT add any additional where conditions or logic change to the input query.

Output Format:
{"query":"<<Select query>>"}

Critical Rules:
1. Return only JSON output.
2. No explanations.
3. No markdown.
4. No semicolon (;) at end of SQL.
5. LIKE clauses must use wildcard format: LIKE '%2026%'
6. Use ? placeholders for substitutions. E.g. BROKERID in ('40356')
7. All ? placholders should be substituted and NEVER leave them with ?
8. Multiple queries must be separated by colon (:)
9. plan Year, MRN, brokerID, compensation date will be provided on any of query to process
10. Multiple queries are required when MRN specific input provided, else keep it single query
11. Columns to refer for "plan year"
    - pmpm_kpif_credits_t -> periodname like '%2026%'
    - pmpm_kpif_rel_t -> PLAN_YEAR  ='2026'.
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
    max_tokens: 1500,
    messages: messages,
    teamName: state?.teamName,
    assistantName: state?.assistantName,
    nuid: state?.nuid
  });

  let identifiers = '';
  const intentResponse = response.replace(/```json|```/g, "").trim();

  //console.log(intentResponse)

  let parseQuery = JSON.parse(intentResponse)
  return parseQuery.query


}
export async function kpifInquiryNode(state) {
  try {
    let brokerID = ''
    let planYear = ''
    let mrn, compensation_date = ''
    if (typeof state.identifiers === 'object' && state.identifiers !== null) {

      brokerID = state.identifiers.broker_id
      planYear = state.identifiers.plan_year
      mrn = state.identifiers.mrn
      compensation_date = state.identifiers.compensation_date
    }
    else {
      const parsedJsonSummary = JSON.parse(state.identifiers);//JSON vs array check to be added

      brokerID = parsedJsonSummary.broker_id
      planYear = parsedJsonSummary.plan_year
      mrn = parsedJsonSummary.mrn
      compensation_date = parsedJsonSummary.compensation_date
    }
    let sqlQuery = '';
    let keys = []

    let excelSasUrl = "";
    let pivotResults;

    const regex = /^\d{4}$/;

    if (!regex.test(planYear)) {
      throw new Error(`Invalid format}`);
    }
    let encryptedMRN = ''
    if (mrn != '') { encryptedMRN = await encode(mrn) }
    const currentDate = new Date().toString();
    const defaultSystemMessage = {
      role: "system",
      content: `
Role:You are an Sql query generator agent.Your job is to generate SQL query using below input

Input Query: ${state.userPrompt}
Identifiers: ${state.identifiers}
BROKERID: ${brokerID}
PlanYear: ${planYear}
MRN :${encryptedMRN}
CompensationDate: ${compensation_date}

Input Rules:
- Broker_ID may contain multiple values.
- Treat Broker_ID as a comma-separated list.
- Example: 41356,67891

Database Metadata:

Table: pmpm_kpif_rel_t
Columns:
- BKR_BID_IK = Broker ID
- MRN = Member ID
- EFFOR_REN_DT = Effective/Renewal Date
- TERM_DT = Termination Date
- STATUS = Broker-Member Status
- PLAN_YEAR = Plan Year
- TYPE = IND or PRS
- ARCV_IND = Archive Indicator

Relationship Rules:

TYPE Mapping:
- Initial / Individual → IND
- Renewal / Retention → PRS

TERM_DT Rules:
- Active Members → TERM_DT IS NULL
- Termed Members → TERM_DT IS NOT NULL
- Total Members → Do not include TERM_DT filter

Mandatory Filters:
- ARCV_IND = 'N'
- PLAN_YEAR = ?
- BKR_BID_IK IN ('?')

Broker ID and Plan Year Rules
- If PLAN_YEAR provided, make Broker ID (BKR_BID_IK) as optional and do not include in the query fitler
- If Broker ID provided, make PLAN_YEAR as optional and do not include in the query filter
- If both PLAN_YEAR and Broker ID are provided,  include both in the query filter


Query Generation Rules:

1. Broker-Member Relationship Queries

Use table: pmpm_kpif_rel_t

Example: select count(distinct mrn) from pmpm_kpif_rel_t where arcv_ind='N' and term_dt is not null and plan_year=? and bkr_bid_ik in ('?') and type='PRS'

2.Retention Rate Queries
  Query: select bob_year,bob_count,renewal_year,renewal_Count ,ret_rate as RetentionRate from pmpm_kpif_ret_mem_ct_t where arcv_ind='N' and BKR_BID_IK in ('?') and ret_payout_year=?

3. Broker Payment Queries

Use table: pmpm_kpif_credits_t

Columns:
- BROKERID
- MRNMASKED
- MRNENCRYPTED
- PERIODNAME
- COVERAGEPERIOD
- CREDIT_AMOUNT
- EVENTTYPEID
- COMPENSATION_DATE

Important Rule:
When user asks:
- Amount Paid
- Dollar Payment
- Total Payment

Always include:
- EVENTTYPEID
- COUNT(DISTINCT MRNMASKED)
- SUM(CREDIT_AMOUNT)

Filter:
- If PeriodName to be included, mention as %planyear%
- If COMPENSATION_DATE included, mention as COMPENSATION_DATE >= DATE '?'
Unless user explicitly requests another breakdown.

Total Payment Query: select EVENTTYPEID,sum(CREDIT_AMOUNT),count(distinct MRNMASKED)  from  pmpm_kpif_credits_t where BROKERID in ('?') and periodname like '?' group by EVENTTYPEID

Month-wise Payment Query: select EVENTTYPEID,sum(CREDIT_AMOUNT),PERIODNAME from  pmpm_kpif_credits_t where BROKERID in ? and periodname like '?' group by EVENTTYPEID,PERIODNAME

Member Payment Processed Query: select EVENTTYPEID,sum(CREDIT_AMOUNT),count(distinct MRNMASKED) from  pmpm_kpif_credits_t where BROKERID in ('?') and periodname like '?' group by EVENTTYPEID

PERIODNAME/COMPENSATION_DATE LOGIC:
- Include PERIODNAME or Compensation_Date column on the query if user requested for month wise payment. 
- If Generic request for month wise, incldue Periodname. If explicitly asked for Compensation_Date, do include them instead of periodname

4. Member Payment Queries when provided with a MRN

Generate multiple SQL statements separated by colon (:)

select distinct MRNMASKED,COVERAGEPERIOD,PERIODNAME,CREDIT_AMOUNT from pmpm_kpif_credits_t where MRNENCRYPTED='?':
select TERM_DT,STATUS From pmpm_kpif_rel_t where arcv_ind='N'  and MRN='?' and PLAN_YEAR='?'

Rule:
- MRN input is encrypted.
- Use encrypted value for both MRN and MRNENCRYPTED filters.

5. Member Payment Month Distribution - User Will request for each month or comparison of months payment and member distribution

Example requests:
- Less than 3 months
- 4 months
- 6 months
- how many unique members were paid for each month in last than 6 months.

Use: Convert Plan year to YYYY-MM-DD as start of Year and refer for Compensation date 

Type: Member Paid for each month - If User requested to get each month members and payment
  Query:SELECT EVENTTYPEID, MONTHS_PAID || ' MONTHS' AS PAYMENT_PERIOD, 
   COUNT(DISTINCT MRNMASKED) AS MEMBER_COUNT ,  SUM(CREDIT_AMOUNT)
 AS TOTAL_CREDIT_AMOUNT FROM (SELECT  MRNMASKED, EVENTTYPEID, COUNT(DISTINCT TRUNC(COMPENSATION_DATE, 'MM')) AS MONTHS_PAID,SUM(CREDIT_AMOUNT) AS CREDIT_AMOUNT
    FROM pmpm_kpif_credits_t WHERE COMPENSATION_DATE >= DATE '?' and BROKERID in ('?')  GROUP BY MRNMASKED, EVENTTYPEID ) WHERE MONTHS_PAID IN (?) GROUP BY EVENTTYPEID,MONTHS_PAID ORDER BY EVENTTYPEID,MONTHS_PAID

Type: Member Paid across different months - If user requested for comparison of monthly payments and members
  Query:SELECT EVENTTYPEID, CASE WHEN MONTHS_PAID <= ? THEN 'LESS THAN ? MONTHS' WHEN MONTHS_PAID <=? THEN '? MONTHS'  ELSE 'OTHER' END AS PAYMENT_PERIOD,  
   COUNT(DISTINCT MRNMASKED) AS MEMBER_COUNT ,  SUM(CREDIT_AMOUNT)
 AS TOTAL_CREDIT_AMOUNT FROM (SELECT  MRNMASKED, EVENTTYPEID, COUNT(DISTINCT TRUNC(COMPENSATION_DATE, 'MM')) AS MONTHS_PAID,SUM(CREDIT_AMOUNT) AS CREDIT_AMOUNT
    FROM pmpm_kpif_credits_t WHERE COMPENSATION_DATE >= DATE '?' and BROKERID in ('?')  GROUP BY MRNMASKED, EVENTTYPEID ) GROUP BY EVENTTYPEID,
     CASE WHEN MONTHS_PAID <= ? THEN 'LESS THAN ? MONTHS' WHEN MONTHS_PAID <=? THEN '? MONTHS' ELSE 'OTHER' END  


6. Member List by Months Paid. Replace BETWEEN values based on user request.
Query: SELECT MRNMASKED FROM ( SELECT  MRNMASKED,  COUNT(DISTINCT TRUNC(COMPENSATION_DATE, 'MM')) AS MONTHS_PAID 
    FROM pmpm_kpif_credits_t   WHERE  periodname like '?' and BROKERID in ('?')   GROUP BY MRNMASKED) WHERE MONTHS_PAID BETWEEN ? AND ?


    
MRN on Query Selection:
- If user request to list MRN, use as  '####' || SUBSTR(reverse(utl_raw.cast_to_varchar2(utl_encode.base64_decode(utl_raw.cast_to_raw(MRN)))) ,-4) as MaskedMRN for the MRN column for pmpm_kpif_rel_t
- MRNMASKED column for pmpm_kpif_credits_t table

Output Format:
{"query":"<<Select query>>","category":<< one of above category>>}

Critical Rules to follow:
1. Return only JSON output.
2. No explanations.
3. No markdown.
4. No semicolon (;) at end of SQL.
5. Always use DISTINCT when returning entity lists.
6. LIKE clauses must use wildcard format: LIKE '%2026%'
7. Use ? placeholders for substitutions. E.g. BROKERID in ('40356')
8. All ? placholders should be substituted and NEVER leave them with ?
9. Multiple queries must be separated by colon (:)
10. plan Year, MRN, brokerID, compensation date will be provided on any of query to process
11. Default archive filter:  ARCV_IND='N'
12. Multiple queries are required when MRN specific input provided, else keep it single query
13. If "Plan Year" to be framed in filter query: 
    -For pmpm_kpif_credits_t it will be periodname like '%2026%'
    -For pmpm_kpif_rel_t, it will be PLAN_YEAR ='2026'. 
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
      max_tokens: 2500,
      messages: messages,
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    });

    let identifiers = '';
    const intentResponse = response.replace(/```json|```/g, "").trim();

    //console.log(intentResponse)

    let parseQuery = JSON.parse(intentResponse)
    sqlQuery = await validateQuery(state, parseQuery.query, brokerID, planYear, encryptedMRN, compensation_date)


    let oracleResponse = []
    let dbResults;
    if (sqlQuery.includes(':')) {
      let queries = sqlQuery.split(":");
      dbResults = []
      for (const item of queries) {
        let res = await queryOracleDB(item)
        dbResults.push(res)
      }
    }
    else {
      dbResults = await queryOracleDB(sqlQuery)
    }
    // console.log(dbResults)


    return {
      ...state, kpifResults: { dbResults: dbResults }
    };
  } catch (e) {
    console.warn('[getRejectSummary]] Failed to process :', e.message);
    return {
      ...state, rejectResults: {}
    };
  }
}