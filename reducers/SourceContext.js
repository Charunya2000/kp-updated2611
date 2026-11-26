'use client';

import { createContext, useContext, useReducer, useEffect } from 'react';
import sourceReducer from './SourceReducer';
import PropTypes from 'prop-types';

const SourceContext = createContext(null);
const SourceDispatchContext = createContext(null);

const initialState = {
  sources: [],
  selectedSource: null,
};

export function SourceProvider({ children }) {
  const [state, dispatch] = useReducer(
    sourceReducer,
    initialState
  );

  return (
    <SourceContext.Provider value={state}>
      <SourceDispatchContext.Provider value={dispatch}>
        {children}
      </SourceDispatchContext.Provider>
    </SourceContext.Provider>
  );
}

export function useSources() {
  return useContext(SourceContext);
}

export function useSourcesDispatch() {
  return useContext(SourceDispatchContext);
}

SourceProvider.propTypes = {
  children: PropTypes.node.isRequired,
};