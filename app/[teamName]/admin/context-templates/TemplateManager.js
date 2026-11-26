'use client';

import { prepDocument } from "@/app/clientServices/insertDocument";
import { getAllPersonas } from "@/app/clientServices/personaService";
import { getAllAssistants } from "@/app/clientServices/assistantService";
import { getAllTemplateCollections } from "@/app/clientServices/templateCollectionService";
import { createTemplateDocument, deleteTemplateDocument, getAllTemplateDocuments } from "@/app/clientServices/templateDocumentService";
import { getAllTemplatePurposes } from "@/app/clientServices/templatePurposeService";
import { getAllWorkflows } from "@/app/clientServices/workflowService";
import { Add, DeleteForeverOutlined, EditOutlined, ExpandMore, HubOutlined } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TemplateManager = ({ assistantName }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { teamName } = useParams();

  useEffect(() => {
    const fetchTemplateData = async () => {
      setLoading(true);
      const [templateDocuments, assistants, personas, workflows, collections, purposes] = await Promise.all([
        getAllTemplateDocuments(teamName),
        getAllAssistants(teamName),
        getAllPersonas(teamName, assistantName),
        getAllWorkflows(),
        getAllTemplateCollections(teamName),
        getAllTemplatePurposes(teamName)
      ]);

      templateDocuments.forEach(template => {
        template.assistantIds = assistants.filter(assistant => template.assistantIds.includes(assistant.id)).map(assistant => assistant.name);
        template.personas = personas.filter(persona => template.personaIds.includes(persona.id)).map(persona => persona.name);
        template.workflows = workflows.filter(workflow => template.workflowIds.includes(workflow.id)).map(workflow => workflow.displayName);
        template.collections = collections.filter(collection => template.templateCollectionIds.includes(collection.id)).map(collection => collection.displayName);
        template.purposes = purposes.filter(purpose => template.templatePurposeIds.includes(purpose.id)).map(purpose => purpose.displayName);
      });

      setTemplates(templateDocuments);
      setLoading(false);
    }

    fetchTemplateData();
  }, []);

  const handleDelete = async (templateId) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete this template: ${templates.find(t => t.id === templateId).name}?`);
    if (confirmDelete) {
      const deleteResult = await deleteTemplateDocument(teamName, templateId);
      if (deleteResult.success) {
        setTemplates(templates.filter(template => template.id !== templateId));
      }
    }
  }

  const handleAddNew = async () => {
    const newTemplate = prepDocument({
      name: 'New Template',
      content: '',
      description: 'This template is used to...',
      inputs: [],
      assistantIds: [],
      personaIds: [],
      workflowIds: [],
      templateCollectionIds: []
    });

    await createTemplateDocument(teamName, newTemplate);

    router.push(`/admin/context-templates/${newTemplate.id}`);
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%', // Fill the viewport height
        padding: 2,
        boxSizing: 'border-box',
      }}
    >
      <Typography variant="h4" gutterBottom>
        Template Manager
      </Typography>
      <Accordion sx={{ border: '1px solid', borderColor: 'grey.300' }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant='body1'>
            Filter <Typography sx={{ color: 'red', fontStyle: 'italic' }} variant="body2" component={'span'}>(This feature not yet enabled.)</Typography>
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', gap: 2 }}>
          <TextField
            sx={{ margin: 1 }}
            label="Template Name"
            variant="outlined"
            fullWidth
            margin="normal" />
          <TextField
            sx={{ margin: 1 }}
            label="Available to Assistants"
            variant="outlined"
            fullWidth
            margin="normal" />
          <TextField
            sx={{ margin: 1 }}
            label="Available to Personas"
            variant="outlined"
            fullWidth
            margin="normal" />
          <TextField
            sx={{ margin: 1 }}
            label="Description"
            variant="outlined"
            fullWidth
            margin="normal" />
          <TextField
            sx={{ margin: 1 }}
            label="Available to Workflows"
            variant="outlined"
            fullWidth
            margin="normal" />
          <TextField
            sx={{ margin: 1 }}
            label="Part of Collections"
            variant="outlined"
            fullWidth
            margin="normal" />
          <TextField
            sx={{ margin: 1 }}
            label="Has Purpose"
            variant="outlined"
            fullWidth
            margin="normal" />
        </AccordionDetails>
      </Accordion>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mt: 2 }}>
        <TableContainer sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '60px' }}>Edit</TableCell>
                <TableCell sx={{ width: '80px' }}>Associations</TableCell>
                <TableCell sx={{ maxWidth: '120px' }}>Template Name</TableCell>
                <TableCell sx={{ maxWidth: '120px' }}>Description</TableCell>
                <TableCell sx={{ maxWidth: '120px' }}>Assistants</TableCell>
                <TableCell sx={{ maxWidth: '120px' }}>Personas</TableCell>
                <TableCell sx={{ maxWidth: '120px' }}>Workflows</TableCell>
                <TableCell sx={{ maxWidth: '120px' }}>Collections</TableCell>
                <TableCell sx={{ maxWidth: '120px' }}>Purposes</TableCell>
                <TableCell sx={{ maxWidth: '60px' }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates && templates.length > 0 && templates.map((template, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ width: '60px' }}>
                    <Link href={`/admin/context-templates/${template.id}`} passHref>
                      <IconButton aria-label="edit" sx={{ padding: 0 }}>
                        <EditOutlined />
                      </IconButton>
                    </Link>
                  </TableCell>
                  <TableCell sx={{ width: '80px' }}>
                    <Link href={`/admin/context-templates/${template.id}/associations`} passHref>
                      <IconButton aria-label="associations" sx={{ padding: 0 }}>
                        <HubOutlined />
                      </IconButton>
                    </Link>
                  </TableCell>
                  <TableCell sx={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {template.name}
                  </TableCell>
                  <TableCell sx={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {template.description}
                  </TableCell>
                  <TableCell sx={{ maxWidth: '120px' }}>
                    {template.assistants?.join(', ')}
                  </TableCell>
                  <TableCell sx={{ maxWidth: '120px' }}>
                    {template.personas?.join(', ')}
                  </TableCell>
                  <TableCell sx={{ maxWidth: '120px' }}>
                    {template.workflows?.join(', ')}
                  </TableCell>
                  <TableCell sx={{ maxWidth: '120px' }}>
                    {template.collections?.join(', ')}
                  </TableCell>
                  <TableCell sx={{ maxWidth: '120px' }}>
                    {template.purposes?.join(', ')}
                  </TableCell>
                  <TableCell align="center" sx={{ width: '80px' }}>
                    <IconButton aria-label="delete" sx={{ padding: 0 }} onClick={() => handleDelete(template.id)}>
                      <DeleteForeverOutlined />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
          <Button startIcon={<Add />} variant="primary" onClick={handleAddNew}>
            New Template
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default TemplateManager;