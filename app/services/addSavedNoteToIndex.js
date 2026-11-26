'use server';

import { insertVectorData, deleteDocument } from './insertVectorDataService';
import { vectorize } from './vectorizeDataService';
import { getServerSession } from '@utils/getSession';
import { recordUserNoteAdded } from '@services/statisticsService';

function annotateSavedNote(noteTitle, noteContent) {
  return `Saved note with title: ${noteTitle} and content: ${noteContent}`;
}

async function addSavedNote({ parentId: smartNoteId, id, noteTitle, noteContent }, teamName, assistantName = null) {
  try {
    const { nuid } = await getServerSession();
    recordUserNoteAdded(nuid, null, teamName, assistantName);
    const content = annotateSavedNote(noteTitle, noteContent);
    const contentVector = await vectorize({ nuid, content });
    const smartNoteType = 'SavedNote';
    const results = await insertVectorData({ nuid, smartNoteId, id, smartNoteType, content, contentVector })
    return results;
  } catch (error) {
    console.error(error)
    throw error;
  }
}

async function deleteSavedNote(savedNoteId) {
  try {
    const results = await deleteDocument(savedNoteId);
    return results;
  } catch (error) {
    console.error(error)
    throw error;
  }
}

export {
  addSavedNote,
  deleteSavedNote
}