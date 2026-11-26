'use client';

import { createContext, useContext, useReducer } from 'react';
import libraryPromptReducer from './LibraryPromptReducer';
import PropTypes from 'prop-types';

const LibraryPromptsContext = createContext(null);
const LibraryPromptsDispatchContext = createContext(null);

export function LibraryPromptsProvider({ children }) {
  const [libraryPrompts, dispatch] = useReducer(
    libraryPromptReducer,
    []);

  return (
    <LibraryPromptsContext.Provider value={libraryPrompts}>
      <LibraryPromptsDispatchContext.Provider value={dispatch}>
        {children}
      </LibraryPromptsDispatchContext.Provider>
    </LibraryPromptsContext.Provider>
  );
}

export function useLibraryPrompts() {
  return useContext(LibraryPromptsContext);
}

export function useLibraryPromptsDispatch() {
  return useContext(LibraryPromptsDispatchContext);
}

LibraryPromptsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
