'use client';

import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Box, Typography, IconButton, Button, TextField } from '@mui/material';
import PropTypes from 'prop-types';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import CloseIcon from '@mui/icons-material/Close';
import JiraIssueDialog from './JiraIssueDialog';
import DesignFileDialog from './DesignFileDialog';
import SharePointDialog from './SharePointDialog';
import JiraFilterDialog from './JiraFilterDialog';
import JiraCustomFilterDialog from './JiraCustomFilterDialog';
import JiraProjectDialog from './JiraProjectDialog';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useSourcesDispatch } from '@reducers/SourceContext';
import { createSource } from '@clientServices/sourceService';
import { prepDocument } from '@clientServices/insertDocument';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { createWebsiteURL } from '@clientServices/websiteURLService';
import { useWebsiteURLsDispatch } from '@reducers/WebsiteURLContext';
import AddSourceDropZones from './AddSourceDropZones';
import QTestDialog from './QTestDialog';
import QTestSearchDialog from './QTestSearchDialog';
import { useParams } from 'next/navigation';
import { QTEST_PROJECT_MAP } from '@/app/config/qtestProjectMapping';

const AddSourceDialog = ({ open, handleClose }) => {
  const [openJiraDialog, setOpenJiraDialog] = useState(false);
  const [openDesignFileDialog, setOpenDesignFileDialog] = useState(false);
  const [openSharePointDialog, setOpenSharePointDialog] = useState(false);
  const [openJiraFilterDialog, setOpenJiraFilterDialog] = useState(false);
  const [openJiraProjectDialog, setOpenJiraProjectDialog] = useState(false);
  const [openWebURLDialog, setOpenWebURLDialog] = useState(false);
  const [openConfluenceDialog, setOpenConfluenceDialog] = useState(false);
  const [openQTestDialog, setOpenQTestDialog] = useState(false);
  const [openQTestSearchDialog, setOpenQTestSearchDialog] = useState(false);
  const [webURL, setWebURL] = useState('');
  const [webTitle, setWebTitle] = useState('');
  const [openJiraCustomFilterDialog, setOpenJiraCustomFilterDialog] = useState(false);
  const [confluenceURL, setConfluenceURL] = useState('');
  const [confluenceTitle, setConfluenceTitle] = useState('');
  const [qTestURL, setQTestURL] = useState('');
  const [qTestTitle, setQTestTitle] = useState('');
  const [webURLError, setWebURLError] = useState('');
  const smartNote = useSmartNote();
  const sourcesDispatch = useSourcesDispatch();
  const { selectedUserAssistant } = useUserAssistants();
  const websiteURLsDispatch = useWebsiteURLsDispatch();
  const { teamName, assistantName } = useParams();

  // Resolve qTest project ID from the centralised mapping (app/config/qtestProjectMapping.js)
  const qtestProjectId = QTEST_PROJECT_MAP[assistantName] ?? null;

  const KPMC_ASSISTANTS = [
    'kpmc-assistant'
  ];

  const NON_KPMC_ASSISTANTS = [
    'hppdm-assistant',
    'cms-assistant',
    'medicaid-ai-assistant',
    'scheduletopay'
  ];

  const JIRA_BY_PROJECT_ASSISTANTS = [
    'marketing',
    'mdw-assistant'
  ];

  const textFieldStyles = {
    borderRadius: '10px', // Updated border radius
  };

  const displayHierachyButton = () => {
    return selectedUserAssistant && KPMC_ASSISTANTS.includes(selectedUserAssistant.name);
  };

  const displayFilterButton = () => {
    return selectedUserAssistant && NON_KPMC_ASSISTANTS.includes(selectedUserAssistant.name);
  };

  const displayProjectButton = () => {
    return selectedUserAssistant && (JIRA_BY_PROJECT_ASSISTANTS.includes(selectedUserAssistant.name));
  };

  const handleOpenJiraDialog = () => {
    setOpenJiraDialog(true);
  };

  const handleCloseJiraDialog = () => {
    setOpenJiraDialog(false);
    handleClose();
  };

  const handleCloseCustomJiraFilterDialog = () => {
    setOpenJiraCustomFilterDialog(false);
    handleClose();
  };

  const handleOpenDesignFileDialog = () => {
    setOpenDesignFileDialog(true);
  };

  const handleCloseDesignFileDialog = () => {
    setOpenDesignFileDialog(false);
    handleClose();
  };

  const handleOpenSharePointDialog = () => {
    setOpenSharePointDialog(true);
  }

  const handleCloseSharePointDialog = () => {
    setOpenSharePointDialog(false);
    handleClose();
  };

  const handleOpenJiraFilterDialog = () => {
    setOpenJiraFilterDialog(true);
  };

  const handleCloseJiraFilterDialog = () => {
    setOpenJiraFilterDialog(false);
    handleClose();
  };

  const handleOpenJiraProjectDialog = () => {
    setOpenJiraProjectDialog(true);
  };

  const handleCloseJiraProjectDialog = () => {
    setOpenJiraProjectDialog(false);
    handleClose();
  };

  const handleOpenWebURLDialog = () => {
    setOpenWebURLDialog(true);
  };

  const handleCloseWebURLDialog = () => {
    setOpenWebURLDialog(false);
    handleClose();
  };

  const handleOpenConfluenceDialog = () => {
    setOpenConfluenceDialog(true);
  };

  const handleCloseConfluenceDialog = () => {
    setOpenConfluenceDialog(false);
    handleClose();
  };

  const handleOpenQTestDialog = () => {
    setOpenQTestDialog(true);
  };

  const handleCloseQTestDialog = () => {
    setOpenQTestDialog(false);
    handleClose();
  };

  const handleOpenQTestSearchDialog = () => {
    setOpenQTestSearchDialog(true);
  };

  const handleCloseQTestSearchDialog = () => {
    setOpenQTestSearchDialog(false);
    handleClose();
  };

  const handleWebURLChange = (event) => {
    setWebURL(event.target.value);
    setWebURLError(''); // Clear error when input changes
  };

  const handleWebTitleChange = (event) => {
    setWebTitle(event.target.value);
  };

  const handleConfluenceURLChange = (event) => {
    setConfluenceURL(event.target.value);
  };

  const handleConfluenceTitleChange = (event) => {
    setConfluenceTitle(event.target.value);
  };

  const handleQTestURLChange = (event) => {
    setQTestURL(event.target.value);
  };

  const handleQTestTitleChange = (event) => {
    setQTestTitle(event.target.value);
  };

  // Whitelist of allowed domains
  const ALLOWED_DOMAINS = ["ca.gov", "cms.gov", "kp.org", "kaiserpermanente.org"];

  // Validate if a URL's domain is in the whitelist
  const isValidDomain = (url) => {
    try {
      const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const domain = new URL(normalizedUrl).hostname;
      return ALLOWED_DOMAINS.some(allowedDomain => domain.endsWith(allowedDomain));
    } catch (e) {
      console.error('Invalid URL in isValidDomain:', e);
      return false; // URL parsing failed
    }
  };

  const handleWebURLSubmit = async () => {
    if (webURL && webTitle) {
      // Validate the URL domain
      if (!isValidDomain(webURL)) {
        setWebURLError(`URL domain not allowed. Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
        return;
      }

      const websiteURL = prepDocument({
        type: 'WebsiteURL',
        variant: 'WebURL',
        url: webURL,
        nuid: smartNote.nuid,
        smartNoteId: smartNote.id,
        parentId: smartNote.id,
        title: webTitle
      });
      await createWebsiteURL(teamName, assistantName, websiteURL);
      websiteURLsDispatch({ type: 'CREATE_WEBSITE_URL', websiteURL: websiteURL });
      const source = prepDocument({
        type: 'Source',
        sourceType: 'WebsiteURL',
        smartNoteId: smartNote.id,
        parentId: smartNote.id,
        sourceId: websiteURL.id,
        selected: true
      });
      await createSource(teamName, assistantName, source);
      sourcesDispatch({ type: 'CREATE_SOURCE', source: source });
    }
    handleCloseWebURLDialog();
  };

  const handleOpenJiraCustomFilterDialog = () => {
    setOpenJiraCustomFilterDialog(true);
  };

  // Updated to accept per-test-case blocks (array of { id, name, content }) and create individual sources
  const handleQTestSubmit = async (perCaseBlocks) => {
    if (!Array.isArray(perCaseBlocks) || perCaseBlocks.length === 0) {
      console.warn('handleQTestSubmit received empty data');
      return;
    }

    for (const block of perCaseBlocks) {
      try {
        // Title based on individual test case name (truncate for UI consistency)
        const rawTitle = block.name || 'qTest Case';
        const title = rawTitle.length > 80 ? rawTitle.substring(0, 77) + '...' : rawTitle;

        const websiteURL = prepDocument({
          type: 'WebsiteURL',
          variant: 'QTestURL',
          url: `qtest://test-case/${block.id}`, // pseudo URL for traceability
          nuid: smartNote.nuid,
          smartNoteId: smartNote.id,
          parentId: smartNote.id,
          title: title,
          content: block.content
        });

        await createWebsiteURL(teamName, assistantName, websiteURL);
        websiteURLsDispatch({ type: 'CREATE_WEBSITE_URL', websiteURL });

        const source = prepDocument({
          type: 'Source',
          sourceType: 'WebsiteURL',
          smartNoteId: smartNote.id,
          parentId: smartNote.id,
          sourceId: websiteURL.id,
          selected: true
        });

        await createSource(teamName, assistantName, source);
        sourcesDispatch({ type: 'CREATE_SOURCE', source });
      } catch (error) {
        console.error(`❌ Error creating source for test case ${block.id}:`, error);
      }
    }
  };

  const handleConfluenceSubmit = async () => {
    if (confluenceURL && confluenceTitle) {
      const websiteURL = prepDocument({
        type: 'WebsiteURL',
        variant: 'ConfluenceURL',
        url: confluenceURL,
        nuid: smartNote.nuid,
        smartNoteId: smartNote.id,
        parentId: smartNote.id,
        title: confluenceTitle,
        status: 'PENDING'
      });
      await createWebsiteURL(teamName, assistantName, websiteURL);
      websiteURLsDispatch({ type: 'CREATE_WEBSITE_URL', websiteURL: websiteURL });
      const source = prepDocument({
        type: 'Source',
        sourceType: 'WebsiteURL',
        smartNoteId: smartNote.id,
        parentId: smartNote.id,
        sourceId: websiteURL.id,
        selected: true
      });
      await createSource(teamName, assistantName, source);
      sourcesDispatch({ type: 'CREATE_SOURCE', source: source });
    }
    handleCloseConfluenceDialog();
    setConfluenceTitle(''); // Clear the Confluence Title field
    setConfluenceURL('');   // Clear the Confluence URL field
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      keepMounted
      disablePortal={false}
      aria-labelledby="add-source-dialog-title"
      sx={{
        '& .MuiPaper-root': {
          borderRadius: '20px', // More rounded border
        },
      }}
    >
      <DialogTitle id="add-source-dialog-title">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <NoteAltOutlinedIcon sx={{ fontSize: '23pt', marginRight: '0.5em' }} />
            <Typography fontWeight={500} fontSize={'22pt'}>KP AI SmartNotes</Typography>
          </Box>
          <IconButton onClick={handleClose} aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom sx={{ fontSize: '24px' }}>Add Sources</Typography>
        <Typography variant="body1" gutterBottom sx={{ fontSize: '20px' }}>
          Sources let SmartNotes base its responses on the information that matters most to you.
        </Typography>
        <Typography variant="body2" gutterBottom sx={{ fontSize: '16px' }}>
          (Examples: design documents, Jira issues, user notes, saved responses, user uploaded documents)
        </Typography>
        <AddSourceDropZones
          smartNote={smartNote}
          selectedUserAssistant={selectedUserAssistant}
          handleClose={handleClose}
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box
            sx={{
              border: '1px solid gray',
              borderRadius: '8px',
              padding: 1,
              textAlign: 'center',
              flex: 1,
            }}
          >
            <Typography variant="h6" gutterBottom>Agile - Jira Issues</Typography>
            {displayHierachyButton() && <Button variant="action" sx={{ m: 1 }} onClick={handleOpenJiraDialog}>With hierarchy</Button>}
            {displayFilterButton() && <Button variant="action" sx={{ m: 1 }} onClick={handleOpenJiraFilterDialog}>With filter</Button>}
            {<Button variant="action" sx={{ m: 1 }} onClick={handleOpenJiraCustomFilterDialog}>With custom filter</Button>}
            {displayProjectButton() && <Button variant="action" sx={{ m: 1 }} onClick={handleOpenJiraProjectDialog}>With project</Button>}
          </Box>
          <Box
            sx={{
              border: '1px solid gray',
              borderRadius: '8px',
              padding: 1,
              textAlign: 'center',
              flex: 1,
            }}
          >
            <Typography variant="h6" gutterBottom>Knowledge Base</Typography>
            {(displayHierachyButton() || displayFilterButton()) ? <Button variant="action" sx={{ m: 1 }} onClick={handleOpenDesignFileDialog}>Design Files</Button> : <Typography variant="body2" color='Red'>Please work with the HPTS AI Services to Add Design Files</Typography>}
            <Button variant="action" sx={{ m: 1 }} onClick={handleOpenSharePointDialog}>SharePoint</Button>
            <Button variant="action" sx={{ m: 1 }} onClick={handleOpenConfluenceDialog}>Confluence URL</Button>
            <Button variant="action" sx={{ m: 1 }} onClick={handleOpenWebURLDialog}>Web URL</Button>
            {teamName === 'ets' && <Button variant="action" sx={{ m: 1 }} onClick={handleOpenQTestDialog}>qTest</Button>}
            {qtestProjectId && <Button variant="action" sx={{ m: 1 }} onClick={handleOpenQTestSearchDialog}>qTest Search</Button>}
          </Box>
        </Box>
        <JiraIssueDialog open={openJiraDialog} onClose={handleCloseJiraDialog} />
        <DesignFileDialog open={openDesignFileDialog} onClose={handleCloseDesignFileDialog} />
        <SharePointDialog open={openSharePointDialog} onClose={handleCloseSharePointDialog} />
        <JiraFilterDialog open={openJiraFilterDialog} onClose={handleCloseJiraFilterDialog} />
        <JiraCustomFilterDialog open={openJiraCustomFilterDialog} onClose={handleCloseCustomJiraFilterDialog} />
        <JiraProjectDialog open={openJiraProjectDialog} onClose={handleCloseJiraProjectDialog} />
        <Dialog
          open={openWebURLDialog}
          onClose={handleCloseWebURLDialog}
          maxWidth="md"
          fullWidth
          keepMounted
          disablePortal={false}
          aria-labelledby="web-url-dialog-title"
          sx={{
            '& .MuiPaper-root': {
              borderRadius: '20px', // More rounded border
            },
          }}
        >
          <DialogTitle id="web-url-dialog-title">
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center">
                <Typography fontWeight={500} fontSize={'18pt'}>Add Web URL</Typography>
              </Box>
              <IconButton onClick={handleCloseWebURLDialog} aria-label="Close dialog">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Title"
              type="text"
              fullWidth
              value={webTitle}
              onChange={handleWebTitleChange}
              sx={{
                ...textFieldStyles,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px', // Updated border radius
                },
              }}
            />
            <TextField
              margin="dense"
              label="Web URL"
              type="url"
              fullWidth
              value={webURL}
              onChange={handleWebURLChange}
              error={!!webURLError}
              helperText={webURLError}
              sx={{
                ...textFieldStyles,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px', // Updated border radius
                },
              }}
            />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              Allowed domains: {ALLOWED_DOMAINS.join(', ')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: 1 }}>
              <Button onClick={handleWebURLSubmit} variant="primary">
                Add
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
        <Dialog
          open={openConfluenceDialog}
          onClose={handleCloseConfluenceDialog}
          maxWidth="md"
          fullWidth
          keepMounted
          disablePortal={false}
          aria-labelledby="confluence-dialog-title"
          sx={{
            '& .MuiPaper-root': {
              borderRadius: '20px', // More rounded border
            },
          }}
        >
          <DialogTitle id="confluence-dialog-title">
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center">
                <Typography fontWeight={500} fontSize={'18pt'}>Add Confluence Page</Typography>
              </Box>
              <IconButton onClick={handleCloseConfluenceDialog} aria-label="Close dialog">
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Title"
              type="text"
              fullWidth
              value={confluenceTitle}
              onChange={handleConfluenceTitleChange}
              sx={{
                ...textFieldStyles,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px', // Updated border radius
                },
              }}
            />
            <TextField
              margin="dense"
              label="Confluence URL"
              type="url"
              fullWidth
              value={confluenceURL}
              onChange={handleConfluenceURLChange}
              sx={{
                ...textFieldStyles,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '10px', // Updated border radius
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: 1 }}>
              <Button onClick={handleConfluenceSubmit} variant="primary">
                Add
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
        <QTestDialog
          open={openQTestDialog}
          onClose={handleCloseQTestDialog}
          onSubmit={handleQTestSubmit}
        />
        <QTestSearchDialog
          open={openQTestSearchDialog}
          onClose={handleCloseQTestSearchDialog}
          onSubmit={handleQTestSubmit}
          projectId={qtestProjectId}
        />
      </DialogContent>
    </Dialog>
  );
};

AddSourceDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
};

export default AddSourceDialog;
