'use client';

import { getAllWorkflows, createWorkflow, updateWorkflow, deleteWorkflow } from '@/app/clientServices/workflowService';
import { getAllAssistants } from '@/app/clientServices/assistantService';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ListItemIcon
} from "@mui/material";
import { useEffect, useState } from "react";
import useSnackbar from '@/app/hooks/useSnackbar';
import { InfoOutlined } from '@mui/icons-material';

const sortByNameProperty = (workflows) => {
  return [...workflows].sort((a, b) => {
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
};

const WorkflowManagement = ({ teamName }) => {
  const [workflows, setWorkflows] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [requiresUpload, setRequiresUpload] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [associatedAssistants, setAssociatedAssistants] = useState([]);
  const [lastClickedAssistantIndex, setLastClickedAssistantIndex] = useState(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  // Use the custom snackbar hook
  const { SnackbarComponent, showSnackbar } = useSnackbar();

  useEffect(() => {
    const handleGetAllWorkflows = async () => {
      try {
        const workflowsData = await getAllWorkflows(teamName);
        setWorkflows(sortByNameProperty(workflowsData));
      } catch (error) {
        showSnackbar("Failed to load workflows", "error");
      }
    }

    const handleGetAllAssistants = async () => {
      try {
        const assistantsData = await getAllAssistants(teamName);
        setAssistants(sortByNameProperty(assistantsData));
      } catch (error) {
        showSnackbar("Failed to load assistants", "error");
      }
    }

    handleGetAllWorkflows();
    handleGetAllAssistants();
  }, [])

  const handleWorkflowClick = (workflow) => {
    setSelectedWorkflow(workflow);
    setPath(workflow.path || "");
    setName(workflow.name || "");
    setMessage(workflow.message || "");
    setRequiresUpload(workflow.requiresUpload || false);
    setDisabled(workflow.disabled || false);
    setAssociatedAssistants(workflow.associatedAssistants || []);
  }

  const handleAddNewWorkflow = async () => {
    if (!path || !name || !message) {
      showSnackbar("Path, name, and message are required", "error");
      return;
    }

    const newWorkflow = {
      path,
      name,
      message,
      requiresUpload,
      disabled,
      associatedAssistants
    };

    try {
      const response = await createWorkflow(newWorkflow, teamName);
      if (response && !response.error) {
        setWorkflows(sortByNameProperty([...workflows, { ...newWorkflow, id: response.id }]));
        showSnackbar("Workflow added successfully", "success");
        clearForm();
      } else {
        showSnackbar(response.error || "Failed to add workflow", "error");
      }
    } catch (error) {
      showSnackbar("Error adding workflow", "error");
    }
  }

  const handleEditWorkflow = async () => {
    if (!path || !name || !message) {
      showSnackbar("Path, name, and message are required", "error");
      return;
    }

    const updatedWorkflow = {
      id: selectedWorkflow.id,
      path,
      name,
      message,
      requiresUpload,
      disabled,
      associatedAssistants
    };

    try {
      const response = await updateWorkflow(updatedWorkflow.id, updatedWorkflow, teamName);
      if (response && !response.error) {
        const updatedWorkflows = workflows.map(workflow =>
          workflow.id === selectedWorkflow.id ? { ...workflow, ...updatedWorkflow } : workflow
        );
        setWorkflows(sortByNameProperty(updatedWorkflows));
        showSnackbar("Workflow updated successfully", "success");
        clearForm();
      } else {
        showSnackbar(response.error || "Failed to update workflow", "error");
      }
    } catch (error) {
      showSnackbar("Error updating workflow", "error");
    }
  }

  const handleDeleteWorkflow = async () => {
    try {
      const response = await deleteWorkflow(selectedWorkflow.id, teamName);
      if (response && !response.error) {
        setWorkflows(workflows.filter(workflow => workflow.id !== selectedWorkflow.id));
        showSnackbar("Workflow deleted successfully", "success");
        clearForm();
        setDeleteConfirmationOpen(false);
      } else {
        showSnackbar(response.error || "Failed to delete workflow", "error");
      }
    } catch (error) {
      showSnackbar("Error deleting workflow", "error");
    }
  }

  const handleAssistantSelection = (event, selectedAssistant, assistantIndex) => {
    event.preventDefault();

    const isShiftClick = event.shiftKey;
    const isCurrentlySelected = associatedAssistants.includes(selectedAssistant);

    if (isShiftClick && lastClickedAssistantIndex !== null && lastClickedAssistantIndex !== assistantIndex) {
      // Shift-click range selection
      const startIndex = Math.min(lastClickedAssistantIndex, assistantIndex);
      const endIndex = Math.max(lastClickedAssistantIndex, assistantIndex);
      const assistantsToToggle = assistantOptions.slice(startIndex, endIndex + 1);

      // Determine if we should add or remove based on the clicked assistant's current state
      if (isCurrentlySelected) {
        // Remove the range
        setAssociatedAssistants(prev => prev.filter(assistant => !assistantsToToggle.includes(assistant)));
      } else {
        // Add the range
        setAssociatedAssistants(prev => {
          const newAssistants = [...prev];
          assistantsToToggle.forEach(assistant => {
            if (!newAssistants.includes(assistant)) {
              newAssistants.push(assistant);
            }
          });
          return newAssistants;
        });
      }
    } else {
      // Regular single click
      if (isCurrentlySelected) {
        setAssociatedAssistants(prev => prev.filter(assistant => assistant !== selectedAssistant));
      } else {
        setAssociatedAssistants(prev => [...prev, selectedAssistant]);
      }
    }

    setLastClickedAssistantIndex(assistantIndex);
  };

  const clearForm = () => {
    setSelectedWorkflow(null);
    setPath("");
    setName("");
    setMessage("");
    setRequiresUpload(false);
    setDisabled(false);
    setAssociatedAssistants([]);
    setLastClickedAssistantIndex(null);
  }

  const openDeleteConfirmation = () => {
    setDeleteConfirmationOpen(true);
  }

  const closeDeleteConfirmation = () => {
    setDeleteConfirmationOpen(false);
  }

  const assistantOptions = assistants.map(assistant => assistant.name);

  return (
    <Box sx={{
      display: 'flex',
      height: '100%',
      gap: 2,
      p: 3,
      maxHeight: 'calc(100vh - 120px)'
    }}>
      {/* Workflow List */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        overflow: 'auto'
      }}>
        <Typography variant="h6" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'color.slate' }}>
          Workflow Configurations
        </Typography>
        {workflows.map((workflow) => (
          <ListItem
            key={workflow.id}
            button="true"
            onClick={() => handleWorkflowClick(workflow)}
            selected={selectedWorkflow && selectedWorkflow.id === workflow.id}
            sx={{
              cursor: 'pointer',
              backgroundColor: selectedWorkflow && selectedWorkflow.id === workflow.id
                ? 'action.selected'
                : 'transparent',
              '&:hover': {
                backgroundColor: 'action.hover'
              },
              '&.Mui-selected': {
                backgroundColor: 'action.selected',
                '&:hover': {
                  backgroundColor: 'action.selected'
                }
              }
            }}
          >
            <Box sx={{ width: '100%', py: 1 }}>
              <Typography variant="body1" component="div" sx={{ fontWeight: 500 }}>
                {workflow.name}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary" component="div">
                  {workflow.path}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {workflow.associatedAssistants?.map((assistant, index) => (
                    <Chip
                      key={index}
                      label={assistant}
                      size="small"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </Box>
                {workflow.disabled && (
                  <Chip label="Disabled" size="small" color="error" sx={{ mt: 0.5 }} />
                )}
              </Box>
            </Box>
          </ListItem>
        ))}
      </Box>

      {/* Workflow Form */}
      <Box sx={{
        width: '50%',
        border: '1px solid',
        borderColor: 'color.slate',
        borderRadius: 1,
        p: 2,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {selectedWorkflow ? 'Edit Workflow' : 'Add New Workflow'}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            fullWidth
            helperText="URL path or identifier for the workflow"
          />

          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            helperText="Display name for the workflow"
          />

          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            helperText="Description or message shown to users"
          />

          <FormControl fullWidth>
            <InputLabel>Associated Assistants</InputLabel>
            <Select
              multiple
              value={associatedAssistants}
              onChange={() => { }} // Disabled default onChange to use custom click handling
              label="Associated Assistants"
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 300,
                  },
                },
                autoFocus: false,
              }}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" variant="outlined" />
                  ))}
                </Box>
              )}
            >
              {assistantOptions.map((assistant, index) => (
                <MenuItem
                  key={assistant}
                  value={assistant}
                  onClick={(event) => handleAssistantSelection(event, assistant, index)}
                >
                  <ListItemIcon>
                    <Checkbox checked={associatedAssistants.indexOf(assistant) > -1} />
                  </ListItemIcon>
                  <ListItemText primary={assistant} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={requiresUpload}
                onChange={(e) => setRequiresUpload(e.target.checked)}
              />
            }
            label="Requires Upload"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={disabled}
                onChange={(e) => setDisabled(e.target.checked)}
              />
            }
            label="Disabled"
          />

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            {selectedWorkflow ? (
              <>
                <Button
                  variant="primary"
                  onClick={handleEditWorkflow}
                >
                  Update Workflow
                </Button>
                <Button
                  variant="destructive"
                  onClick={openDeleteConfirmation}
                >
                  Delete Workflow
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onClick={handleAddNewWorkflow}
              >
                Add Workflow
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={clearForm}
            >
              Clear
            </Button>
          </Box>
        </Box>
        <Box sx={{ mt: 'auto', backgroundColor: 'color.blue10', borderRadius: '4px', p: 2, display: 'flex', gap: 1, color: 'color.inky' }}>
          <InfoOutlined sx={{ fontSize: '28px' }} />
          <Typography variant="body1">Workflows Configurations are meant to provide a way to configure existing workflows from an admin panel. They do not yet allow for custom built workflows to be integrated.</Typography>
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmationOpen}
        onClose={closeDeleteConfirmation}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete the workflow "{selectedWorkflow?.name}"?
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={closeDeleteConfirmation}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteWorkflow} autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <SnackbarComponent />
    </Box>
  );
}

export default WorkflowManagement;