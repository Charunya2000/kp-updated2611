import {
  Box,
  Typography,
  Collapse,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  CircularProgress,
  IconButton
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useChatHistorys } from '@reducers/ChatHistoryContext';
import { useChats } from '@reducers/ChatContext';
import { useChatInteractionsDispatch } from '@reducers/ChatInteractionContext';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import { useSources } from '@reducers/SourceContext';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { createChatInteraction, saveChatInteraction, runDmssWorkflow } from '@/app/clientServices/entryWindowService';
import { useUserAssistants } from '@reducers/UserAssistantContext';


const DmssWorkflow = ({ isWorkflowExpanded, toggleWorkflowBox, selectedWorkflow }) => {
  const { teamName, assistantName, id } = useParams();
  const smartNote = useSmartNote();
  const chatHistory = useChatHistorys();
  const { selectedChat } = useChats();
  const chatInteractionDispatch = useChatInteractionsDispatch();
  const [formData, setFormData] = useState({});
  const [testCaseComponents, setTestCaseComponents] = useState([
    { component: '', test_case_name: '', test_case_priority: '' }
  ]);
  const { user } = useAuth();
  const { sources } = useSources();
  const { selectedUserAssistant } = useUserAssistants();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form configuration
  const formFields = [
    {
      type: 'TextField',
      disabled: false,
      label: 'Epic #',
      value: 'epicNumber',
      rules: {
        required: false,
        default: ''
      }
    },
    {
      type: 'TextField',
      disabled: false,
      label: 'Requirement ID',
      value: 'requirementId',
      rules: {
        required: false,
        default: 'Refer to QTest Data'
      }
    },
    {
      type: 'TextField',
      disabled: false,
      label: 'Test Case Created By',
      value: 'createdBy',
      rules: {
        required: false,
        default: `${user?.firstName + ' ' + user?.lastName}`
      }
    },
    {
      type: 'TextField',
      disabled: false,
      label: 'Affects/Versions',
      value: 'affectsVersions',
      rules: {
        required: false,
        default: ''
      }
    },
    {
      type: 'TestCaseComponentsGroup',
      label: 'Test Case Components',
      value: 'testCaseComponents',
      rules: {
        required: true,
        default: []
      }
    },
    {
      type: 'TextField',
      label: 'Description',
      value: 'description',
      disabled: true,
      rules: {
        multiLine: true,
        required: false,
        default: 'The test case description will be extracted from the letter(s) you upload.'
      }
    },
    {
      type: 'TextField',
      label: 'Step Description',
      value: 'stepDescription',
      disabled: true,
      rules: {
        multiLine: true,
        required: false,
        default: 'The step descriptions will be extracted from the letter(s) you upload.'
      }
    },
    {
      type: 'Select',
      label: 'Test Case Phase',
      value: 'testCasePhase',
      options: ['Testing Services', 'SIT', 'Automation Team', 'UAT Client'],
      rules: {
        required: false,
        default: ''
      },
      secondaryComponent: {
        type: 'TextField',
        disabled: false,
        label: 'If other, please specify',
        value: 'testCasePhaseIfOther',
        rules: {
          required: false,
          default: ''
        }
      }
    },
    {
      type: 'Select',
      label: 'Test Case Type',
      value: 'testCaseType',
      options: ['Functional', 'Regression', 'Manual', 'Integration', 'Environment', 'Automation', 'Smoke'],
      rules: {
        required: false,
        default: ''
      },
      secondaryComponent: {
        type: 'TextField',
        disabled: false,
        label: 'If other, please specify',
        value: 'testCaseTypeIfOther',
        rules: {
          required: false,
          default: ''
        }
      }
    },
    {
      type: 'Select',
      label: 'Test Case Status',
      value: 'testCaseStatus',
      options: ['New', 'In Progress', 'Done'],
      rules: {
        required: false,
        default: 'New'
      },
    },
    {
      type: 'TextField',
      disabled: true,
      label: 'Expected Result',
      value: 'expectedResult',
      rules: {
        multiLine: false,
        required: false,
        default: 'The expected results will be extracted from the letters you upload.'
      }
    },
    {
      type: 'TextField',
      disabled: false,
      label: 'Sheet Name',
      value: 'sheetName',
      rules: {
        multiLine: false,
        required: true,
        default: 'Sheet1'
      }
    },
    {
      type: 'DatePicker',
      label: 'Planned Executed Date',
      value: 'plannedExecutedDate',
      rules: {
        required: false,
        default: ''
      }
    }
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = () => {
    const initialData = {};
    formFields.forEach(field => {
      if (field.type !== 'Label') {
        if (field.rules.default === 'now()') {
          initialData[field.value] = new Date();
        } else {
          initialData[field.value] = field.rules.default;
        }
      }

      // Handle secondary components
      if (field.secondaryComponent) {
        initialData[field.secondaryComponent.value] = field.secondaryComponent.rules.default;
      }
    });

    // Initialize testCaseComponents
    initialData.testCaseComponents = [{ component: '', test_case_name: '', test_case_priority: '' }];
    setFormData(initialData);
    setTestCaseComponents(initialData.testCaseComponents);
  }

  const callAssistantWithFormData = async () => {
    const formattedFormData = { ...formData };
    // Format the date to MM/DD/YYYY if it's a valid date
    if (formData.plannedExecutedDate instanceof Date && !isNaN(formData.plannedExecutedDate)) {
      formattedFormData.plannedExecutedDate = formData.plannedExecutedDate.toLocaleDateString('en-US');
    }

    try {
      const chatInteraction = prepDocument({
        type: 'ChatInteraction',
        parentId: selectedChat.id,
        smartNoteId: id,
        prompt: `Hold on! I'm creating your test case(s): ${formattedFormData.testCaseComponents.map(tc => tc.test_case_name).join(', ')}`,
        response: null,
        isComplete: false,
        sheetName: formattedFormData.sheetName,
      });
      chatInteractionDispatch({ type: 'CREATE_CHAT_INTERACTION', chatInteraction: chatInteraction });
      await createChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, chatInteraction);

      let responseContent = '';
      let chatInteractionWithResponse = { ...chatInteraction, response: responseContent };

      await runDmssWorkflow(teamName, assistantName, id, formattedFormData, sources, chatInteraction, (chunk) => {
        responseContent += chunk;
        // Update the chat interaction with the streamed response
        chatInteractionWithResponse = { ...chatInteraction, response: responseContent };
        chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });
      }, () => { });

      chatInteractionWithResponse.isComplete = true;
      chatInteractionDispatch({ type: 'UPDATE_CHAT_INTERACTION', chatInteraction: chatInteractionWithResponse });

      // DMSS Users should be able to convert the Markdow response to an Excel format
      if (selectedUserAssistant.name === 'document-management-shared-service' && responseContent.startsWith('|')) {
        chatInteractionWithResponse.canCallConvertToExcelApi = true;
      }
      await saveChatInteraction(teamName, assistantName, smartNote, chatHistory, selectedChat, chatInteractionWithResponse);
    } catch (error) {
      console.error("Error submitting the workflow: ", error);
      setError('Failed to submit the workflow. Please try again.');
    }
  };

  const handleInputChange = (fieldName, value) => {
    setError(null);
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const addTestCaseComponent = () => {
    // get previous component
    const previousComponent = testCaseComponents[testCaseComponents.length - 1];
    const newComponent = { ...previousComponent };
    const updatedComponents = [...testCaseComponents, newComponent];
    setTestCaseComponents(updatedComponents);
    setFormData(prev => ({
      ...prev,
      testCaseComponents: updatedComponents
    }));
  };

  const removeTestCaseComponent = (index) => {
    const updatedComponents = testCaseComponents.filter((_, i) => i !== index);
    setTestCaseComponents(updatedComponents);
    setFormData(prev => ({
      ...prev,
      testCaseComponents: updatedComponents
    }));
  };

  const updateTestCaseComponent = (index, field, value) => {
    const updatedComponents = testCaseComponents.map((component, i) =>
      i === index ? { ...component, [field]: value } : component
    );
    setTestCaseComponents(updatedComponents);
    setFormData(prev => ({
      ...prev,
      testCaseComponents: updatedComponents
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    toggleWorkflowBox();
    await callAssistantWithFormData();
    setLoading(false);
  };

  const handleReset = () => {
    setError(null);
    setLoading(false);
    loadInitialData();
    setTestCaseComponents([
      { component: '', test_case_name: '', test_case_priority: '' }
    ]);
  };

  const renderField = (field) => {
    const commonProps = {
      fullWidth: true,
      margin: "normal",
      variant: "outlined"
    };

    switch (field.type) {
      case 'Label':
        return (
          <Box key={field.value} sx={{ flex: '1 1 49%', minWidth: 0 }}>
            <Box sx={{ mt: 2, mb: 1, ml: 0.5 }}>
              <Typography
                key={field.value}
                variant="body1"
                sx={{ fontWeight: 'bold' }}
              >
                {field.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.5, whiteSpace: 'pre-line' }}
              >
                {field.text}
              </Typography>
            </Box>
          </Box>
        );
      case 'TextField':
        return (
          <Box key={field.value} sx={{ flex: '1 1 49%', minWidth: 0 }}>
            <TextField
              label={field.label}
              value={formData[field.value] || ''}
              onChange={(e) => handleInputChange(field.value, e.target.value)}
              required={field.rules.required}
              multiline={field.rules.multiLine}
              rows={field.rules.multiLine ? 4 : 1}
              disabled={field.disabled}
              {...commonProps}
            />
          </Box>
        );

      case 'Select':
        return (
          <Box key={field.value} sx={{ flex: '1 1 49%', minWidth: 0 }}>
            <FormControl {...commonProps}>
              <InputLabel>{field.label}</InputLabel>
              <Select
                value={formData[field.value] || ''}
                label={field.label}
                onChange={(e) => handleInputChange(field.value, e.target.value)}
              >
                {field.options.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Render secondary component if "Other" is selected */}
            {field.secondaryComponent &&
              (formData[field.value] === 'Other') && (
                <TextField
                  label={field.secondaryComponent.label}
                  value={formData[field.secondaryComponent.value] || ''}
                  onChange={(e) => handleInputChange(field.secondaryComponent.value, e.target.value)}
                  required={field.secondaryComponent.rules.required}
                  {...commonProps}
                  sx={{ mt: 1 }}
                />
              )}
          </Box>
        );

      case 'TestCaseComponentsGroup':
        return (
          <Box key={field.value} sx={{ flex: '1 1 100%', minWidth: 0, border: '1px solid #ddd', borderRadius: 1, p: 2 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2 }}>
              {field.label}
            </Typography>
            {testCaseComponents.map((component, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Component #{index + 1}
                  </Typography>
                  {testCaseComponents.length > 1 && (
                    <IconButton
                      onClick={() => removeTestCaseComponent(index)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Component"
                    value={component.component}
                    onChange={(e) => updateTestCaseComponent(index, 'component', e.target.value)}
                    variant="outlined"
                    fullWidth
                    required={field.rules.required}
                  />

                  <TextField
                    label="Test Case Name"
                    value={component.test_case_name}
                    onChange={(e) => updateTestCaseComponent(index, 'test_case_name', e.target.value)}
                    variant="outlined"
                    fullWidth
                    required={field.rules.required}
                  />

                  <FormControl fullWidth variant="outlined">
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={component.test_case_priority}
                      label="Priority"
                      variant="outlined"
                      fullWidth
                      onChange={(e) => updateTestCaseComponent(index, 'test_case_priority', e.target.value)}
                      required={field.rules.required}
                    >
                      <MenuItem value="">&nbsp;</MenuItem>
                      <MenuItem value="Critical">Critical</MenuItem>
                      <MenuItem value="High">High</MenuItem>
                      <MenuItem value="Medium">Medium</MenuItem>
                      <MenuItem value="Low">Low</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={addTestCaseComponent}
              variant="action"
              sx={{ mt: 1 }}
            >
              Add Test Case Component
            </Button>
          </Box>
        );

      case 'DatePicker':
        return (
          <Box key={field.value} sx={{ flex: '1 1 49%', minWidth: 0 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                sx={{
                  width: '100%',
                  '& .MuiFormHelperText-root': { backgroundColor: 'inherit' }
                }}
                label={field.label}
                value={formData[field.value] || null}
                onChange={(newValue) => handleInputChange(field.value, newValue)}
                renderInput={(params) => <TextField {...params} {...commonProps} />}
                slotProps={{
                  textField: {
                    helperText: 'MM/DD/YYYY',
                  },
                }}
              />
            </LocalizationProvider>
          </Box>
        );
      default:
        return null;
    }
  };

  return (<Box
    sx={{
      backgroundColor: 'card.body.dark',
      padding: 2,
      borderRadius: '12px',
      marginBottom: 2,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      width: '100%',
      flexShrink: 0,
      maxHeight: '75%',
      overflow: 'auto',
      '&::-webkit-scrollbar': { width: '12px' },
      '&::-webkit-scrollbar-thumb': { backgroundColor: '#b0c4de', borderRadius: '6px' }
    }}
  >
    <Typography
      variant="h6"
      sx={{ fontWeight: 'bold', cursor: 'pointer', display: 'flex' }}
      onClick={toggleWorkflowBox}
    >
      {selectedWorkflow.name} {isWorkflowExpanded ? '▼' : '▲'}
      {
        !isWorkflowExpanded && loading && (
          <Box sx={{ ml: 8, display: 'inline', display: 'flex', alignItems: 'center' }}>
            Loading... <CircularProgress size={20} sx={{ ml: 2 }} />
          </Box>
        )
      }
      {
        error && (
          <Box sx={{ ml: 2, display: 'inline', color: 'error.main' }}>
            {error}
          </Box>
        )
      }
    </Typography>
    <Collapse in={isWorkflowExpanded}>
      <Box>
        <Typography variant="body1" sx={{ marginBottom: 2 }}>
          {selectedWorkflow.message}
        </Typography>
      </Box>
      <Box>
        <Box component={'form'} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {formFields
            .filter(field => field.type !== 'Button' && field.type !== 'ButtonReset')
            .map((field) => renderField(field))
          }

          <Box sx={{ display: 'flex', width: '100%', gap: 2, mt: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Button
                variant="secondary"
                onClick={handleReset}
                disabled={loading}
                fullWidth
              >
                Reset
              </Button>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={loading}
                fullWidth
              >
                {loading ? <CircularProgress /> : 'Submit'}
              </Button>
            </Box>
          </Box>

        </Box>
      </Box>
    </Collapse>
  </Box>);
}

export default DmssWorkflow;