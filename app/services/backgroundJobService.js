'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { validateBasicMulti, validateBasicSingleByName, validateBasicSingle, validateDocumentDelete } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { insertDocument } from '@/db/insertDocument';
import { updateDocument } from '@/db/updateDocument';
import { deleteDocument } from '@/db/deleteDocument';
import { connectToDatabase } from '@/db/connection';


const JOB_TYPE_PREFIX = 'BackgroundJob';
const APP_JOB_DB_NAME = 'aisvc_userdb';

function getTeamJobDbName(teamName) {
  return `team-${teamName}-db`;
}

export async function getJobByName(teamName, jobType, name) {
  return await selectDocumentExt({ type: JOB_TYPE_PREFIX, jobType, name }, validateBasicMulti, getTeamJobDbName(teamName));
};

export async function getJobByJobType(teamName, jobType) {
  return await selectDocumentExt({ type: JOB_TYPE_PREFIX, jobType }, validateBasicMulti, null, getTeamJobDbName(teamName));
};

export async function getJobById(teamName, id) {
  return await selectDocumentExt({ type: JOB_TYPE_PREFIX, id }, validateBasicSingle, {}, getTeamJobDbName(teamName));
};

export async function getAllJobs(teamName, jobType) {
  return await selectDocumentsExt({ type: JOB_TYPE_PREFIX, jobType }, validateBasicMulti, null, getTeamJobDbName(teamName));
}

export async function createJob(teamName, jobType, jobData) {
  try {
    const newJob = prepDocument({
      ...jobData,
      type: JOB_TYPE_PREFIX,
      jobType: jobType,
    });

    return await insertDocument(newJob, validateBasicMulti, getTeamJobDbName(teamName));
  } catch (error) {
    console.error('Error creating job:', error);
    return false;
  }
}

export async function updateJob(teamName, id, newJobData) {
  try {
    const updatedJob = {
      ...newJobData,
      type: JOB_TYPE_PREFIX,
      updatedAt: new Date(),
    };

    const db = await connectToDatabase(`team-${teamName}-db`);
    const query = { type: JOB_TYPE_PREFIX, id };
    const result = await db.collection('user_collection').updateOne(query, { $set: updatedJob });

    if (result?.modifiedCount > 0 || result?.matchedCount > 0) {
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'updateBackgroundJob',
          detail: { teamName, id, modifiedCount: result.modifiedCount }
        }
      }));
      return { ...updatedJob, id };
    }

    return null;
  } catch (error) {
    console.error('Error updating job:', error);
    return false;
  }
}

export async function deleteJob(teamName, jobType, id) {
  try {
    const query = {
      type: JOB_TYPE_PREFIX,
      jobType: jobType,
      id: id
    };

    return await deleteDocument(query, validateDocumentDelete, getTeamJobDbName(teamName));
  } catch (error) {
    console.error('Error deleting job:', error);
    return false;
  }
}

export async function getAppJobById(id) {
  return await selectDocumentExt({ type: JOB_TYPE_PREFIX, id }, validateBasicSingle, {}, APP_JOB_DB_NAME);
}

export async function getAllAppJobsByType(jobType) {
  return await selectDocumentsExt({ type: JOB_TYPE_PREFIX, jobType }, validateBasicMulti, null, APP_JOB_DB_NAME);
}

export async function createAppJob(jobType, jobData) {
  try {
    const newJob = prepDocument({
      ...jobData,
      type: JOB_TYPE_PREFIX,
      jobType,
    });

    return await insertDocument(newJob, validateBasicMulti, APP_JOB_DB_NAME);
  } catch (error) {
    console.error('Error creating app job:', error);
    return false;
  }
}

export async function updateAppJob(id, newJobData) {
  try {
    const updatedJob = {
      ...newJobData,
      type: JOB_TYPE_PREFIX,
    };

    return await updateDocument(
      updatedJob,
      { type: JOB_TYPE_PREFIX, id },
      validateBasicMulti,
      APP_JOB_DB_NAME
    );
  } catch (error) {
    console.error('Error updating app job:', error);
    return false;
  }
}

export async function deleteAppJob(jobType, id) {
  try {
    return await deleteDocument(
      { type: JOB_TYPE_PREFIX, jobType, id },
      validateDocumentDelete,
      APP_JOB_DB_NAME
    );
  } catch (error) {
    console.error('Error deleting app job:', error);
    return false;
  }
}