import { selectSavedNotes } from "../../../savedNoteService.js";

export const getConfigNode = async (state) => {
  const smartNoteId = state.metadata?.smartNoteId;
  if (!smartNoteId) {
    throw new Error("smartNoteId is required in state");
  }

  // Query for the saved note titled 'metadata'
  const query = { type: 'SavedNote', parentId: smartNoteId, noteTitle: "metadata" }

  const notes = await selectSavedNotes(query);
  if (!notes || !Array.isArray(notes) || notes.length === 0) {
    throw new Error("No metadata savedNote found for smartNoteId: " + smartNoteId);
  }
  if (notes.length > 1) {
    throw new Error("Multiple metadata savedNotes found for smartNoteId: " + smartNoteId);
  }
  const note = notes[0];
  let config = {};
  try {
    config = JSON.parse(note.noteContent);
  } catch (err) {
    throw new Error("Failed to parse noteContent as JSON: " + err.message);
  }
  return {
    ...state,
    config
  };
};