'use client';

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { mockRomApiService } from '../clientServices/mockRomApiService';

const RomTestComponent = () => {
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);

  const runTest = async (testName, testFunction) => {
    setIsRunning(true);
    const startTime = Date.now();
    
    try {
      console.log(`🧪 Running test: ${testName}`);
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: 'success',
          result,
          duration,
          error: null
        }
      }));
      
      console.log(`✅ Test passed: ${testName} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          status: 'error',
          result: null,
          duration,
          error: error.message
        }
      }));
      
      console.error(`❌ Test failed: ${testName} (${duration}ms)`, error);
    } finally {
      setIsRunning(false);
    }
  };

  const testProcessInput = async () => {
    const testData = {
      project_title: 'Test ROM Project',
      project_description: 'This is a test project to verify the ROM estimation workflow is working correctly.',
      confidence_level: 75,
      constraints: 'Limited budget and timeline',
      additional: 'This is additional information for testing',
      in_scope: 'User authentication, data processing, reporting',
      out_scope: 'Third-party integrations, mobile app',
      risks: 'Technical complexity, resource availability',
      markets: 'Healthcare,Finance',
      files: [] // No files for basic test
    };

    return await mockRomApiService.processInput(testData);
  };

  const testWithFiles = async () => {
    // Create mock file objects for testing
    const mockFile1 = new File(['test content'], 'test-document.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const mockFile2 = new File(['image content'], 'test-image.png', { type: 'image/png' });

    const testData = {
      project_title: 'Test ROM Project with Files',
      project_description: 'Testing file upload functionality in the ROM estimation workflow.',
      confidence_level: 50,
      files: [mockFile1, mockFile2]
    };

    return await mockRomApiService.processInput(testData);
  };

  const testFullWorkflow = async () => {
    // Test the complete workflow
    const inputData = {
      project_title: 'Full Workflow Test',
      project_description: 'Testing the complete ROM estimation workflow from start to finish.',
      confidence_level: 75,
      files: []
    };

    // Step 1: Process Input
    const inputResult = await mockRomApiService.processInput(inputData);
    const sessionId = inputResult.session_id;

    // Step 2: Search Similar ROM
    const searchResult = await mockRomApiService.searchSimilarRom(sessionId);

    // Step 3: Extract Details
    const extractResult = await mockRomApiService.extractDetails(sessionId);

    // Step 4: Get Review Data
    const reviewResult = await mockRomApiService.getReviewData(sessionId);

    return {
      input: inputResult,
      search: searchResult,
      extract: extractResult,
      review: reviewResult
    };
  };

  const tests = [
    {
      name: 'Basic Process Input',
      description: 'Test basic form data processing without files',
      testFunction: testProcessInput
    },
    {
      name: 'Process Input with Files',
      description: 'Test form data processing with file uploads',
      testFunction: testWithFiles
    },
    {
      name: 'Full Workflow',
      description: 'Test complete ROM estimation workflow',
      testFunction: testFullWorkflow
    }
  ];

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom color="primary">
          ROM API Test Suite
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Use this component to test the ROM estimation workflow and debug issues.
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          Open your browser's developer console (F12) to see detailed test logs.
        </Alert>

        <List>
          {tests.map((test, index) => (
            <React.Fragment key={test.name}>
              <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <Box>
                    <Typography variant="h6">{test.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {test.description}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    startIcon={<PlayIcon />}
                    onClick={() => runTest(test.name, test.testFunction)}
                    disabled={isRunning}
                  >
                    Run Test
                  </Button>
                </Box>

                {testResults[test.name] && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      {testResults[test.name].status === 'success' ? (
                        <CheckIcon color="success" sx={{ mr: 1 }} />
                      ) : (
                        <ErrorIcon color="error" sx={{ mr: 1 }} />
                      )}
                      <Chip
                        label={testResults[test.name].status.toUpperCase()}
                        color={testResults[test.name].status === 'success' ? 'success' : 'error'}
                        size="small"
                      />
                      <Typography variant="caption" sx={{ ml: 2 }}>
                        {testResults[test.name].duration}ms
                      </Typography>
                    </Box>

                    {testResults[test.name].error && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {testResults[test.name].error}
                      </Alert>
                    )}

                    {testResults[test.name].result && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Result: {JSON.stringify(testResults[test.name].result, null, 2).substring(0, 200)}...
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </ListItem>
              {index < tests.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>

        <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="info.contrastText" gutterBottom>
            How to use:
          </Typography>
          <Typography variant="body2" color="info.contrastText">
            1. Run each test individually to verify functionality<br/>
            2. Check the browser console for detailed logs<br/>
            3. If tests pass, the ROM workflow UI should work correctly<br/>
            4. Use this for debugging before testing with the real backend API
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default RomTestComponent;