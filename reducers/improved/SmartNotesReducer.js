'use client';

const initialState = [];

export default function smartNotesReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SMART_NOTES': {
      const newState = action.smartNotes.sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1);
      return newState;
    }
    case 'DELETE_SMART_NOTE': {
      const newState = state.filter(smartNote => smartNote.id !== action.id);
      return newState;
    }
    case 'EDIT_SMART_NOTE_TITLE': {
      const newState = state.map(note =>
        note.id === action.id ? { ...note, title: action.newTitle } : note
      );
      return newState;
    }
    case 'UPDATE_SMART_NOTE': {
      const updatedNote = action.smartNote;
      return state.map(note =>
        note.id === updatedNote.id ? updatedNote : note
      );
    }
    case 'CLEAR_SMART_NOTES': {
      return initialState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}