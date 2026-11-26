'use client';

import { createContext, useContext, useReducer } from 'react';
import designIndexReducer from './DesignIndexReducer';
import PropTypes from 'prop-types';

const DesignIndexContext = createContext(null);
const DesignIndexDispatchContext = createContext(null);

const initialState = {
  designIndexs: [],
  selectedDesignIndex: null,
};

export function DesignIndexProvider({ children }) {
  const [state, dispatch] = useReducer(
    designIndexReducer,
    initialState
  );

  return (
    <DesignIndexContext.Provider value={state}>
      <DesignIndexDispatchContext.Provider value={dispatch}>
        {children}
      </DesignIndexDispatchContext.Provider>
    </DesignIndexContext.Provider>
  );
}

export function useDesignIndexs() {
  return useContext(DesignIndexContext);
}

export function useDesignIndexsDispatch() {
  return useContext(DesignIndexDispatchContext);
}

DesignIndexProvider.propTypes = {
  children: PropTypes.node.isRequired,
};