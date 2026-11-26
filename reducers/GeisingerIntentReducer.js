'use client';

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

export default function geisingerIntentReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_GEISINGER_LOB_INTENT':
      return { ...state, lobIntent: action.lobIntent };
    case 'SET_GEISINGER_CONVERSATION_DOC':
      return { ...state, conversationDoc: action.conversationDoc };
    case 'SET_GEISINGER_CONVERSATION':
      return { ...state, geisingerConversation: action.geisingerConversation };
    case 'SET_GEISINGER_CONVERSATION_INTERACTION':
      return { ...state, geisingerConversationInteraction: action.geisingerConversationInteraction };
    case 'SET_GEISINGER_COMPARISON':
      return { ...state, geisingerComparison: action.geisingerComparison };
    case 'SET_GEISINGER_COMPARE_FROM_DOC':
      return { ...state, compareFromDoc: action.compareFromDoc };
    case 'SET_GEISINGER_COMPARE_TO_DOC':
      return { ...state, compareToDoc: action.compareToDoc };
    case 'SET_GEISINGER_INTERACTION_INTENT':
      return { ...state, interactionIntent: action.interactionIntent };
    case 'SET_OPEN_GEISINGER_FLOW':
      return { ...state, openGeisingerFlow: action.openGeisingerFlow };
    default:
      throw new Error('Unknown action: ' + action.type);
  }
}
