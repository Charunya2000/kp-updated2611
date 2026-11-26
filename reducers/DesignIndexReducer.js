'use client';

import updateArray from './reducerUtility';

const initialState = {
  designIndexs: [],
  selectedDesignIndex: null,
};

export default function designIndexReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_DESIGN_INDEXS': {
      const newState = { ...state, designIndexs: action.designIndexs };
      return newState;
    }
    case 'CREATE_DESIGN_INDEX': {
      const newState = { ...state, designIndexs: [...state.designIndexs, action.designIndex], selectedDesignIndex: action.designIndex };
      return newState;
    }
    case 'SELECT_DESIGN_INDEX': {
      const selectedDesignIndex = state.designIndexs.find(designIndex => designIndex.id === action.id);
      const newState = { ...state, selectedDesignIndex };
      return newState;
    }
    case 'UPDATE_DESIGN_INDEX': {
      const newState = { ...state, designIndexs: updateArray(state.designIndexs, action.designIndex), selectedDesignIndex: action.designIndex };
      return newState;
    }
    case 'UPDATE_OR_CREATE_DESIGN_INDEX': {
      let newState = null;
      const foundDesignIndex = state.designIndexs.find(designIndex => designIndex.designIndexId === action.designIndex.designIndexId);
      if (foundDesignIndex) {
        newState = { ...state, designIndexs: updateArray(state.designIndexs, action.designIndex), selectedDesignIndex: action.designIndex };
      }
      else {
        newState = { ...state, designIndexs: [...state.designIndexs, action.designIndex], selectedDesignIndex: action.designIndex };
      }
      return newState;
    }
    case 'DELETE_DESIGN_INDEX': {
      const newState = { ...state, designIndexs: state.designIndexs.filter(designIndex => designIndex.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}