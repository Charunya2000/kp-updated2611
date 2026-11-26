'use client';

import { createContext, useContext, useReducer } from 'react';
import userAssistantReducer from './UserAssistantReducer';
import PropTypes from 'prop-types';

const UserAssistantContext = createContext(null);
const UserAssistantDispatchContext = createContext(null);

const initialState = {
  userAssistants: [],
  selectedUserAssistant: '', // Add selectedUserAssistant to the initial state
  userTeams: [],
  selectedTeam: ''
};

export function UserAssistantProvider({ children }) {
  const [state, dispatch] = useReducer(
    userAssistantReducer,
    initialState
  );

  return (
    <UserAssistantContext.Provider value={state}>
      <UserAssistantDispatchContext.Provider value={dispatch}>
        {children}
      </UserAssistantDispatchContext.Provider>
    </UserAssistantContext.Provider>
  );
}

export function useUserAssistants() {
  return useContext(UserAssistantContext);
}

export function useUserAssistantsDispatch() {
  return useContext(UserAssistantDispatchContext);
}

UserAssistantProvider.propTypes = {
  children: PropTypes.node.isRequired,
};