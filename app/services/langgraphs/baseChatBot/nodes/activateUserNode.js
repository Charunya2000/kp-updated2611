

import oracledb from 'oracledb';
import ExcelJS from 'exceljs-hardened';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '@/db/connection';
import { sendEmail } from '@/app/services/emailService';
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
export async function activateSuspendUserNode(state) {
  try {
    const parsedJsonSummary = JSON.parse(state.identifiers);//JSON vs array check to be added
    let userID = parsedJsonSummary.userid

    let sqlQuery = '';
    let keys = []

    let excelSasUrl = "";
    let pivotResults;



//update sut_sec_user_t set LSRT_SUSPENDRSN_CD='00', SUT_LOGIN_TS= sysdate where sut_usr_id='F046335
    sqlQuery = `Select LSRT_SUSPENDRSN_CD,SUT_LOGIN_TS from sut_sec_user_t where sut_usr_id='${userID}'`

    let oracleResponse = []


    let dbResults = await queryOracleDB(sqlQuery)
    // console.log(dbResults)
    let emailBody = `<p>Hi Team,</p>

<p>As per the request below to reactivate the user, we have identified the following details and require your approval before proceeding.</p>

<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
    <tr>
        <td><b>Input Query</b></td>
        <td>${state.userPrompt}</td>
    </tr>
    <tr>
        <td><b>LSRT_SUSPENDRSN_CD Value</b></td>
        <td>${dbResults[0].LSRT_SUSPENDRSN_CD}</td>
    </tr>
    <tr>
        <td><b>Last Inserted Date</b></td>
        <td>${dbResults[0].SUT_LOGIN_TS}</td>
    </tr>
</table>

<p>
Please reply to this email with <b>Approved</b> or <b>Rejected</b> to indicate your decision.
</p>

<p>Thank you.</p>`

    let requestNumber = `Req-${uuidv4()}`
    let emailSubject = `User Reactivet Request for User ${userID} - ${requestNumber}`
    const result = await sendEmail({
      to: "vinothkumar.c.natarajan@kp.org",
      subject: emailSubject,
      text: '',
      html: emailBody
    });

    // console.log(dbResults)

    return {
      ...state, reactivateUserResults: { requestNumber: requestNumber, emailsubject: emailSubject }
    }
  } catch (e) {
    console.warn('[getRejectSummary]] Failed to process :', e.message);
    return {
      ...state, rejectResults: {}
    };
  }
}