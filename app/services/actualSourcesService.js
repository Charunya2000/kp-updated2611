import { getServerSession } from '@utils/getSession';
import { selectSources } from '@services/sourceService';
import { selectDesignReferences } from '@services/designReferenceService';
import { selectSavedResponses } from '@services/savedResponseService';
import { selectSavedNotes } from '@services/savedNoteService';
import { selectUploadedDocuments } from '@services/uploadedDocumentService';
import { selectDesignIndexs } from '@services/designIndexService';
import { selectWebsiteURLs } from '@services/websiteURLService';
import { selectSharePointFiles } from './sharePointService';
import { selectJiraIssues } from '@services/jiraIssueService';

export async function selectRelatedDesignReferences(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'DesignReference', parentId: smartNoteId, nuid: nuid };
  const sources = await selectDesignReferences(query, teamName);
  return sources;
}

export async function selectRelatedSavedResponses(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'SavedResponse', parentId: smartNoteId, nuid: nuid };
  const sources = await selectSavedResponses(query, teamName);
  return sources;
}

export async function selectRelatedSavedNotes(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'SavedNote', parentId: smartNoteId, nuid: nuid };
  const sources = await selectSavedNotes(query, teamName);
  return sources;
}

export async function selectRelatedDesignIndexes(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'DesignIndex', parentId: smartNoteId, nuid: nuid };
  const sources = await selectDesignIndexs(query, teamName);
  return sources;
}

export async function selectRelatedWebsiteURLs(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'WebsiteURL', parentId: smartNoteId, nuid: nuid };
  const sources = await selectWebsiteURLs(query, teamName);
  return sources;
}

export async function selectRelatedConfluenceURLs(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'WebsiteURL', variant: 'ConfluenceURL', parentId: smartNoteId, nuid: nuid };
  const sources = await selectWebsiteURLs(query, teamName);
  return sources;
}

export async function selectRelatedJiraIssues(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'JiraIssue', parentId: smartNoteId, nuid: nuid };
  const sources = await selectJiraIssues(query, teamName);
  return sources;
}

export async function selectRelatedUploadedDocuments(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'UploadedDocument', parentId: smartNoteId, nuid: nuid };
  const sources = await selectUploadedDocuments(query, teamName);
  return sources;
}

export async function selectRelatedSharePointFiles(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'SharePointFile', parentId: smartNoteId, nuid: nuid };
  const sources = await selectSharePointFiles(query, teamName);
  return sources;
}

export async function selectJustSources(smartNoteId, teamName) {
  const { nuid } = await getServerSession();
  const query = { type: 'Source', parentId: smartNoteId, nuid: nuid, selected: true };
  const sources = await selectSources(query, teamName);
  return sources;
}