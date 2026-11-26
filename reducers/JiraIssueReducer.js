'use client';

import updateArray from './reducerUtility';

const initialState = {
  jiraIssues: [],
  selectedJiraIssue: null,
};

export default function jiraIssueReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_JIRA_ISSUES': {
      const newState = { ...state, jiraIssues: action.jiraIssues };
      return newState;
    }
    case 'CREATE_JIRA_ISSUE': {
      const newState = { ...state, jiraIssues: [...state.jiraIssues, action.jiraIssue], selectedJiraIssue: action.jiraIssue };
      return newState;
    }
    case 'SELECT_JIRA_ISSUE': {
      const selectedJiraIssue = state.jiraIssues.find(jiraIssue => jiraIssue.id === action.id);
      const newState = { ...state, selectedJiraIssue };
      return newState;
    }
    case 'UPDATE_JIRA_ISSUE': {
      const newState = { ...state, jiraIssues: updateArray(state.jiraIssues, action.jiraIssue), selectedJiraIssue: action.jiraIssue };
      return newState;
    }
    case 'DELETE_JIRA_ISSUE': {
      const newState = { ...state, jiraIssues: state.jiraIssues.filter(jiraIssue => jiraIssue.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}