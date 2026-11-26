'use client';

const initialState = null;

export default function chatHistoryReducer(state = initialState, action) {
  if (action.type === 'SET_CHAT_HISTORY') {
    const newState = action.chatHistory;
    return newState;
  } else if (action.type === 'RESET_CHAT_HISTORY') {
    return initialState;
  } else {
    throw new Error('Unknown action: ' + action.type);
  }
}