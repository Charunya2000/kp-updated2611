import { Box, Grid2, IconButton, Typography, Snackbar, Alert } from "@mui/material";
import { useState, useEffect, useCallback } from 'react';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { useDropzone } from "react-dropzone";
import { useUploadedDocumentsDispatch, useUploadedDocuments } from '@reducers/UploadedDocumentContext';
import { useSourcesDispatch, useSources } from '@reducers/SourceContext';
import { prepDocument } from '@clientServices/insertDocument';
import { uploadToIndexAndBlob } from '@clientServices/uploadedDocumentService';
import { createSource } from '@clientServices/sourceService';
import { updateUpdatedAt } from '@clientServices/smartNoteService';
import { useParams } from "next/navigation";
import { acceptedFileTypes } from '@/utils/constants';

const AddSourceDropZones = ({ selectedUserAssistant, smartNote, handleClose }) => {
  const uploadedDocumentsDispatch = useUploadedDocumentsDispatch();
  const sourcesDispatch = useSourcesDispatch();
  const { uploadedDocuments } = useUploadedDocuments();
  const { sources } = useSources();
  const [assignmentSheet, setAssignmentSheet] = useState(null); // used only for DMSS
  const [testCaseTemplates, setTestCaseTemplate] = useState([]); // used only for DMSS
  const [letters, setLetters] = useState([]); // used only for DMSS
  const [notes, setNotes] = useState([]); // used only for DMSS
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'error'  // One of: 'error', 'warning', 'info', 'success'
  });
  const { teamName, assistantName } = useParams();

  useEffect(() => {
    if (selectedUserAssistant?.name === 'document-management-shared-service') {
      // reset
      setAssignmentSheet(null);
      setTestCaseTemplate([]);
      setLetters([]);
      setNotes([]);

      const as = sources.find(s => s.category === 'Assignment Sheet');
      if (as) {
        const doc = uploadedDocuments.find(doc => doc.id === as.sourceId);
        setAssignmentSheet(doc);
      }
      const testCaseIds = sources.filter(s => s.category === 'Test Case Template').map(s => s.sourceId);
      if (testCaseIds && testCaseIds.length) {
        const docs = uploadedDocuments.filter(doc => testCaseIds.includes(doc.id));
        setTestCaseTemplate(docs);
      }
      const letterIds = sources.filter(s => s.category === 'Letter').map(s => s.sourceId);
      if (letterIds && letterIds.length) {
        const docs = uploadedDocuments.filter(doc => letterIds.includes(doc.id));
        setLetters(docs);
      }
      const noteIds = sources.filter(s => s.category === 'Note').map(s => s.sourceId);
      if (noteIds && noteIds.length) {
        const docs = uploadedDocuments.filter(doc => noteIds.includes(doc.id));
        setNotes(docs);
      }
    }
  }, [sources, uploadedDocuments]);

  const handleFileChange = async (file, category) => {
    if (file.name.includes("'")) {
      const newFileName = file.name.replace(/'/g, '');
      // Create a new File object with the sanitized name
      file = new File([file], newFileName, { type: file.type })
    }
    if (file) {

      const fileExtension = file.name.toLowerCase().split('.').pop();
      if (fileExtension === 'doc') {
        showSnackbarMessage("Legacy .doc files are not supported. Please convert to .docx format and try again.", 'warning');
        return;
      }

      // Close the dialog immediately after file selection for better UX
      if (!category) {
        handleClose();
      }
      if (category === 'Assignment Sheet') {
        const existingFiles = sources.filter(doc => doc.category === 'Assignment Sheet');
        if (existingFiles.length > 0) {
          showSnackbarMessage("Only one assignment sheet can be uploaded at a time");
          return;
        }
      }

      const uploadedDocument = prepDocument({
        type: 'UploadedDocument',
        smartNoteId: smartNote.id,
        parentId: smartNote.id,
        fileName: file.name,
        file: file,
        status: 'PENDING' // Explicitly set initial status
      });
      // Dispatch immediately to show the document in the UI with spinner
      uploadedDocumentsDispatch({ type: 'CREATE_UPLOADED_DOCUMENT', uploadedDocument: uploadedDocument });

      // Create the source immediately, before uploading, so it appears in the source list right away
      const source = prepDocument({
        type: 'Source',
        sourceType: 'UploadedDocument',
        smartNoteId: smartNote.id,
        parentId: smartNote.id,
        sourceId: uploadedDocument.id,
        category: category,
        selected: true
      });

      try {
        const createdSource = await createSource(teamName, assistantName, source);
        sourcesDispatch({ type: 'CREATE_SOURCE', source: createdSource });
        // Call SmartNote update API to refresh updatedAt
        updateUpdatedAt(teamName, assistantName, smartNote.id);
      } catch (sourceError) {
        console.error(`Error creating source:`, sourceError);
      }

      // Now upload the document in the background
      try {
        // Upload the document to be indexed (this happens in the background after dialog is closed and source is created)        
        await uploadToIndexAndBlob(teamName, assistantName, uploadedDocument);
      } catch (error) {
        console.error(`Error processing document:`, error);
        // Update local state to show error
        const erroredDocument = { ...uploadedDocument, status: 'ERROR' };
        uploadedDocumentsDispatch({ type: 'UPDATE_UPLOADED_DOCUMENT', uploadedDocument: erroredDocument });
      }
    } else {
      // Close the dialog if no file was selected
      handleClose();
    }
  };

  const showSnackbarMessage = (message, severity = 'error') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const onDrop = useCallback((acceptedFiles, category) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      // If there are multiple files, we'll handle them one by one
      // But close the dialog immediately after the first file is processed

      // Process the first file and close the dialog
      handleFileChange(acceptedFiles[0], category);

      // Process any additional files in the background without keeping the dialog open
      if (acceptedFiles.length > 1) {

        // Small delay to ensure first file processing has started
        setTimeout(() => {
          for (let i = 1; i < acceptedFiles.length; i++) {
            handleFileChange(acceptedFiles[i], category);
          }
        }, 100);
      }
    }
    // Don't close dialog when no files are accepted - let user see the rejection warning
  }, [handleFileChange]);

  const onDropRejected = useCallback((fileRejections) => {
    if (fileRejections && fileRejections.length > 0) {
      const rejectedFile = fileRejections[0].file;
      const fileExtension = rejectedFile.name.toLowerCase().split('.').pop();

      if (fileExtension === 'doc') {
        showSnackbarMessage("Legacy .doc files are not supported. Please convert to .docx format and try again.", 'warning');
      } else {
        showSnackbarMessage(`File type ".${fileExtension}" is not supported. Please upload a supported file type.`, 'error');
      }
    }
  }, [showSnackbarMessage]);

  const { getRootProps: getAssignmentSheetProps, getInputProps: getAssignmentSheetInputProps, isDragActive: isAssignmentSheetDragActive } = useDropzone({
    onDrop: (files) => onDrop(files, 'Assignment Sheet'),
    onDropRejected: onDropRejected,
    maxFiles: 1,
    multiple: false,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'] }
  });

  const { getRootProps: getTestCaseTemplateProps, getInputProps: getTestCaseTemplateInputProps, isDragActive: isTestCaseTemplateDragActive } = useDropzone({
    onDrop: (files) => onDrop(files, 'Test Case Template'),
    onDropRejected: onDropRejected,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xlsm'] }
  });

  const { getRootProps: getLettersProps, getInputProps: getLettersInputProps, isDragActive: isLettersDragActive } = useDropzone({
    onDropRejected: onDropRejected,
    onDrop: (files) => onDrop(files, 'Letter'),
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
  });

  const { getRootProps: getNotesProps, getInputProps: getNotesInputProps, isDragActive: isNotesDragActive } = useDropzone({
    onDropRejected: onDropRejected,
    onDrop: (files) => onDrop(files, 'Uploaded Note'),
    accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => onDrop(files, getCategoryName()),
    onDropRejected: onDropRejected,
    accept: acceptedFileTypes
  });

  // This assigns the category property to the UploadedDocument document in the DB
  const getCategoryName = () => {
    switch (selectedUserAssistant?.name) {
      case 'document-management-shared-service':
        return 'Additional Source';
      default:
        return null;
    }
  }

  return (
    <>
      {
        // NOTE: If we start adding additional assistants that will customize the drop zones. We should change this
        // to use named components, and just pass props down.
        selectedUserAssistant?.name === 'document-management-shared-service' ?
          (<Grid2 container spacing={2} sx={{ mt: 2, mb: 2, justifyContent: 'space-between' }}>
            <Grid2 size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                {...getAssignmentSheetProps()}
                component="form"
                sx={{
                  border: `2px ${assignmentSheet ? 'solid #4caf50' : 'dashed gray'}`,
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  padding: 4,
                  textAlign: 'center',
                  backgroundColor: (theme) => isAssignmentSheetDragActive ? (theme.palette.mode === 'light' ? '#f0f0f0' : '#0D1C3D') : 'transparent',
                }}
              >
                <input {...getAssignmentSheetInputProps()} />
                <IconButton color={assignmentSheet ? "success" : "primary"} component="span" sx={{ fontSize: '48px' }}>
                  <CloudUploadOutlinedIcon fontSize="inherit" />
                </IconButton>
                <Typography variant="h6">Assignment Sheet</Typography>
                {assignmentSheet ? (
                  <Typography variant="body2">{assignmentSheet.name || assignmentSheet.fileName}</Typography>
                ) : (
                  <>
                    <Typography variant="body2">Drag & drop or choose a file</Typography>
                    <Typography variant="caption" display="block" sx={{ marginTop: 1 }}>
                      This must be the assignment sheet Excel document.
                    </Typography>
                    <Typography variant="caption" display="block">
                      (Max: 1 file)
                    </Typography>
                  </>
                )}
              </Box>
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                {...getTestCaseTemplateProps()}
                component="form"
                sx={{
                  border: `2px ${testCaseTemplates && testCaseTemplates.length ? 'solid #4caf50' : 'dashed gray'}`,
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  padding: 4,
                  textAlign: 'center',
                  backgroundColor: (theme) => isTestCaseTemplateDragActive ? (theme.palette.mode === 'light' ? '#f0f0f0' : '#0D1C3D') : 'transparent',
                }}
              >
                <input {...getTestCaseTemplateInputProps()} />
                <IconButton color={testCaseTemplates && testCaseTemplates.length ? "success" : "primary"} component="span" sx={{ fontSize: '48px' }}>
                  <CloudUploadOutlinedIcon fontSize="inherit" />
                </IconButton>
                <Typography variant="h6">Test Case Template</Typography>
                {testCaseTemplates && testCaseTemplates.length > 0 ? (
                  testCaseTemplates.map(template => (
                    <Typography key={template.name || template.fileName} variant="body2">{template.name || template.fileName}</Typography>
                  ))
                ) : (
                  <>
                    <Typography variant="body2">Drag & drop or choose a file</Typography>
                    <Typography variant="caption" display="block" sx={{ marginTop: 1 }}>
                      Supported: Excel
                    </Typography>
                  </>
                )}
              </Box>
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                {...getLettersProps()}
                component="form"
                sx={{
                  border: `2px ${letters && letters.length ? 'solid #4caf50' : 'dashed gray'}`,
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  padding: 4,
                  textAlign: 'center',
                  backgroundColor: (theme) => isLettersDragActive ? (theme.palette.mode === 'light' ? '#f0f0f0' : '#0D1C3D') : 'transparent',
                }}
              >
                <input {...getLettersInputProps()} />
                <IconButton color={letters && letters.length ? "success" : "primary"} component="span" sx={{ fontSize: '48px' }}>
                  <CloudUploadOutlinedIcon fontSize="inherit" />
                </IconButton>
                <Typography variant="h6">Letters</Typography>
                {letters && letters.length > 0 ? (
                  letters.map(letter => (
                    <Typography key={letter.name || letter.fileName} variant="body2">{letter.name || letter.fileName}</Typography>
                  ))
                ) : (
                  <>
                    <Typography variant="body2">Drag & drop or choose a file</Typography>
                    <Typography variant="caption" display="block" sx={{ marginTop: 1 }}>
                      Supported: Word
                    </Typography>
                  </>
                )}
              </Box>
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                {...getNotesProps()}
                component="form"
                sx={{
                  border: `2px ${notes && notes.length ? 'solid #4caf50' : 'dashed gray'}`,
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  padding: 4,
                  textAlign: 'center',
                  backgroundColor: (theme) => isNotesDragActive ? (theme.palette.mode === 'light' ? '#f0f0f0' : '#0D1C3D') : 'transparent',
                }}
              >
                <input {...getNotesInputProps()} />
                <IconButton color={notes && notes.length ? "success" : "primary"} component="span" sx={{ fontSize: '48px' }}>
                  <CloudUploadOutlinedIcon fontSize="inherit" />
                </IconButton>
                <Typography variant="h6">Notes</Typography>
                {notes && notes.length > 0 ? (
                  notes.map(note => (
                    <Typography key={note.name || note.fileName} variant="body2">{note.name || note.fileName}</Typography>
                  ))
                ) : (
                  <>
                    <Typography variant="body2">Drag & drop or choose a file</Typography>
                    <Typography variant="caption" display="block" sx={{ marginTop: 1 }}>
                      Supported: Word
                    </Typography>
                  </>
                )}
              </Box>
            </Grid2>
            <Grid2 size={{ xs: 12 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box
                {...getRootProps()}
                component="form"
                sx={{
                  border: '2px dashed gray',
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  padding: 4,
                  textAlign: 'center',
                  backgroundColor: (theme) => isDragActive ? (theme.palette.mode === 'light' ? '#f0f0f0' : '#0D1C3D') : 'transparent',
                }}
              >
                <input {...getInputProps()} />
                <IconButton color="primary" component="span" sx={{ fontSize: '48px' }}>
                  <CloudUploadOutlinedIcon fontSize="inherit" />
                </IconButton>
                <Typography variant="h6">Additional Sources</Typography>
                <Typography variant="body2">Drag & drop or choose a file to upload</Typography>
                <Typography variant="caption" display="block" sx={{ marginTop: 1 }}>
                  Supported file types: MS Word (with images), Excel, PowerPoint (with images), PDF, text, XML, and images (PNG, JPG, JPEG, WEBP, HEIC, TIFF)
                </Typography>
              </Box>
            </Grid2>
          </Grid2>)
          : (
            <Box
              {...getRootProps()}
              component="form"
              sx={{
                border: '2px dashed gray',
                borderRadius: '8px',
                padding: 4,
                textAlign: 'center',
                marginTop: 2,
                marginBottom: 2,
                backgroundColor: (theme) => isDragActive ? (theme.palette.mode === 'light' ? '#f0f0f0' : '#0D1C3D') : 'transparent',
              }}
            >
              <input {...getInputProps()} />
              <IconButton color="primary" component="span" sx={{ fontSize: '48px' }}>
                <CloudUploadOutlinedIcon fontSize="inherit" />
              </IconButton>
              <Typography variant="h6">Upload sources</Typography>
              <Typography variant="body2">Drag & drop or choose a file to upload</Typography>
              <Typography variant="caption" display="block" sx={{ marginTop: 2 }}>
                Supported file types: MS Word (with images), Excel, PowerPoint (with images), PDF, text, XML, and images (PNG, JPG, JPEG, WEBP, HEIC, TIFF)
              </Typography>
            </Box>)
      }
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default AddSourceDropZones;
