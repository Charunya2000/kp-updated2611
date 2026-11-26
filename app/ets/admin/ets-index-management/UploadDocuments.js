'use client';

import { Box, TextField, Typography, IconButton, Snackbar, Alert, Select, MenuItem, FormControl, InputLabel, CircularProgress, Chip, Stack, OutlinedInput, Paper, List, ListItem, ListItemText, Pagination, Button, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText } from "@mui/material";
import { useState, useCallback, useEffect } from 'react';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import { useDropzone } from "react-dropzone";
import { uploadETSDocumentsToIndex } from '@/app/ets/admin/update-ets-index-data/clientServices/searchIndexDataUploadService';
import { getAllAssistants } from '@/app/clientServices/assistantService';
import { getAllTags, createTag, updateTag, deleteTag } from '@/app/ets/admin/update-ets-index-data/clientServices/etsIndexTagService';
import { searchETSDocuments, deleteETSDocumentsByFileName, updateETSDocumentsByFileName } from '@/app/ets/admin/update-ets-index-data/clientServices/etsDocumentManagementService';
import { acceptedFileTypes } from '@/utils/constants';

const UploadDocuments = () => {
  const [assistants, setAssistants] = useState([]);
  const [loadingAssistants, setLoadingAssistants] = useState(true);
  const [selectedAssistant, setSelectedAssistant] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [availableTag, setAvailableTag] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editTagValue, setEditTagValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedFilesCount, setUploadedFilesCount] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Document management states
  const [searchQuery, setSearchQuery] = useState('');
  const [allDocuments, setAllDocuments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null);
  
  // Edit dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState(null);
  const [editProjectId, setEditProjectId] = useState('');
  const [editProjectName, setEditProjectName] = useState('');
  const [editTag, setEditTag] = useState('');

  const showSnackbarMessage = (message, severity = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleTagChange = (event) => {
    setSelectedTag(event.target.value);
  };

  const handleAddNewTag = async () => {
    const trimmedTag = newTagInput.trim();
    if (!trimmedTag) {
      return;
    }

    // Check for duplicates in local state
    if (availableTag.includes(trimmedTag)) {
      showSnackbarMessage('Tag already exists', 'info');
      setNewTagInput('');
      return;
    }

    try {
      await createTag('ets', trimmedTag);
      setAvailableTag([...availableTag, trimmedTag].sort());
      setSelectedTag(trimmedTag);
      setNewTagInput('');
      showSnackbarMessage('Tag created successfully', 'success');
    } catch (error) {
      console.error('Error creating tag:', error);
      // Check if it's a duplicate error from the server
      if (error.message.includes('already exists') || error.message.includes('409')) {
        showSnackbarMessage('Tag name already exists', 'error');
      } else {
        showSnackbarMessage('Failed to create tag', 'error');
      }
    }
  };

  const handleNewTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewTag();
    }
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setEditTagValue(tag);
  };

  const handleSaveEditTag = async () => {
    const trimmedTag = editTagValue.trim();
    if (!trimmedTag || trimmedTag === editingTag) {
      setEditingTag(null);
      setEditTagValue('');
      return;
    }

    // Check for duplicates in local state (excluding the current tag being edited)
    if (availableTag.includes(trimmedTag)) {
      showSnackbarMessage('Tag name already exists', 'error');
      return;
    }

    try {
      // Find the tag document to get its ID
      const tagsList = await getAllTags('ets');
      const tagDoc = tagsList.find(t => t.tag === editingTag);
      if (tagDoc) {
        await updateTag('ets', tagDoc.id, trimmedTag);
        const updatedTag = availableTag.map(t => t === editingTag ? trimmedTag : t).sort();
        setAvailableTag(updatedTag);
        if (selectedTag === editingTag) {
          setSelectedTag(trimmedTag);
        }
        showSnackbarMessage('Tag updated successfully', 'success');
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      // Check if it's a duplicate error from the server
      if (error.message.includes('already exists') || error.message.includes('409')) {
        showSnackbarMessage('Tag name already exists', 'error');
      } else {
        showSnackbarMessage('Failed to update tag', 'error');
      }
    }
    setEditingTag(null);
    setEditTagValue('');
  };

  const handleCancelEditTag = () => {
    setEditingTag(null);
    setEditTagValue('');
  };

  const handleDeleteTag = async (tagToDelete) => {
    try {
      // Find the tag document to get its ID
      const tagsList = await getAllTags('ets');
      const tagDoc = tagsList.find(t => t.tag === tagToDelete);
      if (tagDoc) {
        await deleteTag('ets', tagDoc.id);
        const updatedTag = availableTag.filter(t => t !== tagToDelete).sort();
        setAvailableTag(updatedTag);
        if (selectedTag === tagToDelete) {
          setSelectedTag('');
        }
        showSnackbarMessage('Tag deleted successfully', 'success');
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      showSnackbarMessage('Failed to delete tag', 'error');
    }
  };

  // Document management functions
  const fetchDocuments = async (query = '', page = 1) => {
    try {
      setLoadingDocuments(true);
      // Fetch all documents (up to 1000)
      const result = await searchETSDocuments('', 1, 1000);

      // Deduplicate documents by doc_name - keep the first occurrence of each unique file name
      const uniqueDocuments = [];
      const seenNames = new Set();

      (result.documents || []).forEach(doc => {
        if (!seenNames.has(doc.doc_name)) {
          seenNames.add(doc.doc_name);
          uniqueDocuments.push(doc);
        }
      });

      // Filter documents by file name OR project ID OR tag (case-insensitive)
      const searchTerm = query.toLowerCase().trim();
      const filteredDocuments = searchTerm
        ? uniqueDocuments.filter(doc => {
          return doc.doc_name.toLowerCase().includes(searchTerm) ||
                 doc.project_id.toLowerCase().includes(searchTerm) ||
                 (doc.tag && doc.tag.toLowerCase().includes(searchTerm));
        })
        : uniqueDocuments;

      // Sort by created_at in descending order (newest first)
      const sortedDocuments = filteredDocuments.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      // Store all filtered and sorted documents
      setAllDocuments(sortedDocuments);
      setTotalCount(sortedDocuments.length);

      // Calculate pagination on client side
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedDocs = filteredDocuments.slice(startIndex, endIndex);

      setDocuments(paginatedDocs);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching documents:', error);
      showSnackbarMessage('Failed to load documents', 'error');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Set new timer for debounced search (300ms delay)
    const timer = setTimeout(() => {
      fetchDocuments(value, 1);
    }, 500);
    
    setSearchDebounceTimer(timer);
  };

  const handlePageChange = (event, value) => {
    // Calculate pagination from allDocuments
    const startIndex = (value - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedDocs = allDocuments.slice(startIndex, endIndex);

    setDocuments(paginatedDocs);
    setCurrentPage(value);
  };

  const handlePageSizeChange = (event) => {
    const newPageSize = event.target.value;
    setPageSize(newPageSize);

    // Recalculate pagination with new page size, reset to page 1
    const startIndex = 0;
    const endIndex = newPageSize;
    const paginatedDocs = allDocuments.slice(startIndex, endIndex);

    setDocuments(paginatedDocs);
    setCurrentPage(1);
  };

  const handleDeleteDocument = (document) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;

    try {
      const result = await deleteETSDocumentsByFileName(documentToDelete.doc_name);
      showSnackbarMessage(result.message, 'success');

      // Refresh the document list, stay on current page if possible
      const updatedAllDocs = allDocuments.filter(doc => doc.doc_name !== documentToDelete.doc_name);
      setAllDocuments(updatedAllDocs);
      setTotalCount(updatedAllDocs.length);

      // Adjust current page if needed (if we deleted the last item on the last page)
      const maxPage = Math.ceil(updatedAllDocs.length / pageSize);
      const newPage = currentPage > maxPage ? Math.max(1, maxPage) : currentPage;

      const startIndex = (newPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedDocs = updatedAllDocs.slice(startIndex, endIndex);

      setDocuments(paginatedDocs);
      setCurrentPage(newPage);
    } catch (error) {
      console.error('Error deleting document:', error);
      showSnackbarMessage(error.message || 'Failed to delete document', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const cancelDeleteDocument = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  const handleEditDocument = (document) => {
    setDocumentToEdit(document);
    setEditProjectId(document.project_id);
    setEditProjectName(document.project_name);
    setEditTag(document.tag || '');
    setEditDialogOpen(true);
  };

  const confirmEditDocument = async () => {
    if (!documentToEdit) return;

    if (!editProjectId.trim() || !editProjectName.trim()) {
      showSnackbarMessage('Project ID and Project Name are required', 'error');
      return;
    }

    try {
      const result = await updateETSDocumentsByFileName(documentToEdit.doc_name, {
        projectId: editProjectId.trim(),
        projectName: editProjectName.trim(),
        tag: editTag.trim()
      });
      
      showSnackbarMessage(result.message, 'success');

      // Wait for Azure Search to update the index before refreshing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh the document list
      await fetchDocuments(searchQuery, currentPage);
    } catch (error) {
      console.error('Error updating document:', error);
      showSnackbarMessage(error.message || 'Failed to update document', 'error');
    } finally {
      setEditDialogOpen(false);
      setDocumentToEdit(null);
      setEditProjectId('');
      setEditProjectName('');
      setEditTag('');
    }
  };

  const cancelEditDocument = () => {
    setEditDialogOpen(false);
    setDocumentToEdit(null);
    setEditProjectId('');
    setEditProjectName('');
    setEditTag('');
  };

  const handleEditTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEditTag();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEditTag();
    }
  };

  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        setLoadingAssistants(true);
        const assistantsList = await getAllAssistants('ets');
        // Sort assistants alphabetically by name
        const sortedAssistants = (assistantsList || []).sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        setAssistants(sortedAssistants);
      } catch (error) {
        console.error('Error fetching assistants:', error);
        showSnackbarMessage('Failed to load assistants', 'error');
      } finally {
        setLoadingAssistants(false);
      }
    };

    const fetchTags = async () => {
      try {
        const tagsList = await getAllTags('ets');
        const tagNames = tagsList.map(t => t.tag).sort();
        setAvailableTag(tagNames || []);
      } catch (error) {
        console.error('Error fetching tags:', error);
        // Initialize with empty array if fetch fails
        setAvailableTag([]);
      }
    };

    fetchAssistants();
    fetchTags();
    fetchDocuments('', 1); // Load initial documents
  }, []);

  const handleFileUpload = async (files) => {
    if (!selectedAssistant || !projectName.trim()) {
      showSnackbarMessage('Please select an assistant and enter a project name before uploading', 'error');
      return;
    }

    const assistant = assistants.find(a => a.name === selectedAssistant);
    if (!assistant) {
      showSnackbarMessage('Selected assistant not found', 'error');
      return;
    }

    setUploading(true);

    try {
      // Check for duplicate file names in the index
      const result = await searchETSDocuments('', 1, 1000);
      const existingFileNames = new Set(
        (result.documents || []).map(doc => doc.doc_name)
      );

      // Check if any of the files being uploaded already exist
      const duplicateFiles = files.filter(file => existingFileNames.has(file.name));

      if (duplicateFiles.length > 0) {
        const duplicateNames = duplicateFiles.map(f => f.name).join(', ');
        showSnackbarMessage(
          `Cannot upload: The following file(s) already exist in the index: ${duplicateNames}. Please delete existing files first or rename your files.`,
          'error'
        );
        setUploading(false);
        return;
      }

      const projectId = assistant.name;
      const uploadResult = await uploadETSDocumentsToIndex(files, projectId, projectName, selectedTag);

      setUploadedFilesCount(prev => prev + files.length);
      showSnackbarMessage(uploadResult.message || `Successfully uploaded ${files.length} file(s)`, 'success');

      // Wait a bit for Azure Search to index the documents before refreshing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh the document list to show newly uploaded files
      await fetchDocuments(searchQuery, 1);
    } catch (error) {
      console.error('Error uploading documents:', error);
      showSnackbarMessage(error.message || 'Failed to upload documents. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles);
    }
  }, [selectedAssistant, projectName, selectedTag, assistants]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: acceptedFileTypes,
    disabled: uploading
  });

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'row',
      gap: 2,
      p: 2,
      overflow: 'hidden'
    }}>
      {/* Left Side - Upload Section */}
      <Box sx={{
        flex: '0 0 50%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        pr: 1
      }}>
        <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, width: '100%' }}>

          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            Add Documents to Index
          </Typography>

          <Box sx={{ mb: 2, maxWidth: 700, mx: 'auto', p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Upload instructions
            </Typography>
            <Typography variant="body2">
              Upload documents to the <Box component="span" sx={{ fontWeight: 700 }}>ets-001</Box> index. Use the same <Box component="span" sx={{ fontWeight: 700 }}>Project ID</Box> for every file belonging to the same project — this enables reliable filtering when assigning the index to an assistant in Assistant Settings.
            </Typography>
          </Box>

          {/* Metadata Fields */}
          <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth required disabled={uploading || loadingAssistants}>
              <InputLabel>Select Assistant</InputLabel>
              <Select
                value={selectedAssistant}
                onChange={(e) => setSelectedAssistant(e.target.value)}
                label="Select Assistant"
              >
                {loadingAssistants ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading assistants...
                  </MenuItem>
                ) : assistants.length === 0 ? (
                  <MenuItem disabled>No assistants available</MenuItem>
                ) : (
                  assistants.map((assistant) => (
                    <MenuItem key={assistant.id} value={assistant.name}>
                      {assistant.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <TextField
              label="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              fullWidth
              required
              placeholder="Enter Project Name"
              disabled={uploading}
            />

            {/* Tag Section */}
            <Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                {availableTag.length > 0 ? (
                  <FormControl fullWidth>
                    <InputLabel>Tag</InputLabel>
                    <Select
                      value={selectedTag}
                      onChange={handleTagChange}
                      label="Tag"
                      disabled={uploading}
                      renderValue={(selected) => selected}
                    >
                      {availableTag.map((tag) => (
                        <MenuItem
                          key={tag}
                          value={tag}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            '&:hover .tag-actions': {
                              opacity: 1,
                            }
                          }}
                        >
                          {editingTag === tag ? (
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 1,
                                width: '100%',
                                alignItems: 'center',
                                py: 0.5
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <TextField
                                value={editTagValue}
                                onChange={(e) => setEditTagValue(e.target.value)}
                                onKeyDown={handleEditTagKeyPress}
                                size="small"
                                autoFocus
                                sx={{ flex: 1 }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEditTag();
                                }}
                                sx={{
                                  color: 'success.main',
                                  '&:hover': { bgcolor: 'success.light', color: 'white' }
                                }}
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEditTag();
                                }}
                                sx={{
                                  color: 'error.main',
                                  '&:hover': { bgcolor: 'error.dark', color: 'white' }
                                }}
                              >
                                ✕
                              </IconButton>
                            </Box>
                          ) : (
                            <>
                              <Typography sx={{ flex: 1 }}>{tag}</Typography>
                              <Box
                                className="tag-actions"
                                sx={{
                                  display: 'flex',
                                  gap: 0.5,
                                  opacity: 0,
                                  transition: 'opacity 0.2s'
                                }}
                              >
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditTag(tag);
                                  }}
                                  sx={{
                                    padding: '6px',
                                    color: 'text.secondary',
                                    '&:hover': {
                                      // bgcolor: 'primary.light',
                                      color: 'primary.main'
                                    }
                                  }}
                                >
                                  <EditIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTag(tag);
                                  }}
                                  sx={{
                                    padding: '6px',
                                    color: 'text.secondary',
                                    '&:hover': {
                                      // bgcolor: 'error.light',
                                      color: 'error.main'
                                    }
                                  }}
                                >
                                  <DeleteIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Box>
                            </>
                          )}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Box sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '56px',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 1,
                    color: 'text.secondary'
                  }}>
                    <Typography variant="body2">Add a tag to get started</Typography>
                  </Box>
                )}
                <TextField
                  label="New Tag"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyPress={handleNewTagKeyPress}
                  placeholder="Create tag"
                  disabled={uploading}
                  size="medium"
                  sx={{ width: '200px' }}
                />
                <IconButton
                  onClick={handleAddNewTag}
                  disabled={!newTagInput.trim() || uploading}
                  color="primary"
                  sx={{
                    mt: 0.5,
                    width: 48,
                    height: 48,
                    border: '1px solid',
                    borderColor: !newTagInput.trim() || uploading ? 'divider' : 'primary.main',
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      borderColor: 'primary.main',
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <AddIcon />
                </IconButton>
              </Box>
            </Box>
          </Box>

          {/* Drop Zone */}
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed gray',
              borderRadius: '8px',
              padding: 4,
              textAlign: 'center',
              backgroundColor: (theme) => {
                if (isDragActive) {
                  return theme.palette.mode === 'light' ? '#f0f0f0' : '#0D1C3D';
                }
                return 'transparent';
              },
              cursor: uploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              minHeight: '250px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <input {...getInputProps()} />
            <IconButton
              color="primary"
              component="span"
              sx={{
                fontSize: '48px',
                mx: 'auto',
              }}
              disabled={uploading}
            >
              <CloudUploadOutlinedIcon fontSize="inherit" />
            </IconButton>

            {uploading ? (
              <>
                <Typography variant="h6">Uploading...</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Please wait while we upload your documents
                </Typography>
                <Typography variant="caption" display="block" sx={{ marginTop: 2, color: 'text.secondary' }}>
                  Supported file types: MS Word, Excel, PowerPoint, PDF, text, and images (PNG, JPG, JPEG, WEBP, HEIC, TIFF)
                </Typography>
                <Typography variant="caption" display="block" sx={{ marginTop: 1, color: 'text.secondary' }}>
                  Multiple files supported
                </Typography>
              </>
            ) : uploadedFilesCount > 0 ? (
              <>
                <Typography variant="h6" color="success.main">
                  {uploadedFilesCount} file(s) uploaded successfully
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Click or drag to upload more files
                </Typography>
                <Typography variant="caption" display="block" sx={{ marginTop: 2, color: 'text.secondary' }}>
                  Supported file types: MS Word, Excel, PowerPoint, PDF, text, and images (PNG, JPG, JPEG, WEBP, HEIC, TIFF)
                </Typography>
                <Typography variant="caption" display="block" sx={{ marginTop: 1, color: 'text.secondary' }}>
                  Multiple files supported
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="h6">Upload Documents</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Drag & drop or click to select files
                </Typography>
                <Typography variant="caption" display="block" sx={{ marginTop: 2, color: 'text.secondary' }}>
                  Supported file types: MS Word, Excel, PowerPoint, PDF, text, and images (PNG, JPG, JPEG, WEBP, HEIC, TIFF)
                </Typography>
                <Typography variant="caption" display="block" sx={{ marginTop: 1, color: 'text.secondary' }}>
                  Multiple files supported
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* Right Side - Document Management Section */}
      <Box sx={{
        flex: '0 0 50%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        pl: 1
      }}>
        <Box sx={{ maxWidth: 800, mx: 'auto', p: 3, width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Manage Existing Documents
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Index: <Box component="span" sx={{ fontWeight: 700 }}>ets-001</Box>
            </Typography>
          </Box>

          {/* Search Bar */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              label="Search by File Name, Project ID, or Tag"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Type to search..."
              disabled={loadingDocuments}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Per page</InputLabel>
              <Select
                value={pageSize}
                label="Per page"
                onChange={handlePageSizeChange}
                disabled={loadingDocuments}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Results count */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {totalCount} document{totalCount !== 1 ? 's' : ''} found
            </Typography>
          </Box>

          {/* Document List */}
          <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
            {loadingDocuments ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <CircularProgress />
              </Box>
            ) : documents.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', color: 'text.secondary' }}>
                <Typography variant="body2">No documents found</Typography>
              </Box>
            ) : (
              <List>
                {documents.map((doc) => (
                  <ListItem
                    key={doc.doc_id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1
                    }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          edge="end"
                          aria-label="edit"
                          onClick={() => handleEditDocument(doc)}
                          sx={{
                            color: 'primary.main',
                            '&:hover': {
                              bgcolor: 'primary.light',
                              color: 'white'
                            }
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleDeleteDocument(doc)}
                          sx={{
                            color: 'error.main',
                            '&:hover': {
                              bgcolor: 'error.light',
                              color: 'white'
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {doc.doc_name}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            <strong>Project Name:</strong> {doc.project_name}
                          </Typography>
                          <Typography variant="caption" display="block">
                            <strong>Project ID:</strong> {doc.project_id}
                          </Typography>
                          <Typography variant="caption" display="block">
                            <strong>Tag:</strong> {doc.tag || ''}
                          </Typography>
                        </Box>
                      }
                      secondaryTypographyProps={{ component: 'div' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Pagination */}
          {totalCount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 'auto' }}>
              <Pagination
                count={Math.ceil(totalCount / pageSize)}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                disabled={loadingDocuments}
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDeleteDocument}
        maxWidth="xs"
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pb: 1,
          fontSize: '1.125rem'
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'error.light',
            color: 'error.main'
          }}>
            <DeleteIcon />
          </Box>
          Delete File
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5, fontSize: '0.95rem' }}>
            Are you sure you want to delete:
          </DialogContentText>
          <Box sx={{
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
            mb: 1.5
          }}>
            <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
              {documentToDelete?.doc_name}
            </Typography>
          </Box>
          <Alert severity="warning" sx={{ py: 0.5 }}>
            <Typography variant="body2">
              This will permanently delete all chunks from the index.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button
            onClick={cancelDeleteDocument}
            variant="outlined"
            size="medium"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDeleteDocument}
            color="error"
            variant="contained"
            size="medium"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Confirmation Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={cancelEditDocument}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          pb: 1,
          fontSize: '1.125rem'
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'action.hover',
            color: 'primary.main'
          }}>
            <EditIcon />
          </Box>
          Edit Document
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2, fontSize: '0.95rem' }}>
            Update metadata for:
          </DialogContentText>
          <Box sx={{
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
            mb: 2
          }}>
            <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
              {documentToEdit?.doc_name}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Project ID</InputLabel>
              <Select
                value={editProjectId}
                onChange={(e) => setEditProjectId(e.target.value)}
                label="Project ID"
              >
                {assistants.map((assistant) => (
                  <MenuItem key={assistant.id} value={assistant.name}>
                    {assistant.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Project Name"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              fullWidth
              required
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Tag</InputLabel>
              <Select
                value={editTag}
                onChange={(e) => setEditTag(e.target.value)}
                label="Tag"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {availableTag.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          <Alert severity="info" sx={{ mt: 2, py: 0.5 }}>
            <Typography variant="body2">
              This will update all chunks associated with this file.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
          <Button
            onClick={cancelEditDocument}
            variant="outlined"
            size="medium"
          >
            Cancel
          </Button>
          <Button
            onClick={confirmEditDocument}
            color="primary"
            variant="contained"
            size="medium"
            autoFocus
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UploadDocuments;
