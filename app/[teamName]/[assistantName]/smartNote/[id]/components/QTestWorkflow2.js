import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, IconButton, Collapse, Button, CircularProgress, Alert, LinearProgress, Card, Link } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DownloadIcon from '@mui/icons-material/Download';
import { generateTestCases2, saveTestCaseWorkflowNotes, getTestCaseWorkflowNotes, getTestCaseGenerationProgress } from '@clientServices/testCaseService2';
import { prepDocument } from '@clientServices/insertDocument';
import { useParams } from 'next/navigation';

const DEFAULT_SECTIONING_CONTEXT = `You are a technical documentation analyzer specializing in test case preparation.

Your task is to analyze and separate a document by its logical content sections.

The document will contain design information including:
- Business rules and requirements
- UI screenshots and mockups
- Feature definitions and specifications
- Technical constraints and dependencies

Your goal is to identify distinct sections that are suitable for writing test cases.`;

const QTestWorkflow2 = () => {
  const [instructions, setInstructions] = useState('');
  const [sectioningDirections, setSectioningDirections] = useState(DEFAULT_SECTIONING_CONTEXT);
  const [categoryAnalysisDirections, setCategoryAnalysisDirections] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });
  const [generationProgress, setGenerationProgress] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [progressExpanded, setProgressExpanded] = useState(true);
  const [testCaseGenerationProgressId, setTestCaseGenerationProgressId] = useState(null);
  const { teamName, assistantName, id: smartNoteId } = useParams();
  const scrollContainerRef = useRef(null);

  // Load existing workflow notes on component mount
  useEffect(() => {
    const loadWorkflowNotes = async () => {
      if (!teamName || !assistantName || !smartNoteId) {
        setIsLoading(false);
        return;
      }

      try {
        const existingNotes = await getTestCaseWorkflowNotes(teamName, assistantName, smartNoteId);
        const existingNote = existingNotes.data[0];
        if (existingNote && existingNote.content) {
          setInstructions(existingNote.content);
        }
      } catch (error) {
        console.error('Error loading workflow notes:', error);
        // Don't show error to user if notes don't exist - this is normal for new items
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkflowNotes();
  }, [teamName, assistantName, smartNoteId]);

  // Poll progress when generation is in progress
  useEffect(() => {
    if (!isPolling || !teamName || !smartNoteId || !assistantName || !testCaseGenerationProgressId) return;

    const pollProgress = async () => {
      try {
        if (testCaseGenerationProgressId) {
          const progress = await getTestCaseGenerationProgress(teamName, assistantName, smartNoteId, testCaseGenerationProgressId);
          setGenerationProgress(progress);

          // Stop polling if generation is complete or failed
          if (progress.status === 'completed' || progress.status === 'failed') {
            setIsPolling(false);
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        // Continue polling even on error - generation might still be happening
      }
    };

    const interval = setInterval(pollProgress, 5000);
    return () => clearInterval(interval);
  }, [isPolling, teamName, smartNoteId, assistantName, testCaseGenerationProgressId]);


  const handleInstructionsChange = (event) => {
    setInstructions(event.target.value);
  };

  const handleSectioningDirectionsChange = (event) => {
    setSectioningDirections(event.target.value);
  };

  const handleCategoryAnalysisDirectionsChange = (event) => {
    setCategoryAnalysisDirections(event.target.value);
  };

  const handleExpandClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDownloadTemplate = () => {
    if (generationProgress?.templateDownloadUrl) {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = generationProgress.templateDownloadUrl;
      link.download = 'test-cases.xlsx'; // Optional: set filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSaveNotes = async () => {
    if (!instructions.trim()) {
      setSaveMessage({ type: 'warning', text: 'Please enter some instructions before saving.' });
      return;
    }

    setIsSaving(true);
    setSaveMessage({ type: '', text: '' });

    try {
      const prepInstructions = prepDocument({
        type: 'QTestWorkflowNotes',
        content: instructions,
        instructions: instructions
      });
      await saveTestCaseWorkflowNotes(teamName, assistantName, smartNoteId, prepInstructions);
      setSaveMessage({ type: 'success', text: 'Instructions saved successfully!' });
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Error saving notes:', error);
      setSaveMessage({
        type: 'error',
        text: `Error saving instructions: ${error.message || 'Unknown error'}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateTestCases = async () => {
    if (!instructions.trim()) {
      setSaveMessage({ type: 'warning', text: 'Please enter instructions before generating test cases.' });
      return;
    }

    // Clear previous progress and start polling
    setGenerationProgress(null);
    setIsPolling(true);
    setSaveMessage({ type: 'success', text: 'Test case generation started. Monitoring progress...' });

    // Reset scroll to top
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }

    try {
      const llmDirections = {
        sectioningDirections: sectioningDirections.trim() || null,
        categoryAnalysisDirections: categoryAnalysisDirections.trim() || null
      };

      // Fire off the generation API call (don't await the full generation - we'll poll for progress)
      const response = await generateTestCases2(teamName, assistantName, smartNoteId, instructions, llmDirections);
      const progressId = response.testCaseGenerationProgressId;

      if (progressId) {
        setTestCaseGenerationProgressId(progressId);
      } else {
        setSaveMessage({
          type: 'warning',
          text: 'Generation started but progress tracking ID not available'
        });
      }
    } catch (error) {
      console.error('Error starting test case generation:', error);
      setSaveMessage({
        type: 'error',
        text: `Error starting generation: ${error.message}`
      });
      setIsPolling(false);
    }
  };

  return (
    <Box sx={{
      backgroundColor: 'card.body.dark',
      padding: 3,
      borderRadius: '12px',
      marginBottom: 2,
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
      border: '1px solid',
      borderColor: 'card.border.main',
      width: '100%'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'text.heading' }}>
            QTest Import Workflow
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', marginTop: 0.5 }}>
            Generate test cases from requirements using AI
          </Typography>
        </Box>
        <IconButton
          onClick={handleExpandClick}
          sx={{
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.3s ease-in-out',
            color: 'text.heading',
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Box sx={{ marginTop: 1 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={40} />
              <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                Loading workflow notes...
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body1" sx={{ marginBottom: 2, color: 'text.secondary', lineHeight: 1.6 }}>
                Create QTest import template spreadsheet from requirements. Processing based on single uploaded file and single user note in context.
              </Typography>

              {/* Instructions Textarea */}
              <Box sx={{ marginTop: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', marginBottom: 1, color: 'text.heading' }}>
                  Instructions (Optional)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  placeholder="Enter any special instructions or notes for processing..."
                  value={instructions}
                  onChange={handleInstructionsChange}
                  variant="outlined"
                  sx={{
                    backgroundColor: 'background.paper',
                    '& .MuiOutlinedInput-root': {
                      borderColor: 'color.dolphinLight',
                      '&:hover fieldset': {
                        borderColor: 'color.dolphin',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                        boxShadow: '0 0 0 3px rgba(0, 120, 179, 0.1)',
                      },
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'text.primary',
                      fontFamily: 'var(--font-roboto)',
                    },
                    '& .MuiOutlinedInput-input::placeholder': {
                      color: 'color.slate',
                      opacity: 0.7,
                    },
                  }}
                />
                <Typography variant="caption" sx={{ display: 'block', marginTop: 1, color: 'color.dolphin' }}>
                  {instructions.length} characters
                </Typography>

                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', marginTop: 3, marginBottom: 1, color: 'text.heading' }}>
                  Context Categorization Directions (Optional Override)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={5}
                  placeholder="Optional: adjust the analyzer context. Section JSON structure and boundary rules are enforced automatically."
                  value={sectioningDirections}
                  onChange={handleSectioningDirectionsChange}
                  variant="outlined"
                  sx={{
                    backgroundColor: 'background.paper',
                    '& .MuiOutlinedInput-root': {
                      borderColor: 'color.dolphinLight',
                      '&:hover fieldset': {
                        borderColor: 'color.dolphin',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                        boxShadow: '0 0 0 3px rgba(0, 120, 179, 0.1)',
                      },
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'text.primary',
                      fontFamily: 'var(--font-roboto)',
                    },
                    '& .MuiOutlinedInput-input::placeholder': {
                      color: 'color.slate',
                      opacity: 0.7,
                    },
                  }}
                />
                <Typography variant="caption" sx={{ display: 'block', marginTop: 1, color: 'color.dolphin' }}>
                  {sectioningDirections.length} characters
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', marginTop: 0.5, color: 'text.secondary' }}>
                  Structural sectioning instructions are fixed in the implementation; this field customizes only the context preamble.
                </Typography>

                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', marginTop: 3, marginBottom: 1, color: 'text.heading' }}>
                  Category Test Case Analysis Directions (Optional Override)
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={5}
                  placeholder="Optional: provide high-level guidance (for example, create more or fewer test cases). This does not replace required test case fields/format."
                  value={categoryAnalysisDirections}
                  onChange={handleCategoryAnalysisDirectionsChange}
                  variant="outlined"
                  sx={{
                    backgroundColor: 'background.paper',
                    '& .MuiOutlinedInput-root': {
                      borderColor: 'color.dolphinLight',
                      '&:hover fieldset': {
                        borderColor: 'color.dolphin',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'primary.main',
                        boxShadow: '0 0 0 3px rgba(0, 120, 179, 0.1)',
                      },
                    },
                    '& .MuiOutlinedInput-input': {
                      color: 'text.primary',
                      fontFamily: 'var(--font-roboto)',
                    },
                    '& .MuiOutlinedInput-input::placeholder': {
                      color: 'color.slate',
                      opacity: 0.7,
                    },
                  }}
                />
                <Typography variant="caption" sx={{ display: 'block', marginTop: 1, color: 'color.dolphin' }}>
                  {categoryAnalysisDirections.length} characters
                </Typography>

                {/* Save and Generate Buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 3, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                    onClick={handleSaveNotes}
                    disabled={isSaving || !instructions.trim() || isPolling}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 'bold',
                      paddingX: 3,
                      paddingY: 1.2,
                    }}
                  >
                    {isSaving ? 'Saving...' : 'Save Instructions'}
                  </Button>

                  <Button
                    variant="contained"
                    startIcon={isPolling ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : <DownloadIcon />}
                    onClick={handleGenerateTestCases}
                    disabled={isSaving || !instructions.trim() || isPolling}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 'bold',
                      paddingX: 3,
                      paddingY: 1.2,
                      backgroundColor: 'success.main',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: 'success.dark',
                        boxShadow: '0px 4px 12px rgba(51, 164, 55, 0.3)',
                      },
                      '&:disabled': {
                        backgroundColor: 'action.disabled',
                        color: 'action.disabledText',
                      }
                    }}
                  >
                    {isPolling ? 'Generating...' : 'Generate Test Cases'}
                  </Button>
                </Box>

                {/* Feedback Message */}
                {saveMessage.text && (
                  <Alert
                    severity={saveMessage.type}
                    sx={{ marginTop: 2 }}
                    onClose={() => setSaveMessage({ type: '', text: '' })}
                  >
                    {saveMessage.text}
                  </Alert>
                )}
              </Box>
            </>
          )}
        </Box>
      </Collapse>

      {/* Test Case Generation Progress Section */}
      {generationProgress && (
        <Box sx={{ marginTop: 4, paddingTop: 3, borderTop: '2px solid', borderTopColor: 'card.border.main' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 1 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.heading' }}>
                Test Case Generation Progress
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Real-time updates as test cases are generated
              </Typography>
            </Box>
            <IconButton
              onClick={() => setProgressExpanded(!progressExpanded)}
              sx={{
                transform: progressExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.3s ease-in-out',
                color: 'text.heading',
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>

          <Collapse in={progressExpanded} timeout="auto" unmountOnExit>
            <Box
              ref={scrollContainerRef}
              sx={{
                marginTop: 2,
                maxHeight: '400px',
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: 1,
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: 'card.body.main',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'text.secondary',
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: 'text.heading',
                  },
                },
              }}
            >
              {/* Processing Status */}
              {(generationProgress.status === 'in_progress' || generationProgress.status === 'sectionsCompleted') && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
                    <CircularProgress size={30} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'text.heading' }}>
                        Processing test cases...
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Section {generationProgress.completedSectionsCount + (generationProgress.status === 'in_progress' ? 1 : 0)} of {generationProgress.totalSectionsCount}
                      </Typography>
                    </Box>
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={(generationProgress.completedSectionsCount / generationProgress.totalSectionsCount) * 100}
                    sx={{ marginBottom: 2 }}
                  />

                  {/* Section Status List */}
                  <Box sx={{ marginTop: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', marginBottom: 1, color: 'text.heading' }}>
                      Section Progress:
                    </Typography>
                    {generationProgress.sections && generationProgress.sections.map((section, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1, padding: 1, backgroundColor: 'card.body.main', borderRadius: '8px' }}>
                        {section.status === 'completed' && <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />}
                        {section.status === 'in_progress' && <CircularProgress size={20} />}
                        {section.status === 'error' && <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />}
                        {section.status === 'pending' && <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid', borderColor: 'color.dolphinLight' }} />}

                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.heading' }}>
                            {section.shortTopic}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {section.testCaseCount} test cases
                            {section.error && ` - Error: ${section.error}`}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>

                  <Box sx={{ marginTop: 2, padding: 2, backgroundColor: 'card.body.main', borderRadius: '8px' }}>
                    <Typography variant="body2" sx={{ color: 'text.heading' }}>
                      <strong>Total Test Cases Generated:</strong> {generationProgress.totalTestCasesCount}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Completed Status */}
              {generationProgress.status === 'completed' && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2, padding: 2, backgroundColor: 'success.light', borderRadius: '8px', border: '1px solid', borderColor: 'success.main' }}>
                    <CheckCircleIcon sx={{ color: 'success.main', fontSize: 40 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'text.heading' }}>
                        Test Case Generation Complete!
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {generationProgress.totalTestCasesCount} test cases generated successfully
                      </Typography>
                    </Box>
                  </Box>

                  {/* Summary by Section */}
                  <Card sx={{ marginBottom: 2, padding: 2, backgroundColor: 'card.body.main', border: '1px solid', borderColor: 'card.border.main' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', marginBottom: 1, color: 'text.heading' }}>
                      Summary by Section:
                    </Typography>
                    {generationProgress.sections && generationProgress.sections.map((section, index) => (
                      <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', padding: 1, borderBottom: index < generationProgress.sections.length - 1 ? '1px solid' : 'none', borderBottomColor: 'color.graphite' }}>
                        <Typography variant="body2" sx={{ color: 'text.heading' }}>
                          {section.shortTopic}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          {section.testCaseCount} test cases
                        </Typography>
                      </Box>
                    ))}
                  </Card>

                  {/* Download Section */}
                  {generationProgress.templateDownloadUrl && (
                    <Card sx={{ padding: 2, backgroundColor: 'primary.light', border: '1px solid', borderColor: 'primary.main', borderRadius: '8px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <DownloadIcon sx={{ color: 'text.reverse', fontSize: 32 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'text.reverse', marginBottom: 0.5 }}>
                            Download Test Case Spreadsheet
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.reverse', opacity: 0.9 }}>
                            Excel template with all generated test cases
                          </Typography>
                        </Box>
                        <Button
                          onClick={handleDownloadTemplate}
                          variant="contained"
                          sx={{
                            padding: '8px 16px',
                            backgroundColor: 'text.reverse',
                            color: 'primary.main',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            textTransform: 'none',
                            transition: 'all 0.2s',
                            '&:hover': {
                              backgroundColor: 'color.graphiteLight',
                              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.2)',
                            },
                          }}
                        >
                          Download
                        </Button>
                      </Box>
                    </Card>
                  )}

                  {/* Final Message */}

                </Box>
              )}

              {/* Failed Status */}
              {generationProgress.status === 'failed' && (
                <Alert severity="error">
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    Test Case Generation Failed
                  </Typography>
                  <Typography variant="body2" sx={{ marginTop: 1 }}>
                    {generationProgress.error || 'An unexpected error occurred during test case generation.'}
                  </Typography>
                </Alert>
              )}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
};

export default QTestWorkflow2;
