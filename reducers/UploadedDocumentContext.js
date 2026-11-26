'use client';

import { createContext, useContext, useReducer } from 'react';
import uploadedDocumentReducer from './UploadedDocumentReducer';
import PropTypes from 'prop-types';

const UploadedDocumentContext = createContext(null);
const UploadedDocumentDispatchContext = createContext(null);

const initialState = {
  uploadedDocuments: [],
  selectedUploadedDocument: null,
};

export function UploadedDocumentProvider({ children }) {
  const [state, dispatch] = useReducer(
    uploadedDocumentReducer,
    initialState
  );

  return (
    <UploadedDocumentContext.Provider value={state}>
      <UploadedDocumentDispatchContext.Provider value={dispatch}>
        {children}
      </UploadedDocumentDispatchContext.Provider>
    </UploadedDocumentContext.Provider>
  );
}

export function useUploadedDocuments() {
  return useContext(UploadedDocumentContext);
}

export function useUploadedDocumentsDispatch() {
  return useContext(UploadedDocumentDispatchContext);
}

UploadedDocumentProvider.propTypes = {
  children: PropTypes.node.isRequired,
};