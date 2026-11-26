'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import {
  createEdiCompanionGuideRunConfig,
  createEdiCompanionGuideTemplate,
  getSavedEditableCompanionGuide,
  getEdiWorkbenchParseJobStatus,
  ingestEditableCompanionGuide,
  listEdiCompanionGuideRunConfigs,
  listEdiCompanionGuideTemplates,
  listSavedEditableCompanionGuides,
  refreshEdiWorkbenchReportDownload,
  saveEditableCompanionGuide,
  startEdiWorkbenchParseJob,
  updateEdiCompanionGuideTemplate,
  updateEdiCompanionGuideRunConfig,
  uploadEdiWorkbenchFile,
} from '@/app/clientServices/ediWorkbenchService';
import {
  buildEdiWorkbenchParserOptions,
  DEFAULT_SUBSCRIBER_BATCH_SIZE,
  isValidSubscriberBatchSizeInput,
} from '@/app/utils/ediWorkbenchParserOptions';
import CompanionGuideEditor from './CompanionGuideEditor';

const PARSE_POLL_INTERVAL_MS = 10000;
const MAX_POLL_ERROR_RETRIES = 30;
const EDITABLE_GUIDE_ENABLED = process.env.NEXT_PUBLIC_EDI_COMPANION_GUIDE_EDITOR_ENABLED !== 'false';

// Temporarily hide the companion template + run config management UI.
const SHOW_TEMPLATE_CONFIG_UI = false;

function getFriendlyStatus(status) {
  switch (status) {
    case 'queued':
      return 'Waiting';
    case 'running':
      return 'In progress';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    default:
      return 'Working';
  }
}

function buildReadableTrail(path) {
  void path;
  // Do not render index-based fallback tokens (e.g., "Transaction 3") because
  // path indexes are implementation-specific and can be misleading to users.
  return [];
}

function getLocationTrail(invalidElement) {
  if (Array.isArray(invalidElement?.locatorTrail) && invalidElement.locatorTrail.length > 0) {
    return invalidElement.locatorTrail;
  }

  return buildReadableTrail(invalidElement?.path);
}

function getInvalidSubscriberIdentity(invalidElement) {
  const subscriberSsn = String(invalidElement?.subscriberSsn || '').replace(/\D/g, '');
  const parsedIndex = Number(invalidElement?.subscriberIndex);

  return {
    subscriberSsn: subscriberSsn.length === 9 ? subscriberSsn : null,
    subscriberIndex: Number.isInteger(parsedIndex) && parsedIndex > 0 ? parsedIndex : null,
  };
}

function buildReadableReason(reason, failedValue = null, valueProvided = undefined) {
  if (reason === null || reason === undefined) {
    return null;
  }

  const reasonText = typeof reason === 'string'
    ? reason.trim()
    : JSON.stringify(reason);

  if (!reasonText) {
    return null;
  }

  const hasReceivedValue = valueProvided === true
    ? failedValue !== null && failedValue !== undefined
    : valueProvided !== false
      && failedValue !== null
      && failedValue !== undefined
      && String(failedValue).length > 0;

  const isEdnLike = reasonText.startsWith('{:') && reasonText.includes(':rule');
  if (!isEdnLike) {
    const details = [];
    if (hasReceivedValue) {
      details.push(`Received value: ${failedValue}`);
    } else {
      details.push(`Received value: <no value was provided in the EDI file>`);
    }

    return {
      summary: reasonText,
      details,
    };
  }

  const details = [];
  const ruleValidMatch = reasonText.match(/:rule\s+\{[^}]*:valid\s+(true|false)/i);
  const allowedMatch = reasonText.match(/:allowed\s+\[([^\]]*)\]/i);
  const lookupAppliedMatch = reasonText.match(/:lookup-applied\s+(true|false)/i);
  const lookupValidMatch = reasonText.match(/:lookup\s+\{[^}]*:valid\s+(true|false)/i);
  const lookupStatusMatch = reasonText.match(/:status\s+:([A-Za-z0-9_-]+)/i);

  const ruleFailed = ruleValidMatch?.[1]?.toLowerCase() === 'false';
  const lookupApplied = lookupAppliedMatch?.[1]?.toLowerCase() === 'true';
  const lookupValid = lookupValidMatch?.[1]?.toLowerCase() === 'true';
  const lookupStatus = lookupStatusMatch?.[1] || null;

  if (allowedMatch?.[1]) {
    const allowedValues = Array.from(
      new Set(
        (allowedMatch[1].match(/"([^"]+)"/g) || [])
          .map((token) => token.replaceAll('"', '').trim())
          .filter(Boolean),
      ),
    );

    if (allowedValues.length > 0) {
      details.push(`Allowed value(s): ${allowedValues.join(', ')}`);
    }
  }

  if (hasReceivedValue) {
    details.unshift(`Received value: ${failedValue}`);
  } else {
    details.unshift(`Received value: <no value was provided in the EDI file>`);
  }

  if (lookupAppliedMatch || lookupStatusMatch || lookupValidMatch) {
    const parts = [];
    parts.push(`applied=${lookupApplied ? 'yes' : 'no'}`);
    if (lookupStatus) {
      parts.push(`status=${lookupStatus}`);
    }
    if (lookupValidMatch) {
      parts.push(`valid=${lookupValid ? 'yes' : 'no'}`);
    }
    details.push(`Lookup: ${parts.join(', ')}`);
  }

  const summary = ruleFailed
    ? 'Rule check failed for this element.'
    : 'Validation failed for this element.';

  return {
    summary,
    details,
  };
}

async function uploadSingleFile({ file, fileCategory, teamName, assistantName, smartNoteId }) {
  const uploadDescriptor = await uploadEdiWorkbenchFile(teamName, assistantName, smartNoteId, file, fileCategory);

  return {
    container: uploadDescriptor.container,
    blobName: uploadDescriptor.blobName,
    fileName: uploadDescriptor.fileName,
    fileCategory: uploadDescriptor.fileCategory,
  };
}

async function snapshotFileForUpload(file) {
  if (!file) {
    return null;
  }

  const fileBuffer = await file.arrayBuffer();
  return new File([fileBuffer], file.name, {
    type: file.type || 'application/octet-stream',
    lastModified: Date.now(),
  });
}

const OVERRIDE_MODE = 'single-subscriber-overrides';

const EMPTY_STIPULATED_VALUES = {
  nm1: {
    NM101: '',
    NM102: '',
    NM103: '',
    NM104: '',
    NM105: '',
    NM106: '',
    NM107: '',
    NM108: '',
    NM109: '',
  },
  ref: {
    REF0F: '',
    REF1L: '',
    REFDX: '',
    REFZZ: '',
  },
};

const DEFAULT_PARSER_OPTIONS = {
  dbValidation: false,
  envName: 'dev',
  subscriberOnlyDbValidation: true,
  singleQueryDbValidation: true,
  compareSingleQueryVsLegacy: false,
  includeLookupSql: false,
  logMemory: false,
  subscriberBatchSize: DEFAULT_SUBSCRIBER_BATCH_SIZE,
};

function toBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on') {
      return true;
    }
    if (lowered === 'false' || lowered === '0' || lowered === 'no' || lowered === 'off') {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return fallback;
}

