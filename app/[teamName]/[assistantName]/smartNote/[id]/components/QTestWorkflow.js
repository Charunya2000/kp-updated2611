'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Paper,
  Collapse,
  Card,
  CardContent,
  CardActions,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useDropzone } from 'react-dropzone';
import PropTypes from 'prop-types';
import { useWorkflow, useWorkflowDispatch } from '@reducers/WorkflowContext';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import {
  createTestCase,
  updateTestCase,
  deleteTestCase,
  getTestCases,
  generateTestCasesFromDocument,
  updateTestCaseTemplate
} from '@clientServices/testCaseService';
import { prepDocument } from '@clientServices/insertDocument';
import { useParams } from 'next/navigation';

// Test case structure based on qtestTemplateStructure.txt
const createNewTestCase = () => {
  // Use prepDocument to ensure consistent document structure with type and ID
  return prepDocument({
    type: 'TestCase',
    testCaseId: '',
    testCaseName: '',
    description: '',
    preCondition: '',
    steps: [{ id: Date.now(), stepNumber: 1, stepDescription: '', expectedResult: '' }],
    testCaseType: '',
    testCaseStatus: '',
    testCasePriority: '',
    testCaseAssignedTo: '',
    customField1: '',
    customField2: '',
    customField3: '',
    requirementIds: ''
  });
};

