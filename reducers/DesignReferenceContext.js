'use client';

import { createContext, useContext, useReducer } from 'react';
import designReferenceReducer from './DesignReferenceReducer';
import PropTypes from 'prop-types';

const DesignReferenceContext = createContext(null);
const DesignReferenceDispatchContext = createContext(null);

const initialState = {
  designReferences: [],
  selectedDesignReference: null,
};

export function DesignReferenceProvider({ children }) {
  const [state, dispatch] = useReducer(
    designReferenceReducer,
    initialState
  );

  return (
    <DesignReferenceContext.Provider value={state}>
      <DesignReferenceDispatchContext.Provider value={dispatch}>
        {children}
      </DesignReferenceDispatchContext.Provider>
    </DesignReferenceContext.Provider>
  );
}

export function useDesignReferences() {
  return useContext(DesignReferenceContext);
}

export function useDesignReferencesDispatch() {
  return useContext(DesignReferenceDispatchContext);
}

DesignReferenceProvider.propTypes = {
  children: PropTypes.node.isRequired,
};