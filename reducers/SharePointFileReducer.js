'use client';

import updateArray from './reducerUtility';

const initialState = {
  sharePointFiles: [],
  selectedSharePointFile: null,
};

export default function sharePointFileReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SHAREPOINT_FILES': {
      const newState = { ...state, sharePointFiles: action.sharePointFiles };
      return newState;
    }
    case 'CREATE_SHAREPOINT_FILE': {
      const newState = { ...state, sharePointFiles: [...state.sharePointFiles, action.sharePointFile], selectedSharePointFile: action.sharePointFile };
      return newState;
    }
    case 'SELECT_SHAREPOINT_FILE': {
      const selectedSharePointFile = state.sharePointFiles.find(sharePointFile => sharePointFile.id === action.id);
      const newState = { ...state, selectedSharePointFile };
      return newState;
    }
    case 'UPDATE_SHAREPOINT_FILE': {
      const newState = { ...state, sharePointFiles: updateArray(state.sharePointFiles, action.sharePointFile), selectedSharePointFile: action.sharePointFile };
      return newState;
    }
    case 'DELETE_SHAREPOINT_FILE': {
      const newState = { ...state, sharePointFiles: state.sharePointFiles.filter(sharePointFile => sharePointFile.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}