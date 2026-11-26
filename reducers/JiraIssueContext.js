'use client';

import { createContext, useContext, useReducer } from 'react';
import jiraIssueReducer from './JiraIssueReducer';
import PropTypes from 'prop-types';

const JiraIssueContext = createContext(null);
const JiraIssueDispatchContext = createContext(null);

const initialState = {
  jiraIssues: [],
  selectedJiraIssue: null,
};

export function JiraIssueProvider({ children }) {
  const [state, dispatch] = useReducer(
    jiraIssueReducer,
    initialState
  );

  return (
    <JiraIssueContext.Provider value={state}>
      <JiraIssueDispatchContext.Provider value={dispatch}>
        {children}
      </JiraIssueDispatchContext.Provider>
    </JiraIssueContext.Provider>
  );
}

export function useJiraIssues() {
  return useContext(JiraIssueContext);
}

export function useJiraIssuesDispatch() {
  return useContext(JiraIssueDispatchContext);
}

JiraIssueProvider.propTypes = {
  children: PropTypes.node.isRequired,
};