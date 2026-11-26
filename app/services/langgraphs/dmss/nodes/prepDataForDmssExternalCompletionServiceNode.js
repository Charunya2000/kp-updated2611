import { selectRelatedUploadedDocuments, selectRelatedSavedResponses, selectRelatedSavedNotes } from '@services/actualSourcesService';

export const prepDataForDmssExternalCompletionServiceNode = async (state) => {
  const selectedSources = state.sources.filter(source => source.selected);

  const asSource = selectedSources.find(s => s.category === "Assignment Sheet");
  const lettersSource = selectedSources.filter(s => s.category === "Letter").map(s => s.sourceId);
  const testCaseTemplateSource = selectedSources.filter(s => s.category === "Test Case Template").map(s => s.sourceId);
  const uploadedNoteSource = selectedSources.filter(s => s.category === "Uploaded Note").map(s => s.sourceId);
  const responses = selectedSources.filter(s => s.sourceType === "SavedResponse").map(s => s.sourceId);
  const notes = selectedSources.filter(s => s.sourceType === "SavedNote").map(s => s.sourceId);

  const actualSources = await selectRelatedUploadedDocuments(state.smartNoteId, state.teamName);
  const savedReponses = await selectRelatedSavedResponses(state.smartNoteId, state.teamName);
  const savedNotes = await selectRelatedSavedNotes(state.smartNoteId, state.teamName);

  return {
    assignmentSheet: asSource ? actualSources.find(doc => doc.id === asSource.sourceId) : null,
    letters: lettersSource ? actualSources.filter(doc => lettersSource.includes(doc.id)) : null,
    testCaseTemplates: testCaseTemplateSource ? actualSources.filter(doc => testCaseTemplateSource.includes(doc.id)) : null,
    uploadedNotes: uploadedNoteSource ? actualSources.filter(doc => uploadedNoteSource.includes(doc.id)) : null,
    savedResponsesContent: savedReponses?.filter(response => responses.includes(response.id))?.map(response => response.responseMarkdown) ?? null,
    savedNotesContent: savedNotes?.filter(note => notes.includes(note.id))?.map(note => note.noteContent) ?? null,
    uploadedNotesExists: !!uploadedNoteSource.length,
    assignmentSheetExists: !!asSource,
    lettersExists: !!lettersSource.length,
    testCaseTemplatesExists: !!testCaseTemplateSource.length,
  }
};
