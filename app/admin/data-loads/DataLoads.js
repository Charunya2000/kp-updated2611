'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
  Alert,
} from '@mui/material';
import { CloudUpload, Delete } from '@mui/icons-material';
import { getBlobContainers, getBlobFiles, uploadBlobFile, deleteBlobFile } from '@/app/clientServices/blobStorageService';
import { getAllIndexNames } from '@/app/clientServices/aiSearchIndexService';
import {
  checkAiSearchIndex,
  checkMongoCollection,
  createMongoCollection,
  getAiSearchUploadJob,
  getMongoDatabases,
  getMongoCollections,
  startAiSearchUpload,
  getAllDataLoadJobs,
  startMongoUpload,
  updateAiSearchUploadJob,
} from '@/app/clientServices/dataLoadsService';
import { jobStatus } from '@/utils/constants';

const EMPTY = '';
const AI_SEARCH_DATA_LOAD_JOB_TYPE = 'AISearchDataLoad';
const MONGO_DATA_LOAD_JOB_TYPE = 'MongoDataLoad';
const EMPTY_REPORT = {
  insertedCount: 0,
  skippedCount: 0,
  skippedDocumentIds: [],
  errors: [],
};
const INDEXING_ZERO_STALL_TIMEOUT_MS = 10 * 60 * 1000;

function isBsonlFileName(fileName) {
  return /\.bsonl$/i.test(fileName || '');
}

