import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Box, Button } from '@mui/material';
import AddSourceDialog from './AddSourceDialog';
import { useWorkflowDispatch } from '@reducers/WorkflowContext';
import { clearCurrentChat } from '@/app/clientServices/personaService';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useChatHistorys } from '@reducers/ChatHistoryContext';
import { useChats } from '@reducers/ChatContext';
import { useSuggestedPromptsDispatch } from '@reducers/SuggestedPromptContext';
import { useChatInteractionsDispatch } from '@/reducers/ChatInteractionContext';
import { useParams } from 'next/navigation';
import { getAllWorkflows } from '@clientServices/workflowService';


const defaultWorkflows = [
  {
    id: '54fb7bab-77ae-4a39-8e1d-970771a2bd59',
    path: 'medicaid/requirements',
    name: 'Extract Regulatory Requirements',
    message: 'This AI-powered workflow can help you quickly extract or generate regulatory requirements for any document or topic. Simply provide the document or tell us what you\'re looking for.',
    requiresUpload: true,
    disabled: false,
    associatedAssistants: ['medicaid-ai-assistant'],
  },
  {
    id: 'ae6b71b0-6557-486f-a683-351bb5954070',
    path: 'medicaid/changeReq',
    name: 'Compare Regulatory Requirements',
    message: 'This AI-powered workflow can track the history and compare multiple versions of regulatory requirements.',
    requiresUpload: false,
    disabled: false,
    associatedAssistants: ['medicaid-ai-assistant'],
  },
  {
    id: '1fcc38c2-28bc-432b-9929-467ec2cbfdbf',
    path: 'medicaid/rcm',
    name: 'Extract and Organize Content',
    message: 'This AI-powered workflow can split sections of your document and organize the content into a structured table format for easy analysis and reference.',
    requiresUpload: true,
    disabled: true,
    associatedAssistants: ['medicaid-ai-assistant'],
  },
  {
    id: '1cfc9ee0-cc06-4c65-aaf6-647194d5ff34',
    path: 'medicaid/summarize',
    name: 'Summarize Document',
    message: 'This AI-powered workflow can summarize your document and generate a concise output in memorandum format for clear communication and quick reference.',
    requiresUpload: true,
    disabled: true,
    associatedAssistants: ['medicaid-ai-assistant'],
  },
  {
    id: '0101df82-2a5d-4948-871a-b7bee62f85fb',
    path: 'products/api/hipos/kpifrouter',
    name: 'Generate Jira Issue',
    message: 'Extract and generate Jira tickets for impacted business requirements.',
    requiresUpload: false,
    disabled: false,
    associatedAssistants: ['products'],
  },
  {
    id: '6845f225-c905-47fa-920a-456c4d910618',
    path: 'n/a',
    name: 'QTest Import Workflow',
    message: 'Create QTest import template spreadsheet from requirements.\nProcessing based on single uploaded file and single user note in context.\nThis can be managed by selecting only the sources needed for the workflow.',
    requiresUpload: true,
    disabled: false,
    associatedAssistants: ['scheduletopay'],
  },
  {
    id: '0eb95fa0-1aef-4343-a928-d35a16d7fbc5',
    path: 'dmss/form',
    name: 'Test Case Generation',
    message: 'This AI-powered workflow can help you generate test cases from your document.',
    associatedAssistants: ['document-management-shared-service'],
  }
];

