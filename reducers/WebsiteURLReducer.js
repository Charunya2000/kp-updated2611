'use client';

import updateArray from './reducerUtility';

const initialState = {
  websiteURLs: [],
  selectedWebsiteURL: null,
};

export default function websiteURLReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_WEBSITE_URLS': {
      const newState = { ...state, websiteURLs: action.websiteURLs };
      return newState;
    }
    case 'CREATE_WEBSITE_URL': {
      const newState = { ...state, websiteURLs: [...state.websiteURLs, action.websiteURL], selectedWebsiteURL: action.websiteURL };
      return newState;
    }
    case 'SELECT_WEBSITE_URL': {
      const selectedWebsiteURL = state.websiteURLs.find(websiteURL => websiteURL.id === action.id);
      const newState = { ...state, selectedWebsiteURL };
      return newState;
    }
    case 'UPDATE_WEBSITE_URL': {
      const newState = { ...state, websiteURLs: updateArray(state.websiteURLs, action.websiteURL), selectedWebsiteURL: action.websiteURL };
      return newState;
    }
    case 'DELETE_WEBSITE_URL': {
      const newState = { ...state, websiteURLs: state.websiteURLs.filter(websiteURL => websiteURL.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}