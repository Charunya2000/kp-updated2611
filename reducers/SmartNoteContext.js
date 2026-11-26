'use client';

import { createContext, useContext, useReducer } from 'react';
import smartNoteReducer from './SmartNoteReducer';
import PropTypes from 'prop-types';

const SmartNoteContext = createContext(null);
const SmartNoteDispatchContext = createContext(null);

const initialState = {
  smartNotes: [],
  selectedSmartNote: null,
};

export function SmartNoteProvider({ children }) {
  const [state, dispatch] = useReducer(
    smartNoteReducer,
    initialState
  );

  return (
    <SmartNoteContext.Provider value={state}>
      <SmartNoteDispatchContext.Provider value={dispatch}>
        {children}
      </SmartNoteDispatchContext.Provider>
    </SmartNoteContext.Provider>
  );
}

export function useSmartNotes() {
  return useContext(SmartNoteContext);
}

export function useSmartNotesDispatch() {
  return useContext(SmartNoteDispatchContext);
}

SmartNoteProvider.propTypes = {
  children: PropTypes.node.isRequired,
};