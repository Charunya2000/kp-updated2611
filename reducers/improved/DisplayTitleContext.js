'use client';

import { createContext, useContext, useReducer } from 'react';
import displayTitleReducer from './DisplayTitleReducer';
import PropTypes from 'prop-types';

const DisplayTitleContext = createContext(null);
const DisplayTitleDispatchContext = createContext(null);

const initialState = null;

export function DisplayTitleProvider({ children }) {
  const [state, dispatch] = useReducer(
    displayTitleReducer,
    initialState
  );

  return (
    <DisplayTitleContext.Provider value={state}>
      <DisplayTitleDispatchContext.Provider value={dispatch}>
        {children}
      </DisplayTitleDispatchContext.Provider>
    </DisplayTitleContext.Provider>
  );
}

export function useDisplayTitle() {
  return useContext(DisplayTitleContext);
}

export function useDisplayTitleDispatch() {
  return useContext(DisplayTitleDispatchContext);
}

DisplayTitleProvider.propTypes = {
  children: PropTypes.node.isRequired,
};