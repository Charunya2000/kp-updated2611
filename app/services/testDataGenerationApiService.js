'use server';

import { deleteDocument } from '@db/deleteDocument';
import { insertDocument } from '@db/insertDocument';
import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { updateDocument } from '@db/updateDocument';
import { prepDocument } from '@clientServices/insertDocument';
import { validateDocumentDelete, validateBasicMulti } from '@services/validation';
import { getServerSession } from "@/utils/getSession";

export const generateTestData = async (requestData) => {
  try {
    const envName = process.env['envName'];
    const backendBaseUrl = process.env.ORCHESTRATION_APP_URL
    const endpoint = `${backendBaseUrl}/api/v3/hppdm/reqcomplex`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      },
      body: requestData
    });

    return await response.json();
  } catch (error) {
    console.error("Error generating test data:", error);
    throw new Error("Failed to generate test data");
  }
}

export const getTestDataGenerationStatus = async (taskId) => {
  try {
    const envName = process.env['envName'];
    const backendBaseUrl = process.env.ORCHESTRATION_APP_URL
    const endpoint = `${backendBaseUrl}/api/v3/hppdm/reqcomplex/status/${taskId}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json;odata=verbose',
        'Accept': 'application/json;odata=verbose'
      },
    });

    return await response.json();
  } catch (error) {
    console.error("Error fetching test data generation status:", error);
    throw new Error("Failed to fetch test data generation status");
  }
}

export async function saveTestDataGenJob(teamName, job) {
  const session = await getServerSession();
  // job should include: jobID, issueKey, jobStatus, downloadURL
  const doc = {
    ...job,
    nuid: session.nuid,
    type: 'TestDataGenJob',
  };

  const preparedDoc = await prepDocument(doc);
  // job should include: id, createdAt, updatedAt
  return await insertDocument(preparedDoc, validateDocumentDelete, `team-${teamName}-db`);
}

export async function getAllTestDataGenJobs(teamName) {
  const session = await getServerSession();
  // Only return jobs created within the last 24 hours for this user
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const jobs = await selectDocumentsExt(
    {
      type: 'TestDataGenJob',
      nuid: session.nuid,
      updatedAt: { $gte: twentyFourHoursAgo }
    }, validateBasicMulti, null, `team-${teamName}-db`
  );

  return jobs || [];
}

export async function getTestDataGenJobByJobID(teamName, jobID) {
  const session = await getServerSession();
  const nuid = session.nuid;

  return await selectDocumentExt(
    { type: 'TestDataGenJob', jobID, nuid },
    validateBasicMulti, null, `team-${teamName}-db`
  );
}

export async function updateTestDataGenJob(teamName, jobUpdate) {
  const session = await getServerSession();
  const nuid = session.nuid;

  const query = {
    jobID: jobUpdate.jobID,
    type: 'TestDataGenJob',
    nuid
  };

  const result = await updateDocument(jobUpdate, query, validateDocumentDelete, `team-${teamName}-db`);
  return result;
}

export async function deleteTestDataGenJob(teamName) {
  const session = await getServerSession();
  const nuid = session.nuid;

  const query = { id, type: 'TestDataGenJob', nuid };
  return await deleteDocument(query, validateDocumentDelete, `team-${teamName}-db`);
}

