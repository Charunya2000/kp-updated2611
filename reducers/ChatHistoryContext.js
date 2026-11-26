'use client';

import { createContext, useContext, useReducer } from 'react';
import chatHistoryReducer from './ChatHistoryReducer';
import PropTypes from 'prop-types';

const ChatHistoryContext = createContext(null);
const ChatHistoryDispatchContext = createContext(null);

const initialState = null;

export function ChatHistoryProvider({ children }) {
  const [chatHistorys, dispatch] = useReducer(chatHistoryReducer, initialState);

  return (
    <ChatHistoryContext.Provider value={chatHistorys}>
      <ChatHistoryDispatchContext.Provider value={dispatch}>
        {children}
      </ChatHistoryDispatchContext.Provider>
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistorys() {
  return useContext(ChatHistoryContext);
}

export function useChatHistorysDispatch() {
  return useContext(ChatHistoryDispatchContext);
}

ChatHistoryProvider.propTypes = {
  children: PropTypes.node.isRequired,
};