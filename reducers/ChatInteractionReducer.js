'use client';

import updateArray from './reducerUtility';

const initialState = {
  chatInteractions: [],
  selectedChatInteraction: null,
};

export default function chatInteractionReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_CHAT_INTERACTIONS': {
      const newState = { ...state, chatInteractions: action.chatInteractions };
      return newState;
    }
    case 'RESET_CHAT_INTERACTIONS': {
      return initialState;
    }
    case 'CREATE_CHAT_INTERACTION': {
      const newState = { ...state, chatInteractions: [...state.chatInteractions, action.chatInteraction], selectedChatInteraction: action.chatInteraction };
      return newState;
    }
    case 'SELECT_CHAT_INTERACTION': {
      const selectedChatInteraction = state.chatInteractions.find(chatInteraction => chatInteraction.id === action.id);
      const newState = { ...state, selectedChatInteraction };
      return newState;
    }
    case 'UPDATE_CHAT_INTERACTION': {
      const newState = { ...state, chatInteractions: updateArray(state.chatInteractions, action.chatInteraction), selectedChatInteraction: action.chatInteraction };
      return newState;
    }
    case 'DELETE_CHAT_INTERACTION': {
      const newState = { ...state, chatInteractions: state.chatInteractions.filter(chatInteraction => chatInteraction.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}