

import ExcelJS from 'exceljs-hardened';
import { sendEmail } from '@/app/services/emailService';
import { chatCompletion } from "@/app/services/chatCompletionService2";
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '@/db/connection';
import { createJIRATask, attacheFilestoJIRATask } from '../createJiraIssue';
import { writeFileBufferToBlobStorage, generateTemporaryDownloadLink } from '@/app/services/blobStorageService';
import { queryOracleDB,deleteRecords } from '../queryOracleDB';
import { updateSingleRecord, countRecords, findRecords, findSingleRecord } from '../queryMongoDB';

const envName = process.env['envName'];
const dbName = 'team-bcs-db';
const collectionName = 'BCS_Agent_Archival';
const querytype = 'agent_archive'


async function exceuteSqlQueries(state) {
    try {
        const selectQueries = [

            'select * from mad_agnt_det_t where mad_npn=:npnID and CONNECTORID in (:brokerID)',
            'select * from mad_agnt_term_det_t where mad_npn=:npnID and CONNECTORID in (:brokerID)',
            'select * from mad_agnt_rts_reset where mad_npn=:npnID and CONNECTORID in (:brokerID)',
            'select * from mad_agnt_rel_t where mad_npn=:npnID and CONNECTORID in (:brokerID)',
            'select * from mld_lic_det_t where mld_npn=:npnID and mld_CONNECTORID in (:brokerID)',
            'select * from map_appt_det_t where map_npn=:npnID and map_CONNECTORID in (:brokerID)',
            'select *  from map_auto_appt_ignre_t where map_npn=:npnID and map_CONNECTORID in (:brokerID)',
            'select * from mcd_prd_cert_det_t where mcd_npn=:npnID and CONNECTORID in (:brokerID)',
            'select * from mac_annual_cert_det_t where mac_npn=:npnID and CONNECTORID in (:brokerID)',
            'select * from mrt_regional_training_t where mrt_npn=:npnID and CONNECTORID in (:brokerID)',
            'select * from mar_agt_rej_t where mar_npn =:npnID and CONNECTORID in (:brokerID)',
            'select * from mar_med_agnt_rel_t where mar_npn =:npnID and mar_CONNECTORID in (:brokerID)',
            'select * from mas_agt_sts_t where mas_npn =:npnID and CONNECTORID in (:brokerID)',
            'select * from maa_agnt_agng_t where maa_npn =:npnID and maa_CONNECTORID in (:brokerID)',

        ]


        let params = { npnID: state.archiveAgentResults.npn, brokerID: state.archiveAgentResults.brokerToRemove }
        const parallelQueries = selectQueries.map(async query => {

            const dbResult = await queryOracleDB(query, params)
            return {


                query: query,
                parameters: { npn: state.archiveAgentResults.npn, brokerToRemove: state.archiveAgentResults.brokerToRemove },

                results: dbResult
            };
        });

        const parallelResults = await Promise.all(parallelQueries);
        const combinedData = parallelResults.flat();
        const jsonResult = JSON.stringify(combinedData, null, 2);
        return jsonResult
    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'exceuteSqlQueries', detail: { error: error.message } } }));

    }

}

async function createJIRAttachment(attachmentContent, state, sqlType) {
    try {
        const fileBuffer = Buffer.from(attachmentContent, "utf8");
        const timestamp = Date.now();
        let fileName = `${state.archiveAgentResults.requestNumber}_${sqlType}_${timestamp}.txt`;
        let uploadStatus = await attacheFilestoJIRATask(state.archiveAgentResults.jiraID, fileBuffer, fileName, 'txt')
        return uploadStatus


    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'createJIRAttachment', detail: { error: error.message } } }));

    }
}


