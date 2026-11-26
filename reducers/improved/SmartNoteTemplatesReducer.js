'use client';

const initialState = [];

export default function smartNoteTemplatesReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_SMART_NOTE_TEMPLATES': {
      const newState = action.smartNoteTemplates;
      return newState;
    }
    case 'DELETE_SMART_NOTE_TEMPLATE': {
      const newState = state.filter(template => template.id !== action.id);
      return newState;
    }
    case 'EDIT_SMART_NOTE_TEMPLATE_TITLE': {
      const newState = state.map(template =>
        template.id === action.id ? { ...template, title: action.newTitle } : template
      );
      return newState;
    }
    case 'ADD_SMART_NOTE_TEMPLATE': {
      return [...state, action.template];
    }
    case 'UPDATE_SMART_NOTE_TEMPLATE': {
      const newState = state.map(template =>
        template.id === action.id ? { ...template, ...action.updates } : template
      );
      return newState;
    }
    case 'CLEAR_SMART_NOTE_TEMPLATES': {
      return [];
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}
