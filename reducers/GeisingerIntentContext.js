'use client';

import { createContext, useContext, useReducer } from 'react';
import geisingerIntentReducer from './GeisingerIntentReducer';
import PropTypes from 'prop-types';

const GeisingerIntentContext = createContext(null);
const GeisingerIntentDispatchContext = createContext(null);

const initialState = {
  lobIntent: null,
  interactionIntent: null,
  conversationDoc: null,
  compareFromDoc: null,
  compareToDoc: null,
  openGeisingerFlow: false,
  geisingerConversation: null,
  geisingerConversationInteraction: null,
  geisingerComparison: null,
};

export function GeisingerIntentProvider({ children }) {
  const [state, dispatch] = useReducer(
    geisingerIntentReducer,
    initialState
  );

  return (
    <GeisingerIntentContext.Provider value={state}>
      <GeisingerIntentDispatchContext.Provider value={dispatch}>
        {children}
      </GeisingerIntentDispatchContext.Provider>
    </GeisingerIntentContext.Provider>
  );
}

export function useGeisingerIntents() {
  return useContext(GeisingerIntentContext);
}

export function useGeisingerIntentsDispatch() {
  return useContext(GeisingerIntentDispatchContext);
}

GeisingerIntentProvider.propTypes = {
  children: PropTypes.node.isRequired,
};