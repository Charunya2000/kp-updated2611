'use client';

const initialState = {
  selectedPersona: null,
};

export default function personaReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SELECTED_PERSONA':
      return { ...state, selectedPersona: action.selectedPersona };
    case 'REMOVE_SELECTED_PERSONA':
      return { ...state, selectedPersona: null };
    default:
      throw new Error('Unknown action: ' + action.type);
  }
}