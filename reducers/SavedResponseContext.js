'use client';

import { createContext, useContext, useReducer } from 'react';
import savedResponseReducer from './SavedResponseReducer';
import PropTypes from 'prop-types';

const SavedResponseContext = createContext(null);
const SavedResponseDispatchContext = createContext(null);

const initialState = {
  savedResponses: [],
  selectedSavedResponse: null,
};

export function SavedResponseProvider({ children }) {
  const [state, dispatch] = useReducer(
    savedResponseReducer,
    initialState
  );

  return (
    <SavedResponseContext.Provider value={state}>
      <SavedResponseDispatchContext.Provider value={dispatch}>
        {children}
      </SavedResponseDispatchContext.Provider>
    </SavedResponseContext.Provider>
  );
}

export function useSavedResponses() {
  return useContext(SavedResponseContext);
}

export function useSavedResponsesDispatch() {
  return useContext(SavedResponseDispatchContext);
}

SavedResponseProvider.propTypes = {
  children: PropTypes.node.isRequired,
};