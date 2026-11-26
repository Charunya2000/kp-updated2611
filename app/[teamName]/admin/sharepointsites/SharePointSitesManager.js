'use client'

import { getAllAssistants } from '@/app/clientServices/assistantService';
import { useState, useEffect, useRef } from 'react'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Typography, TextField, Button, Autocomplete, Checkbox, List, ListItem, ListItemText, ListItemButton, ListItemIcon, Dialog, DialogTitle, DialogContent, IconButton, } from "@mui/material";
import { useTheme } from '@emotion/react';
import { addSharePointSite, deleteSharePointSite, getAllSharePointSites, updateSharePointSite } from '@/app/clientServices/sharePointService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';


const SharePointSitesManager = ({ teamName }) => {
  const hint = useRef('');
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [assistants, setAssistants] = useState([]);
  const [siteAssignedAssistants, setSiteAssignedAssistants] = useState([]);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [autoCompleteInputValue, setAutoCompleteInputValue] = useState("");
  const theme = useTheme();

  useEffect(() => {
    const getSites = async () => {
      const sharePointSites = await getAllSharePointSites(teamName);
      setSites(sharePointSites);
    }
    const getAssistants = async () => {
      const assistants = await getAllAssistants(teamName);
      setAssistants(assistants);
    }

    getSites();
    getAssistants();
  }, []);

  const handleSiteSelected = (site) => {
    if (!site) {
      setSiteAssignedAssistants([]);
      setSelectedSite(null);
      return;
    }

    if (typeof site === 'string') {
      site = sites.find(s => s.name === site);
      handleSiteSelected(site);
      return;
    }

    let siteAssigned = assistants.map(assistant => {
      return {
        name: assistant.name,
        displayName: assistant.category ? `${assistant.category} - ${assistant.name}` : assistant.name,
        id: assistant.id,
        assigned: site.assistantIds.find(assistantId => assistantId === assistant.id) ? true : false
      }
    })

    setSiteAssignedAssistants(siteAssigned);
    setSelectedSite(site);
  }

  const handleAddSite = async (siteName) => {
    const siteDocument = prepDocument({
      type: 'SharePointSite',
      name: siteName,
      assistantIds: []
    })

    if (sites.find(s => s.name === siteName)) {
      return { error: 'A site with this name already exists' };
    }

    try {
      const result = await addSharePointSite(teamName, siteDocument);
      setSites([...sites, result]);

      setAutoCompleteInputValue(siteName);
      handleSiteSelected(result);
    } catch (error) {
      // todo: display error message when a site can't be added
    }
    setAddDialogOpen(false);
  }

  const handleToggle = (assistantId) => {
    const updatedAssignments = siteAssignedAssistants.map(assistant => {
      return assistant.id === assistantId ? { ...assistant, assigned: !assistant.assigned } : assistant
    });

    setSiteAssignedAssistants(updatedAssignments);
  }

  const handleApplyAssistantChanges = async () => {
    if (selectedSite && siteAssignedAssistants) {
      const site = Object.assign({}, selectedSite);
      const assistantIds = siteAssignedAssistants.map(assistant => {
        if (assistant.assigned) {
          return assistant.id;
        }
      }).filter(id => !!id);
      site.assistantIds = assistantIds;

      const result = await updateSharePointSite(teamName, site);

      // merge result into sites
      const updatedSite = sites.find(site => site.id === result.id);
      updatedSite.assistantIds = result.assistantIds;
      setSites([...sites.filter(s => s.id !== result.id), updatedSite]);
    }
  }

  const handleDeleteSite = async () => {
    if (!selectedSite) {
      return;
    }

    const result = await deleteSharePointSite(teamName, selectedSite);

    if (result && result.success) {
      setSites([...sites.filter(s => s.id !== selectedSite.id)]);
      setSiteAssignedAssistants([]);
      setSelectedSite(null);
      setAutoCompleteInputValue("");
    } else {
      // display some error about failed to delete
    }
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, padding: '12px' }}>
        <Autocomplete
          freeSolo
          disablePortal
          sx={{ width: 336 }}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              if (hint.current) {
                setAutoCompleteInputValue(hint.current);
                event.preventDefault();
              }
            }
            if (event.key === 'Enter') {
              const site = sites.find(s => s.name === autoCompleteInputValue);
              if (site) {
                setSelectedSite(site);
              }
              event.preventDefault();
            }
          }}
          onClose={() => {
            hint.current = '';
          }}
          selectOnFocus
          options={sites?.sort()}
          getOptionLabel={(option) => option.name ?? option}
          inputValue={autoCompleteInputValue}
          onInputChange={(e, newInput) => setAutoCompleteInputValue(newInput)}
          value={selectedSite}
          onChange={(event, site) => handleSiteSelected(site)}
          renderInput={(params) => {
            return (
              <Box sx={{ position: 'relative' }}>
                <Typography
                  sx={{
                    position: 'absolute',
                    opacity: 0.5,
                    left: 14,
                    top: 16,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    width: 'calc(100% - 75px)',
                  }}
                >
                  {hint.current}
                </Typography>
                <TextField
                  {...params}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    setAutoCompleteInputValue(newValue);
                    const matchingOption = sites.find((option) =>
                      option.name.startsWith(newValue),
                    );

                    if (newValue && matchingOption) {
                      hint.current = matchingOption.name;
                    } else {
                      hint.current = '';
                    }
                  }}
                  label="SharePoint Site"
                  size="small"
                />
              </Box>
            );
          }}
        />
        <Button variant="action" startIcon={<AddOutlinedIcon />}
          onClick={() => setAddDialogOpen(true)}>
          New Site
        </Button>
        {
          selectedSite &&
          <Button variant='destructive'
            startIcon={<DeleteForeverOutlinedIcon />}
            onClick={handleDeleteSite}>
            Delete Site
          </Button>
        }
      </Box>
      {
        siteAssignedAssistants && siteAssignedAssistants.length > 0 &&
        <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: '360px', gap: 2, padding: '12px' }}>
          <ManageAccessibleSitesList
            siteAssignedAssistants={siteAssignedAssistants}
            handleToggle={handleToggle}
            handleApplyAssistantChanges={handleApplyAssistantChanges}
          />
        </Box>
      }
      <AddSiteDialog isOpen={isAddDialogOpen} handleClose={() => setAddDialogOpen(false)} handleAddSite={handleAddSite} />
    </Box>
  );
}

