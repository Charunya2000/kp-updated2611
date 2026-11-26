'use client';

import { createContext, useContext, useReducer } from 'react';
import websiteURLReducer from './WebsiteURLReducer';
import PropTypes from 'prop-types';

const WebsiteURLContext = createContext(null);
const WebsiteURLDispatchContext = createContext(null);

const initialState = {
  websiteURLs: [],
  selectedWebsiteURL: null,
};

export function WebsiteURLProvider({ children }) {
  const [state, dispatch] = useReducer(
    websiteURLReducer,
    initialState
  );

  return (
    <WebsiteURLContext.Provider value={state}>
      <WebsiteURLDispatchContext.Provider value={dispatch}>
        {children}
      </WebsiteURLDispatchContext.Provider>
    </WebsiteURLContext.Provider>
  );
}

export function useWebsiteURLs() {
  return useContext(WebsiteURLContext);
}

export function useWebsiteURLsDispatch() {
  return useContext(WebsiteURLDispatchContext);
}

WebsiteURLProvider.propTypes = {
  children: PropTypes.node.isRequired,
};