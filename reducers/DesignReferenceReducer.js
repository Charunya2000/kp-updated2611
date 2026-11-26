'use client';

import updateArray from './reducerUtility';

const initialState = {
  designReferences: [],
  selectedDesignReference: null,
};

export default function designReferenceReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_DESIGN_REFERENCES': {
      const newState = { ...state, designReferences: action.designReferences };
      return newState;
    }
    case 'CREATE_DESIGN_REFERENCE': {
      const newState = { ...state, designReferences: [...state.designReferences, action.designReference], selectedDesignReference: action.designReference };
      return newState;
    }
    case 'SELECT_DESIGN_REFERENCE': {
      const selectedDesignReference = state.designReferences.find(designReference => designReference.id === action.id);
      const newState = { ...state, selectedDesignReference };
      return newState;
    }
    case 'UPDATE_DESIGN_REFERENCE': {
      const newState = { ...state, designReferences: updateArray(state.designReferences, action.designReference), selectedDesignReference: action.designReference };
      return newState;
    }
    case 'UPDATE_OR_CREATE_DESIGN_REFERENCE': {
      let newState = null;
      const foundDesignReference = state.designReferences.find(designReference => designReference.designReferenceId === action.designReference.designReferenceId);
      if (foundDesignReference) {
        newState = { ...state, designReferences: updateArray(state.designReferences, action.designReference), selectedDesignReference: action.designReference };
      }
      else {
        newState = { ...state, designReferences: [...state.designReferences, action.designReference], selectedDesignReference: action.designReference };
      }
      return newState;
    }
    case 'DELETE_DESIGN_REFERENCE': {
      const newState = { ...state, designReferences: state.designReferences.filter(designReference => designReference.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}