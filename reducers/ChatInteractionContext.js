'use client';

import { createContext, useContext, useReducer } from 'react';
import chatInteractionReducer from './ChatInteractionReducer';
import PropTypes from 'prop-types';

const ChatInteractionContext = createContext(null);
const ChatInteractionDispatchContext = createContext(null);

export function ChatInteractionProvider({ children }) {
  const [chatInteractions, dispatch] = useReducer(
    chatInteractionReducer,
    { chatInteractions: [] });

  return (
    <ChatInteractionContext.Provider value={chatInteractions}>
      <ChatInteractionDispatchContext.Provider value={dispatch}>
        {children}
      </ChatInteractionDispatchContext.Provider>
    </ChatInteractionContext.Provider>
  );
}

export function useChatInteractions() {
  return useContext(ChatInteractionContext);
}

export function useChatInteractionsDispatch() {
  return useContext(ChatInteractionDispatchContext);
}

ChatInteractionProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
