'use client';

import { createContext, useReducer, useContext } from 'react';
import personaReducer from './PersonaReducer';

const PersonaContext = createContext();

export function PersonaProvider({ children }) {
  const [state, dispatch] = useReducer(personaReducer, { selectedPersona: null });
  return (
    <PersonaContext.Provider value={{ state, dispatch }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within an PersonaProvider');
  }
  return context.state;
}

export function usePersonaDispatch() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersonaDispatch must be used within an PersonaProvider');
  }
  return context.dispatch;
}