export async function processAgentArchivalRequest(state) {
    try {
        if (!state.archiveAgentResults) return [];

        const searchQuery = { requestNumber: state.archiveAgentResults.requestNumber, type: querytype }
        const agentRecords = await findSingleRecord(dbName, collectionName, searchQuery, "processAgentArchivalRequest")

        // const db = await connectToDatabase('team-bcs-db');
        // const collection = db.collection('BCS_AGENT_ARCHIVAL');

        // const agentRecords = await collection.findOne(
        //     { requestNumber: state.archiveAgentResults.requestNumber, type: 'agent_archive' }
        // );

        if (!agentRecords) return [];


        const queryAttachment = await exceuteSqlQueries(state)
        const jiraStatus = await createJIRAttachment(queryAttachment, state, "BEFORE_UPDATE-Select_Queries")

        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'Agent Archive - Upload Existing records to JIRA', detail: { status: jiraStatus, message: `Completed upload to JIRA` } } }));

        if (envName.toLowerCase() != 'prod') {
            // Run for Non Prod alone
            const deleteQueries = [
                'delete from mad_agnt_det_t where mad_npn=:npnID and CONNECTORID in (:brokerID)',
                'delete from mad_agnt_term_det_t where mad_npn=:npnID and CONNECTORID in (:brokerID)',
                'delete from mad_agnt_rts_reset where mad_npn=:npnID and CONNECTORID in (:brokerID)',
                'delete from mad_agnt_rel_t where mad_npn=:npnID and CONNECTORID in (:brokerID)',
                'delete from mld_lic_det_t where mld_npn=:npnID and mld_CONNECTORID in (:brokerID)',
                'delete from map_appt_det_t where map_npn=:npnID and map_CONNECTORID in (:brokerID)',
                'delete from map_auto_appt_ignre_t where map_npn=:npnID and map_CONNECTORID in (:brokerID)',
                'delete from mcd_prd_cert_det_t where mcd_npn=:npnID and CONNECTORID in (:brokerID)',
                'delete from mac_annual_cert_det_t where mac_npn=:npnID and CONNECTORID in (:brokerID)',
                'delete from mrt_regional_training_t where mrt_npn=:npnID and CONNECTORID in (:brokerID)',
                'delete from mar_agt_rej_t where mar_npn =:npnID and CONNECTORID in (:brokerID)',
                'delete from mar_med_agnt_rel_t where mar_npn =:npnID and mar_CONNECTORID in (:brokerID)',
                'delete from mas_agt_sts_t where mas_npn =:npnID and CONNECTORID in (:brokerID)',
                'delete from maa_agnt_agng_t where maa_npn =:npnID and maa_CONNECTORID in (:brokerID)',
            ]
            let sqlResult = await executeSqlDeletes(deleteQueries, state.archiveAgentResults.npn, state.archiveAgentResults.brokerToRemove)
            let attachmentContent = JSON.stringify(sqlResult, null, 2)
            let status = await createJIRAttachment(attachmentContent, state, "DELETE_Operation_deleteQueryResults")
            console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'Delete Agent Archive Query', detail: { status: status, message: `Completed delete  Request` } } }));

        }
        // const fileBuffer = Buffer.from(attachmentContent, "utf8");
        // const timestamp = Date.now();
        // let fileName = `${state.archiveAgentResults.requestNumber}_${timestamp}.txt`;
        // let uploadStatus = await attacheFilestoJIRATask(state.archiveAgentResults.jiraID, fileBuffer, fileName, 'txt')
        //console.log(uploadStatus)
        // return agentRecords;



    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'processAgentArchivalRequest', detail: { error: error.message } } }));

        //console.error('[processAgentArchivalRequest] Error:', error.message);
        return [];
    }
}


async function getExistingArchivalRequest(requestID) {
    try {
        if (!requestID) return [];

        const db = await connectToDatabase(dbName);
        const collection = db.collection(collectionName);

        const agentRecords = await collection.findOne(
            { requestNumber: requestID, type: 'agent_archive' }
        );


        if (!agentRecords) return [];

        // Convert stored conversation into messages format


        return agentRecords;
    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'getExistingArchivalRequest', detail: { error: error.message } } }));

        // console.error('[getExistingArchivalRequest] Error:', error.message);
        return [];
    }
}



