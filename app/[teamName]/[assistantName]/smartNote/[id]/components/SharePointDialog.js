'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Box, Typography, Checkbox, TextField, Button, Skeleton, Grid2 } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PropTypes from 'prop-types';
import { getAccessibleSharePointSites, updateSharePointFile, uploadDocumentToIndex } from '@clientServices/sharePointService';
import { createSource } from '@clientServices/sourceService';
import { useSourcesDispatch } from '@reducers/SourceContext';
import { useSharePointFilesDispatch } from '@/reducers/SharePointFileContext';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { prepDocument } from '@clientServices/insertDocument';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { useTheme } from '@mui/material/styles';
import { ChevronRight, CloseOutlined, DescriptionOutlined, FolderOutlined, HomeOutlined } from '@mui/icons-material';
import { getFolderContents, getDocumentLibraries } from '@/app/clientServices/sharePointService';
import { useParams } from 'next/navigation';

const SharePointDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const smartNote = useSmartNote();
  const { selectedUserAssistant } = useUserAssistants();
  const sharePointFilesDispatch = useSharePointFilesDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const [sharePointSites, setSharePointSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [documentLibraries, setDocumentLibraries] = useState(null);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [crumbs, setCrumbs] = useState(["Select a Document Library"]);
  const [libraryContents, setLibraryContents] = useState(null); // { crumbs: string[], files: file[], folders: folder[] }
  const [selectedFiles, setSelectedFiles] = useState([]);
  const { teamName, assistantName } = useParams();

  useEffect(() => {
    const loadSPSites = async () => {
      const sites = await getAccessibleSharePointSites(teamName, assistantName);
      const accessibleSites = sites
        .map(site => site.name);
      setSharePointSites(accessibleSites);
    }
    loadSPSites();
  }, [selectedUserAssistant])

  const handleSiteSelected = async (site) => {
    // reset everything
    setSelectedSite(null);
    setDocumentLibraries(null);
    setSelectedLibrary(null);
    setLibraryContents(null);
    setSelectedFiles([]);
    setCrumbs(["Select a Document Library"]);

    if (selectedSite === site) {
      return;
    }

    setSelectedSite(site);
    const libraries = await getDocumentLibraries(teamName, assistantName, site);
    setDocumentLibraries(libraries);
  }

  const handleLibraryClicked = async (library) => {
    setSelectedLibrary(library);

    const contents = await getFolderContents(teamName, assistantName, selectedSite, library);
    setLibraryContents(contents);
    setCrumbs(contents.crumbs);
  }

  const handleHomeClicked = () => {
    setSelectedLibrary(null);
    setLibraryContents(null);
    setCrumbs(["Select a Document Library"]);
  }

  const handleCrumbClicked = async (index) => {
    const library = [...crumbs].slice(0, index + 1).join('/');

    const contents = await getFolderContents(teamName, assistantName, selectedSite, library);
    setLibraryContents(contents);
    setCrumbs(contents.crumbs);
  }

  const handleFolderClicked = async (folder) => {
    const library = [...crumbs, folder.name].join('/');

    const contents = await getFolderContents(teamName, assistantName, selectedSite, library);
    setLibraryContents(contents);
    setCrumbs(contents.crumbs);
  }

  const handleFileClicked = (file) => {
    setSelectedFiles((selectedFiles) => {
      if (selectedFiles.includes(file)) {
        return selectedFiles.filter((item) => item !== file);
      } else {
        return [...selectedFiles, file];
      }
    });
  }

  const handleSaveSelectedFilesToSource = async () => {
    // TODO: handle adding a site, folderList, and fileList to source
    selectedFiles.forEach(async file => {
      const sharePointFile = prepDocument({
        type: 'SharePointFile',
        smartNoteId: smartNote.id,
        siteName: selectedSite.toLowerCase(),
        fileName: file.name,
        relativeUrl: file.relativeUrl,
        indexName: `sharepoint-uploads`,
        parentId: smartNote.id,
        status: 'PENDING',
      });

      sharePointFilesDispatch({ type: 'CREATE_SHAREPOINT_FILE', sharePointFile: sharePointFile });
      uploadDocumentToIndex(teamName, assistantName, sharePointFile)
        .then((_) => {
          const indexedSharePointFile = { ...sharePointFile, status: 'INDEXED' };
          updateSharePointFile(teamName, assistantName, indexedSharePointFile);
          sharePointFilesDispatch({ type: 'UPDATE_SHAREPOINT_FILE', sharePointFile: indexedSharePointFile });
        }).catch((error) => {
          console.error('Error indexing document:', error);
        });

      const source = prepDocument({
        type: 'Source',
        smartNoteId: smartNote.id,
        sourceType: 'SharePointFile',
        sourceId: sharePointFile.id,
        parentId: smartNote.id,
        selected: true,
        uniqueId: file.uniqueId
      });

      await createSource(teamName, assistantName, source);
      sourcesDispatch({ type: 'CREATE_SOURCE', source: source });
    });

    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" sx={{
      '& .MuiPaper-root': {
        borderRadius: '20px',
      },
    }}
    >
      <DialogTitle>
        SharePoint File Selection
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ padding: 2, marginBottom: 2, border: 'solid', borderColor: '#b0c4de', borderWidth: '2px', borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select a SharePoint Site
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', maxHeight: '100px', overflow: 'auto' }}>
            {!sharePointSites || sharePointSites.length < 1 ?
              <Typography variant="body2" color='Red'>Please work with the HPTS AI Services to add SharePoint sites</Typography> : null}
            {sharePointSites.map(site => {
              return <Button
                key={site}
                value={site}
                aria-label={site}
                onClick={() => handleSiteSelected(site)}
                variant={selectedSite === site ? 'primary' : 'secondary'}
              >
                {site}
              </Button>
            })}
          </Box>
        </Box>
        {
          selectedSite !== null &&
          <Box sx={{ padding: 2, marginBottom: 2, border: 'solid', borderColor: '#b0c4de', borderWidth: '2px', borderRadius: 3 }}>
            <Typography variant="h6">
              <CrumbsNavigation crumbs={crumbs} selectedLibrary={selectedLibrary} handleHomeClicked={handleHomeClicked} handleCrumbClicked={handleCrumbClicked} />
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', maxHeight: '320px', overflow: 'auto' }}>
              {
                selectedLibrary === null ?
                  <DocumentLibrariesList libraries={documentLibraries} handleLibraryClicked={handleLibraryClicked} /> :
                  <LibraryContents files={libraryContents?.files} selectedFiles={selectedFiles} folders={libraryContents?.folders} handleFolderClicked={handleFolderClicked} handleFileClicked={handleFileClicked} />
              }
            </Box>
          </Box>
        }
        {
          selectedFiles && selectedFiles.length ?
            <Box sx={{ padding: 2, marginBottom: 2, border: 'solid', borderColor: '#b0c4de', borderWidth: '2px', borderRadius: 3 }}>
              <Typography variant="h6">Selected Files</Typography>
              <SelectedFilesList selectedFiles={selectedFiles} handleFileClicked={handleFileClicked} />
            </Box>
            : null
        }
      </DialogContent>
      <DialogActions>
        <Button
          disabled={!selectedFiles || selectedFiles.length <= 0}
          variant="primary"
          onClick={handleSaveSelectedFilesToSource}
        >
          Save to source
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const CrumbsNavigation = ({ crumbs, selectedLibrary, handleHomeClicked, handleCrumbClicked }) => {
  if (crumbs && selectedLibrary === null) {
    return <Typography>{crumbs}</Typography>
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
      <IconButton aria-label="navigate to site home" color="primary" onClick={handleHomeClicked}>
        <HomeOutlined />
      </IconButton>
      {crumbs.map((crumb, index) =>
        <Fragment key={crumb}>
          <ChevronRight />
          {index !== crumbs.length - 1 ?
            <Button variant="text" sx={{ textTransform: 'none', minWidth: 'auto' }} onClick={() => handleCrumbClicked(index)}>
              {crumb}
            </Button> :
            <Typography variant='body1'>{crumb}</Typography>
          }
        </Fragment>
      )}
    </Box>);
}