const ManageAccessibleSitesList = ({ siteAssignedAssistants, handleToggle, handleApplyAssistantChanges }) => {

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: '12px' }}>
      <Typography>Select the assistants this site is available for.</Typography>
      <List sx={{ width: '100%', maxWidth: '360px', border: '1px solid gray' }}>
        {siteAssignedAssistants.map((assistant) => {
          const labelId = `checkbox-list-label-${assistant.name}`;

          return (
            <ListItem
              key={assistant.name}
              disablePadding
            >
              <ListItemButton assistant={undefined} onClick={() => handleToggle(assistant.id)} dense>
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={assistant.assigned}
                    tabIndex={-1}
                    disableRipple
                    inputProps={{ 'aria-labelledby': labelId }}
                  />
                </ListItemIcon>
                <ListItemText id={labelId} primary={`${assistant.displayName}`} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Button variant='primary' color='primary' onClick={handleApplyAssistantChanges}>Apply Changes</Button>
    </Box>
  )
}

const AddSiteDialog = ({ isOpen, handleClose, handleAddSite }) => {
  const [newSiteName, setNewSiteName] = useState('');
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setError(null);
    setNewSiteName(e.target.value);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const result = await handleAddSite(newSiteName);
    if (result) {
      setError(result.error);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiPaper-root': {
          borderRadius: '20px', // More rounded border
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <Typography fontWeight={500} fontSize={'18pt'}>Add SharePoint Site</Typography>
          </Box>
          <IconButton onClick={handleClose}>
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
          value={newSiteName}
          onChange={handleChange}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px', // Updated border radius
            },
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit(e);
            }
          }}
        />
        <Typography variant='body2' color='error'>{error}</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: 1 }}>
          <Button onClick={handleSubmit} variant="primary">
            Add
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default SharePointSitesManager;