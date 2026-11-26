'use client';

import updateArray from './reducerUtility';

const initialState = {
  uploadedDocuments: [],
  selectedUploadedDocument: null,
};

export default function uploadedDocumentReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_UPLOADED_DOCUMENTS': {
      const newState = { ...state, uploadedDocuments: action.uploadedDocuments };
      return newState;
    }
    case 'CREATE_UPLOADED_DOCUMENT': {
      const newState = { ...state, uploadedDocuments: [...state.uploadedDocuments, action.uploadedDocument], selectedUploadedDocument: action.uploadedDocument };
      return newState;
    }
    case 'SELECT_UPLOADED_DOCUMENT': {
      const selectedUploadedDocument = state.uploadedDocuments.find(uploadedDocument => uploadedDocument.id === action.id);
      const newState = { ...state, selectedUploadedDocument };
      return newState;
    }
    case 'UPDATE_UPLOADED_DOCUMENT': {
      const newState = { ...state, uploadedDocuments: updateArray(state.uploadedDocuments, action.uploadedDocument), selectedUploadedDocument: action.uploadedDocument };
      return newState;
    }
    case 'DELETE_UPLOADED_DOCUMENT': {
      const newState = { ...state, uploadedDocuments: state.uploadedDocuments.filter(uploadedDocument => uploadedDocument.id !== action.id) };
      return newState;
    }
    default: {
      throw new Error('Unknown action: ' + action.type);
    }
  }
}