async function getListofArchiveRequest() {
    try {


        // const db = await connectToDatabase('team-bcs-db');
        // const collection = db.collection('BCS_AGENT_ARCHIVAL');
        // collection.createIndex({ createdAt: -1 })
        //const agentTotalRecords = await collection.find({ type: 'agent_archive' }).toArray();

        //const agentTopRecords = await collection.find({ type: 'agent_archive' }, { projection: { brokerToRemoveID:1,requestNumber:1, npn: 1, jiraID: 1, _id: 0 }}).sort({ _id: -1 }).limit(5).toArray();
        const [agentlatestRecords, agentTotalRecords] = await Promise.all([
            await findRecords(dbName, collectionName, { type: 'agent_archive' }, { projection: { brokerToRemoveID: 1, requestNumber: 1, npn: 1, jiraID: 1, _id: 0 } }, { _id: -1 }, 5),
            //collection.find({ type: 'agent_archive' }, { projection: { brokerToRemoveID: 1, requestNumber: 1, npn: 1, jiraID: 1, _id: 0 } }).sort({ _id: -1 }).limit(5).toArray(),
            await countRecords(dbName, collectionName, { type: 'agent_archive' })
            //collection.countDocuments({ type: 'agent_archive' }) // Much more accurate and optimized than legacy count()
        ]);


        if (!agentTotalRecords) return [];

        // Convert stored conversation into messages format


        return { agentlatestRecords, agentTotalRecords };
    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'getListofArchiveRequest', detail: { error: error.message } } }));


        return [];
    }
}

async function getExistingArchivalNPNRequest(npnID, brokerToRemove) {
    try {
        if (!npnID) return [];

        const db = await connectToDatabase(dbName);
        const collection = db.collection(collectionName);


        //const res = await collection.deleteOne({ npn: "21303342" })
        const agentRecords = await findSingleRecord(dbName, collectionName, { npn: npnID, type: 'agent_archive', brokerToRemoveName: { $in: brokerToRemove } }, 'getExistingArchivalNPNRequest');
        ///const agentRecords = await collection.findOne(
        //   { npn: npnID, type: 'agent_archive', brokerToRemoveName: { $in: brokerToRemove } }        );


        if (!agentRecords) return [];

        // Convert stored conversation into messages format


        return agentRecords;
    } catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'getExistingArchivalNPNRequest', detail: { error: error.message } } }));

        // console.error('[getExistingArchivalNPNRequest] Error:', error.message);
        return [];
    }
}

async function saveArchiveRequest(sessionId, nuid, userPrompt, requestNumber, emailBody, jiraID, results, npn, brokerID_remove, brokerToRemove) {
    try {
        if (!requestNumber) {
            console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'savearchiveRequest', detail: { warning: 'No emailSubject provided — skipping save' } } }));


            //console.warn('[savearchiveRequest] No emailSubject provided — skipping save');
            return;
        }

        //const db = await connectToDatabase('team-bcs-db');
        //const collection = db.collection('BCS_AGENT_ARCHIVAL');
        const filter = { requestNumber, type: 'agent_archive' }
        const query = {
            $set: {

                nuid: nuid || 'unknown',
                updatedAt: new Date(),
                currentStatus: "Completed",
                result: results

            },
            $setOnInsert: {
                createdAt: new Date(),
                npn: npn,
                initialStatus: "New",
                brokerToRemoveID: brokerID_remove,
                brokerToRemoveName: brokerToRemove,

                jiraID: jiraID,
                requestNumber: requestNumber,
                type: 'agent_archive',



            },
            $push: {
                emailBody: emailBody
            }
        }
        const response = await updateSingleRecord(dbName, collectionName, filter, query, 'saveArchiveRequest')


        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'saveArchiveRequest', detail: { message: `Saved records into MongoDB for session ${sessionId}` } } }));


        return response
    }


    // // Upsert: find existing session doc, push new turn to conversation array
    // await collection.updateOne(
    //     { requestNumber, type: 'agent_archive' },
    //     {
    //         $set: {

    //             nuid: nuid || 'unknown',
    //             updatedAt: new Date(),
    //             currentStatus: "Completed",
    //             result: results

    //         },
    //         $setOnInsert: {
    //             createdAt: new Date(),
    //             npn: npn,
    //             initialStatus: "New",
    //             brokerToRemoveID: brokerID_remove,
    //             brokerToRemoveName: brokerToRemove,

    //             jiraID: jiraID,
    //             requestNumber: requestNumber,
    //             type: 'agent_archive',



    //         },
    //         $push: {
    //             emailBody: emailBody
    //         }
    //     },
    //     { upsert: true }
    // );

    catch (error) {
        console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'saveArchiveRequest', detail: { error: error.message } } }));

        //console.error('[SaveMongoDB] Error saving conversation:', error.message);
        // Non-blocking — don't fail the main flow
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