const DocumentLibrariesList = ({ libraries, handleLibraryClicked }) => {
  if (libraries && libraries.length) {
    return (
      <>
        {
          libraries.map(lib =>
            <Button key={lib} sx={{ textTransform: 'none', width: '100%' }} onClick={() => handleLibraryClicked(lib)}>
              <Grid2 sx={{ alignItems: 'center', textAlign: 'left', width: '100%' }} container spacing={2} >
                <Grid2 size='auto' sx={{ display: 'flex' }}>
                  <FolderOutlined sx={{ fontSize: 28 }} />
                </Grid2>
                <Grid2 size={6}>
                  <Typography variant='body1'>{lib}</Typography>
                </Grid2>
              </Grid2>
            </Button>)
        }
      </>
    )
  }

  if (libraries && libraries.length === 0) {
    return (
      <Typography variant='h5'>
        There are no accessible libraries in this site.
      </Typography>
    );
  }

  return (
    <ListSkeleton />
  );
}

const LibraryContents = ({ folders, files, selectedFiles, handleFolderClicked, handleFileClicked }) => {
  if ((folders && folders.length) || (files && files.length)) {
    return (
      <>
        {
          folders.map(folder =>
            <Button key={folder.uniqueId} sx={{ textTransform: 'none', width: '100%' }} onClick={() => handleFolderClicked(folder)}>
              <Grid2 sx={{ alignItems: 'center', textAlign: 'left', width: '100%' }} container spacing={2} >
                <Grid2 size='auto' sx={{ display: 'flex' }}>
                  <FolderOutlined sx={{ fontSize: 28 }} />
                </Grid2>
                <Grid2 size={6}>
                  <Typography variant='body1'>{folder.name}</Typography>
                </Grid2>
              </Grid2>
            </Button>)
        }
        {
          files.map(file =>
            <Button key={file.uniqueId} sx={{ textTransform: 'none', width: '100%' }} onClick={() => handleFileClicked(file)}>
              <Grid2 sx={{ alignItems: 'center', textAlign: 'left', width: '100%', flexWrap: 'nowrap' }} container spacing={2} >
                <Grid2 size='auto' sx={{ display: 'flex' }}>
                  <DescriptionOutlined sx={{ fontSize: 28 }} />
                </Grid2>
                <Grid2 size={10}>
                  <Typography variant='body1'>{file.name}</Typography>
                </Grid2>
                <Grid2 size={1}>
                  <Checkbox checked={!!selectedFiles.find(f => f.uniqueId === file.uniqueId)} />
                </Grid2>
              </Grid2>
            </Button>)
        }
      </>
    )

  }

  if ((folders && folders.length === 0) && (files && files.length === 0)) {
    return (
      <Typography variant='h5'>
        There are no accessible folders or files at this location.
      </Typography>
    );
  }

  return (
    <ListSkeleton />
  );
}

const SelectedFilesList = ({ selectedFiles, handleFileClicked }) => {
  return (
    <Box sx={{ maxHeight: '200px', overflow: 'auto' }}>
      {selectedFiles && selectedFiles.map(file =>
        <Box key={file.uniqueId} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton onClick={() => handleFileClicked(file)}>
            <CloseOutlined color='error' />
          </IconButton>
          <Typography variant='body1'>{file.name}</Typography>
        </Box>
      )}
    </Box>
  )
}

const ListSkeleton = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {
        new Array(6)
          .fill(null)
          .map((_, i) => <Skeleton key={i} variant='rectangular' height={56} sx={{ width: '100%', borderRadius: '4px' }} />)
      }
    </Box>
  );
}

SharePointDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default SharePointDialog;