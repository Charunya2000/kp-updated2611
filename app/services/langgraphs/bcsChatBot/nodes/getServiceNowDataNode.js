
import sql from 'mssql';
export async function getSNOWData(state) {
     
let SNOWDB='SM_DW'
      const dbConfig = {
            user: process.env["kp.servicenow.reporting.database.user"],
            password: process.env["kp.servicenow.reporting.database.password"],
            server: process.env["kp.servicenow.reporting.database.host"],

            database:SNOWDB,// process.env["SNOWDATABASE"],
            port: 1433,
            options: { encrypt: true, trustServerCertificate: true }
        };


const dbQuery=`
SELECT Distinct incidentA.IncidentIDSource  as IncidentID,incidentA.ShortDescription as [Description],incidentA.[State] as [Status],incidentA.AssignmentGroup as [AssignedGroup],incidentA.SysCreatedOn as [DateCreated]
FROM [SM_DW].[dbo].[IncidentDetail] as incidentA join 
(SELECT IncidentIDSource,AssignmentGroup
FROM [SM_DW].[dbo].[IncidentDetailHistory]
where  STATE in ('NEW','In Progress') and AssignmentGroup in ('AD HP NPG', 'NON-IT ACCENTURE NPS TIER 2')) as incidentB
on incidentA.IncidentIDSource=incidentB.IncidentIDSource where incidentA.[State] in ('NEW','In Progress')  and incidentA.AssignmentGroup in ('NON-IT NPS TIER 1','NON-IT ACCENTURE NPS TIER 2','AD HP NPG')
GROUP BY incidentA.IncidentIDSource,incidentA.ShortDescription,incidentA.[State],incidentA.AssignmentGroup,incidentA.SysCreatedOn


`
let snowResponse=[]
try {
        // STEP 1: Get Quote IDs
        console.log(`[getServiceNowNode] Running SNOW Database Query`);
        const pool = await sql.connect(dbConfig);
     
        const snowResults = await pool.request().query(dbQuery);
        await pool.close();
       
        
        console.log(`[getServiceNowNode]  Found ${snowResults.recordset.length} records: `);

        if (snowResults.recordset.length === 0) {
            snowResponse.push("No open Tickets available.");
        }
        else{

        for (const result of snowResults.recordset) {
            snowResponse.push({IncidentID:result.IncidentID,
                Description:result.Description.substring(0, 35)+'..',
                Status:result.Status,
                AssignedGroup:result.AssignedGroup,
              //  DateCreated:result.DateCreated

            });
        }}

    return {
      ...state, snowMetadata:snowResponse
    };
  } catch (e) {
    console.warn('[getServiceNowData] Failed to process :', e.message);
    return {
      ...state,snowMetadata:[]
        };
  }
}