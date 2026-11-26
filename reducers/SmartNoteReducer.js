'use client';

import updateArray from './reducerUtility';

const initialState = {
  smartNotes: [],
  selectedSmartNote: null,
};

export default function smartNoteReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SMART_NOTES': {
      const newState = { ...state, smartNotes: action.smartNotes };
      return newState;
    }
    case 'CREATE_SMART_NOTE': {
      const newState = { ...state, smartNotes: [...state.smartNotes, action.smartNote], selectedSmartNote: action.smartNote };
      return newState;
    }
    case 'SELECT_SMART_NOTE': {
      const selectedSmartNote = state.smartNotes.find(smartNote => smartNote.id === action.id);
      const newState = { ...state, selectedSmartNote };
      return newState;
    }
    case 'UPDATE_SMART_NOTE': {
      const newState = { ...state, smartNotes: updateArray(state.smartNotes, action.smartNote), selectedSmartNote: action.smartNote };
      return newState;
    }
    case 'DELETE_SMART_NOTE': {
      const newState = { ...state, smartNotes: state.smartNotes.filter(smartNote => smartNote.id !== action.id) };
      return newState;
    }
    case 'CLEAR_SMART_NOTES': {
      return { ...state, smartNotes: [] };
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}