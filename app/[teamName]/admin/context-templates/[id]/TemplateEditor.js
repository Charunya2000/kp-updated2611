'use client'

import { useEffect, useRef, useState } from "react";
import { Box, Button, TextField, Paper, Typography, IconButton, Menu, MenuItem, Accordion, AccordionSummary, AccordionDetails, Snackbar, Alert, Tooltip } from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import { ExpandMore, MoreHoriz, ScienceOutlined } from "@mui/icons-material";
import { getTemplateDocument, updateTemplateDocument } from "@/app/clientServices/templateDocumentService";
import { prepDocument } from "@/app/clientServices/insertDocument";
import Link from "next/link";

const TemplateEditor = ({ templateId }) => {
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [inputs, setInputs] = useState([]);
  const [clearTextAnchor, setClearTextAnchor] = useState(null);
  const [deleteInputAnchors, setDeleteInputAnchors] = useState({});
  const [insertMenuAnchor, setInsertMenuAnchor] = useState(null);
  const [saveMessage, setSaveMessage] = useState({ open: false, message: '', type: '' });
  const contentTextFieldRef = useRef(null);

  useEffect(() => {
    // fetch template content and description from the server
    const fetchTemplateData = async () => {
      const templateData = await getTemplateDocument(teamName, templateId);
      setTemplateName(templateData.name ?? '');
      setTemplateContent(templateData.content ?? '');
      setTemplateDescription(templateData.description ?? '');
      setInputs(templateData.inputs ?? []);

      const anchors = {};
      templateData?.inputs?.forEach((input) => {
        anchors[input.id] = null;
      });
      setDeleteInputAnchors(anchors);
    };

    fetchTemplateData();
  }, []);

  const handleTemplateNameChange = (event) => {
    setTemplateName(event.target.value);
  };

  const handleContentChange = (event) => {
    setTemplateContent(event.target.value);
  };

  const handleInsertAnchorOpen = (e) => {
    setInsertMenuAnchor(e.currentTarget);
  };

  const handleMenuItemClick = (input) => {
    const updatedContent = templateContent.concat(`\${${input.name}}`);
    setTemplateContent(updatedContent);
    setInsertMenuAnchor(null);
  };

  const handleClearTextMoreClicked = (event) => {
    event.stopPropagation();
    setClearTextAnchor(event.currentTarget);
  };

  const handleClearTextAcceptClicked = () => {
    setTemplateContent('');
    setClearTextAnchor(null);
  };

  const handleAddInputClicked = () => {
    const newInput = prepDocument({ name: `Input ${inputs.length + 1}`, defaultValue: '' });
    setInputs((prevInputs) => [...prevInputs, newInput]);
  };

  const handleDeleteInputMoreClicked = (event, input) => {
    event.stopPropagation();
    setDeleteInputAnchors((prev) => ({
      ...prev,
      [input.id]: event.currentTarget, // Set the button as the anchor element for the corresponding ID
    }));
  };

  const handleDeleteInputAcceptClicked = (event, input) => {
    event.stopPropagation();
    const updatedInputs = inputs.filter((i) => i.id !== input.id);
    setInputs(updatedInputs);

    setDeleteInputAnchors((prev) => ({
      ...prev,
      [input.id]: null, // Reset the anchor element for the corresponding ID
    }));
  };

  const handleCloseDeleteInputMenu = (event, input) => {
    event.stopPropagation();
    setDeleteInputAnchors((prev) => ({
      ...prev,
      [input.id]: null, // Reset the anchor element for the corresponding ID
    }));
  };

  const handleClearTextAnchorClose = (event) => {
    event.stopPropagation();
    setClearTextAnchor(null);
  }

  const handleSaveTemplate = async () => {
    // Save the template logic here
    const template = {
      id: templateId,
      name: templateName,
      content: templateContent,
      description: templateDescription,
      inputs: inputs
    };

    // save template to mongo
    const response = await updateTemplateDocument(teamName, template);
    if (response) {
      setSaveMessage({ open: true, message: 'Template saved successfully!', type: 'success' });
    } else {
      setSaveMessage({ open: true, message: 'Unable to save template!', type: 'error' });
    }
  }

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setSaveMessage({ open: false, message: '', type: '' });
  };

  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2 }}>
        <TextField label="Template Name" sx={{ width: '100%' }} onChange={handleTemplateNameChange} value={templateName} />
      </Box>
      <Box sx={{ display: 'grid', overflow: 'hidden', gridTemplateColumns: '3fr 2fr', flex: 1, px: 2, py: 1, gap: 2, backgroundColor: 'grey.200' }}>
        <Box sx={{ display: 'grid', overflow: 'hidden', gridTemplateRows: '3fr 2fr', py: 1, gap: 2 }}>
          <Paper sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', p: 2 }}>
            <Box sx={{ display: 'flex', py: 1, gap: 1, borderBottom: '1px solid', borderColor: 'grey.200' }}>
              <Typography sx={{ flex: 1 }} variant="h4">Template Content</Typography>
              <Button onClick={handleInsertAnchorOpen} variant="action" startIcon={<AddIcon />}>
                Insert
              </Button>
              {inputs && inputs.length > 0 &&
                <Menu
                  anchorEl={insertMenuAnchor}
                  open={Boolean(insertMenuAnchor)}
                  onClose={() => setInsertMenuAnchor(null)}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                >
                  {
                    inputs.map((input) => (
                      <MenuItem key={input.id} onClick={() => handleMenuItemClick(input)}>
                        {input.name}
                      </MenuItem>
                    ))
                  }
                </Menu>
              }
              <IconButton onClick={handleClearTextMoreClicked} aria-label='more'>
                <MoreHoriz />
              </IconButton>
              <Menu
                anchorEl={clearTextAnchor}
                open={Boolean(clearTextAnchor)}
                onClose={handleClearTextAnchorClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
              >
                <MenuItem onClick={handleClearTextAcceptClicked}>Clear Text</MenuItem>
              </Menu>
              <Tooltip title="This feature is currently disabled." placement="bottom" arrow>
                <span id='disabled button tooltip helper'>
                  <Button disabled variant="action" startIcon={<ScienceOutlined />}>
                    Test Prompt
                  </Button>
                </span>
              </Tooltip>
            </Box>
            <Box sx={{ overflow: 'auto', display: 'flex', flex: 1, pt: 1, flexDirection: 'column' }}>
              <TextField
                label="Template Content"
                sx={{
                  flex: 1,
                  "& .MuiInputBase-root": {
                    height: "100%",
                  },
                  "& .MuiInputBase-input": {
                    alignSelf: "start",
                    overflow: "auto",
                    resize: "none",
                  },
                }}
                multiline
                fullWidth
                value={templateContent}
                onChange={handleContentChange}
                inputRef={contentTextFieldRef}
              />
            </Box>
          </Paper>
          <Paper sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', p: 2 }}>
            <Typography variant="h4" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'grey.300' }}>Description</Typography>
            <Box sx={{ overflow: 'auto', display: 'flex', flex: 1, pt: 1, flexDirection: 'column' }}>
              <TextField
                label="Description"
                sx={{
                  flex: 1,
                  "& .MuiInputBase-root": {
                    height: "100%",
                  },
                  "& .MuiInputBase-input": {
                    alignSelf: "start",
                    overflow: "auto",
                    resize: "none",
                  },
                }}
                multiline
                fullWidth
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
              />
            </Box>
          </Paper>
        </Box>
        <Box sx={{ height: '100%', py: 1, overflow: 'hidden' }}>
          <Paper sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'grey.300' }}>
              <Typography variant="h4" sx={{ flex: 1 }}>Content Inputs</Typography>
              <Button variant="action" startIcon={<AddIcon />} onClick={handleAddInputClicked}>
                Add Input
              </Button>
            </Box>
            <Box sx={{ overflow: 'auto', display: 'flex', flex: 1, flexDirection: 'column' }}>
              {inputs && inputs.map((input) => (
                <Box sx={{ p: 2 }} key={input.id}>
                  <Accordion defaultExpanded={true}>
                    <AccordionSummary sx={{ '&:hover': { backgroundColor: 'grey.100' } }} expandIcon={<ExpandMore sx={{ fontSize: '50px' }} />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" component='span' sx={{ px: 0.5, py: '2px', border: '1px solid', borderColor: 'secondary.main', borderRadius: 1, backgroundColor: 'secondary.dark', color: 'white' }}>
                            {input.name}
                          </Typography>
                        </Box>
                        <IconButton onClick={(e) => handleDeleteInputMoreClicked(e, input)} aria-label='more'>
                          <MoreHoriz />
                        </IconButton>
                        <Menu
                          anchorEl={deleteInputAnchors[input.id]}
                          open={Boolean(deleteInputAnchors[input.id])}
                          onClose={(e) => handleCloseDeleteInputMenu(e, input)}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                          }}
                        >
                          <MenuItem onClick={(e) => handleDeleteInputAcceptClicked(e, input)}>Delete Input</MenuItem>
                        </Menu>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'grey.300', p: 2 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                          label="Name"
                          value={input.name}
                          onChange={(e) => {
                            const updatedInputs = inputs.map((i) =>
                              i.id === input.id ? { ...i, name: e.target.value } : i
                            );
                            setInputs(updatedInputs);
                          }}
                          fullWidth
                        />
                        <TextField
                          label="Default Value"
                          value={input.defaultValue}
                          onChange={(e) => {
                            const updatedInputs = inputs.map((i) =>
                              i.id === input.id ? { ...i, defaultValue: e.target.value } : i
                            );
                            setInputs(updatedInputs);
                          }}
                          multiline
                          fullWidth
                        />
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Link href={`/admin/context-templates`}>
          <Button variant="action" color="primary">
            Template List
          </Button>
        </Link>
        <Link href={`/admin/context-templates/${templateId}/associations`}>
          <Button variant="action" color="primary">
            Manage Associations
          </Button>
        </Link>
        <Button variant="primary" color="primary" onClick={handleSaveTemplate}>Save Changes</Button>
      </Box>
      <Snackbar open={saveMessage?.open}
        autoHideDuration={3000}
        onClose={handleClose}>
        <Alert
          onClose={handleClose}
          severity={saveMessage?.type}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {saveMessage?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TemplateEditor;
