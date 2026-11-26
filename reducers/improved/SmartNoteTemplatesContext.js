'use client';

import { createContext, useContext, useReducer } from 'react';
import smartNoteTemplatesReducer from '@reducers/improved/SmartNoteTemplatesReducer';
import PropTypes from 'prop-types';

const SmartNoteTemplatesContext = createContext(null);
const SmartNoteTemplatesDispatchContext = createContext(null);

const initialState = [];

export function SmartNoteTemplatesProvider({ children }) {
  const [state, dispatch] = useReducer(
    smartNoteTemplatesReducer,
    initialState
  );

  return (
    <SmartNoteTemplatesContext.Provider value={state}>
      <SmartNoteTemplatesDispatchContext.Provider value={dispatch}>
        {children}
      </SmartNoteTemplatesDispatchContext.Provider>
    </SmartNoteTemplatesContext.Provider>
  );
}

export function useSmartNoteTemplates() {
  return useContext(SmartNoteTemplatesContext);
}

export function useSmartNoteTemplatesDispatch() {
  return useContext(SmartNoteTemplatesDispatchContext);
}

SmartNoteTemplatesProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
