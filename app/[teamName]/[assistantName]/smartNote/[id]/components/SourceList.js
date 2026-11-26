'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import {
  Box, Typography, Checkbox, IconButton, Menu, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Tooltip, Snackbar, Alert
} from '@mui/material'; // Add Tooltip import
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import QuickreplyOutlinedIcon from '@mui/icons-material/QuickreplyOutlined';
import TextSnippetOutlined from '@mui/icons-material/TextSnippetOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import * as SmartNoteTypes from '@reducers/SmartNoteTypes';
import { useSources, useSourcesDispatch } from '@reducers/SourceContext';
import { getSources, saveSource, deleteSource } from '@clientServices/sourceService';
import { getJiraIssues, deleteJiraIssue } from '@clientServices/jiraService';
import { deleteDesignReference } from '@clientServices/designReferenceService';
import { deleteDesignIndex } from '@clientServices/designIndexService';
import { getUploadedDocuments, deleteUploadedDocument, uploadToIndexAndBlob, downloadUploadedDocument } from '@clientServices/uploadedDocumentService';
import { getSharePointFiles as getSharePointFiles, deleteSharePointFile } from '@clientServices/sharePointService';
import { useSavedNotes } from '@reducers/SavedNoteContext';
import { useSavedResponses } from '@reducers/SavedResponseContext';
import { useDesignReferences, useDesignReferencesDispatch } from '@reducers/DesignReferenceContext';
import { useDesignIndexs, useDesignIndexsDispatch } from '@reducers/DesignIndexContext';
import { useJiraIssues, useJiraIssuesDispatch } from '@reducers/JiraIssueContext';
import { useUploadedDocuments, useUploadedDocumentsDispatch } from '@reducers/UploadedDocumentContext';
import { useWebsiteURLs, useWebsiteURLsDispatch } from '@reducers/WebsiteURLContext';
import { useSmartNote } from '@reducers/improved/SmartNoteContext';
import { useUserAssistants } from '@/reducers/UserAssistantContext';
import { getDesignReferences, getDesignIndexes, updateUpdatedAt } from '@clientServices/smartNoteService';
import { createDesignIndex, updateDesignIndex } from '@clientServices/designIndexService';
import { deleteWebsiteURL, getWebsiteURLs } from '@/app/clientServices/websiteURLService';
import { useSharePointFiles, useSharePointFilesDispatch } from '@/reducers/SharePointFileContext';
import { InfoOutlined } from '@mui/icons-material';
import { getIndexConfigByAssistant } from '@/app/clientServices/aiSearchConfigService';
import { createSource } from '@clientServices/sourceService';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { formatName } from '@/utils/formatting';
import useSnackbar from '../../../../../hooks/useSnackbar';
import { useDropzone } from 'react-dropzone';
import { acceptedFileTypes } from '@/utils/constants';

const categoryDefinitions = {
  "Design Index": "Design indexes are pre-built collections of sources relevant to this assistant. They often include documents from SharePoint, Jira, and other integrated services."
}

