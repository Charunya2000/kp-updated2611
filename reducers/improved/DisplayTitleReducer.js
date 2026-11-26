'use client';

const initialState = null;

export default function displayTitleReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_DISPLAY_TITLE': {
      const newState = action.displayTitle;
      return newState;
    }
    case 'UPDATE_DISPLAY_TITLE': {
      const newState = { ...state, ...action.displayTitle };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}