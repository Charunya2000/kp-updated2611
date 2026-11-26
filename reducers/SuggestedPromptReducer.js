'use client';

import updateArray from './reducerUtility';

const initialState = {
  suggestedPrompts: [],
  selectedSuggestedPrompt: null,
};

export default function suggestedPromptReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SUGGESTED_PROMPTS': {
      const newState = { ...state, suggestedPrompts: action.suggestedPrompts };
      return newState;
    }
    case 'RESET_SUGGESTED_PROMPTS': {
      return initialState;
    }
    case 'CREATE_SUGGESTED_PROMPT': {
      const newState = { ...state, suggestedPrompts: [...state.suggestedPrompts, action.suggestedPrompt], selectedSuggestedPrompt: action.suggestedPrompt };
      return newState;
    }
    case 'SELECT_SUGGESTED_PROMPT': {
      const selectedSuggestedPrompt = state.suggestedPrompts.find(suggestedPrompt => suggestedPrompt.id === action.id);
      const newState = { ...state, selectedSuggestedPrompt };
      return newState;
    }
    case 'UPDATE_SUGGESTED_PROMPT': {
      const newState = { ...state, suggestedPrompts: updateArray(state.suggestedPrompts, action.suggestedPrompt), selectedSuggestedPrompt: action.suggestedPrompt };
      return newState;
    }
    case 'DELETE_SUGGESTED_PROMPT': {
      const newState = { ...state, suggestedPrompts: state.suggestedPrompts.filter(suggestedPrompt => suggestedPrompt.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}