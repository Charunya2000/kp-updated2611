'use client';

import updateArray from './reducerUtility';

const initialState = {
  chats: [],
  selectedChat: null,
};

export default function chatReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_CHATS': {
      const newState = { ...state, chats: action.chats };
      return newState;
    }
    case 'CREATE_CHAT': {
      const newState = { ...state, chats: [...state.chats, action.chat], selectedChat: action.chat };
      return newState;
    }
    case 'SELECT_CHAT': {
      const selectedChat = state.chats.find(chat => chat.id === action.id);
      const newState = { ...state, selectedChat };
      return newState;
    }
    case 'SELECT_CURRENT_CHAT': {
      const selectedChat = state.chats.find(chat => chat.current === true);
      const newState = { ...state, selectedChat };
      return newState;
    }
    case 'UPDATE_CHAT': {
      const newState = { ...state, chats: updateArray(state.chats, action.chat), selectedChat: action.chat };
      return newState;
    }
    case 'DELETE_CHAT': {
      const newState = { ...state, chats: state.chats.filter(chat => chat.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}