function toDateMs(value) {
  if (!value) {
    return Number.NaN;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  if (typeof value === 'object') {
    // Handles Mongo extended JSON date shapes.
    if (Object.prototype.hasOwnProperty.call(value, '$date')) {
      const dateValue = value.$date;

      if (typeof dateValue === 'string' || typeof dateValue === 'number' || dateValue instanceof Date) {
        return toDateMs(dateValue);
      }

      if (dateValue && typeof dateValue === 'object' && Object.prototype.hasOwnProperty.call(dateValue, '$numberLong')) {
        const numberLong = Number(dateValue.$numberLong);
        return Number.isFinite(numberLong) ? numberLong : Number.NaN;
      }
    }
  }

  return Number.NaN;
}

function formatDuration(durationMs) {
  const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const totalSeconds = Math.floor(safeDurationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getDurationMsFromJob(job, polledAtMs) {
  const createdAtMs = toDateMs(job?.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return null;
  }

  return Math.max(polledAtMs - createdAtMs, 0);
}

function isTotalKnownForDisplay(status, current, total) {
  if (status === jobStatus.COMPLETE || status === jobStatus.ERROR || status === jobStatus.CANCELED) {
    return total > 0;
  }

  return total > current;
}

export default function DataLoads() {
  const [containers, setContainers] = useState([]);
  const [indexes, setIndexes] = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [initError, setInitError] = useState(null);

  // AI Search section state
  const [aiContainer, setAiContainer] = useState(EMPTY);
  const [aiFiles, setAiFiles] = useState([]);
  const [aiFile, setAiFile] = useState(EMPTY);
  const [aiFilesLoading, setAiFilesLoading] = useState(false);
  const [aiIndex, setAiIndex] = useState(EMPTY);
  const [aiUploadInProgress, setAiUploadInProgress] = useState(false);
  const [aiOverwriteDialog, setAiOverwriteDialog] = useState(false);
  const [aiDeleteDialog, setAiDeleteDialog] = useState({ open: false, containerName: '', blobName: '' });
  const [aiJobs, setAiJobs] = useState([]);
  const aiPollingTimeoutRefsRef = useRef({});
  const aiIndexingZeroStartRefsRef = useRef({});

  // Mongo DB section state
  const [mongoContainer, setMongoContainer] = useState(EMPTY);
  const [mongoFiles, setMongoFiles] = useState([]);
  const [mongoFile, setMongoFile] = useState(EMPTY);
  const [mongoFilesLoading, setMongoFilesLoading] = useState(false);
  const [mongoDatabases, setMongoDatabases] = useState([]);
  const [mongoCollections, setMongoCollections] = useState([]);
  const [mongoCollectionsLoading, setMongoCollectionsLoading] = useState(false);
  const [dbName, setDbName] = useState(EMPTY);
  const [collectionName, setCollectionName] = useState(EMPTY);
  const [mongoUploadInProgress, setMongoUploadInProgress] = useState(false);
  const [mongoOverwriteDialog, setMongoOverwriteDialog] = useState(false);
  const [mongoDeleteDialog, setMongoDeleteDialog] = useState({ open: false, containerName: '', blobName: '' });
  const [mongoJobs, setMongoJobs] = useState([]);
  const [mongoFormError, setMongoFormError] = useState('');
  const [mongoDbCustom, setMongoDbCustom] = useState(EMPTY);
  const [mongoCollectionCustom, setMongoCollectionCustom] = useState(EMPTY);
  const mongoPollingTimeoutRefsRef = useRef({});
  const mongoIndexingZeroStartRefsRef = useRef({});

  // Mongo create collection (no data) state
  const [createDbName, setCreateDbName] = useState(EMPTY);
  const [createDbCustom, setCreateDbCustom] = useState(EMPTY);
  const [createCollectionName, setCreateCollectionName] = useState(EMPTY);
  const [createInProgress, setCreateInProgress] = useState(false);
  const [createResult, setCreateResult] = useState(null);

  // Blob Upload section state
  const [uploadContainer, setUploadContainer] = useState(EMPTY);
  const [uploadContainerCustom, setUploadContainerCustom] = useState(EMPTY);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [uploadDuplicateDialog, setUploadDuplicateDialog] = useState({ open: false, duplicates: [], targetContainer: '', pendingFiles: [] });
  const [blobUploadJobs, setBlobUploadJobs] = useState([]);
  const blobTickRef = useRef(null);
  const uploadFileInputRef = useRef(null);

  // Fetch containers, indexes, and existing jobs on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const [fetchedContainers, fetchedIndexes, existingJobs, fetchedDatabases] = await Promise.all([
          getBlobContainers(),
          getAllIndexNames(),
          getAllDataLoadJobs(),
          getMongoDatabases(),
        ]);
        setContainers(fetchedContainers ?? []);
        setMongoDatabases(fetchedDatabases?.databases ?? []);
        setIndexes(fetchedIndexes ?? []);

        // Initialize UI job state from persisted jobs and continue polling active ones.
        const initialJobs = (existingJobs ?? [])
          .filter((job) => job?.jobType === AI_SEARCH_DATA_LOAD_JOB_TYPE)
          .map((job) => {
            const current = Number(job.current) || 0;
            const total = Number(job.total) || 0;
            const showTotal = isTotalKnownForDisplay(job.status, current, total);
            let message = '';

            if (job.status === jobStatus.COMPLETE) {
              message = `Upload complete. ${job.report?.insertedCount ?? 0} inserted, ${job.report?.skippedCount ?? 0} skipped.`;
            } else if (job.status === jobStatus.ERROR) {
              message = 'Upload ended with errors. Review the output report below.';
            } else if (job.status === jobStatus.CANCELED) {
              message = 'Upload was canceled.';
            } else {
              message = showTotal
                ? `Processing documents... (${current || 0} of ${total || 0})`
                : `Processing documents... (${current || 0} processed)`;
            }

            return {
              id: job.id,
              status: job.status,
              blobName: job.blobName,
              indexName: job.indexName,
              current,
              total,
              durationMs: getDurationMsFromJob(job, Date.now()),
              report: job.report ?? EMPTY_REPORT,
              error: job.error ?? null,
              message,
              showReport: job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR,
            };
          });

        setAiJobs(initialJobs);

        const initialMongoJobs = (existingJobs ?? [])
          .filter((job) => job?.jobType === MONGO_DATA_LOAD_JOB_TYPE)
          .map((job) => {
            const current = Number(job.current) || 0;
            const total = Number(job.total) || 0;
            const showTotal = isTotalKnownForDisplay(job.status, current, total);
            let message = '';

            if (job.status === jobStatus.COMPLETE) {
              message = `Upload complete. ${job.report?.insertedCount ?? 0} inserted, ${job.report?.skippedCount ?? 0} skipped.`;
            } else if (job.status === jobStatus.ERROR) {
              message = 'Upload ended with errors. Review the output report below.';
            } else if (job.status === jobStatus.CANCELED) {
              message = 'Upload was canceled.';
            } else {
              message = showTotal
                ? `Processing documents... (${current || 0} of ${total || 0})`
                : `Processing documents... (${current || 0} processed)`;
            }

            return {
              id: job.id,
              status: job.status,
              blobName: job.blobName,
              dbName: job.dbName,
              collectionName: job.collectionName,
              current,
              total,
              durationMs: getDurationMsFromJob(job, Date.now()),
              report: job.report ?? EMPTY_REPORT,
              error: job.error ?? null,
              message,
              showReport: job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR,
            };
          });

        setMongoJobs(initialMongoJobs);

        // Start polling only for active jobs.
        initialJobs
          .filter((jobUI) => jobUI.status === jobStatus.PROCESSING || jobUI.status === jobStatus.INDEXING)
          .forEach((jobUI) => {
            startPollingForJob(jobUI.id);
          });

        initialMongoJobs
          .filter((jobUI) => jobUI.status === jobStatus.PROCESSING || jobUI.status === jobStatus.INDEXING)
          .forEach((jobUI) => {
            startPollingForMongoJob(jobUI.id);
          });
      } catch (err) {
        setInitError('Failed to load configuration. Please refresh and try again.');
      } finally {
        setLoadingInit(false);
      }
    };
    initialize();
  }, []);

  // Fetch files when AI Search container changes
  useEffect(() => {
    if (!aiContainer) {
      setAiFiles([]);
      setAiFile(EMPTY);
      return;
    }
    const fetchFiles = async () => {
      setAiFilesLoading(true);
      setAiFiles([]);
      setAiFile(EMPTY);
      try {
        const files = await getBlobFiles(aiContainer);
        setAiFiles(files ?? []);
      } catch {
        setAiFiles([]);
      } finally {
        setAiFilesLoading(false);
      }
    };
    fetchFiles();
  }, [aiContainer]);

  // Fetch files when Mongo DB container changes
  useEffect(() => {
    if (!mongoContainer) {
      setMongoFiles([]);
      setMongoFile(EMPTY);
      return;
    }
    const fetchFiles = async () => {
      setMongoFilesLoading(true);
      setMongoFiles([]);
      setMongoFile(EMPTY);
      try {
        const files = await getBlobFiles(mongoContainer);
        setMongoFiles(files ?? []);
      } catch {
        setMongoFiles([]);
      } finally {
        setMongoFilesLoading(false);
      }
    };
    fetchFiles();
  }, [mongoContainer]);

  // Fetch collections when DB name changes
  useEffect(() => {
    if (!dbName || dbName === '__custom__') {
      setMongoCollections([]);
      setCollectionName(EMPTY);
      return;
    }
    const fetchCollections = async () => {
      setMongoCollectionsLoading(true);
      setMongoCollections([]);
      setCollectionName(EMPTY);
      try {
        const result = await getMongoCollections(dbName);
        setMongoCollections(result?.collections ?? []);
      } catch {
        setMongoCollections([]);
      } finally {
        setMongoCollectionsLoading(false);
      }
    };
    fetchCollections();
  }, [dbName]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(aiPollingTimeoutRefsRef.current).forEach((timeoutId) => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      Object.values(mongoPollingTimeoutRefsRef.current).forEach((timeoutId) => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      aiIndexingZeroStartRefsRef.current = {};
      mongoIndexingZeroStartRefsRef.current = {};
    };
  }, []);

  const aiSearchReady = aiContainer && aiFile && aiIndex;
  const effectiveDbName = dbName === '__custom__' ? mongoDbCustom.trim() : dbName;
  const effectiveCollectionName = collectionName === '__custom__' ? mongoCollectionCustom.trim() : collectionName;
  const mongoReady = mongoContainer && mongoFile && effectiveDbName && effectiveCollectionName;
  const effectiveCreateDbName = createDbName === '__custom__' ? createDbCustom.trim() : createDbName;
  const effectiveCreateCollectionName = createCollectionName.trim();
  const createReady = effectiveCreateDbName && effectiveCreateCollectionName;

  const handleCreateCollection = async () => {
    const newDb = effectiveCreateDbName;
    const newCollection = effectiveCreateCollectionName;
    setCreateInProgress(true);
    setCreateResult(null);

    try {
      await createMongoCollection(newDb, newCollection);
      setMongoDatabases((prev) => (prev.includes(newDb) ? prev : [...prev, newDb].sort()));
      if (dbName === newDb) {
        setMongoCollections((prev) => (prev.includes(newCollection) ? prev : [...prev, newCollection].sort()));
      }
      setCreateResult({ severity: 'success', message: `Created empty collection ${newDb}.${newCollection}.` });
      setCreateDbName(EMPTY);
      setCreateDbCustom(EMPTY);
      setCreateCollectionName(EMPTY);
    } catch (error) {
      setCreateResult({ severity: 'error', message: error.message || 'Failed to create collection.' });
    } finally {
      setCreateInProgress(false);
    }
  };

  const startPollingForJob = (jobId, initialInterval = 3000, maxInterval = 30000) => {
    let currentInterval = initialInterval;
    let attemptCount = 0;

    const poll = async () => {
      try {
        const job = await getAiSearchUploadJob(jobId);
        const polledAtMs = Date.now();
        const report = job.report ?? EMPTY_REPORT;
        const current = Number(job.current) || 0;
        const total = Number(job.total) || 0;
        const durationMs = getDurationMsFromJob(job, polledAtMs);

        // Guard against stalled jobs that reached INDEXING but never processed documents.
        if (job.status === jobStatus.INDEXING && current === 0) {
          const previousStartMs = aiIndexingZeroStartRefsRef.current[jobId];
          const updatedAtMs = toDateMs(job?.updatedAt);
          const createdAtMs = toDateMs(job?.createdAt);
          const serverHintStartMs = Number.isFinite(updatedAtMs)
            ? updatedAtMs
            : createdAtMs;
          const trackingStartMs = Number.isFinite(previousStartMs)
            ? previousStartMs
            : Number.isFinite(serverHintStartMs)
              ? serverHintStartMs
              : polledAtMs;

          aiIndexingZeroStartRefsRef.current[jobId] = trackingStartMs;

          if (polledAtMs - trackingStartMs > INDEXING_ZERO_STALL_TIMEOUT_MS) {
            const stalledErrorMessage = 'Job stalled in INDEXING with 0 processed documents for over 10 minutes.';

            try {
              await updateAiSearchUploadJob(jobId, {
                status: jobStatus.ERROR,
                current,
                total,
                report,
                error: stalledErrorMessage,
              });
            } catch {
              // Keep UI behavior deterministic even if persistence update fails.
            }

            setAiJobs((prev) =>
              prev.map((j) =>
                j.id === jobId
                  ? {
                    ...j,
                    status: jobStatus.ERROR,
                    durationMs,
                    error: stalledErrorMessage,
                    message: 'Upload ended with errors. Review the output report below.',
                    showReport: true,
                  }
                  : j
              )
            );

            if (aiPollingTimeoutRefsRef.current[jobId]) {
              clearTimeout(aiPollingTimeoutRefsRef.current[jobId]);
              delete aiPollingTimeoutRefsRef.current[jobId];
            }
            delete aiIndexingZeroStartRefsRef.current[jobId];
            return;
          }
        } else {
          delete aiIndexingZeroStartRefsRef.current[jobId];
        }

        const showTotal = isTotalKnownForDisplay(job.status, current, total);
        let message = '';
        if (job.status === jobStatus.COMPLETE) {
          message = `Upload complete. ${report?.insertedCount ?? 0} inserted, ${report?.skippedCount ?? 0} skipped.`;
        } else if (job.status === jobStatus.ERROR) {
          message = 'Upload ended with errors. Review the output report below.';
        } else if (job.status === jobStatus.CANCELED) {
          message = 'Upload was canceled.';
        } else {
          message = showTotal
            ? `Processing documents... (${current || 0} of ${total || 0})`
            : `Processing documents... (${current || 0} processed)`;
        }

        setAiJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                ...j,
                status: job.status,
                current,
                total,
                durationMs,
                report,
                error: job.status === jobStatus.ERROR ? (job.error || null) : null,
                message,
                showReport: job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR ? true : j.showReport,
              }
              : j
          )
        );

        if (job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR || job.status === jobStatus.CANCELED) {
          if (aiPollingTimeoutRefsRef.current[jobId]) {
            clearTimeout(aiPollingTimeoutRefsRef.current[jobId]);
            delete aiPollingTimeoutRefsRef.current[jobId];
          }
          delete aiIndexingZeroStartRefsRef.current[jobId];
          return;
        }

        attemptCount += 1;
        if (attemptCount % 5 === 0) {
          currentInterval = Math.min(currentInterval * 2, maxInterval);
        }

        aiPollingTimeoutRefsRef.current[jobId] = setTimeout(poll, currentInterval);
      } catch (error) {
        attemptCount += 1;
        if (attemptCount % 5 === 0) {
          currentInterval = Math.min(currentInterval * 2, maxInterval);
        }

        setAiJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                ...j,
                error: `Temporary polling issue: ${error.message}`,
              }
              : j
          )
        );

        aiPollingTimeoutRefsRef.current[jobId] = setTimeout(poll, currentInterval);
      }
    };

    poll();
  };

  const startPollingForMongoJob = (jobId, initialInterval = 3000, maxInterval = 30000) => {
    let currentInterval = initialInterval;
    let attemptCount = 0;

    const poll = async () => {
      try {
        const job = await getAiSearchUploadJob(jobId);
        const polledAtMs = Date.now();
        const report = job.report ?? EMPTY_REPORT;
        const current = Number(job.current) || 0;
        const total = Number(job.total) || 0;
        const durationMs = getDurationMsFromJob(job, polledAtMs);

        if (job.status === jobStatus.INDEXING && current === 0) {
          const previousStartMs = mongoIndexingZeroStartRefsRef.current[jobId];
          const updatedAtMs = toDateMs(job?.updatedAt);
          const createdAtMs = toDateMs(job?.createdAt);
          const serverHintStartMs = Number.isFinite(updatedAtMs)
            ? updatedAtMs
            : createdAtMs;
          const trackingStartMs = Number.isFinite(previousStartMs)
            ? previousStartMs
            : Number.isFinite(serverHintStartMs)
              ? serverHintStartMs
              : polledAtMs;

          mongoIndexingZeroStartRefsRef.current[jobId] = trackingStartMs;

          if (polledAtMs - trackingStartMs > INDEXING_ZERO_STALL_TIMEOUT_MS) {
            const stalledErrorMessage = 'Job stalled in INDEXING with 0 processed documents for over 10 minutes.';

            try {
              await updateAiSearchUploadJob(jobId, {
                status: jobStatus.ERROR,
                current,
                total,
                report,
                error: stalledErrorMessage,
              });
            } catch {
              // Keep UI behavior deterministic even if persistence update fails.
            }

            setMongoJobs((prev) =>
              prev.map((j) =>
                j.id === jobId
                  ? {
                    ...j,
                    status: jobStatus.ERROR,
                    durationMs,
                    error: stalledErrorMessage,
                    message: 'Upload ended with errors. Review the output report below.',
                    showReport: true,
                  }
                  : j
              )
            );

            if (mongoPollingTimeoutRefsRef.current[jobId]) {
              clearTimeout(mongoPollingTimeoutRefsRef.current[jobId]);
              delete mongoPollingTimeoutRefsRef.current[jobId];
            }
            delete mongoIndexingZeroStartRefsRef.current[jobId];
            return;
          }
        } else {
          delete mongoIndexingZeroStartRefsRef.current[jobId];
        }

        const showTotal = isTotalKnownForDisplay(job.status, current, total);
        let message = '';
        if (job.status === jobStatus.COMPLETE) {
          message = `Upload complete. ${report?.insertedCount ?? 0} inserted, ${report?.skippedCount ?? 0} skipped.`;
        } else if (job.status === jobStatus.ERROR) {
          message = 'Upload ended with errors. Review the output report below.';
        } else if (job.status === jobStatus.CANCELED) {
          message = 'Upload was canceled.';
        } else {
          message = showTotal
            ? `Processing documents... (${current || 0} of ${total || 0})`
            : `Processing documents... (${current || 0} processed)`;
        }

        setMongoJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                ...j,
                status: job.status,
                current,
                total,
                durationMs,
                report,
                error: job.status === jobStatus.ERROR ? (job.error || null) : null,
                message,
                showReport: job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR ? true : j.showReport,
              }
              : j
          )
        );

        if (job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR || job.status === jobStatus.CANCELED) {
          if (mongoPollingTimeoutRefsRef.current[jobId]) {
            clearTimeout(mongoPollingTimeoutRefsRef.current[jobId]);
            delete mongoPollingTimeoutRefsRef.current[jobId];
          }
          delete mongoIndexingZeroStartRefsRef.current[jobId];
          return;
        }

        attemptCount += 1;
        if (attemptCount % 5 === 0) {
          currentInterval = Math.min(currentInterval * 2, maxInterval);
        }

        mongoPollingTimeoutRefsRef.current[jobId] = setTimeout(poll, currentInterval);
      } catch (error) {
        attemptCount += 1;
        if (attemptCount % 5 === 0) {
          currentInterval = Math.min(currentInterval * 2, maxInterval);
        }

        setMongoJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                ...j,
                error: `Temporary polling issue: ${error.message}`,
              }
              : j
          )
        );

        mongoPollingTimeoutRefsRef.current[jobId] = setTimeout(poll, currentInterval);
      }
    };

    poll();
  };

  const handleAiSearchUpload = async () => {
    try {
      const check = await checkAiSearchIndex(aiIndex);
      if (check.exists && check.documentCount > 0) {
        setAiOverwriteDialog(true);
        return;
      }
    } catch {
      // If check fails, proceed without dialog
    }

    await runAiSearchUpload(false);
  };

  const runAiSearchUpload = async (overwrite) => {
    setAiOverwriteDialog(false);
    setAiUploadInProgress(true);

    try {
      const response = await startAiSearchUpload({
        containerName: aiContainer,
        blobName: aiFile,
        indexName: aiIndex,
        overwrite,
      });

      const job = response.job;
      const durationMs = getDurationMsFromJob(job, Date.now());

      const newJobUI = {
        id: job?.id,
        status: jobStatus.PROCESSING,
        blobName: aiFile,
        indexName: aiIndex,
        current: Number(job?.current) || 0,
        total: Number(job?.total) || 0,
        durationMs,
        report: EMPTY_REPORT,
        error: null,
        message: `Upload started for ${aiFile}. Monitoring progress...`,
        showReport: false,
      };

      setAiJobs((prev) => {
        const active = prev.filter((j) => j.status === jobStatus.PROCESSING || j.status === jobStatus.INDEXING);
        return [...active, newJobUI];
      });

      if (job?.id) {
        startPollingForJob(job.id);
      }

      // Clear form
      setAiContainer(EMPTY);
      setAiFile(EMPTY);
      setAiIndex(EMPTY);
    } catch (error) {
      const errorMsg = error.message || 'Failed to start AI Search upload.';
      const newJobUI = {
        id: `error-${Date.now()}`,
        status: jobStatus.ERROR,
        blobName: aiFile,
        indexName: aiIndex,
        current: 0,
        total: 0,
        durationMs: 0,
        report: EMPTY_REPORT,
        error: errorMsg,
        message: errorMsg,
        showReport: false,
      };
      setAiJobs((prev) => {
        const active = prev.filter((j) => j.status === jobStatus.PROCESSING || j.status === jobStatus.INDEXING);
        return [...active, newJobUI];
      });
    } finally {
      setAiUploadInProgress(false);
    }
  };

  const handleMongoUpload = async () => {
    if (!isBsonlFileName(mongoFile)) {
      setMongoFormError('Mongo upload requires a .bsonl blob file. Use the extract-mongo-collection script to produce this format.');
      return;
    }

    setMongoFormError('');

    try {
      const check = await checkMongoCollection(effectiveDbName, effectiveCollectionName);
      if (check.exists && check.documentCount > 0) {
        setMongoOverwriteDialog(true);
        return;
      }
    } catch {
      // If check fails, proceed without dialog
    }

    await runMongoUpload(false);
  };

  const runMongoUpload = async (overwrite) => {
    setMongoOverwriteDialog(false);
    setMongoUploadInProgress(true);

    try {
      const response = await startMongoUpload({
        containerName: mongoContainer,
        blobName: mongoFile,
        dbName: effectiveDbName,
        collectionName: effectiveCollectionName,
        overwrite,
      });

      const job = response.job;
      const durationMs = getDurationMsFromJob(job, Date.now());

      const newJobUI = {
        id: job?.id,
        status: jobStatus.PROCESSING,
        blobName: mongoFile,
        dbName: effectiveDbName,
        collectionName: effectiveCollectionName,
        current: Number(job?.current) || 0,
        total: Number(job?.total) || 0,
        durationMs,
        report: EMPTY_REPORT,
        error: null,
        message: `Upload started for ${mongoFile}. Monitoring progress...`,
        showReport: false,
      };

      setMongoJobs((prev) => {
        const active = prev.filter((j) => j.status === jobStatus.PROCESSING || j.status === jobStatus.INDEXING);
        return [...active, newJobUI];
      });

      if (job?.id) {
        startPollingForMongoJob(job.id);
      }

      setMongoContainer(EMPTY);
      setMongoFile(EMPTY);
      setDbName(EMPTY);
      setCollectionName(EMPTY);
      setMongoDbCustom(EMPTY);
      setMongoCollectionCustom(EMPTY);
    } catch (error) {
      const errorMsg = error.message || 'Failed to start Mongo upload.';
      const newJobUI = {
        id: `mongo-error-${Date.now()}`,
        status: jobStatus.ERROR,
        blobName: mongoFile,
        dbName: effectiveDbName,
        collectionName: effectiveCollectionName,
        current: 0,
        total: 0,
        durationMs: 0,
        report: EMPTY_REPORT,
        error: errorMsg,
        message: errorMsg,
        showReport: false,
      };
      setMongoJobs((prev) => {
        const active = prev.filter((j) => j.status === jobStatus.PROCESSING || j.status === jobStatus.INDEXING);
        return [...active, newJobUI];
      });
    } finally {
      setMongoUploadInProgress(false);
    }
  };

  const handleBlobUpload = async () => {
    const targetContainer = uploadContainer === '__custom__' ? uploadContainerCustom.trim() : uploadContainer;

    if (!targetContainer || uploadFiles.length === 0) return;

    // Check for duplicates before uploading.
    let existingFiles = [];
    try {
      existingFiles = await getBlobFiles(targetContainer) ?? [];
    } catch {
      // Container may not exist yet; treat as no existing files.
      existingFiles = [];
    }

    const duplicates = uploadFiles.filter((f) => existingFiles.includes(f.name)).map((f) => f.name);

    if (duplicates.length > 0) {
      setUploadDuplicateDialog({ open: true, duplicates, targetContainer, pendingFiles: uploadFiles });
      return;
    }

    await runBlobUpload(targetContainer, uploadFiles);
  };

  const handleDeleteAiBlob = async () => {
    const { containerName, blobName } = aiDeleteDialog;
    setAiDeleteDialog({ open: false, containerName: '', blobName: '' });
    try {
      await deleteBlobFile(containerName, blobName);
      setAiFiles((prev) => prev.filter((f) => f !== blobName));
      if (aiFile === blobName) setAiFile(EMPTY);
      if (mongoContainer === containerName) {
        setMongoFiles((prev) => prev.filter((f) => f !== blobName));
        if (mongoFile === blobName) setMongoFile(EMPTY);
      }
    } catch {
      // Silently handle — file may already be deleted
    }
  };

  const handleDeleteMongoBlob = async () => {
    const { containerName, blobName } = mongoDeleteDialog;
    setMongoDeleteDialog({ open: false, containerName: '', blobName: '' });
    try {
      await deleteBlobFile(containerName, blobName);
      setMongoFiles((prev) => prev.filter((f) => f !== blobName));
      if (mongoFile === blobName) setMongoFile(EMPTY);
      if (aiContainer === containerName) {
        setAiFiles((prev) => prev.filter((f) => f !== blobName));
        if (aiFile === blobName) setAiFile(EMPTY);
      }
    } catch {
      // Silently handle — file may already be deleted
    }
  };

  const runBlobUpload = async (targetContainer, files) => {
    setUploadInProgress(true);

    const jobs = files.map((file, idx) => ({
      id: `blob-${Date.now()}-${idx}`,
      fileName: file.name,
      fileSize: file.size,
      status: 'pending',
      startedAt: null,
      durationMs: null,
      error: null,
    }));
    setBlobUploadJobs(jobs);

    // Start a 1-second tick to update elapsed time for the active upload.
    blobTickRef.current = setInterval(() => {
      setBlobUploadJobs((prev) =>
        prev.map((j) =>
          j.status === 'uploading' && j.startedAt
            ? { ...j, durationMs: Date.now() - j.startedAt }
            : j
        )
      );
    }, 1000);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const startedAt = Date.now();

      setBlobUploadJobs((prev) =>
        prev.map((j, idx) => idx === i ? { ...j, status: 'uploading', startedAt } : j)
      );

      try {
        await uploadBlobFile(targetContainer, file);
        const durationMs = Date.now() - startedAt;
        setBlobUploadJobs((prev) =>
          prev.map((j, idx) => idx === i ? { ...j, status: 'success', durationMs } : j)
        );
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        setBlobUploadJobs((prev) =>
          prev.map((j, idx) => idx === i ? { ...j, status: 'error', error: error.message, durationMs } : j)
        );
      }
    }

    clearInterval(blobTickRef.current);
    blobTickRef.current = null;
    setUploadFiles([]);
    setUploadInProgress(false);
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = '';
    }
  };

  const handleDuplicateConfirm = async () => {
    const { targetContainer, pendingFiles } = uploadDuplicateDialog;
    setUploadDuplicateDialog({ open: false, duplicates: [], targetContainer: '', pendingFiles: [] });
    await runBlobUpload(targetContainer, pendingFiles);
  };

  const handleDuplicateCancel = () => {
    setUploadDuplicateDialog({ open: false, duplicates: [], targetContainer: '', pendingFiles: [] });
  };

  const effectiveUploadContainer = uploadContainer === '__custom__' ? uploadContainerCustom.trim() : uploadContainer;
  const blobUploadReady = effectiveUploadContainer && uploadFiles.length > 0 && !uploadInProgress && uploadFiles.every((f) => f.size <= 200 * 1024 * 1024);

  if (loadingInit) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {initError && <Alert severity="error">{initError}</Alert>}

      <Alert severity="info">
        This tool expects that you have exported data from either Azure AI Search or Mongo DB using one of the extraction scripts
        (extract-ai-search-index.js/extract-mongo-collection.js). AI Search requires .jsonl format. Mongo requires .bsonl format
        which preserves type information like ObjectId and Date automatically.
      </Alert>

      {/* ── Blob Upload ── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          Upload Files to Blob Storage
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start', mb: 2 }}>
          {/* Container selector */}
          <FormControl size="small" sx={{ minWidth: 220 }} disabled={uploadInProgress}>
            <InputLabel>Container</InputLabel>
            <Select
              value={uploadContainer}
              label="Container"
              onChange={(e) => setUploadContainer(e.target.value)}
            >
              {containers.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
              <MenuItem value="__custom__">
                <em>Type a new container name...</em>
              </MenuItem>
            </Select>
          </FormControl>

          {/* Custom container name input */}
          {uploadContainer === '__custom__' && (
            <TextField
              size="small"
              label="Container Name"
              value={uploadContainerCustom}
              onChange={(e) => setUploadContainerCustom(e.target.value)}
              sx={{ minWidth: 220 }}
              disabled={uploadInProgress}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
          <Button
            variant="action"
            component="label"
            disabled={uploadInProgress}
          >
            Select Files
            <input
              ref={uploadFileInputRef}
              type="file"
              hidden
              multiple
              onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
            />
          </Button>



          <Button
            variant="primary"
            startIcon={uploadInProgress ? <CircularProgress size={18} color="inherit" /> : <CloudUpload />}
            disabled={!blobUploadReady}
            onClick={handleBlobUpload}
            sx={{ height: 40 }}
          >
            {uploadInProgress ? 'Uploading...' : 'Upload'}
          </Button>
        </Box>

        {uploadFiles.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {uploadFiles.map((file, idx) => (
              <Typography key={idx} variant="body2" sx={{ color: 'text.secondary' }}>
                {file.name} ({file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`})
                {file.size > 200 * 1024 * 1024 && (
                  <Typography component="span" variant="body2" color="error"> — exceeds 200 MB limit</Typography>
                )}
              </Typography>
            ))}
          </Box>
        )}

        {blobUploadJobs.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
            {blobUploadJobs.map((job) => (
              <Paper key={job.id} variant="outlined" sx={{ p: 2, backgroundColor: (theme) => theme.palette.form.background }}>
                {job.status === 'error' && job.error && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBlobUploadJobs((prev) => prev.filter((j) => j.id !== job.id))}>
                    {job.error}
                  </Alert>
                )}

                {job.status === 'success' && (
                  <Alert severity="success" onClose={() => setBlobUploadJobs((prev) => prev.filter((j) => j.id !== job.id))}>
                    Upload complete — {job.fileName} ({job.fileSize >= 1024 * 1024 ? `${(job.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${(job.fileSize / 1024).toFixed(1)} KB`}) in {formatDuration(job.durationMs)}
                  </Alert>
                )}

                {job.status === 'uploading' && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Uploading {job.fileName}...
                  </Alert>
                )}

                {job.status === 'pending' && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Waiting...
                  </Alert>
                )}

                {job.status !== 'success' && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {job.fileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {job.fileSize >= 1024 * 1024 ? `${(job.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${(job.fileSize / 1024).toFixed(1)} KB`}
                    </Typography>
                  </Box>
                )}

                {job.status === 'uploading' && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Duration: {formatDuration(job.durationMs ?? 0)}
                    </Typography>
                    <LinearProgress variant="indeterminate" />
                  </Box>
                )}

                {job.status === 'error' && job.durationMs != null && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Failed after {formatDuration(job.durationMs)}
                    </Typography>
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        )}

        <Dialog open={uploadDuplicateDialog.open} onClose={handleDuplicateCancel}>
          <DialogTitle>Overwrite existing files?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              The following file{uploadDuplicateDialog.duplicates.length > 1 ? 's' : ''} already exist in the container and will be overwritten:
            </DialogContentText>
            <Box component="ul" sx={{ mt: 1, pl: 2 }}>
              {uploadDuplicateDialog.duplicates.map((name) => (
                <Typography key={name} component="li" variant="body2">{name}</Typography>
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button variant="secondary" onClick={handleDuplicateCancel}>Cancel</Button>
            <Button variant="destructive" onClick={handleDuplicateConfirm}>Overwrite</Button>
          </DialogActions>
        </Dialog>
      </Paper>

      {/* Overwrite dialog for AI Search */}
      <Dialog open={aiOverwriteDialog} onClose={() => setAiOverwriteDialog(false)}>
        <DialogTitle>Overwrite existing documents?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            If documents with the same ID already exist in the index, would you like to overwrite them or skip them?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setAiOverwriteDialog(false)}>Cancel</Button>
          <Button variant="action" onClick={() => runAiSearchUpload(false)}>Skip Existing</Button>
          <Button variant="destructive" onClick={() => runAiSearchUpload(true)}>Overwrite</Button>
        </DialogActions>
      </Dialog>

      {/* Overwrite dialog for Mongo */}
      <Dialog open={mongoOverwriteDialog} onClose={() => setMongoOverwriteDialog(false)}>
        <DialogTitle>Overwrite existing documents?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            If documents with the same _id already exist in the collection, would you like to overwrite them or skip them?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setMongoOverwriteDialog(false)}>Cancel</Button>
          <Button variant="action" onClick={() => runMongoUpload(false)}>Skip Existing</Button>
          <Button variant="destructive" onClick={() => runMongoUpload(true)}>Overwrite</Button>
        </DialogActions>
      </Dialog>

      {/* Delete blob confirmation - AI Search */}
      <Dialog open={aiDeleteDialog.open} onClose={() => setAiDeleteDialog({ open: false, containerName: '', blobName: '' })}>
        <DialogTitle>Delete Blob File</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{aiDeleteDialog.blobName}</strong> from container <strong>{aiDeleteDialog.containerName}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setAiDeleteDialog({ open: false, containerName: '', blobName: '' })}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteAiBlob}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Delete blob confirmation - Mongo */}
      <Dialog open={mongoDeleteDialog.open} onClose={() => setMongoDeleteDialog({ open: false, containerName: '', blobName: '' })}>
        <DialogTitle>Delete Blob File</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{mongoDeleteDialog.blobName}</strong> from container <strong>{mongoDeleteDialog.containerName}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setMongoDeleteDialog({ open: false, containerName: '', blobName: '' })}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteMongoBlob}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* ── AI Search Data Load ── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          AI Search Data Load
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start', mb: 3 }}>
          {/* Container */}
          <FormControl size="small" sx={{ minWidth: 220 }} disabled={aiUploadInProgress}>
            <InputLabel>Select Container</InputLabel>
            <Select
              value={aiContainer}
              label="Select Container"
              onChange={(e) => setAiContainer(e.target.value)}
            >
              {containers.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Blob File */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FormControl size="small" sx={{ minWidth: 280 }} disabled={!aiContainer || aiFilesLoading || aiUploadInProgress}>
              <InputLabel>{aiFilesLoading ? 'Loading files…' : 'Select Blob File'}</InputLabel>
              <Select
                value={aiFile}
                label={aiFilesLoading ? 'Loading files…' : 'Select Blob File'}
                onChange={(e) => setAiFile(e.target.value)}
                endAdornment={aiFilesLoading ? <CircularProgress size={16} sx={{ mr: 2 }} /> : null}
              >
                {aiFiles.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Delete selected blob file">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={!aiFile || aiUploadInProgress}
                  onClick={() => setAiDeleteDialog({ open: true, containerName: aiContainer, blobName: aiFile })}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {/* Index */}
          <FormControl size="small" sx={{ minWidth: 220 }} disabled={aiUploadInProgress}>
            <InputLabel>Index Name</InputLabel>
            <Select
              value={aiIndex}
              label="Index Name"
              onChange={(e) => setAiIndex(e.target.value)}
            >
              {indexes.map((idx) => (
                <MenuItem key={idx} value={idx}>
                  {idx}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="primary"
            startIcon={aiUploadInProgress ? <CircularProgress size={18} color="inherit" /> : <CloudUpload />}
            disabled={!aiSearchReady || aiUploadInProgress}
            onClick={handleAiSearchUpload}
            sx={{ height: 40, alignSelf: 'center' }}
          >
            {aiUploadInProgress ? 'Starting...' : 'Upload'}
          </Button>
        </Box>

        {/* Job listings */}
        {aiJobs.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {aiJobs.map((job) => {
              const progressPercent = job.total > 0 ? Math.min((job.current / job.total) * 100, 100) : 0;
              const showTotal = isTotalKnownForDisplay(job.status, job.current, job.total);

              return (
                <Paper key={job.id} variant="outlined" sx={{ p: 2, backgroundColor: (theme) => theme.palette.form.background }}>
                  {job.error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAiJobs((prev) => prev.filter((j) => j.id !== job.id))}>
                      {job.error}
                    </Alert>
                  )}

                  {job.message && !job.error && (
                    <Alert
                      severity={
                        job.status === jobStatus.COMPLETE
                          ? 'success'
                          : job.status === jobStatus.ERROR
                            ? 'error'
                            : 'info'
                      }
                      sx={{ mb: 2 }}
                      {...(job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR || job.status === jobStatus.CANCELED
                        ? { onClose: () => setAiJobs((prev) => prev.filter((j) => j.id !== job.id)) }
                        : {})}
                    >
                      {job.message}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {job.blobName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {job.indexName}
                    </Typography>
                  </Box>

                  {(job.status === jobStatus.PROCESSING || job.status === jobStatus.INDEXING) && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                        {showTotal
                          ? `Documents processed: ${job.current} / ${job.total}`
                          : `Documents processed: ${job.current}`}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Duration: {formatDuration(job.durationMs ?? 0)}
                      </Typography>
                      <LinearProgress variant="determinate" value={progressPercent} />
                    </Box>
                  )}

                  {job.showReport && job.status !== jobStatus.PROCESSING && (
                    <Box sx={{ mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                        Output Report
                      </Typography>

                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 2 }}>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Inserted
                          </Typography>
                          <Typography variant="h6">{job.report.insertedCount}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Skipped
                          </Typography>
                          <Typography variant="h6">{job.report.skippedCount}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Errors
                          </Typography>
                          <Typography variant="h6">{job.report.errors.length}</Typography>
                        </Paper>
                      </Box>

                      {job.report.errors.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Errors
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 200, overflowY: 'auto' }}>
                            {job.report.errors.map((errorMessage, index) => (
                              <Typography key={`${errorMessage}-${index}`} variant="body2" sx={{ mb: index === job.report.errors.length - 1 ? 0 : 0.5 }}>
                                {errorMessage}
                              </Typography>
                            ))}
                          </Paper>
                        </Box>
                      )}
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* ── Mongo DB Data Load ── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          Mongo DB Data Load
        </Typography>

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Create Database / Collection
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create an empty collection (and database, if new) without loading data. Use this if you need to apply indexes before loading data below.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
          <FormControl size="small" sx={{ minWidth: 180 }} disabled={createInProgress}>
            <InputLabel>DB Name</InputLabel>
            <Select
              value={createDbName}
              label="DB Name"
              onChange={(e) => {
                setCreateDbName(e.target.value);
                if (e.target.value !== '__custom__') {
                  setCreateDbCustom(EMPTY);
                }
              }}
            >
              {mongoDatabases.map((db) => (
                <MenuItem key={db} value={db}>{db}</MenuItem>
              ))}
              <MenuItem value="__custom__"><strong><em>Create New DB...</em></strong></MenuItem>
            </Select>
          </FormControl>
          {createDbName === '__custom__' && (
            <TextField
              size="small"
              label="New DB Name"
              value={createDbCustom}
              onChange={(e) => setCreateDbCustom(e.target.value)}
              disabled={createInProgress}
              sx={{ minWidth: 180 }}
            />
          )}

          <TextField
            size="small"
            label="New Collection Name"
            value={createCollectionName}
            onChange={(e) => setCreateCollectionName(e.target.value)}
            disabled={createInProgress}
            sx={{ minWidth: 200 }}
          />

          <Button
            variant="primary"
            startIcon={createInProgress ? <CircularProgress size={18} color="inherit" /> : null}
            disabled={!createReady || createInProgress}
            onClick={handleCreateCollection}
            sx={{ height: 40, alignSelf: 'center' }}
          >
            {createInProgress ? 'Creating...' : 'Create'}
          </Button>
        </Box>

        {createResult && (
          <Alert severity={createResult.severity} sx={{ mt: 2 }} onClose={() => setCreateResult(null)}>
            {createResult.message}
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Load Data
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
          {/* Container */}
          <FormControl size="small" sx={{ minWidth: 220 }} disabled={mongoUploadInProgress}>
            <InputLabel>Select Container</InputLabel>
            <Select
              value={mongoContainer}
              label="Select Container"
              onChange={(e) => setMongoContainer(e.target.value)}
            >
              {containers.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Blob File */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FormControl size="small" sx={{ minWidth: 280 }} disabled={!mongoContainer || mongoFilesLoading || mongoUploadInProgress}>
              <InputLabel>
                {mongoFilesLoading ? 'Loading files…' : 'Select Blob File'}
              </InputLabel>
              <Select
                value={mongoFile}
                label={mongoFilesLoading ? 'Loading files…' : 'Select Blob File'}
                onChange={(e) => setMongoFile(e.target.value)}
                endAdornment={mongoFilesLoading ? <CircularProgress size={16} sx={{ mr: 2 }} /> : null}
              >
                {mongoFiles.map((f) => (
                  <MenuItem key={f} value={f}>{f}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Delete selected blob file">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={!mongoFile || mongoUploadInProgress}
                  onClick={() => setMongoDeleteDialog({ open: true, containerName: mongoContainer, blobName: mongoFile })}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {/* DB Name */}
          <FormControl size="small" sx={{ minWidth: 180 }} disabled={mongoUploadInProgress}>
            <InputLabel>DB Name</InputLabel>
            <Select
              value={dbName}
              label="DB Name"
              onChange={(e) => {
                setDbName(e.target.value);
                if (e.target.value !== '__custom__') {
                  setMongoDbCustom(EMPTY);
                }
              }}
            >
              {mongoDatabases.map((db) => (
                <MenuItem key={db} value={db}>{db}</MenuItem>
              ))}
              <MenuItem value="__custom__"><strong><em>Create New DB...</em></strong></MenuItem>
            </Select>
          </FormControl>
          {dbName === '__custom__' && (
            <TextField
              size="small"
              label="New DB Name"
              value={mongoDbCustom}
              onChange={(e) => setMongoDbCustom(e.target.value)}
              disabled={mongoUploadInProgress}
              sx={{ minWidth: 180 }}
            />
          )}

          {/* Collection Name */}
          <FormControl size="small" sx={{ minWidth: 200 }} disabled={(!dbName || (dbName !== '__custom__' && mongoCollectionsLoading)) || mongoUploadInProgress}>
            <InputLabel>{mongoCollectionsLoading && dbName !== '__custom__' ? 'Loading...' : 'Collection Name'}</InputLabel>
            <Select
              value={collectionName}
              label={mongoCollectionsLoading && dbName !== '__custom__' ? 'Loading...' : 'Collection Name'}
              onChange={(e) => {
                setCollectionName(e.target.value);
                if (e.target.value !== '__custom__') {
                  setMongoCollectionCustom(EMPTY);
                }
              }}
              endAdornment={mongoCollectionsLoading && dbName !== '__custom__' ? <CircularProgress size={16} sx={{ mr: 2 }} /> : null}
            >
              {mongoCollections.map((col) => (
                <MenuItem key={col} value={col}>{col}</MenuItem>
              ))}
              <MenuItem value="__custom__"><strong><em>Create New Collection...</em></strong></MenuItem>
            </Select>
          </FormControl>
          {collectionName === '__custom__' && (
            <TextField
              size="small"
              label="New Collection Name"
              value={mongoCollectionCustom}
              onChange={(e) => setMongoCollectionCustom(e.target.value)}
              disabled={mongoUploadInProgress}
              sx={{ minWidth: 200 }}
            />
          )}

          <Button
            variant="primary"
            startIcon={mongoUploadInProgress ? <CircularProgress size={18} color="inherit" /> : <CloudUpload />}
            disabled={!mongoReady || mongoUploadInProgress}
            onClick={handleMongoUpload}
            sx={{ height: 40, alignSelf: 'center' }}
          >
            {mongoUploadInProgress ? 'Starting...' : 'Upload'}
          </Button>
        </Box>

        {mongoFormError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {mongoFormError}
          </Alert>
        )}

        {mongoJobs.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
            {mongoJobs.map((job) => {
              const progressPercent = job.total > 0 ? Math.min((job.current / job.total) * 100, 100) : 0;
              const showTotal = isTotalKnownForDisplay(job.status, job.current, job.total);

              return (
                <Paper key={job.id} variant="outlined" sx={{ p: 2, backgroundColor: (theme) => theme.palette.form.background }}>
                  {job.error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMongoJobs((prev) => prev.filter((j) => j.id !== job.id))}>
                      {job.error}
                    </Alert>
                  )}

                  {job.message && !job.error && (
                    <Alert
                      severity={
                        job.status === jobStatus.COMPLETE
                          ? 'success'
                          : job.status === jobStatus.ERROR
                            ? 'error'
                            : 'info'
                      }
                      sx={{ mb: 2 }}
                      {...(job.status === jobStatus.COMPLETE || job.status === jobStatus.ERROR || job.status === jobStatus.CANCELED
                        ? { onClose: () => setMongoJobs((prev) => prev.filter((j) => j.id !== job.id)) }
                        : {})}
                    >
                      {job.message}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {job.blobName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {job.dbName}.{job.collectionName}
                    </Typography>
                  </Box>

                  {(job.status === jobStatus.PROCESSING || job.status === jobStatus.INDEXING) && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                        {showTotal
                          ? `Documents processed: ${job.current} / ${job.total}`
                          : `Documents processed: ${job.current}`}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Duration: {formatDuration(job.durationMs ?? 0)}
                      </Typography>
                      <LinearProgress variant="determinate" value={progressPercent} />
                    </Box>
                  )}

                  {job.showReport && job.status !== jobStatus.PROCESSING && (
                    <Box sx={{ mt: 2, borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                        Output Report
                      </Typography>

                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 2 }}>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Inserted
                          </Typography>
                          <Typography variant="h6">{job.report.insertedCount}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Skipped
                          </Typography>
                          <Typography variant="h6">{job.report.skippedCount}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Errors
                          </Typography>
                          <Typography variant="h6">{job.report.errors.length}</Typography>
                        </Paper>
                      </Box>

                      {job.report.errors.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Errors
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 200, overflowY: 'auto' }}>
                            {job.report.errors.map((errorMessage, index) => (
                              <Typography key={`${errorMessage}-${index}`} variant="body2" sx={{ mb: index === job.report.errors.length - 1 ? 0 : 0.5 }}>
                                {errorMessage}
                              </Typography>
                            ))}
                          </Paper>
                        </Box>
                      )}
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
