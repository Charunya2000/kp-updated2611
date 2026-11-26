'use client';

import { createContext, useContext, useReducer } from 'react';
import chatReducer from './ChatReducer';
import PropTypes from 'prop-types';

const ChatContext = createContext(null);
const ChatDispatchContext = createContext(null);

const initialState = {
  chats: [],
  selectedChat: null,
};

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(
    chatReducer,
    initialState
  );

  return (
    <ChatContext.Provider value={state}>
      <ChatDispatchContext.Provider value={dispatch}>
        {children}
      </ChatDispatchContext.Provider>
    </ChatContext.Provider>
  );
}

export function useChats() {
  return useContext(ChatContext);
}

export function useChatsDispatch() {
  return useContext(ChatDispatchContext);
}

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired,
};