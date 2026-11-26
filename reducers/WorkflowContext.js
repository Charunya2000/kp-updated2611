'use client';

import { createContext, useContext, useReducer } from 'react';
import workflowReducer from './WorkflowReducer';
import PropTypes from 'prop-types';

const WorkflowContext = createContext(null);
const WorkflowDispatchContext = createContext(null);

const initialState = {
  selectedWorkflow: null,
  files: [], // Initialize files array
  // workflows: [], // Initialize workflows array
};

export function WorkflowProvider({ children }) {
  const [state, dispatch] = useReducer(workflowReducer, initialState);

  return (
    <WorkflowContext.Provider value={state}>
      <WorkflowDispatchContext.Provider value={dispatch}>
        {children}
      </WorkflowDispatchContext.Provider>
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  return useContext(WorkflowContext);
}

export function useWorkflowDispatch() {
  return useContext(WorkflowDispatchContext);
}

WorkflowProvider.propTypes = {
  children: PropTypes.node.isRequired,
};