const QTestWorkflow = ({ isWorkflowExpanded, toggleWorkflowBox }) => {
  const { selectedWorkflow } = useWorkflow();
  const workflowDispatch = useWorkflowDispatch();
  const smartNote = useSmartNote(); // Get the smartNote object from context
  const { teamName, assistantName } = useParams();

  // State for file upload
  const [uploadedFile, setUploadedFile] = useState(null);

  // State for description management
  const [fileDescription, setFileDescription] = useState('');
  const [savedDescriptions, setSavedDescriptions] = useState([]);
  const [selectedDescription, setSelectedDescription] = useState('');

  // State for test cases
  const [testCases, setTestCases] = useState([createNewTestCase()]);
  const [selectedTestCaseIndex, setSelectedTestCaseIndex] = useState(0);
  const [showTestCaseDetails, setShowTestCaseDetails] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [testCaseToDelete, setTestCaseToDelete] = useState(null);

  // State for test case generation
  const [isGeneratingTestCases, setIsGeneratingTestCases] = useState(false);
  const [generationMessage, setGenerationMessage] = useState(null);
  const [templateDownloadUrl, setTemplateDownloadUrl] = useState(null);

  // Helper function to get the first line of a description
  const getFirstLine = (text) => {
    if (!text) return '';
    const firstLineEnd = text.indexOf('\n');
    return firstLineEnd > -1 ? text.substring(0, firstLineEnd) : text;
  };

  // Helper function to truncate text with ellipsis
  const truncateText = (text, maxLength = 40) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  // Load saved descriptions from localStorage on component mount
  useEffect(() => {
    const loadedDescriptions = localStorage.getItem('qtest_saved_descriptions');
    if (loadedDescriptions) {
      setSavedDescriptions(JSON.parse(loadedDescriptions));
    }

    // Log workflow information for debugging
    if (selectedWorkflow) {

      // If the workflow exists but doesn't have an ID, try to set one
      if (!selectedWorkflow.id && selectedWorkflow.path) {
        // Update the workflow in context with the path as the ID if no ID is present
        const updatedWorkflow = {
          ...selectedWorkflow,
          id: selectedWorkflow.path || `workflow_${Date.now()}` // Use path as ID or generate one
        };

        workflowDispatch({
          type: 'SET_WORKFLOW',
          workflow: updatedWorkflow
        });
      }
    } else {
    }

    // Load test cases from API if smartNote has an ID
    if (smartNote?.id) {
      const fetchTestCases = async () => {
        try {
          const fetchedTestCases = await getTestCases(teamName, assistantName, smartNote.id);
          if (Array.isArray(fetchedTestCases) && fetchedTestCases.length > 0) {
            setTestCases(fetchedTestCases);
          } else {
            // If no test cases found, use the default empty one
            setTestCases([createNewTestCase()]);
          }
        } catch (error) {
          console.error('Error loading test cases:', error);
          // Fall back to localStorage if API fails
          const savedTestCases = localStorage.getItem('qtest_test_cases');
          if (savedTestCases) {
            try {
              const parsedTestCases = JSON.parse(savedTestCases);
              if (Array.isArray(parsedTestCases) && parsedTestCases.length > 0) {
                setTestCases(parsedTestCases);
              }
            } catch (error) {
              console.error('Error loading saved test cases:', error);
            }
          }
        }
      };

      fetchTestCases();
    } else {
      // Fall back to localStorage if no smartNote ID
      const savedTestCases = localStorage.getItem('qtest_test_cases');
      if (savedTestCases) {
        try {
          const parsedTestCases = JSON.parse(savedTestCases);
          if (Array.isArray(parsedTestCases) && parsedTestCases.length > 0) {
            setTestCases(parsedTestCases);
          }
        } catch (error) {
          console.error('Error loading saved test cases:', error);
        }
      }
    }
  }, [smartNote?.id]);

  // Reset the template download URL when the workflow changes
  useEffect(() => {
    setTemplateDownloadUrl(null);
  }, [selectedWorkflow]);

  // Save test cases to localStorage whenever they change
  useEffect(() => {
    // Always save to localStorage as a backup
    localStorage.setItem('qtest_test_cases', JSON.stringify(testCases));

    // If we have a smartNote ID and there are changes, save to API
    if (smartNote?.id && testCases.length > 0) {
      // We need to throttle API calls to avoid excessive requests
      const saveToAPI = async () => {
        try {
          // For each test case, either create or update
          const savePromises = testCases.map(testCase => {
            // Make sure the test case is associated with the current smart note
            const preparedTestCase = {
              ...testCase,
              smartNoteId: smartNote.id
            };

            // If the test case already has an isNewlyCreated flag set to false,
            // it means it's from the database and we should update it
            if (testCase.isNewlyCreated === false) {
              return updateTestCase(teamName, assistantName, smartNote.id, testCase.id, preparedTestCase);
            } else {
              // Otherwise, it's a new test case that needs to be created
              // After creation, we'll update its isNewlyCreated flag
              return createTestCase(teamName, assistantName, smartNote.id, preparedTestCase)
                .then(result => {
                  // Update the testCase in state to mark it as saved
                  setTestCases(current =>
                    current.map(tc =>
                      tc.id === testCase.id
                        ? { ...result, isNewlyCreated: false }
                        : tc
                    )
                  );
                  return result;
                });
            }
          });

          await Promise.all(savePromises);
        } catch (error) {
          console.error('Error saving test cases to API:', error);
          // If API save fails, at least we have the local backup
        }
      };

      // Use a debounce to prevent too many API calls
      const timeoutId = setTimeout(saveToAPI, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [testCases, smartNote?.id]);

  // Handle file upload
  const handleFileUpload = async (file) => {
    const fileData = {
      id: `file_${Date.now()}`, // Generate a unique ID for the file
      name: file.name,
      size: file.size,
      type: file.type,
      file: file, // Store the File object directly
    };

    setUploadedFile(fileData);

    // Reset the template download URL when a new file is uploaded
    setTemplateDownloadUrl(null);

    // Add the file to the workflow context
    await workflowDispatch({
      type: 'ADD_FILE',
      file: fileData,
    });
  };

  // Handle file removal
  const handleFileRemove = () => {
    if (uploadedFile && uploadedFile.name) {
      workflowDispatch({ type: 'REMOVE_FILE', fileName: uploadedFile.name });
    }
    setUploadedFile(null);

    // Reset the template download URL when the file is removed
    setTemplateDownloadUrl(null);
  };

  // Handle dropzone
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles[0]); // We only want one file
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
    },
  });

  // Save description
  const handleSaveDescription = () => {
    if (fileDescription.trim() === '') return;

    const newDescriptions = [...savedDescriptions];
    // Check if description already exists
    if (!newDescriptions.includes(fileDescription)) {
      newDescriptions.push(fileDescription);
      setSavedDescriptions(newDescriptions);
      localStorage.setItem('qtest_saved_descriptions', JSON.stringify(newDescriptions));
    }

    // Also set this as the selected description
    setSelectedDescription(fileDescription);

    // Update the workflow context
    workflowDispatch({
      type: 'SET_DESCRIPTION',
      description: fileDescription,
    });
  };

  // Select a saved description
  const handleSelectDescription = (event) => {
    const selected = event.target.value;
    setSelectedDescription(selected);
    setFileDescription(selected);

    // Update the workflow context
    workflowDispatch({
      type: 'SET_DESCRIPTION',
      description: selected,
    });
  };

  // Select a test case for editing
  const handleSelectTestCase = (index) => {
    setSelectedTestCaseIndex(index);
    setShowTestCaseDetails(true);
  };

  // Add a new test case
  const handleAddTestCase = () => {
    // Use prepDocument to create a new test case with proper structure
    const newTestCase = prepDocument({
      type: 'TestCase',
      smartNoteId: smartNote?.id, // Associate with current smart note
      parentId: smartNote?.id, // Also set parentId
      testCaseId: '',
      testCaseName: '',
      description: '',
      preCondition: '',
      steps: [{ id: Date.now(), stepNumber: 1, stepDescription: '', expectedResult: '' }],
      testCaseType: '',
      testCaseStatus: '',
      testCasePriority: '',
      testCaseAssignedTo: '',
      customField1: '',
      customField2: '',
      customField3: '',
      requirementIds: '',
      isNewlyCreated: true // Flag to indicate this is a new test case
    });
    setTestCases([...testCases, newTestCase]);
    setSelectedTestCaseIndex(testCases.length);
    setShowTestCaseDetails(true);
  };

  // Delete a test case
  const handleConfirmDeleteTestCase = (index) => {
    setTestCaseToDelete(index);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteTestCase = async () => {
    const testCaseToRemove = testCases[testCaseToDelete];
    const updatedTestCases = testCases.filter((_, index) => index !== testCaseToDelete);

    // Update state first for responsive UI
    setTestCases(updatedTestCases);

    if (selectedTestCaseIndex === testCaseToDelete) {
      setSelectedTestCaseIndex(0);
    } else if (selectedTestCaseIndex > testCaseToDelete) {
      setSelectedTestCaseIndex(selectedTestCaseIndex - 1);
    }

    setDeleteConfirmOpen(false);
    setTestCaseToDelete(null);

    // If the test case exists in the database (has an ID and is not newly created)
    if (smartNote?.id && testCaseToRemove.id && testCaseToRemove.isNewlyCreated !== true) {
      try {
        await deleteTestCase(teamName, assistantName, smartNote.id, testCaseToRemove.id);
      } catch (error) {
        console.error(`Error deleting test case ${testCaseToRemove.id}:`, error);
        // Inform the user of the error
        alert(`Failed to delete test case: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Handle test case data changes
  const handleTestCaseChange = (field, value) => {
    const updatedTestCases = [...testCases];
    updatedTestCases[selectedTestCaseIndex] = {
      ...updatedTestCases[selectedTestCaseIndex],
      [field]: value
    };
    setTestCases(updatedTestCases);

    // Reset template download URL when test cases change
    // We'll require explicit update via button instead of automatic update
    // to avoid too many API calls and blob storage writes
    if (templateDownloadUrl) {
      setTemplateDownloadUrl(null);
    }
  };

  // Handle update of the test case template
  const handleUpdateTemplate = async () => {
    // Use smartNote.id if available, otherwise fall back to selectedWorkflow.id
    const smartNoteId = smartNote?.id || selectedWorkflow?.id;

    if (!smartNoteId || testCases.length === 0) {
      return;
    }

    try {
      // Show a loading message
      setGenerationMessage({
        type: 'info',
        text: 'Updating test case template...'
      });

      // Get the original document name from the uploaded file
      const documentName = uploadedFile ? uploadedFile.name : 'updated_test_cases';

      // Call the API to update the template and get a new download URL
      const result = await updateTestCaseTemplate(
        teamName,
        assistantName,
        smartNoteId,
        testCases,
        documentName
      );

      if (result.success && result.templateDownloadUrl) {
        // Update the template download URL
        setTemplateDownloadUrl(result.templateDownloadUrl);

        // Show success message
        setGenerationMessage({
          type: 'success',
          text: 'Test case template updated successfully.'
        });
      } else {
        // Show error message
        setGenerationMessage({
          type: 'error',
          text: result.error || 'Failed to update test case template.'
        });
      }
    } catch (error) {
      console.error('Error updating test case template:', error);
      setGenerationMessage({
        type: 'error',
        text: `Error updating template: ${error.message || 'Unknown error'}`
      });
    }
  };

  // Handle test step changes
  const handleStepChange = (index, field, value) => {
    const updatedTestCases = [...testCases];
    const updatedSteps = [...updatedTestCases[selectedTestCaseIndex].steps];

    updatedSteps[index] = {
      ...updatedSteps[index],
      [field]: value
    };

    updatedTestCases[selectedTestCaseIndex] = {
      ...updatedTestCases[selectedTestCaseIndex],
      steps: updatedSteps
    };

    setTestCases(updatedTestCases);
  };

  // Add a new step
  const handleAddStep = () => {
    const updatedTestCases = [...testCases];
    const currentTestCase = updatedTestCases[selectedTestCaseIndex];
    const newStepNumber = currentTestCase.steps.length + 1;

    updatedTestCases[selectedTestCaseIndex] = {
      ...currentTestCase,
      steps: [
        ...currentTestCase.steps,
        {
          id: Date.now(),
          stepNumber: newStepNumber,
          stepDescription: '',
          expectedResult: ''
        }
      ]
    };

    setTestCases(updatedTestCases);
  };

  // Remove a step
  const handleRemoveStep = (index) => {
    const updatedTestCases = [...testCases];
    const currentTestCase = updatedTestCases[selectedTestCaseIndex];

    if (currentTestCase.steps.length <= 1) return; // Keep at least one step

    const updatedSteps = currentTestCase.steps.filter((_, i) => i !== index);
    // Update step numbers
    updatedSteps.forEach((step, i) => {
      step.stepNumber = i + 1;
    });

    updatedTestCases[selectedTestCaseIndex] = {
      ...currentTestCase,
      steps: updatedSteps
    };

    setTestCases(updatedTestCases);
  };

  // Handle QTest import download
  const handleDownload = async () => {
    const selectedTestCase = testCases[selectedTestCaseIndex];

    try {
      let blob;

      // If we have a smartNote ID and the test case is saved, use the API
      if (smartNote?.id && selectedTestCase.isNewlyCreated !== true) {
        try {
          // Use the export API to get the formatted test case
          const response = await fetch(`/api/${teamName}/${assistantName}/smartNote/${smartNote.id}/testCase/export`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ testCaseIds: [selectedTestCase.id] }),
          });

          if (!response.ok) {
            throw new Error(`Export failed: ${response.status} ${response.statusText}`);
          }

          // Get the blob directly from the response
          blob = await response.blob();
        } catch (error) {
          console.error('Error using export API:', error);
          // Fall back to client-side formatting
          blob = createLocalBlob(selectedTestCase);
        }
      } else {
        // No smartNote ID or not saved yet, format locally
        blob = createLocalBlob(selectedTestCase);
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QTest_Import_${selectedTestCase.testCaseId || 'TestCase'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading test case:', error);
      alert(`Failed to download test case: ${error.message}`);
    }
  };

  // Helper function to create a blob from a test case
  const createLocalBlob = (testCase) => {
    // Create a formatted string representation of the test case data
    const formatTestCase = () => {
      let content = '';
      content += `Test Case Id: ${testCase.testCaseId}\n`;
      content += `Test Case Name: ${testCase.testCaseName}\n`;
      content += `Description: ${testCase.description}\n`;
      content += `Pre-condition: ${testCase.preCondition}\n\n`;

      // Format steps
      testCase.steps.forEach(step => {
        content += `Step #: ${step.stepNumber}\n`;
        content += `Step Description: ${step.stepDescription}\n`;
        content += `Expected Result: ${step.expectedResult}\n\n`;
      });

      content += `Test Case Type: ${testCase.testCaseType}\n`;
      content += `Test Case Status: ${testCase.testCaseStatus}\n`;
      content += `Test Case Priority: ${testCase.testCasePriority}\n`;
      content += `Test Case Assigned To: ${testCase.testCaseAssignedTo}\n`;
      content += `Custom Field 1: ${testCase.customField1}\n`;
      content += `Custom Field 2: ${testCase.customField2}\n`;
      content += `Custom Field 3: ${testCase.customField3}\n`;
      content += `Requirement Ids: ${testCase.requirementIds}\n`;

      return content;
    };

    // Create download blob
    const content = formatTestCase();
    return new Blob([content], { type: 'text/plain' });
  };

  // Get current test case
  const currentTestCase = testCases[selectedTestCaseIndex];

  // Handle manual test case generation
  const handleGenerateTestCases = async () => {
    // Early validation - if workflow is missing or its ID is missing, show an alert
    if (!selectedWorkflow) {
      setGenerationMessage({
        type: 'error',
        text: 'No workflow selected. Please select a workflow first.'
      });
      return;
    }

    if (!selectedWorkflow.id) {
      setGenerationMessage({
        type: 'error',
        text: 'Workflow is missing an ID. Please reload the page or select a different workflow.'
      });
      return;
    }

    if (!uploadedFile) {
      setGenerationMessage({
        type: 'error',
        text: 'No file uploaded. Please upload a file first.'
      });
      return;
    }

    if (!fileDescription.trim()) {
      setGenerationMessage({
        type: 'error',
        text: 'Description is empty. Please enter a description first.'
      });
      return;
    }

    try {
      setIsGeneratingTestCases(true);
      setGenerationMessage(null);

      // Generate a random ID for the file if it doesn't already have one
      const fileId = uploadedFile.id || `file_${Date.now()}`;

      // Update the uploadedFile object with the ID if it doesn't have one
      if (!uploadedFile.id) {
        setUploadedFile({
          ...uploadedFile,
          id: fileId
        });

        // Also update the file in the workflow context
        workflowDispatch({
          type: 'REMOVE_FILE',
          fileName: uploadedFile.name,
        });

        workflowDispatch({
          type: 'ADD_FILE',
          file: {
            ...uploadedFile,
            id: fileId
          },
        });
      }

      // Make sure we have a valid workflow ID before proceeding
      const workflowId = selectedWorkflow.id || selectedWorkflow.path || `workflow_${Date.now()}`;

      // If we need to use a fallback ID, update the workflow context
      if (!selectedWorkflow.id && workflowId !== selectedWorkflow.id) {
        workflowDispatch({
          type: 'SET_WORKFLOW',
          workflow: {
            ...selectedWorkflow,
            id: workflowId
          }
        });
      }

      // Get the actual smartNote ID (from the smartNote context, not the workflow)
      const smartNoteId = smartNote?.id || workflowId;

      // Create document object for upload using prepDocument utility
      const documentToUpload = prepDocument({
        type: 'UploadedDocument',
        smartNoteId: smartNoteId,  // Use smartNote.id as the smartNoteId
        parentId: smartNoteId,     // Use smartNote.id as the parentId too
        fileName: uploadedFile.name,
        file: uploadedFile.file,
        status: 'PENDING'          // Explicitly set initial status
      });

      // STEP 1: Upload the document to MongoDB and index it
      // This only happens when the user clicks the "Create Test Cases" button, not when they select a file
      setGenerationMessage({
        type: 'info',
        text: 'Step 1/2: Uploading and indexing document...'
      });

      try {
        // Upload the document using the existing service
        // Pass 'QTest Import' as the assistant name to route to the appropriate indexing service

        if (!uploadResult || !uploadResult.id) {
          throw new Error('Failed to upload and index document');
        }

        // Update status message
        setGenerationMessage({
          type: 'info',
          text: 'Step 2/2: Document indexed successfully. Generating test cases...'
        });

        // STEP 2: Call the test case generation service with the uploaded document ID
        const result = await generateTestCasesFromDocument(
          teamName,
          assistantName,
          smartNoteId, // Use the smartNoteId to ensure consistency
          uploadResult.id, // Use the ID from the uploaded document
          fileDescription
        );

        if (result && result.testCases && result.testCases.length > 0) {
          // Update the test cases state with the generated test cases
          setTestCases(result.testCases);
          setSelectedTestCaseIndex(0);
          setShowTestCaseDetails(true);

          // Set template download URL if available
          if (result.templateDownloadUrl) {
            setTemplateDownloadUrl(result.templateDownloadUrl);
          }

          // Show success message
          setGenerationMessage({
            type: 'success',
            text: `Successfully generated ${result.testCases.length} test cases from the uploaded file.${result.templateDownloadUrl ? ' Excel template is available for download.' : ''}`
          });
        } else {
          // Show warning message if no test cases were generated
          setGenerationMessage({
            type: 'warning',
            text: 'No test cases could be generated from this file. Try adding more details in the description.'
          });
        }
      } catch (error) {
        console.error('Error generating test cases:', error);
        // Show error message with more details about which step failed
        setGenerationMessage({
          type: 'error',
          text: `Failed to generate test cases: ${error.message || 'Unknown error'} (${error.step || 'unknown step'})`
        });
      } finally {
        setIsGeneratingTestCases(false);
      }
    } catch (uploadError) {
      console.error('Error during file upload or processing:', uploadError);
      setGenerationMessage({
        type: 'error',
        text: `Error during file upload or processing: ${uploadError.message || 'Unknown error'}`
      });
      setIsGeneratingTestCases(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Workflow Header and Description */}
      <Box
        sx={{
          backgroundColor: 'card.body.dark',
          padding: '12px',
          borderRadius: '12px',
          marginBottom: '12px',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          width: '100%',
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontWeight: 'bold', cursor: 'pointer' }}
          onClick={toggleWorkflowBox}
        >
          {selectedWorkflow?.name || 'QTest Import Workflow'} {isWorkflowExpanded ? '▼' : '▲'}
        </Typography>

        <Collapse in={isWorkflowExpanded}>
          <Typography variant="body1" sx={{ mt: 1, mb: 1 }}>
            {selectedWorkflow?.message || 'Create and manage QTest test cases for import.'}
          </Typography>

          {/* Description Section First - Full Width */}
          <Paper elevation={0} sx={{ p: 1.5, mb: 2, backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              1. File Description
            </Typography>

            <TextField
              label="Description"
              placeholder="Describe the file and its purpose..."
              multiline
              rows={4}
              value={fileDescription}
              onChange={(e) => setFileDescription(e.target.value)}
              variant="outlined"
              fullWidth
              size="small"
              sx={{ mb: 1 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveDescription}
                disabled={!fileDescription.trim()}
                size="small"
              >
                Save Description
              </Button>
            </Box>
          </Paper>

          {/* File Upload and Saved Descriptions - Side by Side */}
          <Paper elevation={0} sx={{ p: 1.5, mb: 2, backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <Grid container spacing={2}>
              {/* File Upload Section */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                  2. Upload File
                </Typography>

                {!uploadedFile ? (
                  <Box
                    {...getRootProps()}
                    component="form"
                    sx={{
                      border: '2px dashed gray',
                      borderRadius: '8px',
                      padding: 1,
                      textAlign: 'center',
                      backgroundColor: isDragActive ? '#f0f0f0' : 'transparent',
                      cursor: 'pointer',
                      height: '100%',
                      minHeight: '120px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    <input {...getInputProps()} />
                    <IconButton color="primary" component="span" sx={{ fontSize: '36px' }}>
                      <CloudUploadOutlinedIcon fontSize="inherit" />
                    </IconButton>
                    <Typography variant="subtitle1">Upload a file</Typography>
                    <Typography variant="body2">Drag & drop or click to choose</Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Supported: MS Word, Excel, and text
                    </Typography>
                  </Box>
                ) : (
                  <Card variant="outlined" sx={{ height: '100%', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <CardContent sx={{ py: 1, px: 2 }}>
                      <Typography variant="subtitle1">{uploadedFile.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {`${(uploadedFile.size / 1024).toFixed(2)} KB`}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ pt: 0, display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        startIcon={<DeleteIcon />}
                        color="error"
                        onClick={handleFileRemove}
                        size="small"
                      >
                        Remove
                      </Button>

                      <Tooltip title={
                        !fileDescription.trim()
                          ? "Please enter a description first"
                          : !uploadedFile
                            ? "Please upload a file first"
                            : !selectedWorkflow
                              ? "No workflow selected - please select a workflow first"
                              : !selectedWorkflow.id && !selectedWorkflow.path
                                ? "Workflow is missing identifiers - please reload the page or select a different workflow"
                                : isGeneratingTestCases
                                  ? "Test cases are being generated..."
                                  : `Upload & index document, then generate test cases (using workflow: ${selectedWorkflow.name || 'Unknown'})`
                      }>
                        <span> {/* Wrapper needed for disabled buttons */}
                          <Button
                            variant="contained"
                            color="primary"
                            startIcon={isGeneratingTestCases ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
                            onClick={handleGenerateTestCases}
                            disabled={isGeneratingTestCases || !fileDescription.trim() || (!selectedWorkflow?.id && !selectedWorkflow?.path) || !uploadedFile}
                            size="small"
                          >
                            Create Test Cases
                          </Button>
                        </span>
                      </Tooltip>

                      {/* Template Download and Update Buttons */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {/* Update Template Button - Always shown when there are test cases */}
                        {testCases.length > 0 && (
                          <Tooltip title={
                            !selectedWorkflow?.id
                              ? "Workflow ID is required to update template"
                              : templateDownloadUrl
                                ? "Update Excel template with current test cases"
                                : "Generate Excel template with current test cases"
                          }>
                            <span> {/* Wrapper needed for disabled buttons */}
                              <Button
                                variant="outlined"
                                color="primary"
                                startIcon={<RefreshIcon />}
                                onClick={handleUpdateTemplate}
                                disabled={!selectedWorkflow?.id}
                                size="small"
                              >
                                {templateDownloadUrl ? 'Update Template' : 'Generate Template'}
                              </Button>
                            </span>
                          </Tooltip>
                        )}

                        {/* Template Download Button - Only shown when a template URL is available */}
                        {templateDownloadUrl && (
                          <Tooltip title="Download Excel template with all test cases">
                            <Button
                              variant="outlined"
                              color="success"
                              startIcon={<DownloadIcon />}
                              href={templateDownloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="small"
                            >
                              Download Excel
                            </Button>
                          </Tooltip>
                        )}
                      </Box>
                    </CardActions>
                  </Card>
                )}
              </Grid>

              {/* Saved Description Selection Section */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                  3. Select Saved Description
                </Typography>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel id="saved-descriptions-label">Saved Descriptions</InputLabel>
                    <Select
                      labelId="saved-descriptions-label"
                      id="saved-descriptions"
                      value={selectedDescription}
                      label="Saved Descriptions"
                      onChange={handleSelectDescription}
                      disabled={savedDescriptions.length === 0}
                    >
                      {savedDescriptions.map((desc, index) => {
                        // Get just the first line for display in dropdown
                        const displayText = getFirstLine(desc);
                        // If first line is too long, truncate it
                        const truncatedText = displayText.length > 50
                          ? `${displayText.substring(0, 47)}...`
                          : displayText;

                        return (
                          <MenuItem key={index} value={desc} title={desc}>
                            {truncatedText}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Box>
              </Grid>
            </Grid>

            {/* Test Case Generation Status */}
            {isGeneratingTestCases && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2">Generating test cases from document...</Typography>
              </Box>
            )}

            {generationMessage && !isGeneratingTestCases && (
              <Box sx={{
                mt: 1,
                p: 1,
                borderRadius: 1,
                backgroundColor: generationMessage.type === 'error' ? '#ffebee' :
                  generationMessage.type === 'warning' ? '#fff8e1' :
                    '#e8f5e9'
              }}>
                <Typography variant="body2" color={
                  generationMessage.type === 'error' ? 'error' :
                    generationMessage.type === 'warning' ? 'warning.dark' :
                      'success.dark'
                }>
                  {generationMessage.text}
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Test Cases Table */}
          <Paper elevation={0} sx={{ p: 1.5, mb: 2, backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                4. Test Cases
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleAddTestCase}
                size="small"
              >
                New Test Case
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxHeight: '250px' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Test Case ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Test Case Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '10%' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testCases.map((testCase, index) => (
                    <TableRow
                      key={testCase.id || index}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: selectedTestCaseIndex === index ? 'rgba(25, 118, 210, 0.08)' : 'inherit',
                        '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                      }}
                      onClick={() => handleSelectTestCase(index)}
                    >
                      <TableCell>{testCase.testCaseId || '<No ID>'}</TableCell>
                      <TableCell>
                        <Tooltip title={testCase.testCaseName} placement="top">
                          <Typography variant="body2" noWrap>
                            {truncateText(testCase.testCaseName)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={testCase.description} placement="top">
                          <Typography variant="body2" noWrap>
                            {truncateText(testCase.description)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmDeleteTestCase(index);
                          }}
                          color="error"
                          sx={{ padding: '4px' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {testCases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', py: 2 }}>
                        No test cases created yet. Click "New Test Case" to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Test Case Details */}
            {showTestCaseDetails && currentTestCase && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    Test Case Details
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownload}
                    size="small"
                  >
                    QTest Import
                  </Button>
                </Box>

                <Divider sx={{ mb: 1.5 }} />

                <Grid container spacing={2}>
                  {/* Basic Info */}
                  <Grid item xs={12} md={6}>
                    <TextField
                      label="Test Case ID"
                      value={currentTestCase.testCaseId}
                      onChange={(e) => handleTestCaseChange('testCaseId', e.target.value)}
                      variant="outlined"
                      fullWidth
                      margin="dense"
                      size="small"
                    />

                    <TextField
                      label="Test Case Name"
                      value={currentTestCase.testCaseName}
                      onChange={(e) => handleTestCaseChange('testCaseName', e.target.value)}
                      variant="outlined"
                      fullWidth
                      margin="dense"
                      size="small"
                    />

                    <TextField
                      label="Description"
                      value={currentTestCase.description}
                      onChange={(e) => handleTestCaseChange('description', e.target.value)}
                      variant="outlined"
                      fullWidth
                      multiline
                      rows={2}
                      margin="dense"
                      size="small"
                    />

                    <TextField
                      label="Pre-condition"
                      value={currentTestCase.preCondition}
                      onChange={(e) => handleTestCaseChange('preCondition', e.target.value)}
                      variant="outlined"
                      fullWidth
                      multiline
                      rows={2}
                      margin="dense"
                      size="small"
                    />
                  </Grid>

                  {/* Additional Info */}
                  <Grid item xs={12} md={6}>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <TextField
                          label="Test Case Type"
                          value={currentTestCase.testCaseType}
                          onChange={(e) => handleTestCaseChange('testCaseType', e.target.value)}
                          variant="outlined"
                          fullWidth
                          margin="dense"
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Test Case Status"
                          value={currentTestCase.testCaseStatus}
                          onChange={(e) => handleTestCaseChange('testCaseStatus', e.target.value)}
                          variant="outlined"
                          fullWidth
                          margin="dense"
                          size="small"
                        />
                      </Grid>
                    </Grid>

                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <TextField
                          label="Test Case Priority"
                          value={currentTestCase.testCasePriority}
                          onChange={(e) => handleTestCaseChange('testCasePriority', e.target.value)}
                          variant="outlined"
                          fullWidth
                          margin="dense"
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Test Case Assigned To"
                          value={currentTestCase.testCaseAssignedTo}
                          onChange={(e) => handleTestCaseChange('testCaseAssignedTo', e.target.value)}
                          variant="outlined"
                          fullWidth
                          margin="dense"
                          size="small"
                        />
                      </Grid>
                    </Grid>

                    <TextField
                      label="Requirement IDs"
                      value={currentTestCase.requirementIds}
                      onChange={(e) => handleTestCaseChange('requirementIds', e.target.value)}
                      variant="outlined"
                      fullWidth
                      margin="dense"
                      size="small"
                    />

                    {/* Custom Fields */}
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>Custom Fields:</Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={4}>
                          <TextField
                            label="Custom Field 1"
                            value={currentTestCase.customField1}
                            onChange={(e) => handleTestCaseChange('customField1', e.target.value)}
                            variant="outlined"
                            fullWidth
                            margin="dense"
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={4}>
                          <TextField
                            label="Custom Field 2"
                            value={currentTestCase.customField2}
                            onChange={(e) => handleTestCaseChange('customField2', e.target.value)}
                            variant="outlined"
                            fullWidth
                            margin="dense"
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={4}>
                          <TextField
                            label="Custom Field 3"
                            value={currentTestCase.customField3}
                            onChange={(e) => handleTestCaseChange('customField3', e.target.value)}
                            variant="outlined"
                            fullWidth
                            margin="dense"
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>

                  {/* Test Steps */}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle1" sx={{ mt: 1, mb: 1, fontWeight: 'bold' }}>
                        Test Steps
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={handleAddStep}
                        size="small"
                        startIcon={<AddCircleOutlineIcon />}
                      >
                        Add Step
                      </Button>
                    </Box>

                    {currentTestCase.steps.map((step, index) => (
                      <Card key={step.id || index} variant="outlined" sx={{ mb: 1 }}>
                        <CardContent sx={{ py: 1, px: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2">Step {step.stepNumber}</Typography>
                            <IconButton
                              color="error"
                              onClick={() => handleRemoveStep(index)}
                              disabled={currentTestCase.steps.length <= 1}
                              size="small"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          <TextField
                            label="Step Description"
                            value={step.stepDescription}
                            onChange={(e) => handleStepChange(index, 'stepDescription', e.target.value)}
                            variant="outlined"
                            fullWidth
                            multiline
                            rows={2}
                            margin="dense"
                            size="small"
                          />

                          <TextField
                            label="Expected Result"
                            value={step.expectedResult}
                            onChange={(e) => handleStepChange(index, 'expectedResult', e.target.value)}
                            variant="outlined"
                            fullWidth
                            multiline
                            rows={2}
                            margin="dense"
                            size="small"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        </Collapse>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Delete Test Case</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete this test case? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteTestCase} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

QTestWorkflow.propTypes = {
  isWorkflowExpanded: PropTypes.bool.isRequired,
  toggleWorkflowBox: PropTypes.func.isRequired,
};

export default QTestWorkflow;

/*
 * Material UI Accordion Component Props:
 * 
 * children: The content of the accordion.
 * classes: Override or extend the styles applied to the component.
 * defaultExpanded: If true, expands the accordion by default.
 * disabled: If true, the accordion will be displayed in a disabled state.
 * disableGutters: If true, removes the gutters (paddings) from the accordion.
 * elevation: The elevation of the accordion. Default is 1.
 * expanded: If true, expands the accordion, otherwise collapse it. Setting this prop enables control mode.
 * onChange: Callback fired when the expand/collapse state is changed.
 * square: If true, rounded corners are disabled.
 * sx: The system prop that allows defining system overrides as well as additional CSS styles.
 * TransitionComponent: The component used for the transition. Default is Collapse.
 * TransitionProps: Props applied to the transition element.
 */

