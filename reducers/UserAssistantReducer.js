'use client';

const initialState = {
  userAssistants: [],
  selectedUserAssistant: '', // Add selectedUserAssistant to the initial state
  userTeams: [],
  selectedTeam: ''
};

export default function userAssistantReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_USER_ASSISTANTS':
      return { ...state, userAssistants: action.userAssistants };
    case 'SET_SELECTED_USER_ASSISTANT':
      return { ...state, selectedUserAssistant: action.selectedUserAssistant }; // Handle SET_SELECTED_USER_ASSISTANT action
    case 'SET_USER_TEAMS':
      return { ...state, userTeams: action.userTeams };
    case 'SET_SELECTED_TEAM':
      return { ...state, selectedTeam: action.selectedTeam };
    case 'SET_USER_ASSISTANTS_AND_TEAMS':
      return { ...state, userAssistants: action.userAssistants, userTeams: action.userTeams };
    case 'SET_SELECTED_USER_ASSISTANT_AND_TEAM':
      return { ...state, selectedUserAssistant: action.selectedUserAssistant, selectedTeam: action.selectedTeam };
    default:
      throw new Error('Unknown action: ' + action.type);
  }
}