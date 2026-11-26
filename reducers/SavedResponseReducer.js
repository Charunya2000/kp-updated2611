'use client';

import updateArray from './reducerUtility';

const initialState = {
  savedResponses: [],
  selectedSavedResponse: null,
};

export default function savedResponseReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SAVED_RESPONSES': {
      const newState = { ...state, savedResponses: action.savedResponses };
      return newState;
    }
    case 'CREATE_SAVED_RESPONSE': {
      const newState = { ...state, savedResponses: [...state.savedResponses, action.savedResponse], selectedSavedResponse: action.savedResponse };
      return newState;
    }
    case 'SELECT_SAVED_RESPONSE': {
      const selectedSavedResponse = state.savedResponses.find(savedResponse => savedResponse.id === action.id);
      const newState = { ...state, selectedSavedResponse };
      return newState;
    }
    case 'UPDATE_SAVED_RESPONSE': {
      const newState = { ...state, savedResponses: updateArray(state.savedResponses, action.savedResponse), selectedSavedResponse: action.savedResponse };
      return newState;
    }
    case 'DELETE_SAVED_RESPONSE': {
      const newState = { ...state, savedResponses: state.savedResponses.filter(savedResponse => savedResponse.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}