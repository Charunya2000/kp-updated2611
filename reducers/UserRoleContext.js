'use client';

import { createContext, useContext, useReducer } from 'react';
import userRoleReducer from './UserRoleReducer';
import PropTypes from 'prop-types';

const UserRoleContext = createContext(null);
const UserRoleDispatchContext = createContext(null);

const initialState = {
  userRoles: [],
  selectedUserRole: '' // Add selectedUserRole to the initial state
};

export function UserRoleProvider({ children }) {
  const [state, dispatch] = useReducer(
    userRoleReducer,
    initialState
  );

  return (
    <UserRoleContext.Provider value={state}>
      <UserRoleDispatchContext.Provider value={dispatch}>
        {children}
      </UserRoleDispatchContext.Provider>
    </UserRoleContext.Provider>
  );
}

export function useUserRoles() {
  return useContext(UserRoleContext);
}

export function useUserRolesDispatch() {
  return useContext(UserRoleDispatchContext);
}

UserRoleProvider.propTypes = {
  children: PropTypes.node.isRequired,
};