import { updateArray } from './reducerUtility';

export default function libraryPromptReducer(libraryPrompts, action) {
  switch (action.type) {
    case 'SET_LIBRARY_PROMPTS': {
      return action.libraryPrompt;
    }
    case 'CREATE_LIBRARY_PROMPT': {
      return [...libraryPrompts, action.libraryPrompt];
    }
    case 'UPDATE_LIBRARY_PROMPT': {
      return updateArray(libraryPrompts, action.libraryPrompt);
    }
    case 'DELETE_LIBRARY_PROMPTS': {
      return libraryPrompts.filter(libraryPrompt => libraryPrompt.id !== action.libraryPromptId);
    }
    default: {
      throw Error('Unknown action: ' + action.type);
    }
  }
}