const SmartWorkflowSection = ({ selectedUserAssistant }) => {

  if (!selectedUserAssistant) {
    return null;
  }

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const workflowDispatch = useWorkflowDispatch();
  const smartNote = useSmartNote();
  const chatHistory = useChatHistorys();
  const { selectedChat } = useChats();
  const suggestedPromptsDispatch = useSuggestedPromptsDispatch();
  const chatInteractionDispath = useChatInteractionsDispatch();
  const [workflows, setWorkflows] = useState(defaultWorkflows);
  const { teamName, assistantName, id: smartNoteId } = useParams();

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const apiWorkflows = await getAllWorkflows(teamName);

        // Filter workflows that are associated with the current assistant
        const assistantWorkflows = apiWorkflows.filter(workflow =>
          workflow.associatedAssistants &&
          workflow.associatedAssistants.includes(assistantName)
        );

        // If we have assistant-specific workflows from the API, use them
        // Otherwise, fall back to the default workflows
        if (assistantWorkflows.length > 0) {
          setWorkflows(assistantWorkflows);
        } else {
          // Keep default workflows for backward compatibility
          setWorkflows(defaultWorkflows);
        }
      } catch (error) {
        console.error('Failed to fetch workflows:', error);
        // Fall back to default workflows if API call fails
        setWorkflows(defaultWorkflows);
      }
    };

    if (teamName && assistantName) {
      fetchWorkflows();
    }
  }, [teamName, assistantName]);

  const handleRefresh = async () => {
    try {
      if (chatHistory && selectedChat) {
        clearCurrentChat(teamName, assistantName, smartNote, chatHistory, selectedChat);
      }
      suggestedPromptsDispatch({ type: 'SET_SUGGESTED_PROMPTS', suggestedPrompts: [] })
      chatInteractionDispath({ type: 'SET_CHAT_INTERACTIONS', chatInteractions: [] });
    } catch (error) {
      console.error('Failed to delete chat interactions:', error);
    }
  };

  const handleWorkflowClick = (workflow) => {
    handleRefresh();
    if (selectedWorkflow?.path === workflow.path) {
      // If the same workflow is clicked, unselect it
      setSelectedWorkflow(null);
      workflowDispatch({ type: 'CLEAR_WORKFLOW' });
      workflowDispatch({ type: 'SET_FILES', files: [] });
    } else {
      // Select the new workflow
      setSelectedWorkflow(workflow);
      workflowDispatch({ type: 'SET_WORKFLOW', workflow });
      workflowDispatch({ type: 'SET_FILES', files: [] });
    }
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setSelectedWorkflow(null);
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {workflows.map((workflow) => workflow.associatedAssistants.filter(r => r === selectedUserAssistant.name).length > 0 && (
        <Button
          key={workflow.id}
          onClick={() => handleWorkflowClick(workflow)}
          variant={selectedWorkflow?.path === workflow.path ? 'primary' : 'secondary'}
          disabled={workflow.disabled}
          sx={{
            paddingY: 0.5,
            marginRight: 0.5,
          }}
        >
          {workflow.name}
        </Button>
      ))}
      {selectedWorkflow && selectedWorkflow.requiresUpload && (
        <AddSourceDialog open={openDialog} handleClose={handleDialogClose} />
      )}
    </Box>
  );
};


const SmartWorkflowSectionConversation = ({ toggleWorkflowBox, selectedWorkflow, isWorkflowExpanded }) => {
  return (<Box
    sx={{
      backgroundColor: 'background.default',
      padding: 2,
      borderRadius: '12px',
      marginBottom: 2,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      width: '100%',
      flexShrink: 0,
    }}
  >
    <Typography
      variant="h6"
      sx={{ fontWeight: 'bold', cursor: 'pointer' }}
      onClick={toggleWorkflowBox}
    >
      {selectedWorkflow.name} {isWorkflowExpanded ? '▼' : '▲'}
    </Typography>
    <Collapse in={isWorkflowExpanded}>
      <Box>
        <Typography variant="body1" sx={{ marginBottom: 2 }}>
          {selectedWorkflow.message}
        </Typography>
      </Box>
    </Collapse>
  </Box>);
}

SmartWorkflowSection.propTypes = {
  selectedUserRole: PropTypes.shape({
    name: PropTypes.string.isRequired,
  }),
};

SmartWorkflowSectionConversation.propTypes = {
  toggleWorkflowBox: PropTypes.func.isRequired,
  selectedWorkflow: PropTypes.shape({
    name: PropTypes.string.isRequired,
    message: PropTypes.string,
  }).isRequired,
  isWorkflowExpanded: PropTypes.bool.isRequired,
};


export default SmartWorkflowSection;
export { SmartWorkflowSectionConversation };