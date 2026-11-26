'use client';

import { getTemplateDocument, updateTemplateDocument } from "@/app/clientServices/templateDocumentService";
import { getAllPersonas } from "@/app/clientServices/personaService";
import { Alert, Box, Button, Checkbox, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Snackbar, Typography } from "@mui/material";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getAllAssistants } from "@/app/clientServices/assistantService";
import { getAllWorkflows } from "@/app/clientServices/workflowService";
import { getAllTemplateCollections } from "@/app/clientServices/templateCollectionService";
import { getAllTemplatePurposes } from "@/app/clientServices/templatePurposeService";
import { useParams } from "next/navigation";

const TemplateAssociation = ({ templateId, assistantName }) => {
  const [originalTemplateDoc, setOriginalTemplateDoc] = useState({});
  const [assistants, setAssistants] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [collections, setCollections] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [saveMessage, setSaveMessage] = useState({ open: false, message: '', type: '' });
  const [loading, setLoading] = useState(true);
  const { teamName } = useParams();

  useEffect(() => {
    const fetchTemplateData = async () => {
      setLoading(true);
      const [templateDocument, assistants, personas, workflows, collections, purposes] = await Promise.all([
        getTemplateDocument(teamName, templateId),
        getAllAssistants(teamName),
        getAllPersonas(teamName, assistantName),
        getAllWorkflows(),
        getAllTemplateCollections(teamName),
        getAllTemplatePurposes(teamName)
      ]);

      setOriginalTemplateDoc({ ...templateDocument });

      templateDocument.assistants = assistants.map(assistant => {
        return {
          ...assistant,
          selected: templateDocument.assistantIds.includes(assistant.id)
        };
      });
      templateDocument.personas = personas.map(persona => {
        return {
          ...persona,
          selected: templateDocument.personaIds.includes(persona.id)
        };
      });
      templateDocument.workflows = workflows.map(workflow => {
        return {
          ...workflow,
          selected: templateDocument.workflowIds.includes(workflow.id)
        };
      });
      templateDocument.collections = collections.map(collection => {
        return {
          ...collection,
          selected: templateDocument.templateCollectionIds.includes(collection.id)
        };
      });
      templateDocument.purposes = purposes.map(purpose => {
        return {
          ...purpose,
          selected: templateDocument.templatePurposeIds.includes(purpose.id)
        };
      });

      setAssistants(templateDocument.assistants);
      setPersonas(templateDocument.personas);
      setWorkflows(templateDocument.workflows);
      setCollections(templateDocument.collections);
      setPurposes(templateDocument.purposes);
      setLoading(false);
    }

    fetchTemplateData();
  }, []);


  const handleAssistantChange = (assistantId) => {
    setAssistants(prevAssistants => prevAssistants.map(assistant => assistant.id === assistantId ? { ...assistant, selected: !assistant.selected } : assistant));
  }
  const handlePersonaChange = (personaId) => {
    setPersonas(prevPersonas => prevPersonas.map(persona => persona.id === personaId ? { ...persona, selected: !persona.selected } : persona));
  }
  const handleWorkflowChange = (workflowId) => {
    setWorkflows(prevWorkflows => prevWorkflows.map(workflow => workflow.id === workflowId ? { ...workflow, selected: !workflow.selected } : workflow));
  }
  const handleCollectionChange = (collectionId) => {
    setCollections(prevCollections => prevCollections.map(collection => collection.id === collectionId ? { ...collection, selected: !collection.selected } : collection));
  }
  const handlePurposeChange = (purposeId) => {
    setPurposes(prevPurposes => prevPurposes.map(purpose => purpose.id === purposeId ? { ...purpose, selected: !purpose.selected } : purpose));
  }

  const handleSaveChanges = async () => {
    const updatedTemplate = {
      ...originalTemplateDoc,
      assistantIds: assistants.filter(assistant => assistant.selected).map(assistant => assistant.id),
      personaIds: personas.filter(persona => persona.selected).map(persona => persona.id),
      workflowIds: workflows.filter(workflow => workflow.selected).map(workflow => workflow.id),
      templateCollectionIds: collections.filter(collection => collection.selected).map(collection => collection.id),
      templatePurposeIds: purposes.filter(purpose => purpose.selected).map(purpose => purpose.id)
    };

    const updatedResult = await updateTemplateDocument(teamName, updatedTemplate);
    if (updatedResult) {
      setSaveMessage({ open: true, message: 'Template updated successfully', type: 'success' });
    } else {
      setSaveMessage({ open: true, message: 'Failed to update template', type: 'error' });
    }
  }

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setSaveMessage({ open: false, message: '', type: '' });
  };

  return (
    <>
      <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', px: 2, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h2">Template Association</Typography>
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, minHeight: 0, overflowY: 'auto' }}>

          <Box sx={{ display: 'flex', flexDirection: 'column', padding: 2 }}>
            <Typography variant="h4">Assistants</Typography>
            {loading ? <Typography>Loading...</Typography> :
              <List sx={{ border: '1px solid', borderColor: 'grey.500', height: '100%', overflow: 'auto' }}>
                {assistants.map(assistant => {
                  const labelId = `checkbox-list-label-${assistant.id}`;
                  return (
                    <ListItem disablePadding key={assistant.id} sx={{ display: 'flex', width: '100%' }}>
                      <ListItemButton dense onClick={(e) => handleAssistantChange(assistant.id)} sx={{ width: '100%' }}>
                        <ListItemIcon sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            edge="start"
                            checked={assistant.selected}
                            tabIndex={-1}
                            disableRipple
                            inputProps={{ 'aria-labelledby': labelId }} />
                          <ListItemText sx={{ color: 'text.primary', width: '100%' }} primary={assistant.name} />
                        </ListItemIcon>
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            }
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', padding: 2 }}>
            <Typography variant="h4">Personas</Typography>
            {loading ? <Typography>Loading...</Typography> :
              <List sx={{ border: '1px solid', borderColor: 'grey.500', height: '100%', overflow: 'auto' }}>
                {personas.map(persona => {
                  const labelId = `checkbox-list-label-${persona.id}`;
                  return (
                    <ListItem disablePadding key={persona.id} sx={{ display: 'flex', width: '100%' }}>
                      <ListItemButton dense onClick={(e) => handlePersonaChange(persona.id)} sx={{ width: '100%' }}>
                        <ListItemIcon sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            edge="start"
                            checked={persona.selected}
                            tabIndex={-1}
                            disableRipple
                            inputProps={{ 'aria-labelledby': labelId }} />
                          <ListItemText sx={{ color: 'text.primary', width: '100%' }} primary={persona.name} />
                        </ListItemIcon>
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            }
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', padding: 2 }}>
            <Typography variant="h4">Workflows</Typography>
            {loading ? <Typography>Loading...</Typography> :
              <List sx={{ border: '1px solid', borderColor: 'grey.500', height: '100%', overflow: 'auto' }}>
                {workflows.map(workflow => {
                  const labelId = `checkbox-list-label-${workflow.id}`;
                  return (
                    <ListItem disablePadding key={workflow.id} sx={{ display: 'flex', width: '100%' }}>
                      <ListItemButton dense onClick={(e) => handleWorkflowChange(workflow.id)} sx={{ width: '100%' }}>
                        <ListItemIcon sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            edge="start"
                            checked={workflow.selected}
                            tabIndex={-1}
                            disableRipple
                            inputProps={{ 'aria-labelledby': labelId }} />
                          <ListItemText sx={{ color: 'text.primary', width: '100%' }} primary={workflow.displayName} />
                        </ListItemIcon>
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            }
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', padding: 2 }}>
            <Typography variant="h4">Collections</Typography>
            {loading ? <Typography>Loading...</Typography> :
              <List sx={{ border: '1px solid', borderColor: 'grey.500', height: '100%', overflow: 'auto' }}>
                {collections.map(collection => {
                  const labelId = `checkbox-list-label-${collection.id}`;
                  return (
                    <ListItem disablePadding key={collection.id} sx={{ display: 'flex', width: '100%' }}>
                      <ListItemButton dense onClick={(e) => handleCollectionChange(collection.id)} sx={{ width: '100%' }}>
                        <ListItemIcon sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            edge="start"
                            checked={collection.selected}
                            tabIndex={-1}
                            disableRipple
                            inputProps={{ 'aria-labelledby': labelId }} />
                          <ListItemText sx={{ color: 'text.primary', width: '100%' }} primary={collection.displayName} />
                        </ListItemIcon>
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            }
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', padding: 2 }}>
            <Typography variant="h4">Purposes</Typography>
            {loading ? <Typography>Loading...</Typography> :
              <List sx={{ border: '1px solid', borderColor: 'grey.500', height: '100%', overflow: 'auto' }}>
                {purposes.map(purpose => {
                  const labelId = `checkbox-list-label-${purpose.id}`;
                  return (
                    <ListItem disablePadding key={purpose.id} sx={{ display: 'flex', width: '100%' }}>
                      <ListItemButton dense onClick={(e) => handlePurposeChange(purpose.id)} sx={{ width: '100%' }}>
                        <ListItemIcon sx={{ display: 'flex', alignItems: 'center' }}>
                          <Checkbox
                            edge="start"
                            checked={purpose.selected}
                            tabIndex={-1}
                            disableRipple
                            inputProps={{ 'aria-labelledby': labelId }} />
                          <ListItemText sx={{ color: 'text.primary', width: '100%' }} primary={purpose.displayName} />
                        </ListItemIcon>
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            }
          </Box>

        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2 }}>
          <Link href={`/admin/context-templates`}>
            <Button variant="action" color="primary">
              Template List
            </Button>
          </Link>
          <Link href={`/admin/context-templates/${templateId}`}>
            <Button variant="action" color="primary">
              Edit Template
            </Button>
          </Link>
          <Button variant="primary" color="primary" onClick={handleSaveChanges}>
            Save Changes
          </Button>
        </Box>
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
    </>
  );
}

export default TemplateAssociation;