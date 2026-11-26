'use client';

const initialState = null;

export default function smartNoteReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SMART_NOTE': {
      const newState = action.smartNote;
      return newState;
    }
    case 'UPDATE_SMART_NOTE': {
      const newState = { ...state, ...action.smartNote };
      return newState;
    }
    case 'RESET_SMART_NOTE': {
      return initialState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}