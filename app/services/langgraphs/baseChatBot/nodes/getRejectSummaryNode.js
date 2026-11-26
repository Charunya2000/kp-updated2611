

import oracledb from 'oracledb';
import ExcelJS from 'exceljs-hardened';
import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '@/app/services/blobStorageService';
async function queryOracleDB(sqlQuery, bindParams = []) {
  let connection;
  try {
    const envName = process.env['envName'] || 'dev';
    connection = await oracledb.getConnection({

      user: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.user`],//process.env.BASE_ORACLE_USER
      password: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.password`],//process.env.BASE_ORACLE_PASSWORD
      connectString: process.env[`host.${envName}-aiportal-web-2.bcs.oracle.dsn`]//process.env.BASE_ORACLE_DSN,
    });
    const options = {
      outFormat: oracledb.OUT_FORMAT_OBJECT // Returns rows as JS objects instead of arrays
    };
    const result = await connection.execute(sqlQuery, bindParams, options);
    return result.rows;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) { }
    }
  }
}

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
export async function getRejectSummaryNode(state) {
  try {
    const parsedJsonSummary = JSON.parse(state.identifiers);//JSON vs array check to be added
    let startdate = parsedJsonSummary.start_date
    let enddate = parsedJsonSummary.end_date

    let queryType = parsedJsonSummary.reject_type
    let sqlQuery = '';
    let keys = []

    let excelSasUrl = "";
    let pivotResults;

    const regex = /^TO_DATE\('\d{2}\/\d{2}\/\d{4}',\s*'MM\/DD\/YYYY'\)$/;

    if (!regex.test(startdate) || !regex.test(enddate)) {
      throw new Error(`Invalid format}`);
    }



    if (queryType == 'KPIF') {
      keys = ['REJ_DSCR', 'RTYPE']
      sqlQuery =
        `SELECT
DISTINCT
RTYPE. SEQ_NB,
RTYPE. BROKER_ID,
RTYPE. BROKER_FIRST_NM,
RTYPE. BROKER_LAST_NM,
RTYPE. PROSPECT_NM,
RTYPE. PROSPECT_ID,
RTYPE. MRN,
RTYPE. MBR_EFF_DT,
RTYPE.Renewal_Dt,
RTYPE. SUB_REGION,
RTYPE. EXCHANGE_ID,
RTYPE. RTYPE,
RTYPE. PROCESS_DT,
RTYPE. REJ_CODE,
RTYPE. REJ_DSCR
FROM
( 
SELECT
distinct
IIRR.IRT_SEQ_NB AS SEQ_NB,
IIRR.BKR_BID_IK AS BROKER_ID,
IIRR.BKR_FIRST_NAME AS BROKER_FIRST_NM,
IIRR.BKR_LAST_NAME AS BROKER_LAST_NM,
IIRR.PROSPECT_ID AS PROSPECT_ID,
reverse(utl_raw.cast_to_varchar2(utl_encode.base64_decode(utl_raw.cast_to_raw(MRN)))) AS MRN,
IIRR.PROSPECT_NAME AS PROSPECT_NM,
TO_CHAR(IIRR.IRT_EFF_DT,'MM/DD/YYYY') AS MBR_EFF_DT,
'' as Renewal_Dt,
IIRR.SUB_REGION,
IIRR.EXCHANGE_ID AS EXCHANGE_ID,
'Initial Rwd' as Rtype,
TO_CHAR(IIRR.IRJ_INSRT_TS,'MM/DD/YYYY') AS PROCESS_DT,
IIRR.LRRR_REWREJ_RSN_NB AS REJ_CODE,
LRRR.LRRR_REWREJ_RSN_DS AS REJ_DSCR  

FROM
BASE.IRJ_IND_RWD_REJ_T IIRR,
LRRR_REW_REJ_RSN_T LRRR
WHERE
LRRR.LRRR_REWREJ_RSN_NB = IIRR.LRRR_REWREJ_RSN_NB AND
trunc(IRJ_INSRT_TS) between ${startdate} and ${enddate}
UNION

SELECT
DISTINCT
PPRR.PRT_SEQ_NB AS SEQ_NB,
PPRR.BKR_BID_IK AS BROKER_ID,
PPRR.BKR_FIRST_NAME AS BROKER_LAST_NM,
PPRR.BKR_LAST_NAME AS BROKER_LAST_NM,
PPRR.PROSPECT_ID AS PROSPECT_ID,
reverse(utl_raw.cast_to_varchar2(utl_encode.base64_decode(utl_raw.cast_to_raw(MRN)))) AS MRN,
PPRR.PROSPECT_NAME AS PROSPECT_NM,
TO_CHAR(PPRR.PRT_EFF_DT,'MM/DD/YYYY') AS MBR_EFF_DT,
TO_CHAR(TO_CHAR(PPRR.PRT_RENEWAL_DT,'MM/DD/YYYY')) as Renewal_Dt,
PPRR.SUB_REGION,
PPRR.EXCHANGE_ID AS EXCHANGE_ID,
'Renewal Rwd' AS RTYPE,
TO_CHAR(PPRR.PRJ_INSRT_TS,'MM/DD/YYYY') AS PROCCESS_DT,
PPRR.LRRR_REWREJ_RSN_NB AS REJ_CODE,
LRRR.LRRR_REWREJ_RSN_DS AS REJ_DSCR
FROM
BASE.PRJ_PER_RWD_REJ_T PPRR,
LRRR_REW_REJ_RSN_T LRRR 
WHERE
LRRR.LRRR_REWREJ_RSN_NB = PPRR.LRRR_REWREJ_RSN_NB AND
trunc(PRJ_INSRT_TS) between ${startdate} and ${enddate}) RTYPE`
    }
    else if (queryType == 'Medicare') {
      keys = ['REJECTREASON', 'BROKERID']
      sqlQuery =
        `Select 
MCT_IK as IK,MCT_SEQ_NB as SequenceNumber,
mmt_hicn as HICN,
MCT_ENRL_EFF_DT as EffectiveDate,
MMT_AGT_ID  as NPN,
MMT_APP_FRST_NM as ApplicantFirstName,
MMT_APP_LST_NM as ApplicantLastName,
MMT_APP_STATE as ApplicantSate,
RTS_REJ_RSN as RejectReason,
MMT_APP_RCVD_DT as ApplicationReceivedDate,
CONNECTORID as BrokerId
from RTS_REJ_T where trunc(MPA_INSRT_TS) between ${startdate} and ${enddate}`
    }
    else if (queryType == 'Commercial') {
      keys = ['PROD_SHRT_NM', 'REJECT_CODE']
      sqlQuery =
        `SELECT 
trr.LTRR_REJ_RSN_NB as REJECT_CODE,
trj.TRJ_TRAN_SEQ_NB SEQ_NB, trj.TRJ_PID_NB PID, 
LPAD(trj.TRJ_ENRL_UNT_NB, 4, 0) EU, trj.TRJ_CVRG_PER_DT CVRG_PER_DT, 
trj.TRJ_BILL_AM BILL_AM, trj.TRJ_PD_AM PD_AM, trj.TRJ_MBR_CT MBR_CT, 
trr.TRR_BID_IK BID, trj.TRJ_PROD_SHRT_NM PROD_SHRT_NM, trj.TRJ_KPIC_GL_SHR_PC KPIC_SHR_PC,
trj.TRJ_REC_TP_CD REC_TP, trj.TRJ_TRAN_TP_CD TRAN_TP, trj.TRJ_BU_OWN_CD REGION, PEU.SUN_SHRT_NM as Business_Line,trj.TRJ_BILL_FREQ_NB BILL_FREQ, TRUNC(tct.TCT_INSRT_TS) batch_recd_date
FROM trj_tran_rej_t trj, trr_tran_rej_rsn_t trr,
tct_tran_cntl_t tct, ltrr_rej_rsn_t ltrr, LTPC_TRANPROC_CD_T LTPC,
PEU_PUR_ENRL_UNT_T PEU
WHERE trj.TCT_IK = trr.TCT_IK
AND TRJ.TRJ_PUR_IK = PEU.PUR_IK (+)
AND TRJ.TRJ_PEU_IK =PEU.PEU_IK (+)
AND trj.LTPC_PROC_CD_NB in (0,6)
AND tct.LELS_EXTRLD_STS_CD = 'L'
AND trj.TRJ_TRAN_SEQ_NB = trr.TRJ_TRAN_SEQ_NB
AND trj.LTPC_PROC_CD_NB = LTPC.LTPC_PROC_CD_NB
AND trj.TCT_IK = tct.TCT_IK
AND ltrr.LTRR_REJ_RSN_NB = trr.LTRR_REJ_RSN_NB 
AND trunc(TCT_INSRT_TS) between ${startdate} and ${enddate}`
    }

    let oracleResponse = []


    let dbResults = await queryOracleDB(sqlQuery)
    // console.log(dbResults)
    const excelBuffer = await exportToExcel(dbResults)
    pivotResults = await pivotAndCount(dbResults, keys)//Need to add logic to check token limit

    const containerName = 'base-rejectsummaries';
    const timestamp = Date.now();
    const excelBlobName = `${queryType}_${timestamp}.xlsx`;


    console.log(`[DEBUG] Uploading Excel to Azure Blob: ${excelBlobName}`);
    const excelUploadSuccess = await writeFileBufferToBlobStorage(
      excelBuffer,
      containerName,
      excelBlobName,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    if (excelUploadSuccess) {
      excelSasUrl = await generateTemporaryDownloadLink(containerName, excelBlobName, 60);

    }


    return {
      ...state, rejectResults: { rejectFileURL: excelSasUrl, rejectSummary: pivotResults }
    };
  } catch (e) {
    console.warn('[getRejectSummary]] Failed to process :', e.message);
    return {
      ...state, rejectResults: {}
    };
  }
}