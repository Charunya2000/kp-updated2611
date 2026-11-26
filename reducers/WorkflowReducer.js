'use client';

const initialState = {
  selectedWorkflow: null,
  files: [], // Array to store uploaded files
  description: '', // Store workflow description
  // workflows: [] // Store available workflows
};

export default function workflowReducer(state = initialState, action) {
  switch (action.type) {
    case 'SET_WORKFLOW': {
      return { ...state, selectedWorkflow: action.workflow}; // Set selected workflow and optionally update workflows list
    }
    case 'CLEAR_WORKFLOW': {
      return { ...state, selectedWorkflow: null, files: [], description: '' }; // Clear files and description
    }
    case 'ADD_FILE': {
      return { ...state, files: [...state.files, action.file] }; // Add a file to the array
    }
    case 'REMOVE_FILE': {
      return {
        ...state,
        files: state.files.filter((file) => file.name !== action.fileName), // Remove a file by name
      };
    }
    case 'GET_FILE_ID': {
      // Find the file with the specified name and return its ID
      const file = state.files.find(f => f.name === action.fileName);
      return file ? file.id : null;
    }
    case 'SET_FILES': {
      return { ...state, files: action.files }; // Replace the entire files array
    }
    case 'SET_DESCRIPTION': {
      return { ...state, description: action.description }; // Set the description
    }
    case 'EDIT_DESCRIPTION': {
      // Edit description allows for partial updates or transformations
      const updatedDescription = typeof action.transform === 'function'
        ? action.transform(state.description)
        : action.description;

      return { ...state, description: updatedDescription };
    }
    default: {
      throw new Error(`Unknown action: ${action.type}`);
    }
  }
}