function normalizeParserOptions(parserOptions) {
  const source = parserOptions && typeof parserOptions === 'object'
    ? parserOptions
    : {};

  return {
    dbValidation: toBoolean(source.dbValidation, DEFAULT_PARSER_OPTIONS.dbValidation),
    envName: String(source.envName || DEFAULT_PARSER_OPTIONS.envName).trim() || DEFAULT_PARSER_OPTIONS.envName,
    subscriberOnlyDbValidation: toBoolean(source.subscriberOnlyDbValidation, DEFAULT_PARSER_OPTIONS.subscriberOnlyDbValidation),
    singleQueryDbValidation: toBoolean(source.singleQueryDbValidation, DEFAULT_PARSER_OPTIONS.singleQueryDbValidation),
    compareSingleQueryVsLegacy: toBoolean(source.compareSingleQueryVsLegacy, DEFAULT_PARSER_OPTIONS.compareSingleQueryVsLegacy),
    includeLookupSql: toBoolean(source.includeLookupSql, DEFAULT_PARSER_OPTIONS.includeLookupSql),
    logMemory: toBoolean(source.logMemory, DEFAULT_PARSER_OPTIONS.logMemory),
    subscriberBatchSize: source.subscriberBatchSize ?? DEFAULT_PARSER_OPTIONS.subscriberBatchSize,
  };
}

function normalizeStipulatedValuesForPayload(stipulatedValues) {
  if (!stipulatedValues || typeof stipulatedValues !== 'object') {
    return null;
  }

  const nm1Input = stipulatedValues.nm1 || {};
  const refInput = stipulatedValues.ref || {};
  const nm1 = {
    NM101: String(nm1Input.NM101 || '').trim(),
    NM102: String(nm1Input.NM102 || '').trim(),
    NM103: String(nm1Input.NM103 || '').trim(),
    NM104: String(nm1Input.NM104 || '').trim(),
    NM105: String(nm1Input.NM105 || '').trim(),
    NM106: String(nm1Input.NM106 || '').trim(),
    NM107: String(nm1Input.NM107 || '').trim(),
    NM108: String(nm1Input.NM108 || '').trim(),
    NM109: String(nm1Input.NM109 || '').replace(/\D/g, ''),
  };
  const ref = {
    REF0F: String(refInput.REF0F || '').replace(/\D/g, ''),
    REF1L: String(refInput.REF1L || '').trim(),
    REFDX: String(refInput.REFDX || '').trim(),
    REFZZ: String(refInput.REFZZ || '').trim(),
  };

  const hasValues = Object.values(nm1).some((value) => value) || Object.values(ref).some((value) => value);
  if (!hasValues) {
    return null;
  }

  return { nm1, ref };
}