const SourceList = () => {
  const params = useParams();
  const smartNote = useSmartNote();
  const { selectedUserAssistant } = useUserAssistants();
  const { sources } = useSources();
  const { savedNotes } = useSavedNotes();
  const { savedResponses } = useSavedResponses();
  const { jiraIssues } = useJiraIssues();
  const { designReferences } = useDesignReferences();
  const { designIndexs } = useDesignIndexs();
  const { uploadedDocuments } = useUploadedDocuments();
  const { sharePointFiles } = useSharePointFiles();
  const { websiteURLs } = useWebsiteURLs();
  const sourcesDispatch = useSourcesDispatch();
  const jiraIssuesDispatch = useJiraIssuesDispatch();
  const designReferencesDispatch = useDesignReferencesDispatch();
  const designIndexsDispatch = useDesignIndexsDispatch();
  const uploadedDocumentsDispatch = useUploadedDocumentsDispatch();
  const sharePointFilesDispatch = useSharePointFilesDispatch();
  const websiteURLsDispatch = useWebsiteURLsDispatch();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [hoveredSource, setHoveredSource] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updateCounter, setUpdateCounter] = useState(0);
  const forceUpdate = useCallback(() => setUpdateCounter(prev => prev + 1), []);
  const pollingTimeoutRef = useRef(null);
  const attemptsRef = useRef(0);
  const { SnackbarComponent, showSnackbar } = useSnackbar();

  // Calculate polling interval with exponential backoff
  const calculatePollInterval = useCallback((attemptCount) => {
    const basePollInterval = 5000; // 5 seconds base interval
    const maxPollInterval = 60000; // 1 minute maximum interval
    const intervalIncreaseEvery = 5; // Increase interval every 5 attempts

    const multiplier = Math.floor(attemptCount / intervalIncreaseEvery);
    const calculatedInterval = basePollInterval * Math.pow(2, multiplier); // 5s, 10s, 20s, 40s, 60s
    return Math.min(calculatedInterval, maxPollInterval);
  }, []);

  const hasPendingSources = useCallback(() => {
    const pendingUploadedDocs = uploadedDocuments.some(doc => doc.status === 'PENDING' || doc.status === undefined);
    const pendingSharePointFiles = sharePointFiles.some(file => file.status === 'PENDING' || file.status === undefined);
    const pendingWebsiteURLs = websiteURLs.some(url => url.status === 'PENDING' || url.status === undefined);
    const pendingJiraIssues = jiraIssues.some(issue => issue.status === 'PENDING' || issue.status === undefined);

    return pendingUploadedDocs || pendingSharePointFiles || pendingWebsiteURLs || pendingJiraIssues;
  }, [uploadedDocuments, sharePointFiles, websiteURLs, jiraIssues]);

  const { teamName, assistantName } = params;

  const onDropAccepted = useCallback(async (acceptedFiles) => {
    for (let file of acceptedFiles) {
      try {
        if (file.name.includes("'")) {
          const newFileName = file.name.replace(/'/g, '');
          file = new File([file], newFileName, { type: file.type })
        }

        const uploadedDocumentData = prepDocument({
          type: 'UploadedDocument',
          smartNoteId: smartNote.id,
          parentId: smartNote.id,
          fileName: file.name,
          file: file,
          status: 'PENDING'
        });

        uploadedDocumentsDispatch({ type: 'CREATE_UPLOADED_DOCUMENT', uploadedDocument: uploadedDocumentData });

        const sourceData = prepDocument({
          type: 'Source',
          smartNoteId: smartNote.id,
          sourceType: 'UploadedDocument',
          sourceId: uploadedDocumentData.id,
          parentId: smartNote.id,
          selected: true,
          enabled: true
        });
        try {
          const newSource = await createSource(teamName, assistantName, sourceData);
          sourcesDispatch({ type: 'CREATE_SOURCE', source: newSource });
        } catch (sourceError) {
          console.error(`[${new Date().toISOString()}] Error creating source:`, sourceError);
        }
        try {
          await uploadToIndexAndBlob(teamName, assistantName, uploadedDocumentData);
        } catch (error) {
          const erroredDocument = { ...uploadedDocumentData, status: 'ERROR' };
          uploadedDocumentsDispatch({ type: 'UPDATE_UPLOADED_DOCUMENT', uploadedDocument: erroredDocument });
        }
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
      }
    }
    updateUpdatedAt(teamName, assistantName, smartNote.id);
  }, [teamName, assistantName, smartNote, uploadedDocumentsDispatch, sourcesDispatch]);

  const onDropRejected = useCallback((fileRejections) => {
    if (fileRejections && fileRejections.length > 0) {
      const rejectedFile = fileRejections[0].file;
      const fileExtension = rejectedFile.name.toLowerCase().split('.').pop();

      if (fileExtension === 'doc') {
        showSnackbar("Legacy .doc files are not supported. Please convert to .docx format and try again.", 'warning');
      } else {
        showSnackbar(`File type ".${fileExtension}" is not supported. Please upload a supported file type.`, 'error');
      }
    }
  }, [showSnackbar]);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: onDropAccepted,
    onDropRejected: onDropRejected,
    accept: acceptedFileTypes,
    noClick: true,
    noKeyboard: true
  });

  useEffect(() => {
    const fetchData = async () => {
      // Log start of data fetching
      try {
        // Fetch all data in parallel for better performance
        const [
          foundSources,
          foundUploadedDocuments,
          foundJiraIssues,
          foundDesignReferences,
          foundSharePointFiles,
          foundWebsiteURLs,
          indexConfigs,
          foundDesignIndexes
        ] = await Promise.all([
          getSources(teamName, assistantName, smartNote),
          getUploadedDocuments(teamName, assistantName, smartNote),
          getJiraIssues(teamName, assistantName, smartNote),
          getDesignReferences(teamName, assistantName, smartNote),
          getSharePointFiles(teamName, assistantName, smartNote),
          getWebsiteURLs(teamName, assistantName, smartNote),
          getIndexConfigByAssistant(teamName, assistantName),
          getDesignIndexes(teamName, assistantName, smartNote)
        ]);

        // Document ID verification - log source IDs that don't have matching documents
        const documentSourceIds = foundSources
          .filter(source => source.sourceType === 'UploadedDocument')
          .map(source => source.sourceId);

        const documentIds = foundUploadedDocuments.map(doc => doc.id);
        const missingDocuments = documentSourceIds.filter(id => !documentIds.includes(id));
        if (missingDocuments.length > 0) {
          console.warn(`[${new Date().toISOString()}] Found ${missingDocuments.length} sources referencing missing documents:`, missingDocuments);
        }

        for (const indexConfig of indexConfigs) {
          try {
            const existingDesignIndex = foundDesignIndexes.find(index => formatName(index.title) === indexConfig.name);

            if (existingDesignIndex) {
              const relatedSource = foundSources.find(source => source.sourceId === existingDesignIndex.id);
              if (relatedSource) {
                if (relatedSource.enabled !== indexConfig.enabled) {
                  relatedSource.enabled = indexConfig.enabled;
                  relatedSource.selected = indexConfig.enabled;
                  relatedSource.searchIndexConfigId = indexConfig.id;

                  existingDesignIndex.enabled = indexConfig.enabled;
                  existingDesignIndex.searchIndexConfigId = indexConfig.id;
                  await Promise.all([
                    updateDesignIndex(teamName, assistantName, existingDesignIndex),
                    saveSource(teamName, assistantName, relatedSource)
                  ]);
                }
              }
            } else {
              // Create new design index for config that doesn't exist
              const designIndexData = prepDocument({
                type: 'DesignIndex',
                smartNoteId: smartNote.id,
                title: indexConfig.displayName,
                indexName: indexConfig.indexName,
                parentId: smartNote.id,
                enabled: indexConfig.enabled,
                searchIndexConfigId: indexConfig.id
              });

              const newDesignIndex = await createDesignIndex(teamName, assistantName, designIndexData);

              // Create corresponding source
              const sourceData = prepDocument({
                type: 'Source',
                smartNoteId: smartNote.id,
                sourceType: 'DesignIndex',
                sourceId: designIndexData.id,
                parentId: smartNote.id,
                selected: indexConfig.enabled,
                enabled: indexConfig.enabled,
                searchIndexConfigId: indexConfig.id
              });

              await createSource(teamName, assistantName, sourceData);

              foundDesignIndexes.push(newDesignIndex);
              foundSources.push(sourceData);
            }
          } catch (error) {
            console.error(`[${new Date().toISOString()}] Error processing design index for config ${indexConfig.id}:`, error);
          }
        }

        // handle the scenario where there are no indexConfigs, because they were deleted, but the sources and designIndexes still exist
        for (const designIndex of foundDesignIndexes) {
          const matchingConfig = indexConfigs.find(config => config.indexName === designIndex.indexName);
          if (!matchingConfig) {
            // If no matching config is found, we need to delete the design index and source
            const relatedSource = foundSources.find(source => source.sourceId === designIndex.id);
            if (relatedSource) {
              relatedSource.enabled = false;
              designIndex.enabled = false;
              await Promise.all([
                deleteDesignIndex(teamName, assistantName, designIndex),
                deleteSource(teamName, assistantName, relatedSource)
              ]);
            }
          }
        }

        // add a variant to WebsiteURLs that are actually ConfluenceURLs to ensure they're listed under the correct category
        const updatedSources = foundSources.map(source => {
          if (source.sourceType === SmartNoteTypes.DESIGN_INDEX && !source.enabled) {
            return;
          }

          return source;
        }).filter(Boolean);

        // Update Source list in UI
        sourcesDispatch({ type: 'SET_SOURCES', sources: updatedSources });
        designIndexsDispatch({ type: 'SET_DESIGN_INDEXS', designIndexs: foundDesignIndexes.filter(index => index.enabled) });
        uploadedDocumentsDispatch({ type: 'SET_UPLOADED_DOCUMENTS', uploadedDocuments: foundUploadedDocuments });
        jiraIssuesDispatch({ type: 'SET_JIRA_ISSUES', jiraIssues: foundJiraIssues });
        designReferencesDispatch({ type: 'SET_DESIGN_REFERENCES', designReferences: foundDesignReferences });
        sharePointFilesDispatch({ type: 'SET_SHAREPOINT_FILES', sharePointFiles: foundSharePointFiles });
        websiteURLsDispatch({ type: 'SET_WEBSITE_URLS', websiteURLs: foundWebsiteURLs });

      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching data:`, error);
      }
    }
    fetchData();
  }, [smartNote, sourcesDispatch, jiraIssuesDispatch, designReferencesDispatch, designIndexsDispatch, uploadedDocumentsDispatch, sharePointFilesDispatch, websiteURLsDispatch]);

  // Polling mechanism to check for pending sources with exponential backoff
  useEffect(() => {
    // Only start polling if there are pending sources
    if (!hasPendingSources()) {
      return;
    }

    const maxAttempts = 60;

    // Reset attempts counter when starting new polling session
    attemptsRef.current = 0;

    const pollForUpdates = async () => {
      attemptsRef.current++;

      try {
        let statusChanged = false;

        // Check uploaded documents
        const pendingUploadedDocs = uploadedDocuments.filter(doc => doc.status === 'PENDING');
        if (pendingUploadedDocs.length > 0) {
          const foundUploadedDocuments = await getUploadedDocuments(teamName, assistantName, smartNote);

          // Check if any status changed
          const hasChanges = pendingUploadedDocs.some(pendingDoc => {
            const serverDoc = foundUploadedDocuments.find(doc => doc.id === pendingDoc.id);
            return serverDoc && serverDoc.status !== pendingDoc.status;
          });

          if (hasChanges) {
            uploadedDocumentsDispatch({
              type: 'SET_UPLOADED_DOCUMENTS',
              uploadedDocuments: foundUploadedDocuments
            });
            statusChanged = true;
          }
        }

        // Check SharePoint files
        const pendingSharePointFiles = sharePointFiles.filter(file => file.status === 'PENDING');
        if (pendingSharePointFiles.length > 0) {
          const foundSharePointFiles = await getSharePointFiles(teamName, assistantName, smartNote);

          // Check if any status changed
          const hasChanges = pendingSharePointFiles.some(pendingFile => {
            const serverFile = foundSharePointFiles.find(file => file.id === pendingFile.id);
            return serverFile && serverFile.status !== pendingFile.status;
          });

          if (hasChanges) {
            sharePointFilesDispatch({
              type: 'SET_SHAREPOINT_FILES',
              sharePointFiles: foundSharePointFiles
            });
            statusChanged = true;
          }
        }

        // Check website URLs
        const pendingWebsiteURLs = websiteURLs.filter(url => url.status === 'PENDING');
        if (pendingWebsiteURLs.length > 0) {
          const foundWebsiteURLs = await getWebsiteURLs(teamName, assistantName, smartNote);

          // Check if any status changed
          const hasChanges = pendingWebsiteURLs.some(pendingUrl => {
            const serverUrl = foundWebsiteURLs.find(url => url.id === pendingUrl.id);
            return serverUrl && serverUrl.status !== pendingUrl.status;
          });

          if (hasChanges) {
            websiteURLsDispatch({
              type: 'SET_WEBSITE_URLS',
              websiteURLs: foundWebsiteURLs
            });
            statusChanged = true;
          }
        }

        const pendingJiraIssues = jiraIssues.filter(issue => issue.status === 'PENDING');
        if (pendingJiraIssues.length > 0) {
          const foundJiraIssues = await getJiraIssues(teamName, assistantName, smartNote);

          // Check if any status changed
          const hasChanges = pendingJiraIssues.some(pendingIssue => {
            const serverIssue = foundJiraIssues.find(issue => issue.id === pendingIssue.id);
            return serverIssue && serverIssue.status !== pendingIssue.status;
          });

          if (hasChanges) {
            jiraIssuesDispatch({
              type: 'SET_JIRA_ISSUES',
              jiraIssues: foundJiraIssues
            });
            statusChanged = true;
          }
        }

        if (statusChanged) {
          forceUpdate();
        }

        // Continue polling if there are still pending sources and we haven't exceeded max attempts
        if (hasPendingSources() && attemptsRef.current < maxAttempts) {
          const nextInterval = calculatePollInterval(attemptsRef.current);
          pollingTimeoutRef.current = setTimeout(pollForUpdates, nextInterval);
        } else if (attemptsRef.current >= maxAttempts) {
          console.warn(`[${new Date().toISOString()}] Source polling reached maximum attempts (${maxAttempts}). Stopping polling.`);
        }

      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error polling for source updates:`, error);

        // Continue polling even on error
        if (hasPendingSources() && attemptsRef.current < maxAttempts) {
          const nextInterval = calculatePollInterval(attemptsRef.current);
          pollingTimeoutRef.current = setTimeout(pollForUpdates, nextInterval);
        }
      }
    };

    // Start initial poll
    const initialInterval = calculatePollInterval(attemptsRef.current);
    pollingTimeoutRef.current = setTimeout(pollForUpdates, initialInterval);

    // Cleanup function
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [smartNote, uploadedDocuments, sharePointFiles, websiteURLs, jiraIssues, uploadedDocumentsDispatch, sharePointFilesDispatch, websiteURLsDispatch, jiraIssuesDispatch, teamName, assistantName, forceUpdate, hasPendingSources, calculatePollInterval]);

  const sourceOnlyTypes = [
    SmartNoteTypes.UPLOADED_DOCUMENT,
    SmartNoteTypes.SHAREPOINT_FILE,
    SmartNoteTypes.DESIGN_REFERENCE,
    SmartNoteTypes.DESIGN_INDEX,
    SmartNoteTypes.JIRA_ISSUE,
    SmartNoteTypes.WEBSITE_URL
  ];

  const getSourceIcon = (source) => {
    const iconStyle = { fontSize: 24 }; // Increase the size of the icons

    if (SmartNoteTypes.SAVED_NOTE === source.sourceType) {
      return <DescriptionOutlinedIcon sx={iconStyle} />;
    } else if (SmartNoteTypes.UPLOADED_DOCUMENT === source.sourceType) {
      // Early check - if sources list was loaded but documents weren't, don't log warnings
      if (!uploadedDocuments || uploadedDocuments.length === 0) {
        // Documents aren't loaded yet, just show default icon
        return <DescriptionOutlinedIcon sx={iconStyle} />;
      }

      const uploadedDocument = uploadedDocuments.find(doc => doc.id === source.sourceId);

      // Only log the document status for debugging if we've seen this warning before
      if (!uploadedDocument) {
        // Check if we need to log this warning - do so less frequently to avoid console spam
        if (!window.warnedDocumentIds) {
          window.warnedDocumentIds = new Set();
        }

        if (!window.warnedDocumentIds.has(source.sourceId)) {
          console.warn(`[${new Date().toISOString()}] Document not found in state: ${source.sourceId}`);
          window.warnedDocumentIds.add(source.sourceId);

          // Add debug info about available documents
          console.debug(`Available document IDs:`, uploadedDocuments.map(doc => doc.id));
        }

        return <DescriptionOutlinedIcon sx={iconStyle} />; // Default to regular icon if document not found
      }

      // Explicit status check with additional debug logging
      if (uploadedDocument.status === 'PENDING') {
        // Use proper styling for CircularProgress
        return <CircularProgress size={iconStyle.fontSize} sx={{ color: iconStyle.color }} />;
      } else if (uploadedDocument.status === 'ERROR') {
        // Could add an error icon here if desired
        return <DescriptionOutlinedIcon sx={{ ...iconStyle, color: 'error.main' }} />; // Red color for error
      } else {
        if (uploadedDocument.status !== 'INDEXED' && uploadedDocument.status !== 'COMPLETED') {
        }
        // Default to indexed icon for any other status (including INDEXED)
        return <DescriptionOutlinedIcon sx={iconStyle} />;
      }
    } else if (SmartNoteTypes.SHAREPOINT_FILE === source.sourceType) {
      const sharePointFile = sharePointFiles.find(file => file.id === source.sourceId);
      // Similar explicit status check for SharePoint files
      if (sharePointFile && sharePointFile.status === 'PENDING') {
        return <CircularProgress size={iconStyle.fontSize} sx={{ color: iconStyle.color }} />;
      } else if (sharePointFile && sharePointFile.status === 'ERROR') {
        return <TextSnippetOutlined sx={{ ...iconStyle, color: 'error.main' }} />;
      }
      return <TextSnippetOutlined sx={iconStyle} />;
    } else if (SmartNoteTypes.WEBSITE_URL === source.sourceType) {
      const websiteURL = websiteURLs.find(url => url.id === source.sourceId);
      // Similar explicit status check for Website URLs
      if (websiteURL && websiteURL.status === 'PENDING') {
        return <CircularProgress size={iconStyle.fontSize} sx={{ color: iconStyle.color }} />;
      } else if (websiteURL && websiteURL.status === 'ERROR') {
        return <InsertDriveFileOutlinedIcon sx={{ ...iconStyle, color: 'error.main' }} />;
      }
      return <InsertDriveFileOutlinedIcon sx={iconStyle} />;
    } else if (SmartNoteTypes.SAVED_RESPONSE === source.sourceType) {
      return <QuickreplyOutlinedIcon sx={iconStyle} />;
    } else if (SmartNoteTypes.DESIGN_REFERENCE === source.sourceType) {
      return <AssignmentOutlinedIcon sx={iconStyle} />;
    } else if (SmartNoteTypes.JIRA_ISSUE === source.sourceType) {
      const jiraIssue = jiraIssues.find(issue => issue.id === source.sourceId);
      if (jiraIssue && jiraIssue.status === 'PENDING') {
        return <CircularProgress size={iconStyle.fontSize} sx={{ color: iconStyle.color }} />;
      } else if (jiraIssue && jiraIssue.status === 'ERROR') {
        return <AssignmentOutlinedIcon sx={{ ...iconStyle, color: 'error.main' }} />;
      }
      return <AssignmentOutlinedIcon sx={iconStyle} />;
    } else {
      return <InsertDriveFileOutlinedIcon sx={iconStyle} />;
    }
  }

  const isSourceIndexing = (source) => {
    if (SmartNoteTypes.UPLOADED_DOCUMENT === source.sourceType) {
      // More defensive check - avoid console warnings if documents aren't loaded yet
      if (!uploadedDocuments || uploadedDocuments.length === 0) {
        return false; // Assume not indexing if documents aren't loaded yet
      }

      const uploadedDocument = uploadedDocuments.find(doc => doc.id === source.sourceId);


      // Only consider it indexing if status is specifically PENDING
      if (uploadedDocument && uploadedDocument.status === 'PENDING') {
        return true;
      }
    } else if (SmartNoteTypes.SHAREPOINT_FILE === source.sourceType) {
      const sharePointFile = sharePointFiles.find(file => file.id === source.sourceId);
      // Only consider it indexing if status is specifically PENDING
      if (sharePointFile && sharePointFile.status === 'PENDING') {
        return true;
      }
    } else if (SmartNoteTypes.WEBSITE_URL === source.sourceType) {
      const websiteURL = websiteURLs.find(url => url.id === source.sourceId);
      // Only consider it indexing if status is specifically PENDING
      if (websiteURL && websiteURL.status === 'PENDING') {
        return true;
      }
    } else if (SmartNoteTypes.JIRA_ISSUE === source.sourceType) {
      const jiraIssue = jiraIssues.find(issue => issue.id === source.sourceId);
      // Only consider it indexing if status is specifically PENDING
      if (jiraIssue && jiraIssue.status === 'PENDING') {
        return true;
      }
    }
    return false;
  }

  const getSourceText = (source) => {
    if (SmartNoteTypes.SAVED_NOTE === source.sourceType) {
      const savedNote = savedNotes.find(note => note.id === source.sourceId);
      return savedNote?.noteTitle;
    } else if (SmartNoteTypes.UPLOADED_DOCUMENT === source.sourceType) {
      const uploadedDocument = uploadedDocuments.find(uploadedDocument => uploadedDocument.id === source.sourceId);
      return uploadedDocument && uploadedDocument.fileName || '';
    } else if (SmartNoteTypes.SHAREPOINT_FILE === source.sourceType) {
      const sharePointFile = sharePointFiles.find(sharePointFile => sharePointFile.id === source.sourceId);
      return sharePointFile && sharePointFile.fileName || '';
    } else if (SmartNoteTypes.WEBSITE_URL === source.sourceType) {
      const websiteURL = websiteURLs.find(websiteURL => websiteURL.id === source.sourceId);
      return websiteURL && websiteURL.title || '';
    } else if (SmartNoteTypes.SAVED_RESPONSE === source.sourceType) {
      const savedResponse = savedResponses.find(savedResponse => savedResponse.id === source.sourceId);
      let title;
      if (savedResponse) {
        title = savedResponse.responseTitle || 'default'
      } else {
        title = 'default';
      }
      return title;
    } else if (SmartNoteTypes.DESIGN_REFERENCE === source.sourceType) {
      const designReference = designReferences.find(designReference => designReference.id === source.sourceId);
      return designReference ? designReference.name : '';
    } else if (SmartNoteTypes.DESIGN_INDEX === source.sourceType) {
      const designIndex = designIndexs.find(designIndex => designIndex.id === source.sourceId);
      return designIndex ? designIndex.title : '';
    } else if (SmartNoteTypes.JIRA_ISSUE === source.sourceType) {
      const jiraIssue = jiraIssues.find(jiraIssue => jiraIssue.id === source.sourceId);
      return jiraIssue ? `${jiraIssue.jiraKey}: ${jiraIssue.jiraSummary}` : '';
    } else {
      return 'default';
    }
  }

  const handleCheckboxChange = (source) => {
    const updatedSource = { ...source, selected: !source.selected };
    saveSource(teamName, assistantName, updatedSource);
    sourcesDispatch({ type: 'UPDATE_SOURCE', source: updatedSource });
  };

  const handleMenuOpen = (event, source) => {
    event.stopPropagation(); // Prevent event propagation
    setAnchorEl(event.currentTarget);
    setSelectedSource(source);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuAbandon = () => {
    setAnchorEl(null);
    setSelectedSource(null);
  };

  const handleDeleteClick = () => {
    setDialogOpen(true);
    handleMenuClose();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    await deleteSource(teamName, assistantName, selectedSource);
    sourcesDispatch({ type: 'DELETE_SOURCE', id: selectedSource.id });
    if (sourceOnlyTypes.includes(selectedSource.sourceType)) {
      switch (selectedSource.sourceType) {
        case SmartNoteTypes.DESIGN_REFERENCE: {
          const designReference = designReferences.find(designReference => designReference.id === selectedSource.sourceId);
          deleteDesignReference(teamName, assistantName, designReference);
          designReferencesDispatch({ type: 'DELETE_DESIGN_REFERENCE', id: selectedSource.sourceId });
          break;
        }
        case SmartNoteTypes.DESIGN_INDEX: {
          const designIndex = designIndexs.find(designIndex => designIndex.id === selectedSource.sourceId);
          deleteDesignIndex(teamName, assistantName, designIndex);
          designIndexsDispatch({ type: 'DELETE_DESIGN_INDEX', id: selectedSource.sourceId });
          break;
        }
        case SmartNoteTypes.JIRA_ISSUE: {
          const jiraIssue = jiraIssues.find(jiraIssue => jiraIssue.id === selectedSource.sourceId);
          deleteJiraIssue(teamName, assistantName, jiraIssue);
          jiraIssuesDispatch({ type: 'DELETE_JIRA_ISSUE', id: selectedSource.sourceId });
          break;
        }
        case SmartNoteTypes.UPLOADED_DOCUMENT: {
          const uploadedDocument = uploadedDocuments.find(uploadedDocument => uploadedDocument.id === selectedSource.sourceId);
          // Ensure parentId is set for the delete API call
          const documentToDelete = { ...uploadedDocument, parentId: uploadedDocument.parentId || smartNote.id };
          deleteUploadedDocument(teamName, assistantName, documentToDelete);
          uploadedDocumentsDispatch({ type: 'DELETE_UPLOADED_DOCUMENT', id: selectedSource.sourceId });
          break;
        }
        case SmartNoteTypes.SHAREPOINT_FILE: {
          const sharePointFile = sharePointFiles.find(file => file.id === selectedSource.sourceId);
          deleteSharePointFile(teamName, assistantName, sharePointFile);
          sharePointFilesDispatch({ type: 'DELETE_SHAREPOINT_FILE', id: selectedSource.sourceId })
          break;
        }
        case SmartNoteTypes.WEBSITE_URL: {
          const websiteURL = websiteURLs.find(url => url.id === selectedSource.sourceId);
          deleteWebsiteURL(teamName, assistantName, websiteURL);
          websiteURLsDispatch({ type: 'DELETE_WEBSITE_URL', id: selectedSource.sourceId });
          break;
        }
      }
    }
    updateUpdatedAt(teamName, assistantName, smartNote.id);
    handleDialogClose();
  }

  const formatCategoryDisplayValue = (category) => {
    if (organizedSources[category] && organizedSources[category].length === 1) {
      return category;
    }

    // In general, most nouns form the plural by adding "s".
    // However, for nouns ending in s, x, ch, sh, or z, the plural is formed by adding "es". 
    if (category.endsWith('s') || category.endsWith('x') || category.endsWith('ch') || category.endsWith('sh') || category.endsWith('z')) {
      return category + 'es';
    }
    return category + 's';
  }

  const handleDownloadDocument = async (uploadedDocument) => {
    try {
      if (!uploadedDocument.blobStorageLocation) {
        showSnackbar('This document cannot be downloaded. Only documents uploaded with blob storage support are downloadable.', 'warning');
        return;
      }
      showSnackbar('Your download will begin shortly...', 'info');

      const blob = await downloadUploadedDocument(teamName, assistantName, smartNote.id, uploadedDocument.id);

      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = uploadedDocument.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      showSnackbar('Download started successfully', 'success');

    } catch (error) {
      console.error(`[${new Date().toISOString()}] Download error:`, error);
      showSnackbar(`Download failed: ${error.message}`, 'error');
    }
  };

  const variants = ['ConfluenceURL', 'QTestURL'];
  const organizedSources = useMemo(() => {
    return (sources || []).reduce((acc, source) => {
      if (source.sourceType === SmartNoteTypes.WEBSITE_URL) {
        const websiteURL = websiteURLs.find(url => url.id === source.sourceId);
        if (websiteURL && websiteURL.variant) {
          source.variant = websiteURL.variant;
        }
      }
      // Normalize the category name
      const category = source.category || (variants.includes(source?.variant) ? splitOnCapitalLetters(source.variant) : splitOnCapitalLetters(source.sourceType));

      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(source);
      return acc;
    }, {});
  }, [sources]);

  // Sort categories and sources within each category
  const sortedCategories = Object.keys(organizedSources).filter(k => k !== '').sort((a, b) => {
    return a.localeCompare(b);
  });

  sortedCategories.forEach(category => {
    organizedSources[category].sort((a, b) => getSourceText(a)?.localeCompare(getSourceText(b)));
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        overflow: 'auto',
        padding: 0,
        position: 'relative',
        zIndex: 0
      }}
      {...getRootProps()}
    >
      {isDragActive && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(25, 118, 210, 0.08)',
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: -1
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CloudUploadOutlinedIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Drop files here to upload
            </Typography>
          </Box>
        </Box>
      )}
      {sortedCategories.map(category => (
        <Box key={category} sx={{ mb: 1, ml: 1, mt: 1 }}>
          <Box sx={{ display: 'flex', mb: 1, gap: 2 }}>
            <Typography sx={{ fontWeight: 'bold' }} variant="body1">{formatCategoryDisplayValue(category)}</Typography>
            {
              categoryDefinitions[category] && (
                <Tooltip title={categoryDefinitions[category]} placement="top" arrow>
                  <InfoOutlined sx={{ color: 'info.dark', cursor: 'pointer', alignSelf: 'center' }} />
                </Tooltip>
              )
            }
          </Box>
          {organizedSources[category].map((source) => (
            <Box
              key={source.id}
              onMouseEnter={() => setHoveredSource(source.id)}
              onMouseLeave={() => setHoveredSource(null)}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, overflow: 'hidden' }}>
                <IconButton
                  onClick={(event) => handleMenuOpen(event, source)}
                  onMouseDown={(event) => event.stopPropagation()}
                  sx={{
                    transition: 'opacity 0.3s',
                  }}
                >
                  {hoveredSource === source.id ? (
                    <MoreVertIcon sx={{ fontSize: '24px' }} />
                  ) : (
                    getSourceIcon(source)
                  )}
                </IconButton>
                <Tooltip title={getSourceText(source)} placement={'top'} arrow>
                  <Typography
                    sx={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {getSourceText(source)}
                  </Typography>
                </Tooltip>
              </Box>
              <Checkbox
                disabled={isSourceIndexing(source)}
                onChange={() => handleCheckboxChange(source)}
                checked={!!source.selected}
                sx={{
                  '& .MuiSvgIcon-root': {
                    fontSize: 24,
                  },
                }
                }
              />
            </Box>))}
        </Box>
      ))}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuAbandon}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        // Fix accessibility warning by keeping focus management proper
        keepMounted
      >
        {selectedSource?.sourceType === SmartNoteTypes.UPLOADED_DOCUMENT && uploadedDocuments.find(d => d.id === selectedSource.sourceId)?.blobStorageLocation && (
          <MenuItem onClick={() => {
            const doc = uploadedDocuments.find(d => d.id === selectedSource.sourceId);
            if (doc) {
              handleDownloadDocument(doc)
            };
            handleMenuClose();
          }}>
            Download
          </MenuItem>
        )}
        <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
      </Menu>
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        // Fix aria-hidden warning by setting proper focus management 
        keepMounted
        disablePortal={false}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">Delete Source</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this source?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} variant='secondary'>Cancel</Button>
          <Button onClick={handleDelete} variant='destructive' color="error" autoFocus>Delete</Button>
        </DialogActions>
      </Dialog>
      <SnackbarComponent />
    </Box>
  );
}

export default SourceList;

// Replace any capital letter that follows a lowercase letter with a space + that letter
// e.g., "camelCase" becomes "camel Case"
const splitOnCapitalLetters = (str) => {
  if (!str) return ''; // Handle null or undefined input
  let formatted = str.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Special Case: Share Point File should be SharePoint File
  formatted = formatted.replace('Share Point', 'SharePoint');
  return formatted;
};