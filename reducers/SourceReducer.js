'use client';

import updateArray from './reducerUtility';

const initialState = {
  sources: [],
  selectedSource: null,
};

export default function sourceReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SOURCES': {
      const newState = { ...state, sources: action.sources };
      return newState;
    }
    case 'CREATE_SOURCE': {
      const newState = { ...state, sources: [...state.sources, action.source], selectedSource: action.source };
      return newState;
    }
    case 'SELECT_SOURCE': {
      const selectedSource = state.sources.find(source => source.id === action.id);
      const newState = { ...state, selectedSource };
      return newState;
    }
    case 'UPDATE_SOURCE': {
      const newState = { ...state, sources: updateArray(state.sources, action.source), selectedSource: action.source };
      return newState;
    }
    case 'UPDATE_OR_CREATE_SOURCE': {
      let newState = null;
      const foundSource = state.sources.find(source => source.sourceId === action.source.sourceId);
      if (foundSource) {
        newState = { ...state, sources: updateArray(state.sources, action.source), selectedSource: action.source };
      }
      else {
        newState = { ...state, sources: [...state.sources, action.source], selectedSource: action.source };
      }
      return newState;
    }
    case 'DELETE_SOURCE': {
      const newState = { ...state, sources: state.sources.filter(source => source.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}