'use client';

import { createContext, useContext, useReducer } from 'react';
import savedNoteReducer from './SavedNoteReducer';
import PropTypes from 'prop-types';

const SavedNoteContext = createContext(null);
const SavedNoteDispatchContext = createContext(null);

const initialState = {
  savedNotes: [],
  selectedSavedNote: null,
};

export function SavedNoteProvider({ children }) {
  const [state, dispatch] = useReducer(
    savedNoteReducer,
    initialState
  );

  return (
    <SavedNoteContext.Provider value={state}>
      <SavedNoteDispatchContext.Provider value={dispatch}>
        {children}
      </SavedNoteDispatchContext.Provider>
    </SavedNoteContext.Provider>
  );
}

export function useSavedNotes() {
  return useContext(SavedNoteContext);
}

export function useSavedNotesDispatch() {
  return useContext(SavedNoteDispatchContext);
}

SavedNoteProvider.propTypes = {
  children: PropTypes.node.isRequired,
};