async function executeSqlDeletes(deleteQueries, npnID, brokerToRemove) {


    const results = [];

    try {
        for (const query of deleteQueries) {
            try {
                let params = { npnID: npnID, brokerID: brokerToRemove }
                const result = await deleteRecords(query, params)


                results.push({
                    query: query,
                    npn: npnID,
                    brokerID: brokerToRemove,
                    success: true,
                    result: result
                });
            } catch (error) {
                results.push({
                    query,
                    npn: npnID,
                    brokerID: brokerToRemove,
                    success: false,
                    rowsAffected: 0,
                    error: error.message
                });
            }
        }



        return results;

    } catch (error) {

        throw error;

    }

}


function getUTCTimestamp(date = new Date()) {
    return date.toISOString()        // "2026-08-13T12:30:45.123Z"
        .replace(/[-T:]/g, '')         // "20260813123045.123Z"
        .split('.')[0]                 // "20260813123045"
        .replace(/^(\d{8})(\d{6})$/, '$1_$2'); // "20260813_123045"
}
export async function agentArchivalNode(state) {
    try {
        // const result = await sendEmail({
        //     to: "vinothkumar.c.natarajan@kp.org",
        //     subject:"Testing Email",
        //     text:"HI- Text",
        //     html:""
        //   });

        const parsedJsonSummary = JSON.parse(state.identifiers);//JSON vs array check to be added

        let npnID = parsedJsonSummary.npn_id
        let brokerToRemove = parsedJsonSummary.broker_remove

        let brokerToRetain = parsedJsonSummary.broker_retain
        let subcategory = parsedJsonSummary.subcategory
        if (subcategory == "metrics") {
            let { agentlatestRecords, agentTotalRecords } = await getListofArchiveRequest()
            let requiresArchiveAgentApproval = false;
            return {
                ...state, archiveAgentResults: { npn: '', brokerToRemove: '', requestNumber: '', emailsubject: '', jiraID: '', subcategory: subcategory, agentRecords: agentlatestRecords, recordCount: agentTotalRecords }, requiresArchiveAgentApproval
            };
        }
        else {
            let existingRequest = await getExistingArchivalNPNRequest(npnID, brokerToRemove)
            if (Object.keys(existingRequest).length > 0) {
                let requiresArchiveAgentApproval = false;
                return {
                    ...state, archiveAgentResults: { npn: npnID, brokerToRemove: brokerToRemove, requestNumber: existingRequest['requestNumber'], emailsubject: 'Request Already Exist', jiraID: existingRequest['jiraID'], subcategory: subcategory }, requiresArchiveAgentApproval
                };

            }
            else {
                const currentDate = new Date().toString();
                const defaultSystemMessage = {
                    role: "system",
                    content: `
    Role:You are an Broker ID extraction agent.
    Your job is to extract broker ID for both brokerToRemove  from the provided user query and generate output as per given format.

    Input Query: ${state.userPrompt}
    Broker to Remove: ${brokerToRemove}
    brokerMapping = {
            'ARHE': 350631,
            'PREMIER': 397515, 'PRE': 397515,
            'INTEGRITY': 397750, 'INT': 397750,
            'APTIA': 409671, 'APT': 409671,
            'GOHEALTH': 386235, 'GH': 386235,
            'SELECTQUOTE': 386282, 'SQ': 386282,
            'TRANZACT': 386285, 'TZ': 386285,
            'TW': 360849,
            'EHEALTH': 361764, 'EH': 361764,
            'GS NATIONAL': 384193, 'GSN': 384193,
            'HEALTH MARKET': 384190, 'HM': 384190,
            'AMERILIFE': 417444, 'AML': 417444,
            'HPONE': 411053,
            'OPTUM':333333,
            'BALDWIN': 424094,
            'CONCENTRIX':444444	
        };
    Extraction Rule
    Using the Input Query, identifier and broker Mapping provided, extract the brokerToRemove ID

    Output Format:
    {"brokerToRemove":Comma separated Broker ID from Mapping}

    Output Rule:
    Only provide the output in format asked
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
                const intentResponse = response;
                const brokerIDRemove = intentResponse
                    .replace(/```json|```/g, "")
                    .trim();
                const parsedBrokerJson = JSON.parse(brokerIDRemove);//JSON vs array check to be added

                let brokerRemove = parsedBrokerJson.brokerToRemove

                let sqlQuery = '';
                let keys = []

                let excelSasUrl = "";
                let pivotResults;
                const bindsParam = {}


                let oracleResponse = []
                let dbResults;
                if (brokerRemove != '') {
                    sqlQuery = `SELECT count(MAD_NPN) as TotalRecords from mad_agnt_det_t where mad_npn=:npnID and CONNECTORID in (:brokerID)`
                    dbResults = await queryOracleDB(sqlQuery, { npnID: npnID, brokerID: brokerRemove })
                }
                else {
                    sqlQuery = `SELECT count(MAD_NPN) as TotalRecords from mad_agnt_det_t where mad_npn=:npnID`
                    dbResults = await queryOracleDB(sqlQuery, { npnID: npnID })
                }




                let brokerQueryResult = dbResults[0]['TOTALRECORDS']
                if (brokerQueryResult > 0) {

                    let requestNumber = `Req-NPN_${npnID}_${getUTCTimestamp()}`
                    let emailSubject = `Agent Archival Request  - ${requestNumber}`
                    let jirasummary = `As per the request below to archive the Agent, we have identified the following details and require your approval before proceeding.</p>

    Input Query:${state.userPrompt}
    Broker Mapping: ${brokerRemove}
    Number of Mapped Broker Records: ${brokerQueryResult}
    `
                    let issueKey = await createJIRATask(emailSubject, jirasummary)
                    //let issueKey = 'BCS-6057'

                    let emailBody = `<p>Hi Team,</p>

    <p>As per the request below to archive the Agent, we have identified the following details and require your approval before proceeding.</p>

    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
        <tr>
            <td><b>Input Query</b></td>
            <td>${state.userPrompt}</td>
        </tr>
        <tr>
            <td><b>Broker Mapping</b></td>
            <td>${brokerRemove}</td>
        </tr>
        <tr>
            <td><b>Number of Mapped Broker Records</b></td>
            <td>${brokerQueryResult}</td>
        </tr>
        <tr>
            <td><b>JIRA ID to validate outcomes</b></td>
            <td><a href="https://jira-aes.kp.org/browse/${issueKey} style="color: #1a73e8; text-decoration: none; font-weight: bold;">${issueKey}</a></td>
        

        </tr>
    </table>

    <p>
    Please reply to this email with <b>Approved</b> or <b>Rejected</b> to indicate your decision.
    </p>

    <p>Thank you.</p>`

                    //Uncomment below on 08/18/26 Send email commented to bypass it


                    const result = await sendEmail({

                        to: process.env[`host.${envName}-aiportal-web-2.bcs.emailid`],
                        subject: emailSubject,
                        text: '',
                        html: emailBody
                    });
                    // console.log(result)

                    await saveArchiveRequest(state.sessionID, state.nuid, state.userPrompt, requestNumber, emailBody, issueKey, '', npnID, brokerRemove, brokerToRemove)
                    let requiresArchiveAgentApproval = true;
                    //let res = await getExistingArchivalRequest(requestNumber)

                    // console.log(res)

                    // console.log(dbResults)

                    return {
                        ...state, archiveAgentResults: { npn: npnID, brokerToRemove: brokerRemove, requestNumber: requestNumber, emailsubject: emailSubject, jiraID: issueKey, subcategory: subcategory }, requiresArchiveAgentApproval
                    };
                }
                else {
                    let requiresArchiveAgentApproval = false;
                    return {
                        ...state, archiveAgentResults: { npn: npnID, brokerToRemove: brokerRemove, requestNumber: 'NA', emailsubject: 'Give Broker is not Mapped to the NPN. Hence No action taken ', jiraID: 'NA', subcategory: subcategory }, requiresArchiveAgentApproval
                    };
                }
            }
        }

    } catch (e) {
        console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'agentArchivalNode', detail: { error: error.message } } }));



        //console.warn('[agentArchivalNode]] Failed to process :', e.message);
        return {
            ...state, archiveAgentResults: {}
        };
    }
}