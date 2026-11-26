'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Box, Typography, Autocomplete, TextField, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PropTypes from 'prop-types';
import { createDesignReference, loadCachedReferenceFiles } from '@clientServices/designReferenceService';
import { createSource } from '@clientServices/sourceService';
import { useSourcesDispatch } from '@reducers/SourceContext';
import { useDesignReferencesDispatch } from '@reducers/DesignReferenceContext';
import { useDesignIndexsDispatch } from '@reducers/DesignIndexContext';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { prepDocument } from '@clientServices/insertDocument';
import { createDesignIndex } from '@clientServices/designIndexService';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { useTheme } from '@mui/material/styles';
import { useParams } from 'next/navigation';

const DesignFileDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const [alignment, setAlignment] = useState('');
  const [designReferenceFiles, setDesignReferenceFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const sourcesDispatch = useSourcesDispatch();
  const designReferencesDispatch = useDesignReferencesDispatch();
  const designIndexsDispatch = useDesignIndexsDispatch();
  const smartNote = useSmartNote();
  const { selectedUserAssistant } = useUserAssistants();

  const { teamName, assistantName, id: smartNoteId } = useParams();

  useEffect(() => {
    if (!smartNote) return;
    const loadCachedFiles = async () => {
      setLoading(true);
      try {
        const cachedFiles = await loadCachedReferenceFiles(teamName, assistantName, smartNote);
        setDesignReferenceFiles(cachedFiles.kpmcDocNames); // Default to KPMC Index
      } catch (error) {
        console.error('Error loading cached reference files:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCachedFiles();
  }, [smartNote]);

  const KPMC_ASSISTANT_NAME = 'kpmc-assistant';
  const HPPDM_ASSISTANT_NAME = 'hppdm-assistant';
  const CMS_ASSISTANT_NAME = 'cms-assistant';
  const MEDICAID_ASSISTANT_NAME = 'medicaid-ai-assistant';

  const displayKPMCIndex = () => {
    return selectedUserAssistant && KPMC_ASSISTANT_NAME === selectedUserAssistant.name;
  };

  const displayHPPDMIndex = () => {
    return selectedUserAssistant && HPPDM_ASSISTANT_NAME === selectedUserAssistant.name;
  };

  const displayCMSIndex = () => {
    return selectedUserAssistant && (CMS_ASSISTANT_NAME === selectedUserAssistant.name);
  };

  const displayPIPlanningIndex = () => {
    return displayKPMCIndex() && smartNote.persona === 'Planning';
  };

  const displayMedicaidIndex = () => {
    return selectedUserAssistant && (MEDICAID_ASSISTANT_NAME === selectedUserAssistant.name);
  };

  const displayCRIndex = () => {
    return displayKPMCIndex() && smartNote.persona === 'Change Request';
  };

  const lookupIndexName = (alignmentValue) => {
    if ('KPMC Index' === alignmentValue) {
      return 'kpmc-doc-001';
    } else if ('CMS Index' === alignmentValue) {
      return 'cms-doc-001';
    } else if ('HPPDM Index' === alignmentValue) {
      return 'hppdm-doc-001';
    } else if ('PI Planning Index' === alignmentValue) {
      return 'pi-planning-001';
    } else if ('Medicaid Index' === alignmentValue) {
      return 'medicaid-002';
    } else if ('Change Request Index' === alignmentValue) {
      return 'kpmc-cr-001';
    } else {
      return 'kpmc-doc-001';
    }
  };

  const handleAlignment = async (newAlignment) => {
    setAlignment(newAlignment);
    if (newAlignment) {
      setLoading(true);
      try {
        const cachedFiles = await loadCachedReferenceFiles(teamName, assistantName, smartNote);
        if (newAlignment === 'KPMC Index') {
          setDesignReferenceFiles(cachedFiles.kpmcDocNames);
        } else if (newAlignment === 'CMS Index') {
          setDesignReferenceFiles(cachedFiles.cmsDocSources);
        } else if (newAlignment === 'HPPDM Index') {
          setDesignReferenceFiles(cachedFiles.hppdmDocNames);
        } else if (newAlignment === 'PI Planning Index') {
          setDesignReferenceFiles(cachedFiles.piPlanningDocNames);
        } else if (newAlignment === 'Medicaid Index') {
          setDesignReferenceFiles(cachedFiles.medicaidDocNames);
        } else if (newAlignment === 'Change Request Index') {
          setDesignReferenceFiles(cachedFiles.kpmcCRDocNames);
        }
      } catch (error) {
        console.error('Error loading design reference files:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const saveDesignReferenceFileToSource = async () => {
    if (selectedFile) {
      const designReferenceDocument = prepDocument({
        type: 'DesignReference',
        smartNoteId: smartNote.id,
        name: selectedFile.document_name,
        url: selectedFile.source_url,
        indexName: lookupIndexName(alignment),
        parentId: smartNote.id // Update this as needed
      });
      createDesignReference(designReferenceDocument);
      designReferencesDispatch({ type: 'CREATE_DESIGN_REFERENCE', designReference: designReferenceDocument });
      const designReferenceSourceDocument = prepDocument({
        type: 'Source',
        smartNoteId: smartNote.id,
        sourceType: 'DesignReference',
        sourceId: designReferenceDocument.id,
        parentId: smartNote.id,
        selected: true,
      });
      createSource(teamName, assistantName, designReferenceSourceDocument);
      sourcesDispatch({ type: 'CREATE_SOURCE', source: designReferenceSourceDocument });
    } else {
      // Add the entire index to context
      const designIndex = prepDocument({
        type: 'DesignIndex',
        smartNoteId: smartNote.id,
        title: alignment,
        indexName: lookupIndexName(alignment),
        parentId: smartNote.id // Update this as needed
      });
      designIndexsDispatch({ type: 'CREATE_DESIGN_INDEX', designIndex: designIndex });
      createDesignIndex(teamName, assistantName, designIndex);
      const designIndexSourceDocument = prepDocument({
        type: 'Source',
        smartNoteId: smartNote.id,
        sourceType: 'DesignIndex',
        sourceId: designIndex.id,
        parentId: smartNote.id,
        selected: true,
      });
      createSource(teamName, assistantName, designIndexSourceDocument);
      sourcesDispatch({ type: 'CREATE_SOURCE', source: designIndexSourceDocument });
    }
    onClose();
  };

  const textFieldStyles = {
    borderRadius: '10px', // Updated border radius
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" sx={{
      '& .MuiPaper-root': {
        borderRadius: '20px',
        // More rounded border
      },
    }}
    >
      <DialogTitle>
        Design Files Already in the Knowledge Base
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ padding: 2, marginBottom: 2, border: 'solid', borderColor: '#b0c4de', borderWidth: '2px', borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select design file collection:
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 1 }}>
            {displayKPMCIndex() && (
              <Button
                value="KPMC Index"
                aria-label="KPMC Index"
                onClick={() => handleAlignment('KPMC Index')}
                variant={alignment === 'KPMC Index' ? 'primary' : 'secondary'}
              >
                KPMC
              </Button>
            )}
            {displayCMSIndex() && (
              <Button
                value="CMS Index"
                aria-label="CMS Index"
                onClick={() => handleAlignment('CMS Index')}
                variant={alignment === 'CMS Index' ? 'primary' : 'secondary'}
              >
                CMS
              </Button>
            )}
            {displayHPPDMIndex() && (
              <Button
                value="HPPDM Index"
                aria-label="HPPDM Index"
                onClick={() => handleAlignment('HPPDM Index')}
                variant={alignment === 'HPPDM Index' ? 'primary' : 'secondary'}
              >
                HPPDM
              </Button>
            )}
            {displayPIPlanningIndex() && (
              <Button
                value="PI Planning Index"
                aria-label="PI Planning Index"
                onClick={() => handleAlignment('PI Planning Index')}
                variant={alignment === 'PI Planning Index' ? 'primary' : 'secondary'}
              >
                PI Planning
              </Button>
            )}
            {displayMedicaidIndex() && (
              <Button
                value="Medicaid Index"
                aria-label="Medicaid Index"
                onClick={() => handleAlignment('Medicaid Index')}
                variant={alignment === 'Medicaid Index' ? 'primary' : 'secondary'}
              >
                Medicaid
              </Button>
            )}
            {displayCRIndex() && (
              <Button
                value="Change Request Index"
                aria-label="Change Request Index"
                onClick={() => handleAlignment('Change Request Index')}
                variant={alignment === 'Change Request Index' ? 'primary' : 'secondary'}
              >
                Change Request
              </Button>
            )}
          </Box>
        </Box>
        <Box sx={{ padding: 2, marginBottom: 2, border: 'solid', borderColor: '#b0c4de', borderWidth: '2px', borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom>
            Search Design Reference Files
          </Typography>
          <Autocomplete
            options={designReferenceFiles}
            getOptionLabel={(option) => option.document_name}
            value={selectedFile}
            onChange={(event, newValue) => setSelectedFile(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Design Reference Files"
                variant="outlined"
                fullWidth
                sx={{
                  ...textFieldStyles,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px', // Updated border radius
                  },
                }}
              />
            )}
          />
        </Box>
        <Typography variant="body2" gutterBottom>NOTE: If no document is selected the entire collection is added at click of 'Save to source'.</Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="primary"
          onClick={saveDesignReferenceFileToSource}
        >
          Save to source
        </Button>
      </DialogActions>
    </Dialog>
  );
};

DesignFileDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default DesignFileDialog;