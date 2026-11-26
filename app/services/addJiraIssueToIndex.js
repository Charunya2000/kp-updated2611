'use server';

import { insertVectorData } from './insertVectorDataService';
import { vectorize } from './vectorizeDataService';
import { getServerSession } from '@utils/getSession';

function annotateJiraIssue(fields) {
  let annotation = `Jira issue of type: ${fields.issueType}, jiraKey: ${fields.jiraKey}, jiraDescription: ${fields.jiraDescription}`;
  if (fields.jiraAcceptanceCriteria) annotation += `, acceptance criteria: ${fields.jiraAcceptanceCriteria}`;
  if (fields.jiraStatus) annotation += `, status: ${fields.jiraStatus}`;
  if (fields.jiraEpicName) annotation += `, epic name: ${fields.jiraEpicName}`;
  if (fields.jiraFixVersions && Array.isArray(fields.jiraFixVersions) && fields.jiraFixVersions.length > 0) {
    const fixVersionsText = fields.jiraFixVersions.map(v => v.name || v).join(', ');
    annotation += `, fix versions: ${fixVersionsText}`;
  }
  if (fields.jiraAssigneeName) annotation += `, assignee: ${fields.jiraAssigneeName}`;
  if (fields.jiraAssigneeEmail) annotation += `, assignee email: ${fields.jiraAssigneeEmail}`;
  if (fields.jiraAssigneeNUID) annotation += `, assignee NUID: ${fields.jiraAssigneeNUID}`;
  if (fields.jiraReporterName) annotation += `, reporter: ${fields.jiraReporterName}`;
  if (fields.jiraReporterEmail) annotation += `, reporter email: ${fields.jiraReporterEmail}`;
  if (fields.jiraReporterNUID) annotation += `, reporter NUID: ${fields.jiraReporterNUID}`;
  return annotation + '.';
}

async function addJiraIssue(fields, teamName, assistantName = null) {
  try {
    const { nuid } = await getServerSession();

    // Only include non-null fields in vector data
    const vectorData = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (
        value !== null &&
        value !== undefined &&
        !(Array.isArray(value) && value.length === 0)
      ) {
        vectorData[key] = value;
      }
    });

    const content = annotateJiraIssue(fields);
    const contentVector = await vectorize({ nuid, content });
    const smartNoteType = 'JiraIssue';
    const results = await insertVectorData({
      nuid,
      smartNoteId: fields.parentId,
      id: fields.id,
      smartNoteType,
      content,
      contentVector,
      ...vectorData
    });
    return results;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export {
  addJiraIssue
}