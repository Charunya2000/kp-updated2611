'use client';

import React, { useMemo, useState } from 'react';
import { Box, Typography, Select, MenuItem, Button, Paper } from '@mui/material';
import { prepDocument } from '@/app/clientServices/insertDocument';
import { useParams } from 'next/navigation';
import {
  createGeisingerConfigContextDocument,
  getGeisingerConfigContextDocuments,
  updateGeisingerConfigContextDocumentById,
  deleteGeisingerConfigContextDocumentById,
  exportGeisingerConfigDocuments,
  importGeisingerConfigDocuments,
} from '@/app/clientServices/geisingerConfigService';

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function parseJsonObjectSafe(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return undefined;

  try {
    const direct = JSON.parse(raw);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct;
    }
  } catch {
    // fall through to fenced block extraction
  }

  const fenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!fenceMatch?.[1]) return undefined;

  try {
    const fenced = JSON.parse(fenceMatch[1]);
    if (fenced && typeof fenced === 'object' && !Array.isArray(fenced)) {
      return fenced;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function isJsonTitle(value = '') {
  return normalizeString(value).toLowerCase().endsWith('.json');
}

function formatJsonTextSafe(value = '') {
  const raw = String(value || '');
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      formatted: '',
      isValid: true,
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return {
      formatted: JSON.stringify(parsed, null, 2),
      isValid: true,
    };
  } catch {
    return {
      formatted: raw,
      isValid: false,
    };
  }
}

function getEngineFamilyFromDoc(doc = {}) {
  const config = parseJsonObjectSafe(doc?.documentText);
  if (!config) return 'service3';

  const prepEngine = normalizeString(config?.engines?.prepEngine || config?.prepEngine).toLowerCase();
  const conversationEngine = normalizeString(config?.engines?.conversationEngine || config?.conversationEngine).toLowerCase();
  const comparisonEngine = normalizeString(config?.engines?.comparisonEngine || config?.comparisonEngine).toLowerCase();

  const usesFirstPrinciples = [prepEngine, conversationEngine, comparisonEngine].includes('first-principles');
  return usesFirstPrinciples ? 'first-principles' : 'service3';
}

function toEditorModel(doc = {}) {
  return {
    title: doc.title || doc.name || '',
    documentText: doc.documentText || '',
    inferredLob: doc.inferredLob || '',
    purpose: doc.purpose || '',
    collectionName: doc.collectionName || '',
  };
}

function documentMatchesEngineFilter(doc, engineFilter) {
  if (engineFilter === 'all') return true;
  return getEngineFamilyFromDoc(doc) === engineFilter;
}

export default function GeisingerConfigManager() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');

  const [editText, setEditText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [editInferredLob, setEditInferredLob] = useState('');
  const [originalInferredLob, setOriginalInferredLob] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [originalPurpose, setOriginalPurpose] = useState('');
  const [editCollectionName, setEditCollectionName] = useState('');
  const [originalCollectionName, setOriginalCollectionName] = useState('');
  const [jsonTextHasError, setJsonTextHasError] = useState(false);

  const [filterOnCollectionName, setFilterOnCollectionName] = useState(false);
  const [engineFilter, setEngineFilter] = useState('all');

  const [exportPath, setExportPath] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [importErrors, setImportErrors] = useState([]);

  const { teamName } = useParams();
  const isJsonDocumentTitle = useMemo(() => isJsonTitle(editTitle), [editTitle]);

  const visibleDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (filterOnCollectionName && doc.collectionName !== editCollectionName) {
        return false;
      }
      return documentMatchesEngineFilter(doc, engineFilter);
    });
  }, [documents, filterOnCollectionName, editCollectionName, engineFilter]);

  const applyEditorModel = (doc = {}) => {
    const model = toEditorModel(doc);

    if (isJsonTitle(model.title)) {
      const jsonState = formatJsonTextSafe(model.documentText);
      setEditText(jsonState.formatted);
      setOriginalText(jsonState.formatted);
      setJsonTextHasError(!jsonState.isValid);
    } else {
      setEditText(model.documentText);
      setOriginalText(model.documentText);
      setJsonTextHasError(false);
    }

    setEditTitle(model.title);
    setOriginalTitle(model.title);
    setEditInferredLob(model.inferredLob);
    setOriginalInferredLob(model.inferredLob);
    setEditPurpose(model.purpose);
    setOriginalPurpose(model.purpose);
    setEditCollectionName(model.collectionName);
    setOriginalCollectionName(model.collectionName);
  };

  const resetEditor = () => {
    setSelectedDocId('');
    setEditText('');
    setOriginalText('');
    setEditTitle('');
    setOriginalTitle('');
    setEditInferredLob('');
    setOriginalInferredLob('');
    setEditPurpose('');
    setOriginalPurpose('');
    setEditCollectionName('');
    setOriginalCollectionName('');
    setJsonTextHasError(false);
  };

  const handleTitleChange = (event) => {
    const nextTitle = event.target.value;
    setEditTitle(nextTitle);

    if (!isJsonTitle(nextTitle)) {
      setJsonTextHasError(false);
      return;
    }

    const jsonState = formatJsonTextSafe(editText);
    setEditText(jsonState.formatted);
    setJsonTextHasError(!jsonState.isValid);
  };

  const handleDocumentTextChange = (event) => {
    const nextText = event.target.value;
    setEditText(nextText);

    if (!isJsonDocumentTitle) {
      setJsonTextHasError(false);
      return;
    }

    const jsonState = formatJsonTextSafe(nextText);
    setJsonTextHasError(!jsonState.isValid);
  };

  const handleDocumentTextBlur = () => {
    if (!isJsonDocumentTitle) return;

    const jsonState = formatJsonTextSafe(editText);
    setEditText(jsonState.formatted);
    setJsonTextHasError(!jsonState.isValid);
  };

  const handleFormatJson = () => {
    if (!isJsonDocumentTitle) return;

    const jsonState = formatJsonTextSafe(editText);
    setEditText(jsonState.formatted);
    setJsonTextHasError(!jsonState.isValid);
  };

  const fetchDocuments = async () => {
    try {
      const docs = await getGeisingerConfigContextDocuments(teamName, { type: 'GeisingerConfig' });
      setDocuments(docs);

      if (docs.length === 0) {
        resetEditor();
        return;
      }

      const firstVisible = docs.find((doc) => {
        const matchesCollection = filterOnCollectionName ? doc.collectionName === editCollectionName : true;
        return matchesCollection && documentMatchesEngineFilter(doc, engineFilter);
      }) || docs[0];

      setSelectedDocId(firstVisible.id);
      applyEditorModel(firstVisible);
    } catch (err) {
      console.error('Error fetching Geisinger config documents:', err);
      setDocuments([]);
      resetEditor();
    }
  };

  React.useEffect(() => {
    fetchDocuments();
  }, []);

  React.useEffect(() => {
    if (!visibleDocuments.length) {
      if (selectedDocId) {
        resetEditor();
      }
      return;
    }

    const stillVisible = visibleDocuments.some((doc) => doc.id === selectedDocId);
    if (!stillVisible) {
      const firstDoc = visibleDocuments[0];
      setSelectedDocId(firstDoc.id);
      applyEditorModel(firstDoc);
    }
  }, [visibleDocuments, selectedDocId]);

  const handleSelectDoc = (event) => {
    const docId = event.target.value;
    const doc = documents.find((item) => item.id === docId);
    if (!doc) return;

    setSelectedDocId(docId);
    applyEditorModel(doc);
  };

  const handleDelete = async () => {
    if (!selectedDocId) return;

    try {
      await deleteGeisingerConfigContextDocumentById(teamName, selectedDocId);
      setDocuments((previous) => previous.filter((doc) => doc.id !== selectedDocId));
      resetEditor();
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      let items;
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && Array.isArray(parsed.items)) {
        items = parsed.items;
      } else if (parsed && Array.isArray(parsed.data)) {
        items = parsed.data;
      } else {
        throw new Error('JSON must be an array or object with items[]');
      }

      setLastImport({ pendingItems: items, fileName: file.name, ready: true });
      setImportErrors([]);
    } catch (error) {
      setLastImport(null);
      setImportErrors([{ error: 'Parse error', detail: error.message }]);
    }
  };

  const handleImport = async () => {
    if (!lastImport?.pendingItems) return;

    setIsImporting(true);
    setImportErrors([]);

    try {
      const result = await importGeisingerConfigDocuments(teamName, lastImport.pendingItems, { replace: true });
      setLastImport({ ...lastImport, ...result, completedAt: new Date().toISOString() });
      if (result.validationErrors) {
        setImportErrors(result.validationErrors);
      }
      await fetchDocuments();
    } catch (err) {
      setImportErrors([{ error: 'Import failed', detail: err.message }]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (isDeletingAll || documents.length === 0) return;

    const confirmed = window.confirm(`Delete all ${documents.length} Geisinger config document(s) for team ${teamName}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setIsDeletingAll(true);
      const docs = await getGeisingerConfigContextDocuments(teamName, { type: 'GeisingerConfig' });
      await Promise.all((Array.isArray(docs) ? docs : []).map((doc) => deleteGeisingerConfigContextDocumentById(teamName, doc.id)));

      setDocuments([]);
      resetEditor();
      setLastImport(null);
      setImportErrors([]);
      setImportFileName('');
    } catch (err) {
      console.error('Error deleting all config documents:', err);
      alert(`Delete all failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsDeletingAll(false);
      await fetchDocuments();
    }
  };

  const handleExportAll = async () => {
    try {
      setIsExporting(true);
      const params = {
        filename: exportPath || 'geisinger-config-export.json',
        type: 'GeisingerConfig',
      };
      const result = await exportGeisingerConfigDocuments(teamName, params);

      if (result?.downloadUrl) {
        setLastExport({ ...result, exportedClientAt: new Date().toISOString() });
        const a = document.createElement('a');
        a.href = result.downloadUrl;
        a.download = result.originalRequestedFilename || 'geisinger-config-export.json';
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 2000);
      } else {
        console.warn('Export completed but no downloadUrl returned', result);
      }
    } catch (err) {
      console.error('Error exporting Geisinger config documents:', err);
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = async () => {
    if (editTitle.trim() === '' || editText.trim() === '') {
      return;
    }

    let textToPersist = editText;
    if (isJsonDocumentTitle) {
      const jsonState = formatJsonTextSafe(editText);
      if (!jsonState.isValid) {
        alert('Document Text is not valid JSON. Please fix JSON syntax before saving.');
        setJsonTextHasError(true);
        return;
      }

      textToPersist = jsonState.formatted;
      setEditText(jsonState.formatted);
      setJsonTextHasError(false);
    }

    const docObj = prepDocument({
      type: 'GeisingerConfig',
      title: editTitle,
      documentText: textToPersist,
      inferredLob: editInferredLob,
      purpose: editPurpose,
      collectionName: editCollectionName,
    });

    try {
      if (!selectedDocId) {
        await createGeisingerConfigContextDocument(teamName, docObj);
        setDocuments((previous) => [...previous, docObj]);
        setSelectedDocId(docObj.id);
      } else {
        await updateGeisingerConfigContextDocumentById(teamName, selectedDocId, docObj);
        setDocuments((previous) => previous.map((doc) => (doc.id === selectedDocId ? docObj : doc)));
        setSelectedDocId(docObj.id);
      }

      setOriginalText(textToPersist);
      setOriginalTitle(editTitle);
      setOriginalInferredLob(editInferredLob);
      setOriginalPurpose(editPurpose);
      setOriginalCollectionName(editCollectionName);
    } catch (err) {
      alert(`Save failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    setEditText(originalText);
    setEditTitle(originalTitle);
    setEditInferredLob(originalInferredLob);
    setEditPurpose(originalPurpose);
    setEditCollectionName(originalCollectionName);
    if (isJsonTitle(originalTitle)) {
      const jsonState = formatJsonTextSafe(originalText);
      setJsonTextHasError(!jsonState.isValid);
    } else {
      setJsonTextHasError(false);
    }
  };

  const handleReset = () => {
    const doc = documents.find((item) => item.id === selectedDocId);
    if (!doc) return;
    applyEditorModel(doc);
  };

  const handleNewDocument = () => {
    resetEditor();
  };

  return (
    <Paper sx={{ p: 4, maxWidth: '80%', margin: '32px auto' }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Edit Context Documents
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Select Document:
          </Typography>
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <label>
              <input
                type="checkbox"
                checked={filterOnCollectionName}
                onChange={(event) => setFilterOnCollectionName(event.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Filter on Current Collection Name
            </label>
            <Select
              size="small"
              value={engineFilter}
              onChange={(event) => setEngineFilter(event.target.value)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="all">Engine Config Filter: All</MenuItem>
              <MenuItem value="service3">Engine Config Filter: service3</MenuItem>
              <MenuItem value="first-principles">Engine Config Filter: first-principles</MenuItem>
            </Select>
          </Box>
          <Select
            value={selectedDocId}
            onChange={handleSelectDoc}
            sx={{ minWidth: 240 }}
          >
            {visibleDocuments.map((doc) => (
              <MenuItem key={doc.id} value={doc.id}>
                {doc.title || doc.name || doc.id}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Button variant="contained" color="secondary" onClick={handleNewDocument}>
          New Document
        </Button>
        <Button variant="outlined" color="primary" onClick={fetchDocuments} sx={{ ml: 2 }}>
          Refresh
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={handleDeleteAll}
          disabled={isDeletingAll || documents.length === 0}
          sx={{ ml: 2 }}
        >
          {isDeletingAll ? 'Deleting All...' : 'Delete All Config'}
        </Button>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Export All Geisinger Config Documents
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Optional output file name (e.g., geisinger-config.json)"
            value={exportPath}
            onChange={(event) => setExportPath(event.target.value)}
            style={{
              flexGrow: 1,
              fontSize: '1rem',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px solid #ccc',
              padding: '8px',
              boxSizing: 'border-box',
            }}
          />
          <Button
            variant="contained"
            color="secondary"
            onClick={handleExportAll}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export All'}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Exports all GeisingerConfig documents to blob storage and opens a 15-minute download link.
        </Typography>
        <Box sx={{ mt: 1 }}>
          {lastExport ? (
            <a
              href={lastExport.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.8rem' }}
            >
              Download last export ({lastExport.count} doc{lastExport.count === 1 ? '' : 's'}) - expires in ~15 min
            </a>
          ) : (
            <span style={{ fontSize: '0.7rem', color: '#666' }}>
              (No export yet this session)
            </span>
          )}
        </Box>
      </Box>

      <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Import / Upsert Geisinger Config Documents
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, alignItems: 'center' }}>
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleImportFileChange}
            disabled={isImporting}
          />
          <Button
            variant="contained"
            color="warning"
            onClick={handleImport}
            disabled={isImporting || !lastImport?.pendingItems}
          >
            {isImporting ? 'Importing...' : 'Import / Upsert'}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Selecting a JSON file (array or {'{ items: [] }'}) will upsert documents by (title, collectionName, inferredLob, purpose).
        </Typography>
        {!!importFileName && (
          <Typography variant="caption" color="text.secondary">
            Selected import file: {importFileName}
          </Typography>
        )}
        {lastImport?.completedAt && (
          <Typography variant="caption" color={importErrors.length ? 'error' : 'success.main'}>
            Upsert complete: inserted {lastImport.inserted ?? 0}, updated {lastImport.updated ?? 0} / {lastImport.attempted ?? lastImport.pendingItems?.length} (deleted {lastImport.deleted ?? 0}) at {new Date(lastImport.completedAt).toLocaleTimeString()}
          </Typography>
        )}
        {importErrors.length > 0 && (
          <Box sx={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #eee', p: 1, borderRadius: '4px', background: '#fff' }}>
            {importErrors.slice(0, 10).map((err, idx) => (
              <Typography key={idx} variant="caption" color="error" display="block">
                {err.index !== undefined ? `#${err.index}: ` : ''}
                {err.error}
                {err.detail ? ` - ${err.detail}` : ''}
              </Typography>
            ))}
            {importErrors.length > 10 && (
              <Typography variant="caption" color="error">
                ...and {importErrors.length - 10} more
              </Typography>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Document Title:
        </Typography>
        <Box sx={{ mb: 2 }}>
          <input
            type="text"
            value={editTitle}
            onChange={handleTitleChange}
            style={{
              width: '100%',
              fontSize: '1.1rem',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px solid #ccc',
              padding: '8px',
              marginBottom: '8px',
              boxSizing: 'border-box',
            }}
          />
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Collection Name:
        </Typography>
        <Box sx={{ mb: 2 }}>
          <input
            type="text"
            value={editCollectionName}
            onChange={(event) => setEditCollectionName(event.target.value)}
            style={{
              width: '100%',
              fontSize: '1.1rem',
              background: '#fafafa',
              borderRadius: '4px',
              border: '1px solid #ccc',
              padding: '8px',
              marginBottom: '8px',
              boxSizing: 'border-box',
            }}
          />
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Inferred LOB:
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Select
            value={editInferredLob}
            onChange={(event) => setEditInferredLob(event.target.value)}
            sx={{ width: '100%', fontSize: '1.1rem', background: '#fafafa', borderRadius: '4px', marginBottom: '8px' }}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="CHIP">CHIP</MenuItem>
            <MenuItem value="Marketplace">Marketplace</MenuItem>
            <MenuItem value="Medicare">Medicare</MenuItem>
            <MenuItem value="Medicaid">Medicaid</MenuItem>
            <MenuItem value="Commercial">Commercial</MenuItem>
          </Select>
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Purpose:
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Select
            value={editPurpose}
            onChange={(event) => setEditPurpose(event.target.value)}
            sx={{ width: '100%', fontSize: '1.1rem', background: '#fafafa', borderRadius: '4px', marginBottom: '8px' }}
          >
            <MenuItem value="Background">Background</MenuItem>
            <MenuItem value="UserIntent">User Intent</MenuItem>
            <MenuItem value="SearchConfig">Search Config</MenuItem>
            <MenuItem value="ChatCompletionConfig">Chat Completion Config</MenuItem>
            <MenuItem value="FormatConfig">Format Config</MenuItem>
            <MenuItem value="SummarizeConfig">Summarize Config</MenuItem>
            <MenuItem value="GeneralConfig">General Config</MenuItem>
            <MenuItem value="DatabaseSearch">Database Search</MenuItem>
          </Select>
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Document Text:
        </Typography>
        {isJsonDocumentTitle && (
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color={jsonTextHasError ? 'error' : 'text.secondary'} sx={{ display: 'block' }}>
              JSON editor mode enabled for titles ending in .json. Content auto-formats on blur/save.
              {jsonTextHasError ? ' Current content is not valid JSON.' : ''}
            </Typography>
            <Button
              variant="action"
              size="small"
              onClick={handleFormatJson}
            >
              Format JSON
            </Button>
          </Box>
        )}
        <Box sx={{ position: 'relative', width: '100%', height: 600, mb: 2 }}>
          <textarea
            value={editText}
            onChange={handleDocumentTextChange}
            onBlur={handleDocumentTextBlur}
            style={{
              width: '100%',
              height: '100%',
              fontFamily: 'monospace',
              fontSize: '1rem',
              background: '#fafafa',
              borderRadius: '4px',
              border: jsonTextHasError ? '1px solid #d32f2f' : '1px solid #ccc',
              padding: '8px',
              resize: 'none',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Button
          variant="outlined"
          color="primary"
          onClick={handleReset}
        >
          Reset
        </Button>
        <Box>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDelete}
            sx={{ mr: 2 }}
            disabled={!selectedDocId}
          >
            Delete
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleCancel}
            sx={{ mr: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
          >
            Save
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
