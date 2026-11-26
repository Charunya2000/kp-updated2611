'use client';

import { createContext, useContext, useReducer } from 'react';
import smartNotesReducer from '@reducers/improved/SmartNotesReducer';
import PropTypes from 'prop-types';

const SmartNotesContext = createContext(null);
const SmartNotesDispatchContext = createContext(null);

const initialState = [];

export function SmartNotesProvider({ children }) {
  const [state, dispatch] = useReducer(
    smartNotesReducer,
    initialState
  );

  return (
    <SmartNotesContext.Provider value={state}>
      <SmartNotesDispatchContext.Provider value={dispatch}>
        {children}
      </SmartNotesDispatchContext.Provider>
    </SmartNotesContext.Provider>
  );
}

export function useSmartNotes() {
  return useContext(SmartNotesContext);
}

export function useSmartNotesDispatch() {
  return useContext(SmartNotesDispatchContext);
}

SmartNotesProvider.propTypes = {
  children: PropTypes.node.isRequired,
};