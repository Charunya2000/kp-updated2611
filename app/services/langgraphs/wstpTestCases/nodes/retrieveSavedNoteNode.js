'use server';

import { selectJustSources, selectRelatedSavedNotes } from '@services/actualSourcesService';

export const retrieveSavedNoteNode = async (state) => {
  const foundSavedNotes = await selectRelatedSavedNotes(state.smartNoteId, state.teamName);
  const actualSources = await selectJustSources(state.smartNoteId, state.teamName);

  const filteredSavedNotes = foundSavedNotes.filter(savedNote =>
    actualSources?.some(actualSource => actualSource.sourceId === savedNote.id)
  );
  // Return the first found note's content as fileDescription
  const notes = filteredSavedNotes && filteredSavedNotes.length > 0
    ? filteredSavedNotes.map(note => note.noteContent).join('\n\n')
    : null;

  return { filteredSavedNotes: notes };
};
