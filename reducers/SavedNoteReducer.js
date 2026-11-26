'use client';

import updateArray from './reducerUtility';

const initialState = {
  savedNotes: [],
  selectedSavedNote: null,
};

export default function savedNoteReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SAVED_NOTES': {
      const newState = { ...state, savedNotes: action.savedNotes };
      return newState;
    }
    case 'CREATE_SAVED_NOTE': {
      const newState = { ...state, savedNotes: [...state.savedNotes, action.savedNote], selectedSavedNote: action.savedNote };
      return newState;
    }
    case 'SELECT_SAVED_NOTE': {
      const selectedSavedNote = state.savedNotes.find(savedNote => savedNote.id === action.id);
      const newState = { ...state, selectedSavedNote };
      return newState;
    }
    case 'UPDATE_SAVED_NOTE': {
      const newState = { ...state, savedNotes: updateArray(state.savedNotes, action.savedNote), selectedSavedNote: action.savedNote };
      return newState;
    }
    case 'DELETE_SAVED_NOTE': {
      const newState = { ...state, savedNotes: state.savedNotes.filter(savedNote => savedNote.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}