export default function EdiWorkbenchExperience() {
  const { teamName, assistantName, id: smartNoteId } = useParams();

  const [companionFile, setCompanionFile] = useState(null);
  const [companionBlob, setCompanionBlob] = useState(null);
  const [originalGuide, setOriginalGuide] = useState(null);
  const [workingGuide, setWorkingGuide] = useState(null);
  const [editableGuideSupported, setEditableGuideSupported] = useState(null);
  const [efssPackageVersion, setEfssPackageVersion] = useState(null);
  const [modelGuideDiagnostics, setModelGuideDiagnostics] = useState([]);
  const [isIngestingGuide, setIsIngestingGuide] = useState(false);
  const [savedGuides, setSavedGuides] = useState([]);
  const [selectedSavedGuideId, setSelectedSavedGuideId] = useState('');
  const [isLoadingSavedGuide, setIsLoadingSavedGuide] = useState(false);
  const [isSavingGuide, setIsSavingGuide] = useState(false);
  const [ediFile, setEdiFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [parseProgressMessage, setParseProgressMessage] = useState('');
  const [overallJobPercent, setOverallJobPercent] = useState(0);
  const [parseServerStatus, setParseServerStatus] = useState('idle');
  const [parseJobId, setParseJobId] = useState(null);
  const [isRefreshingDownload, setIsRefreshingDownload] = useState(false);
  const [subscriberProgress, setSubscriberProgress] = useState(null);
  const [showTechnicalPaths, setShowTechnicalPaths] = useState(false);
  const [showUniqueElementErrors, setShowUniqueElementErrors] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [runConfigs, setRunConfigs] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedRunConfigId, setSelectedRunConfigId] = useState('');
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [runConfigNameInput, setRunConfigNameInput] = useState('');
  const [validationScopeMode, setValidationScopeMode] = useState('all-subscribers');
  const [singleSubscriberSsn, setSingleSubscriberSsn] = useState('');
  const [stipulatedValues, setStipulatedValues] = useState(EMPTY_STIPULATED_VALUES);
  const [treatSlashAsComma, setTreatSlashAsComma] = useState(true);
  const [dbValidationEnabled, setDbValidationEnabled] = useState(DEFAULT_PARSER_OPTIONS.dbValidation);
  const [parserEnvName, setParserEnvName] = useState(DEFAULT_PARSER_OPTIONS.envName);
  const [subscriberOnlyDbValidation, setSubscriberOnlyDbValidation] = useState(DEFAULT_PARSER_OPTIONS.subscriberOnlyDbValidation);
  const [includeLookupSql, setIncludeLookupSql] = useState(DEFAULT_PARSER_OPTIONS.includeLookupSql);
  const [logMemory, setLogMemory] = useState(DEFAULT_PARSER_OPTIONS.logMemory);
  const [subscriberBatchSizeInput, setSubscriberBatchSizeInput] = useState(String(DEFAULT_PARSER_OPTIONS.subscriberBatchSize));
  const [isLoadingTemplateData, setIsLoadingTemplateData] = useState(false);
  const isMountedRef = useRef(true);

  const handleCompanionFileChange = async (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      setCompanionFile(null);
      setCompanionBlob(null);
      setOriginalGuide(null);
      setWorkingGuide(null);
      setEditableGuideSupported(null);
      setEfssPackageVersion(null);
      setModelGuideDiagnostics([]);
      setSelectedSavedGuideId('');
      return;
    }

    try {
      const snapshot = await snapshotFileForUpload(nextFile);
      if (isMountedRef.current) {
        setCompanionFile(snapshot);
        setCompanionBlob(null);
        setOriginalGuide(null);
        setWorkingGuide(null);
        setEditableGuideSupported(null);
        setEfssPackageVersion(null);
        setModelGuideDiagnostics([]);
        setSelectedSavedGuideId('');
      }
    } catch {
      if (isMountedRef.current) {
        setErrorMessage('Failed to stage companion file for upload. Please reselect the file.');
      }
    }
  };

  const handleEdiFileChange = async (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) {
      setEdiFile(null);
      return;
    }

    try {
      const snapshot = await snapshotFileForUpload(nextFile);
      if (isMountedRef.current) {
        setEdiFile(snapshot);
      }
    } catch {
      if (isMountedRef.current) {
        setErrorMessage('Failed to stage EDI file for upload. Please reselect the file.');
      }
    }
  };

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const loadSavedGuides = async () => {
    try {
      const guides = await listSavedEditableCompanionGuides(teamName, assistantName, smartNoteId);
      if (isMountedRef.current) {
        setSavedGuides((guides || []).slice().reverse());
      }
    } catch (error) {
      if (isMountedRef.current) {
        setErrorMessage(error?.message || 'Failed to load saved companion guides.');
      }
    }
  };

  useEffect(() => {
    if (!EDITABLE_GUIDE_ENABLED) {
      return;
    }

    void loadSavedGuides();
  }, [teamName, assistantName, smartNoteId]);

  const handleSavedGuideChange = async (event) => {
    const guideId = event.target.value;
    setSelectedSavedGuideId(guideId);
    if (!guideId) {
      setCompanionBlob(null);
      setOriginalGuide(null);
      setWorkingGuide(null);
      setEditableGuideSupported(null);
      setEfssPackageVersion(null);
      setModelGuideDiagnostics([]);
      return;
    }

    setErrorMessage('');
    setIsLoadingSavedGuide(true);
    try {
      const record = await getSavedEditableCompanionGuide(
        teamName,
        assistantName,
        smartNoteId,
        guideId,
      );
      if (!record?.editableGuide || !record?.sourceArtifact?.container || !record?.sourceArtifact?.blobName) {
        throw new Error('Saved companion guide is missing its editable model or source file location');
      }

      if (!isMountedRef.current) {
        return;
      }

      const loadedGuide = structuredClone(record.editableGuide);
      setCompanionFile(null);
      setCompanionBlob({
        container: record.sourceArtifact.container,
        blobName: record.sourceArtifact.blobName,
        fileName: record.sourceArtifact.fileName || loadedGuide?.source?.name || 'Saved companion guide',
        fileCategory: 'companion',
      });
      setOriginalGuide(structuredClone(loadedGuide));
      setWorkingGuide(structuredClone(loadedGuide));
      setEditableGuideSupported(true);
      setEfssPackageVersion(record.efssPackageVersion || null);
      setModelGuideDiagnostics([]);
      setParseResult(null);
    } catch (error) {
      if (isMountedRef.current) {
        setSelectedSavedGuideId('');
        setErrorMessage(error?.message || 'Failed to load saved companion guide.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingSavedGuide(false);
      }
    }
  };

  const loadTemplateData = async (templateId = null) => {
    setIsLoadingTemplateData(true);
    try {
      const [nextTemplates, nextRunConfigs] = await Promise.all([
        listEdiCompanionGuideTemplates(teamName, assistantName, smartNoteId, false),
        listEdiCompanionGuideRunConfigs(teamName, assistantName, smartNoteId, templateId),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      setTemplates(nextTemplates || []);
      setRunConfigs(nextRunConfigs || []);
    } catch (error) {
      if (isMountedRef.current) {
        setErrorMessage(error?.message || 'Failed to load template and run config data.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingTemplateData(false);
      }
    }
  };

  useEffect(() => {
    if (!SHOW_TEMPLATE_CONFIG_UI) {
      return;
    }

    void loadTemplateData();
  }, [teamName, assistantName, smartNoteId]);

  useEffect(() => {
    if (!SHOW_TEMPLATE_CONFIG_UI || !selectedTemplateId) {
      return;
    }

    void loadTemplateData(selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }

    const selectedTemplate = templates.find((entry) => entry.id === selectedTemplateId);
    if (!selectedTemplate) {
      return;
    }

    setTreatSlashAsComma(selectedTemplate?.delimiterConfig?.treatSlashAsComma !== false);

    if (!selectedRunConfigId) {
      const nextParserOptions = normalizeParserOptions(selectedTemplate?.parserOptions);
      setDbValidationEnabled(nextParserOptions.dbValidation);
      setParserEnvName(nextParserOptions.envName);
      setSubscriberOnlyDbValidation(nextParserOptions.subscriberOnlyDbValidation);
      setIncludeLookupSql(nextParserOptions.includeLookupSql);
      setLogMemory(nextParserOptions.logMemory);
      setSubscriberBatchSizeInput(String(nextParserOptions.subscriberBatchSize));
    }
  }, [selectedTemplateId, selectedRunConfigId, templates]);

  useEffect(() => {
    if (!selectedRunConfigId) {
      return;
    }

    const selectedRunConfig = runConfigs.find((entry) => entry.id === selectedRunConfigId);
    if (!selectedRunConfig) {
      return;
    }

    const mode = selectedRunConfig?.validationScope?.mode === 'single-subscriber'
      || selectedRunConfig?.validationScope?.mode === OVERRIDE_MODE
      ? selectedRunConfig.validationScope.mode
      : 'all-subscribers';

    setValidationScopeMode(mode);
    setSingleSubscriberSsn(selectedRunConfig?.validationScope?.subscriberSsn || '');
    setStipulatedValues(
      selectedRunConfig?.effectiveValues?.singleSubscriberOverride
      || selectedRunConfig?.validationScope?.stipulatedValues
      || EMPTY_STIPULATED_VALUES,
    );
    setTreatSlashAsComma(selectedRunConfig?.effectiveValues?.delimiterConfig?.treatSlashAsComma !== false);

    const nextParserOptions = normalizeParserOptions(selectedRunConfig?.effectiveValues?.parserOptions);
    setDbValidationEnabled(nextParserOptions.dbValidation);
    setParserEnvName(nextParserOptions.envName);
    setSubscriberOnlyDbValidation(nextParserOptions.subscriberOnlyDbValidation);
    setIncludeLookupSql(nextParserOptions.includeLookupSql);
    setLogMemory(nextParserOptions.logMemory);
    setSubscriberBatchSizeInput(String(nextParserOptions.subscriberBatchSize));
  }, [selectedRunConfigId, runConfigs]);

  const normalizedSubscriberSsn = useMemo(
    () => String(singleSubscriberSsn || '').replace(/\D/g, ''),
    [singleSubscriberSsn],
  );

  const isSingleSubscriberScopeInvalid = useMemo(
    () => (
      (validationScopeMode === 'single-subscriber' || validationScopeMode === OVERRIDE_MODE)
      && normalizedSubscriberSsn.length !== 9
    ),
    [validationScopeMode, normalizedSubscriberSsn],
  );

  const stipulatedValuesPayload = useMemo(
    () => normalizeStipulatedValuesForPayload(stipulatedValues),
    [stipulatedValues],
  );

  const isSubscriberBatchSizeInvalid = !isValidSubscriberBatchSizeInput(subscriberBatchSizeInput);

  const parserOptionsPayload = useMemo(
    () => {
      const parserOptions = {
        dbValidation: dbValidationEnabled,
        envName: String(parserEnvName || '').trim() || DEFAULT_PARSER_OPTIONS.envName,
        subscriberOnlyDbValidation: dbValidationEnabled || subscriberOnlyDbValidation,
        singleQueryDbValidation: DEFAULT_PARSER_OPTIONS.singleQueryDbValidation,
        compareSingleQueryVsLegacy: DEFAULT_PARSER_OPTIONS.compareSingleQueryVsLegacy,
        includeLookupSql,
        logMemory,
      };

      return isSubscriberBatchSizeInvalid
        ? { ...parserOptions, subscriberBatchSize: subscriberBatchSizeInput }
        : buildEdiWorkbenchParserOptions(parserOptions, subscriberBatchSizeInput);
    },
    [
      dbValidationEnabled,
      parserEnvName,
      subscriberOnlyDbValidation,
      includeLookupSql,
      logMemory,
      subscriberBatchSizeInput,
      isSubscriberBatchSizeInvalid,
    ],
  );

  const isParseDisabled = useMemo(
    () => (!companionFile && !companionBlob) || !ediFile || isRunning || isSingleSubscriberScopeInvalid || isSubscriberBatchSizeInvalid,
    [companionFile, companionBlob, ediFile, isRunning, isSingleSubscriberScopeInvalid, isSubscriberBatchSizeInvalid],
  );
  const maxInvalidRows = 500;
  const invalidElements = Array.isArray(parseResult?.invalidElements) ? parseResult.invalidElements : [];
  const invalidFindingCount = Number.isInteger(parseResult?.findingCount)
    ? parseResult.findingCount
    : invalidElements.length;
  const validationSummary = parseResult?.x12Validation?.validationSummary
    || parseResult?.x12Validation?.summary
    || parseResult?.x12Validation
    || null;
  const subscriberProgressSummary = parseResult?.x12Validation?.['subscriber-progress'] || null;
  const uniqueInvalidElements = useMemo(() => {
    const seen = new Set();

    return invalidElements.filter((invalidElement) => {
      const dedupeKey = [
        invalidElement?.subscriberSsn || '',
        invalidElement?.subscriberIndex || '',
        invalidElement?.segment || '',
        invalidElement?.ref || '',
        invalidElement?.loopName || '',
        invalidElement?.loopDescription || '',
        invalidElement?.name || '',
        invalidElement?.reason || '',
      ].join('||');

      if (seen.has(dedupeKey)) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    });
  }, [invalidElements]);
  const visibleInvalidElements = useMemo(() => {
    const source = showUniqueElementErrors ? uniqueInvalidElements : invalidElements;

    return source
      .map((invalidElement, originalIndex) => ({ invalidElement, originalIndex }))
      .sort((left, right) => {
        const leftIndex = getInvalidSubscriberIdentity(left.invalidElement).subscriberIndex ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = getInvalidSubscriberIdentity(right.invalidElement).subscriberIndex ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex || left.originalIndex - right.originalIndex;
      })
      .map(({ invalidElement }) => invalidElement);
  }, [showUniqueElementErrors, uniqueInvalidElements, invalidElements]);
  const shownInvalidElements = visibleInvalidElements.slice(0, maxInvalidRows);
  const hasGuideChanges = useMemo(
    () => Boolean(originalGuide && workingGuide && JSON.stringify(originalGuide) !== JSON.stringify(workingGuide)),
    [originalGuide, workingGuide],
  );

  const handleIngestGuide = async () => {
    if ((!companionFile && !companionBlob) || isIngestingGuide || isRunning) {
      return;
    }

    setErrorMessage('');
    setIsIngestingGuide(true);
    try {
      const uploadedCompanion = companionBlob || await uploadSingleFile({
        file: companionFile,
        fileCategory: 'companion',
        teamName,
        assistantName,
        smartNoteId,
      });
      const ingestion = await ingestEditableCompanionGuide(teamName, assistantName, smartNoteId, {
        companion: uploadedCompanion,
        treatSlashAsComma,
      });

      if (!isMountedRef.current) {
        return;
      }

      setCompanionBlob(uploadedCompanion);
      setSelectedSavedGuideId('');
      setEditableGuideSupported(ingestion.supported === true);
      if (ingestion.supported === true && ingestion.editableGuide?.schemaVersion === 1) {
        const ingestedGuide = structuredClone(ingestion.editableGuide);
        setOriginalGuide(structuredClone(ingestedGuide));
        setWorkingGuide(structuredClone(ingestedGuide));
        setEfssPackageVersion(ingestion.efssPackageVersion || null);
        setModelGuideDiagnostics([]);
      } else {
        setOriginalGuide(null);
        setWorkingGuide(null);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setErrorMessage(error?.message || 'Failed to ingest the companion guide.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsIngestingGuide(false);
      }
    }
  };

  const handleSaveGuide = async () => {
    if (!workingGuide || isSavingGuide || isRunning || isIngestingGuide) {
      return;
    }

    setErrorMessage('');
    setIsSavingGuide(true);
    try {
      const sourceArtifact = companionBlob || await uploadSingleFile({
        file: companionFile,
        fileCategory: 'companion',
        teamName,
        assistantName,
        smartNoteId,
      });
      const savedGuide = await saveEditableCompanionGuide(teamName, assistantName, smartNoteId, {
        companion: sourceArtifact,
        editableGuide: workingGuide,
        efssPackageVersion,
      });
      if (!savedGuide?.id) {
        throw new Error('The companion guide was saved without a revision identifier');
      }

      if (!isMountedRef.current) {
        return;
      }

      setCompanionBlob(sourceArtifact);
      setSelectedSavedGuideId(savedGuide.id);
      setOriginalGuide(structuredClone(workingGuide));
      await loadSavedGuides();
    } catch (error) {
      if (isMountedRef.current) {
        setErrorMessage(error?.message || 'Failed to save companion guide.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSavingGuide(false);
      }
    }
  };

  const handleRun = async () => {
    setErrorMessage('');

    if (isSubscriberBatchSizeInvalid) {
      setErrorMessage('Subscribers per batch must be a positive integer');
      return;
    }

    setParseResult(null);
    setModelGuideDiagnostics([]);
    setSubscriberProgress(null);
    setIsRunning(true);
    setOverallJobPercent(0);
    setParseServerStatus('queued');
    setParseJobId(null);

    try {
      const [companionBlobForRun, ediBlob] = await Promise.all([
        companionBlob || uploadSingleFile({ file: companionFile, fileCategory: 'companion', teamName, assistantName, smartNoteId }),
        uploadSingleFile({ file: ediFile, fileCategory: 'edi', teamName, assistantName, smartNoteId }),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      const job = await startEdiWorkbenchParseJob(teamName, assistantName, smartNoteId, {
        companion: companionBlobForRun,
        edi: ediBlob,
        editableGuide: editableGuideSupported === true ? workingGuide : null,
        editableGuideMetadata: editableGuideSupported === true
          ? { schemaVersion: workingGuide?.schemaVersion, efssPackageVersion }
          : null,
        templateId: selectedTemplateId || null,
        runConfigId: selectedRunConfigId || null,
        parseOptions: parserOptionsPayload,
        validationScope: {
          mode: validationScopeMode,
          subscriberSsn: validationScopeMode === 'single-subscriber' || validationScopeMode === OVERRIDE_MODE
            ? normalizedSubscriberSsn
            : null,
          stipulatedValues: validationScopeMode === OVERRIDE_MODE
            ? stipulatedValuesPayload
            : null,
        },
      });
      setParseJobId(job.jobId);

      let latestStatus = job.status;
      let latestStep = job.step || 'Validation started';
      let latestOverallJobPercent = typeof job.overallJobPercent === 'number'
        ? job.overallJobPercent
        : (typeof job.progress === 'number' ? job.progress : 0);
      let consecutivePollErrors = 0;

      if (isMountedRef.current) {
        setParseProgressMessage(latestStep);
        setOverallJobPercent(latestOverallJobPercent);
        setParseServerStatus(latestStatus);
      }

      while (latestStatus === 'queued' || latestStatus === 'running') {
        try {
          const statusResponse = await getEdiWorkbenchParseJobStatus(teamName, assistantName, smartNoteId, job.jobId);
          consecutivePollErrors = 0;
          latestStatus = statusResponse.status || latestStatus || 'running';
          latestStep = statusResponse.step || latestStep;
          latestOverallJobPercent = typeof statusResponse.overallJobPercent === 'number'
            ? statusResponse.overallJobPercent
            : latestOverallJobPercent;

          if (isMountedRef.current) {
            setParseProgressMessage(latestStep);
            setOverallJobPercent(latestOverallJobPercent);
            setParseServerStatus(latestStatus);
            setSubscriberProgress((current) => statusResponse?.metrics?.subscriberProgress || current);
          }

          if (latestStatus === 'completed') {
            if (isMountedRef.current) {
              setParseResult(statusResponse.result || null);
              setParseProgressMessage('');
              setOverallJobPercent(100);
              setParseServerStatus('completed');
              setSubscriberProgress((current) => statusResponse?.metrics?.subscriberProgress || current);
              if (statusResponse.result?.editableGuideRecord?.id && workingGuide) {
                setSelectedSavedGuideId(statusResponse.result.editableGuideRecord.id);
                setOriginalGuide(structuredClone(workingGuide));
                void loadSavedGuides();
              }
            }
            return;
          }

          if (latestStatus === 'failed') {
            if (statusResponse.errorType === 'invalid-editable-companion-guide') {
              setModelGuideDiagnostics(statusResponse.errorDetails?.diagnostics || []);
            }
            const validationError = new Error(statusResponse.error || 'Validation failed');
            validationError.nonRetryable = true;
            throw validationError;
          }
        } catch (pollError) {
          if (pollError?.nonRetryable) {
            throw pollError;
          }
          consecutivePollErrors += 1;

          if (consecutivePollErrors >= MAX_POLL_ERROR_RETRIES) {
            throw new Error(pollError?.message || 'Lost connection while checking validation progress');
          }

          if (isMountedRef.current) {
            setParseServerStatus('running');
            setParseProgressMessage(`Validation is still running. Reconnecting to progress updates (${consecutivePollErrors}/${MAX_POLL_ERROR_RETRIES})`);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, PARSE_POLL_INTERVAL_MS));
      }
    } catch (error) {
      if (isMountedRef.current) {
        setErrorMessage(error?.message || 'Failed to parse and enrich the uploaded files.');
        setParseProgressMessage('');
        setParseServerStatus('failed');
      }
    } finally {
      if (isMountedRef.current) {
        setIsRunning(false);
      }
    }
  };

  const handleDownloadReport = async () => {
    if (!parseResult?.downloadReport || !parseJobId || isRefreshingDownload) {
      return;
    }

    setErrorMessage('');
    setIsRefreshingDownload(true);
    try {
      const currentDownload = parseResult.downloadReport;
      const expiresAtMs = Date.parse(currentDownload.expiresAt || '');
      const download = Number.isFinite(expiresAtMs) && expiresAtMs > Date.now() + 30000
        ? currentDownload
        : await refreshEdiWorkbenchReportDownload(teamName, assistantName, smartNoteId, parseJobId);

      window.location.assign(download.downloadUrl);
      if (download !== currentDownload) {
        setParseResult((current) => ({ ...current, downloadReport: download }));
      }
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to download the validation report.');
    } finally {
      setIsRefreshingDownload(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'auto',
        p: { xs: 1.5, md: 2.5 },
        alignItems: 'center',
        background: 'linear-gradient(145deg, #f8f6f1 0%, #eaf4f9 55%, #f7ede2 100%)',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 1420, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Card
          sx={{
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.28)',
            background: 'linear-gradient(118deg, #0a2342 0%, #0f3f73 58%, #1664b8 100%)',
            color: '#f8fbff',
            boxShadow: '0 14px 34px rgba(12,45,84,0.28)',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(circle at 85% 18%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 42%)',
            },
          }}
        >
          <CardContent sx={{ position: 'relative', zIndex: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
              <Box>
                <Typography sx={{ fontFamily: 'Space Grotesk, Manrope, sans-serif', letterSpacing: 0.4 }} variant="h4">
                  EDI Validation Workbench
                </Typography>
                <Typography sx={{ mt: 1, opacity: 0.92, fontFamily: 'Manrope, Space Grotesk, sans-serif' }}>
                  Upload a companion spreadsheet and an EDI file, then parse and enrich to surface invalid elements with clear location context.
                </Typography>
              </Box>
              <Chip
                label="Direct API Uploads"
                variant="filled"
                sx={{
                  alignSelf: { xs: 'flex-start', md: 'center' },
                  backgroundColor: '#f4f9ff',
                  color: '#0c3e70',
                  fontWeight: 700,
                }}
              />
            </Stack>
          </CardContent>
        </Card>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
          <Card sx={{ flex: 1, borderRadius: 3, minWidth: 0 }}>
            <CardContent>
              <Stack spacing={2} alignItems="flex-start">
                <Stack direction="row" spacing={1} alignItems="center">
                  <SchemaOutlinedIcon color="primary" />
                  <Typography variant="h6" sx={{ fontFamily: 'Space Grotesk, Manrope, sans-serif' }}>
                    Companion Guide Spreadsheet
                  </Typography>
                </Stack>
                <Button component="label" variant="secondary" startIcon={<UploadFileOutlinedIcon />} sx={{ minWidth: 220 }}>
                  {companionFile ? 'Replace Spreadsheet' : 'Upload Spreadsheet'}
                  <input
                    hidden
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onClick={(event) => {
                      event.currentTarget.value = '';
                    }}
                    onChange={handleCompanionFileChange}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {companionFile
                    ? `${companionFile.name} (${Math.ceil(companionFile.size / 1024)} KB)`
                    : companionBlob?.fileName || 'No spreadsheet selected'}
                </Typography>
                {EDITABLE_GUIDE_ENABLED && savedGuides.length > 0 && (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Saved companion guide"
                    value={selectedSavedGuideId}
                    onChange={handleSavedGuideChange}
                    disabled={isLoadingSavedGuide || isRunning || isIngestingGuide}
                  >
                    <MenuItem value="">Select a saved guide</MenuItem>
                    {savedGuides.map((guide) => (
                      <MenuItem key={guide.id} value={guide.id}>
                        {guide.sourceArtifact?.fileName || 'Companion guide'} · {guide.validationStatus === 'validated' ? 'Validated' : 'Draft'} · {new Date(guide.savedAt || guide.validatedAt || guide.createdAt).toLocaleString()}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {isLoadingSavedGuide && <LinearProgress sx={{ width: '100%' }} />}
                {EDITABLE_GUIDE_ENABLED && (companionFile || companionBlob) && (
                  <Button
                    variant="action"
                    startIcon={isIngestingGuide ? <CircularProgress size={16} color="inherit" /> : <SchemaOutlinedIcon />}
                    onClick={handleIngestGuide}
                    disabled={isIngestingGuide || isRunning}
                  >
                    {workingGuide ? 'Re-ingest for editing' : 'Prepare guide for editing'}
                  </Button>
                )}
                {EDITABLE_GUIDE_ENABLED && editableGuideSupported === false && (
                  <Alert severity="info">Guide editing is unavailable with the installed EFS-S package. CSV validation remains available.</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, borderRadius: 3, minWidth: 0 }}>
            <CardContent>
              <Stack spacing={2} alignItems="flex-start">
                <Stack direction="row" spacing={1} alignItems="center">
                  <DescriptionOutlinedIcon color="primary" />
                  <Typography variant="h6" sx={{ fontFamily: 'Space Grotesk, Manrope, sans-serif' }}>
                    EDI Input File
                  </Typography>
                </Stack>
                <Button component="label" variant="secondary" startIcon={<UploadFileOutlinedIcon />} sx={{ minWidth: 220 }}>
                  {ediFile ? 'Replace EDI File' : 'Upload EDI File'}
                  <input
                    hidden
                    type="file"
                    accept=".txt,.edi"
                    onClick={(event) => {
                      event.currentTarget.value = '';
                    }}
                    onChange={handleEdiFileChange}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ediFile ? `${ediFile.name} (${Math.ceil(ediFile.size / 1024)} KB)` : 'No EDI file selected'}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        {EDITABLE_GUIDE_ENABLED && editableGuideSupported === true && workingGuide && (
          <CompanionGuideEditor
            guide={workingGuide}
            hasChanges={hasGuideChanges}
            sourceDiagnostics={originalGuide?.diagnostics || []}
            modelDiagnostics={modelGuideDiagnostics}
            efssPackageVersion={efssPackageVersion}
            disabled={isRunning || isIngestingGuide || isSavingGuide}
            saving={isSavingGuide}
            onChange={(nextGuide) => {
              setWorkingGuide(nextGuide);
              setModelGuideDiagnostics([]);
            }}
            onReset={() => {
              setWorkingGuide(structuredClone(originalGuide));
              setModelGuideDiagnostics([]);
            }}
            onReingest={handleIngestGuide}
            onSave={handleSaveGuide}
          />
        )}

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              {SHOW_TEMPLATE_CONFIG_UI && (
              <>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
                <TextField
                  select
                  label="Companion Template"
                  value={selectedTemplateId}
                  onChange={(event) => {
                    setSelectedTemplateId(event.target.value);
                    setSelectedRunConfigId('');
                  }}
                  size="small"
                  sx={{ minWidth: { xs: '100%', md: 320 } }}
                  helperText="Shared, SmartNote-scoped template"
                >
                  <MenuItem value="">None selected</MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>{template.templateName || template.id}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="New Template Name"
                  value={templateNameInput}
                  onChange={(event) => setTemplateNameInput(event.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 240 } }}
                />
                <Button
                  variant="secondary"
                  disabled={!templateNameInput.trim() || isLoadingTemplateData}
                  onClick={async () => {
                    setErrorMessage('');
                    try {
                      const created = await createEdiCompanionGuideTemplate(teamName, assistantName, smartNoteId, {
                        templateName: templateNameInput.trim(),
                        rules: [],
                        source: { kind: 'manual' },
                      });

                      setTemplateNameInput('');
                      setSelectedTemplateId(created?.id || '');
                      await loadTemplateData(created?.id || null);
                    } catch (error) {
                      setErrorMessage(error?.message || 'Failed to create template');
                    }
                  }}
                >
                  Create Template
                </Button>
                <Button
                  variant="action"
                  disabled={!selectedTemplateId || isLoadingTemplateData}
                  onClick={async () => {
                    setErrorMessage('');
                    try {
                      const selectedTemplate = templates.find((entry) => entry.id === selectedTemplateId);
                      if (!selectedTemplate) {
                        throw new Error('Select an existing template to save updates');
                      }

                      await updateEdiCompanionGuideTemplate(teamName, assistantName, smartNoteId, selectedTemplateId, {
                        templateName: selectedTemplate.templateName || 'Untitled Template',
                        delimiterConfig: {
                          ...(selectedTemplate.delimiterConfig || {}),
                          treatSlashAsComma,
                        },
                        parserOptions: parserOptionsPayload,
                      });

                      await loadTemplateData(selectedTemplateId || null);
                    } catch (error) {
                      setErrorMessage(error?.message || 'Failed to update template');
                    }
                  }}
                >
                  Save Template
                </Button>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
                <TextField
                  select
                  label="Run Config"
                  value={selectedRunConfigId}
                  onChange={(event) => setSelectedRunConfigId(event.target.value)}
                  size="small"
                  sx={{ minWidth: { xs: '100%', md: 320 } }}
                  helperText="Run-specific values and scope"
                >
                  <MenuItem value="">None selected</MenuItem>
                  {runConfigs.map((runConfig) => (
                    <MenuItem key={runConfig.id} value={runConfig.id}>{runConfig.runLabel || runConfig.id}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="New Run Config"
                  value={runConfigNameInput}
                  onChange={(event) => setRunConfigNameInput(event.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 240 } }}
                />
                <Button
                  variant="secondary"
                  disabled={!runConfigNameInput.trim() || !selectedTemplateId || isLoadingTemplateData}
                  onClick={async () => {
                    setErrorMessage('');
                    try {
                      const created = await createEdiCompanionGuideRunConfig(teamName, assistantName, smartNoteId, {
                        templateId: selectedTemplateId,
                        runLabel: runConfigNameInput.trim(),
                        effectiveValues: {
                          delimiterConfig: {
                            treatSlashAsComma,
                          },
                          parserOptions: parserOptionsPayload,
                          singleSubscriberOverride: validationScopeMode === OVERRIDE_MODE
                            ? stipulatedValuesPayload
                            : null,
                        },
                        validationScope: {
                          mode: validationScopeMode,
                          subscriberSsn: validationScopeMode === 'single-subscriber' || validationScopeMode === OVERRIDE_MODE
                            ? normalizedSubscriberSsn
                            : null,
                          stipulatedValues: validationScopeMode === OVERRIDE_MODE
                            ? stipulatedValuesPayload
                            : null,
                        },
                      });

                      setRunConfigNameInput('');
                      setSelectedRunConfigId(created?.id || '');
                      await loadTemplateData(selectedTemplateId || null);
                    } catch (error) {
                      setErrorMessage(error?.message || 'Failed to create run config');
                    }
                  }}
                >
                  Create Run Config
                </Button>
              </Stack>
              </>
              )}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="Validation Scope"
                  value={validationScopeMode}
                  onChange={(event) => setValidationScopeMode(event.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 240 } }}
                >
                  <MenuItem value="all-subscribers">All subscribers</MenuItem>
                  <MenuItem value="single-subscriber">Single subscriber SSN</MenuItem>
                  <MenuItem value={OVERRIDE_MODE}>Single SSN with stipulated values</MenuItem>
                </TextField>

                {(validationScopeMode === 'single-subscriber' || validationScopeMode === OVERRIDE_MODE) && (
                  <TextField
                    size="small"
                    label="Subscriber SSN"
                    value={singleSubscriberSsn}
                    onChange={(event) => setSingleSubscriberSsn(event.target.value.replace(/[^0-9-]/g, ''))}
                    placeholder="111-31-4433"
                    error={isSingleSubscriberScopeInvalid}
                    helperText={isSingleSubscriberScopeInvalid ? 'Enter a 9-digit subscriber SSN.' : 'Digits only or SSN format.'}
                    sx={{ minWidth: { xs: '100%', md: 220 } }}
                  />
                )}

                {validationScopeMode === OVERRIDE_MODE && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'flex-start' }} sx={{ flexWrap: 'wrap' }}>
                    <TextField
                      size="small"
                      label="NM101"
                      value={stipulatedValues.nm1.NM101}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM101: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 110 } }}
                    />
                    <TextField
                      size="small"
                      label="NM102"
                      value={stipulatedValues.nm1.NM102}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM102: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 110 } }}
                    />
                    <TextField
                      size="small"
                      label="NM103"
                      value={stipulatedValues.nm1.NM103}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM103: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 150 } }}
                    />
                    <TextField
                      size="small"
                      label="NM104"
                      value={stipulatedValues.nm1.NM104}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM104: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 150 } }}
                    />
                    <TextField
                      size="small"
                      label="NM108"
                      value={stipulatedValues.nm1.NM108}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM108: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 110 } }}
                    />
                    <TextField
                      size="small"
                      label="NM105"
                      value={stipulatedValues.nm1.NM105}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM105: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 120 } }}
                    />
                    <TextField
                      size="small"
                      label="NM106"
                      value={stipulatedValues.nm1.NM106}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM106: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 120 } }}
                    />
                    <TextField
                      size="small"
                      label="NM107"
                      value={stipulatedValues.nm1.NM107}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM107: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 120 } }}
                    />
                    <TextField
                      size="small"
                      label="NM109"
                      value={stipulatedValues.nm1.NM109}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, nm1: { ...current.nm1, NM109: event.target.value.replace(/[^0-9-]/g, '') } }))}
                      sx={{ width: { xs: '100%', md: 140 } }}
                    />
                    <TextField
                      size="small"
                      label="REF0F"
                      value={stipulatedValues.ref.REF0F}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, ref: { ...current.ref, REF0F: event.target.value.replace(/[^0-9-]/g, '') } }))}
                      sx={{ width: { xs: '100%', md: 140 } }}
                    />
                    <TextField
                      size="small"
                      label="REF1L"
                      value={stipulatedValues.ref.REF1L}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, ref: { ...current.ref, REF1L: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 160 } }}
                    />
                    <TextField
                      size="small"
                      label="REFDX"
                      value={stipulatedValues.ref.REFDX}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, ref: { ...current.ref, REFDX: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 120 } }}
                    />
                    <TextField
                      size="small"
                      label="REFZZ"
                      value={stipulatedValues.ref.REFZZ}
                      onChange={(event) => setStipulatedValues((current) => ({ ...current, ref: { ...current.ref, REFZZ: event.target.value } }))}
                      sx={{ width: { xs: '100%', md: 120 } }}
                    />
                  </Stack>
                )}

                <FormControlLabel
                  control={(
                    <Checkbox
                      size="small"
                      checked={treatSlashAsComma}
                      onChange={(event) => setTreatSlashAsComma(event.target.checked)}
                    />
                  )}
                  label="Treat '/' as ',' in CSV allowed values"
                />

                <Card
                  sx={{
                    mt: 0.5,
                    borderRadius: 2.5,
                    border: '1px solid rgba(17,76,133,0.14)',
                    background: 'linear-gradient(120deg, rgba(14,67,120,0.06) 0%, rgba(0,163,173,0.08) 100%)',
                    width: '100%',
                    maxWidth: 920,
                  }}
                >
                  <CardContent sx={{ pb: '16px !important' }}>
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, fontFamily: 'Space Grotesk, Manrope, sans-serif' }}>
                        Parser Options
                      </Typography>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
                        {/* <TextField
                          size="small"
                          label="Environment"
                          value={parserEnvName}
                          onChange={(event) => setParserEnvName(event.target.value)}
                          sx={{ width: { xs: '100%', md: 160 } }}
                          helperText="maps to envName"
                        />
                        */}
                        <FormControlLabel
                          control={(
                            <Checkbox
                              size="small"
                              checked={dbValidationEnabled}
                              onChange={(event) => setDbValidationEnabled(event.target.checked)}
                            />
                          )}
                          label="DB validation"
                        />
                        <FormControlLabel
                          control={(
                            <Checkbox
                              size="small"
                              checked={dbValidationEnabled || subscriberOnlyDbValidation}
                              onChange={(event) => setSubscriberOnlyDbValidation(event.target.checked)}
                              disabled={dbValidationEnabled}
                            />
                          )}
                          label="Subscriber-only DB"
                        />
                        <FormControlLabel
                          control={(
                            <Checkbox
                              size="small"
                              checked={includeLookupSql}
                              onChange={(event) => setIncludeLookupSql(event.target.checked)}
                            />
                          )}
                          label="Include lookup SQL"
                        />
                        <FormControlLabel
                          control={(
                            <Checkbox
                              size="small"
                              checked={logMemory}
                              onChange={(event) => setLogMemory(event.target.checked)}
                            />
                          )}
                          label="Parser memory logging"
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Subscribers per batch"
                          value={subscriberBatchSizeInput}
                          onChange={(event) => setSubscriberBatchSizeInput(event.target.value)}
                          error={isSubscriberBatchSizeInvalid}
                          helperText={isSubscriberBatchSizeInvalid
                            ? 'Enter a positive integer.'
                            : 'Higher values may process faster but use more memory.'}
                          slotProps={{ htmlInput: { min: 1, step: 1 } }}
                          sx={{ width: { xs: '100%', md: 220 } }}
                        />
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                {SHOW_TEMPLATE_CONFIG_UI && (
                <Button
                  variant="action"
                  disabled={!selectedRunConfigId || isLoadingTemplateData}
                  onClick={async () => {
                    setErrorMessage('');
                    try {
                      const selectedRunConfig = runConfigs.find((entry) => entry.id === selectedRunConfigId);
                      if (!selectedRunConfig) {
                        throw new Error('Select an existing run config to save updates');
                      }

                      await updateEdiCompanionGuideRunConfig(teamName, assistantName, smartNoteId, selectedRunConfigId, {
                        runLabel: selectedRunConfig.runLabel || 'Validation Run',
                        templateId: selectedTemplateId || selectedRunConfig.templateId || null,
                        effectiveValues: {
                          ...(selectedRunConfig.effectiveValues || {}),
                          delimiterConfig: {
                            ...((selectedRunConfig.effectiveValues && selectedRunConfig.effectiveValues.delimiterConfig) || {}),
                            treatSlashAsComma,
                          },
                          parserOptions: parserOptionsPayload,
                          singleSubscriberOverride: validationScopeMode === OVERRIDE_MODE
                            ? stipulatedValuesPayload
                            : null,
                        },
                        validationScope: {
                          mode: validationScopeMode,
                          subscriberSsn: validationScopeMode === 'single-subscriber' || validationScopeMode === OVERRIDE_MODE
                            ? normalizedSubscriberSsn
                            : null,
                          stipulatedValues: validationScopeMode === OVERRIDE_MODE
                            ? stipulatedValuesPayload
                            : null,
                        },
                      });

                      await loadTemplateData(selectedTemplateId || null);
                    } catch (error) {
                      setErrorMessage(error?.message || 'Failed to update run config');
                    }
                  }}
                >
                  Save Run Config
                </Button>
                )}

                {isLoadingTemplateData && (
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 0.5 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">Loading template data...</Typography>
                  </Stack>
                )}
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontFamily: 'Space Grotesk, Manrope, sans-serif' }}>
                  Parse and Enrich
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Files upload through the API to Azure Blob before parse/enrich runs in server-side services.
                </Typography>
              </Box>
              <Button
                variant="primary"
                startIcon={isRunning ? <CircularProgress size={16} color="inherit" /> : <PlayArrowOutlinedIcon />}
                onClick={handleRun}
                disabled={isParseDisabled}
                sx={{ minWidth: { xs: '100%', md: 190 }, alignSelf: { xs: 'stretch', md: 'auto' } }}
              >
                {isRunning ? 'Processing...' : 'Run Validation'}
              </Button>
            </Stack>

            {isRunning && parseProgressMessage && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Current step: {parseProgressMessage}
                    </Typography>
                    <Chip size="small" label={`Status: ${getFriendlyStatus(parseServerStatus)}`} variant="outlined" />
                    <Chip size="small" label={`${Math.max(0, Math.min(100, Math.round(overallJobPercent)))}%`} variant="outlined" />
                  </Stack>
                  <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, overallJobPercent))} />
                  <Typography variant="caption" color="text.secondary">
                    Checking progress every 10 seconds
                  </Typography>
                  {subscriberProgress && (
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Chip
                          size="small"
                          label={`Subscribers: ${subscriberProgress.processedSubscribers || 0}/${subscriberProgress.totalSubscribers || 0}`}
                          variant="outlined"
                        />
                        {Number.isFinite(subscriberProgress.percentComplete) && (
                          <Chip
                            size="small"
                            label={`Subscriber progress: ${Math.max(0, Math.min(100, Math.round(subscriberProgress.percentComplete)))}%`}
                            variant="outlined"
                          />
                        )}
                        {subscriberProgress.status && (
                          <Chip
                            size="small"
                            label={`Member status: ${subscriberProgress.status}`}
                            variant="outlined"
                          />
                        )}
                        {subscriberProgress.structure && (
                          <Chip
                            size="small"
                            label={`Structure: ${subscriberProgress.structure.passed || 0} passed / ${subscriberProgress.structure.failed || 0} failed`}
                            variant="outlined"
                          />
                        )}
                        {subscriberProgress.db && (
                          <Chip
                            size="small"
                            label={`DB: ${subscriberProgress.db.passed || 0} passed / ${subscriberProgress.db.failed || 0} failed / ${subscriberProgress.db.skipped || 0} skipped`}
                            variant="outlined"
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {`Current member index: ${subscriberProgress.subscriberIndex || 'n/a'}${subscriberProgress.subscriberSsn ? ` | SSN: ${subscriberProgress.subscriberSsn}` : ''}${Number.isFinite(subscriberProgress.elapsedMs) ? ` | Elapsed: ${Math.round(subscriberProgress.elapsedMs / 1000)}s` : ''}`}
                      </Typography>
                    </Stack>
                  )}
                  {parseServerStatus === 'queued' && (
                    <Typography variant="caption" color="text.secondary">
                      Your validation is waiting to begin.
                    </Typography>
                  )}
                </Stack>
              </Alert>
            )}

            {errorMessage && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errorMessage}
              </Alert>
            )}
          </CardContent>
        </Card>

        {parseResult && (
          <Card sx={{ borderRadius: 3, flex: 1, minHeight: 260 }}>
            <CardContent>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                <Typography variant="h6" sx={{ fontFamily: 'Space Grotesk, Manrope, sans-serif' }}>
                  Invalid Elements Report
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                  {parseResult.downloadReport && (
                    <Button
                      variant="primary"
                      startIcon={isRefreshingDownload ? <CircularProgress size={16} /> : <DownloadOutlinedIcon />}
                      onClick={handleDownloadReport}
                      disabled={isRefreshingDownload}
                    >
                      Download report
                    </Button>
                  )}
                  <Chip label={`Invalid findings: ${invalidFindingCount}`} color="error" variant="outlined" />
                  <Chip label={`Valid: ${parseResult?.summary?.valid || 0}`} color="success" variant="outlined" />
                  <Chip label={`Unknown: ${parseResult?.summary?.unknown || 0}`} variant="outlined" />
                  <FormControlLabel
                    sx={{ ml: 0.5 }}
                    control={(
                      <Checkbox
                        size="small"
                        checked={showUniqueElementErrors}
                        onChange={(event) => setShowUniqueElementErrors(event.target.checked)}
                      />
                    )}
                    label="Unique element errors"
                  />
                  <Button
                    variant="text"
                    onClick={() => setShowTechnicalPaths((current) => !current)}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {showTechnicalPaths ? 'Hide exact paths' : 'Show exact paths'}
                  </Button>
                </Stack>
              </Stack>
              <Divider sx={{ my: 1.5 }} />

              {validationSummary && (
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} useFlexGap flexWrap="wrap">
                  <Chip label={`Checks total: ${validationSummary.total || 0}`} variant="outlined" />
                  <Chip label={`Checks passed: ${validationSummary.passed || 0}`} color="success" variant="outlined" />
                  <Chip label={`Checks failed: ${validationSummary.failed || 0}`} color="warning" variant="outlined" />
                  <Chip label={`Lookup checks: ${validationSummary.lookup || 0}`} variant="outlined" />
                </Stack>
              )}

              {subscriberProgressSummary && (
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} useFlexGap flexWrap="wrap">
                  <Chip label={`Subscribers total: ${subscriberProgressSummary.total || 0}`} variant="outlined" />
                  <Chip label={`Subscriber passed: ${subscriberProgressSummary['completed-passed'] || 0}`} color="success" variant="outlined" />
                  <Chip label={`Subscriber failed: ${subscriberProgressSummary['completed-failed'] || 0}`} color="warning" variant="outlined" />
                  <Chip label={`Subscriber partial: ${subscriberProgressSummary['completed-partial'] || 0}`} variant="outlined" />
                </Stack>
              )}

              {parseResult?.executionContext && (
                <Stack spacing={1} sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={`Template: ${parseResult.executionContext.templateId || 'none'}`} variant="outlined" />
                    <Chip label={`Run Config: ${parseResult.executionContext.runConfigId || 'none'}`} variant="outlined" />
                    <Chip
                      label={`Scope: ${parseResult.executionContext.validationScope?.mode || 'all-subscribers'}`}
                      variant="outlined"
                    />
                    {parseResult.executionContext.validationScope?.mode === 'single-subscriber' && (
                      <Chip
                        label={`SSN: ${parseResult.executionContext.validationScope?.subscriberSsn || 'n/a'}`}
                        variant="outlined"
                      />
                    )}
                    <Chip
                      label={`Slash->Comma: ${parseResult.executionContext.treatSlashAsComma ? 'on' : 'off'}`}
                      variant="outlined"
                    />
                    <Chip
                      label={`DB Validation: ${parseResult.executionContext.parseOptions?.dbValidation ? 'on' : 'off'}`}
                      variant="outlined"
                    />
                    <Chip
                      label={`Env: ${parseResult.executionContext.parseOptions?.envName || 'default'}`}
                      variant="outlined"
                    />
                    <Chip
                      label={`Subscriber-only DB: ${parseResult.executionContext.parseOptions?.subscriberOnlyDbValidation ? 'on' : 'off'}`}
                      variant="outlined"
                    />
                    <Chip
                      label={`Lookup SQL: ${parseResult.executionContext.parseOptions?.includeLookupSql ? 'on' : 'off'}`}
                      variant="outlined"
                    />
                    <Chip
                      label={`Log Memory: ${parseResult.executionContext.parseOptions?.logMemory ? 'on' : 'off'}`}
                      variant="outlined"
                    />
                    {parseResult.executionContext.lookupStats && (
                      <Chip
                        label={`Lookup applied: ${parseResult.executionContext.lookupStats.applied || 0}/${parseResult.executionContext.lookupStats.total || 0}`}
                        variant="outlined"
                      />
                    )}
                    {parseResult.executionContext.scopedSubscriberMetrics && (
                      <Chip
                        label={`Subscribers matched: ${parseResult.executionContext.scopedSubscriberMetrics.matchedSubscribers || 0}/${parseResult.executionContext.scopedSubscriberMetrics.totalSubscribers || 0}`}
                        variant="outlined"
                      />
                    )}
                  </Stack>
                  {Array.isArray(parseResult.executionContext.warnings) && parseResult.executionContext.warnings.map((warning, index) => (
                    <Alert key={`exec-warning-${index}`} severity="warning">
                      {warning}
                    </Alert>
                  ))}
                </Stack>
              )}

              {visibleInvalidElements.length === 0 ? (
                <Alert severity="success">No invalid elements were detected for the uploaded files.</Alert>
              ) : (
                <Stack spacing={1} sx={{ maxHeight: '52vh', overflow: 'auto', pr: 1 }}>
                  {shownInvalidElements.map((invalidElement, index) => (
                    <Box key={`${invalidElement.path}-${invalidElement.subscriberSsn || invalidElement.subscriberIndex || 'transaction'}-${index}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25 }}>
                      <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                        INVALID
                      </Typography>
                      <Stack direction="row" spacing={0.75} sx={{ mt: 0.25, mb: 0.5 }} useFlexGap flexWrap="wrap">
                        {getInvalidSubscriberIdentity(invalidElement).subscriberSsn && (
                          <Chip size="small" color="primary" variant="outlined" label={`Subscriber/Member: ${getInvalidSubscriberIdentity(invalidElement).subscriberSsn}`} />
                        )}
                        {getInvalidSubscriberIdentity(invalidElement).subscriberIndex && (
                          <Chip size="small" variant="outlined" label={`INS member: ${getInvalidSubscriberIdentity(invalidElement).subscriberIndex}`} />
                        )}
                        {!getInvalidSubscriberIdentity(invalidElement).subscriberSsn && !getInvalidSubscriberIdentity(invalidElement).subscriberIndex && (
                          <Chip size="small" variant="outlined" label="Transaction-level" />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {invalidElement.segment || 'Validation rule'}
                        </Typography>
                        {(invalidElement.loopName || invalidElement.loopDescription) && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={invalidElement.loopName
                              ? `Loop ${invalidElement.loopName}${invalidElement.loopDescription ? ` - ${invalidElement.loopDescription}` : ''}`
                              : `Loop: ${invalidElement.loopDescription}`}
                          />
                        )}
                      </Stack>
                      {getLocationTrail(invalidElement).length > 0 && (
                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.75 }}>
                          {getLocationTrail(invalidElement).map((trailPart, trailIndex) => (
                            <Chip key={`${invalidElement.path}-${trailPart}-${trailIndex}`} size="small" variant="outlined" label={trailPart} />
                          ))}
                        </Stack>
                      )}
                      {invalidElement.ref && (
                        <Typography variant="body2" color="text.secondary">
                          Element: {invalidElement.ref}
                        </Typography>
                      )}
                      {(() => {
                        const reasonView = buildReadableReason(
                          invalidElement.reason,
                          invalidElement.failedValue,
                          invalidElement.valueProvided,
                        );
                        if (!reasonView) {
                          return null;
                        }

                        return (
                          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                              Reason: {reasonView.summary}
                            </Typography>
                            {reasonView.details.map((detail) => (
                              <Typography key={`${invalidElement.path}-${detail}`} variant="caption" color="text.secondary">
                                {detail}
                              </Typography>
                            ))}
                          </Stack>
                        );
                      })()}
                      {showTechnicalPaths && invalidElement.path && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.75, fontFamily: 'Consolas, Menlo, Monaco, monospace', wordBreak: 'break-all' }}
                        >
                          Path: {invalidElement.path}
                        </Typography>
                      )}
                    </Box>
                  ))}
                  {(parseResult?.findingsTruncated || visibleInvalidElements.length > maxInvalidRows) && (
                    <Alert severity="info">
                      Showing the first {shownInvalidElements.length} findings out of {invalidFindingCount}.
                    </Alert>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}
