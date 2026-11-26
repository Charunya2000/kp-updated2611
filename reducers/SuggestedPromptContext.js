'use client';

import { createContext, useContext, useReducer } from 'react';
import suggestedPromptReducer from './SuggestedPromptReducer';
import PropTypes from 'prop-types';

const SuggestedPromptContext = createContext(null);
const SuggestedPromptDispatchContext = createContext(null);

const initialState = {
  suggestedPrompts: [],
  selectedSuggestedPrompt: null,
};

export function SuggestedPromptProvider({ children }) {
  const [state, dispatch] = useReducer(
    suggestedPromptReducer,
    initialState
  );

  return (
    <SuggestedPromptContext.Provider value={state}>
      <SuggestedPromptDispatchContext.Provider value={dispatch}>
        {children}
      </SuggestedPromptDispatchContext.Provider>
    </SuggestedPromptContext.Provider>
  );
}

export function useSuggestedPrompts() {
  return useContext(SuggestedPromptContext);
}

export function useSuggestedPromptsDispatch() {
  return useContext(SuggestedPromptDispatchContext);
}

SuggestedPromptProvider.propTypes = {
  children: PropTypes.node.isRequired,
};