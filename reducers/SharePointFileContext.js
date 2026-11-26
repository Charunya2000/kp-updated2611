'use client';

import { createContext, useContext, useReducer } from 'react';
import sharePointFileReducer from './SharePointFileReducer';
import PropTypes from 'prop-types';

const SharePointFileContext = createContext(null);
const SharePointFileDispatchContext = createContext(null);

const initialState = {
  sharePointFiles: [],
  selectedSharePointFile: null,
};

export function SharePointFileProvider({ children }) {
  const [state, dispatch] = useReducer(
    sharePointFileReducer,
    initialState
  );

  return (
    <SharePointFileContext.Provider value={state}>
      <SharePointFileDispatchContext.Provider value={dispatch}>
        {children}
      </SharePointFileDispatchContext.Provider>
    </SharePointFileContext.Provider>
  );
}

export function useSharePointFiles() {
  return useContext(SharePointFileContext);
}

export function useSharePointFilesDispatch() {
  return useContext(SharePointFileDispatchContext);
}

SharePointFileProvider.propTypes = {
  children: PropTypes.node.isRequired,
};