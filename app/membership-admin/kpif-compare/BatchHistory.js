'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Chip, CircularProgress,
  Collapse, Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button,
  TablePagination,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  getRunHistory, downloadFinalResults, getIpbCount,
  checkFinalResultsExist, uploadFinalResults, deleteRunHistory,
} from './clientServices/batchEntryService';
import {
  getKpifTargetDatabaseOptions,
  getKpifTargetDatabases,
} from './config/targetDatabases';
import {
  formatOracleLocalDate,
  formatOracleLocalDuration,
} from './utils/timestampUtils';

const PAGE_SIZE = 10;
const PAGINATION_DEBOUNCE_MS = 300;

const CA_IPB_RULES = [
  'IPB0001_3',
  'IPB0001_4',
  'IPB0001_6',
  'IPB0001_12',
  'IPB0001_16',
  'IPB0001_17',
  'IPB0001_22',
  'IPB0001_23',
  'IPB0001_24',
  'IPB0001_25',
  'IPB0001_26',
  'IPB0001_27',
  'IPB0001_28',
  'IPB0001_29',
];

const MOC_IPB_RULES = [
  'IPB0001_19',
  'IPB0001_29',
  'IPB0001_8',
  'IPB0001_24',
  'IPB0001_25',
  'IPB0001_30',
  'IPB0001_42',
  'IPB0001_28',
  'IPB0001_31',
  'IPB0001_43',
  'IPB0001_14',
  'IPB0001_18',
  'IPB0001_4',
  'IPB0001_5',
];

function buildRowKey(row) {
  return `${row.targetDatabase}-${row.runId}-${row.batchNumber}`;
}

function buildBlobStateKey(row, invoiceType) {
  return `${buildRowKey(row)}-${invoiceType}`;
}

const formatDuration = formatOracleLocalDuration;
const formatDate = formatOracleLocalDate;

function formatQualityPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'NA';
  }

  return `${parseFloat(Number(value).toFixed(2))}%`;
}

function computeRuleQualityPercent(passCount, totalRecords) {
  const numerator = Number(passCount || 0);
  const denominator = Number(totalRecords || 0);

  if (denominator <= 0) {
    return null;
  }

  return (numerator / denominator) * 100;
}

function computeSourceQualityPercent(ipbCounts) {
  if (!ipbCounts) {
    return null;
  }

  let yesTotal = 0;
  let noTotal = 0;

  for (const ruleCount of Object.values(ipbCounts)) {
    yesTotal += Number(ruleCount?.yes || 0);
    noTotal += Number(ruleCount?.no || 0);
  }

  const denominator = yesTotal + noTotal;
  if (denominator <= 0) {
    return null;
  }

  return (yesTotal / denominator) * 100;
}

function IpbCountsTable({ title, totalRecords, invoiceCount, rules, ipbCounts, rowKeyPrefix }) {
  const qualityScoreDenominator = Number(invoiceCount || totalRecords || 0);

  return (
    <Box sx={{ width: 400 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Total records: {totalRecords ?? '—'}
      </Typography>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>IPB Rule</TableCell>
              <TableCell align="right">Pass</TableCell>
              <TableCell align="right">Flag</TableCell>
              <TableCell align="right">Quality Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={`${rowKeyPrefix}-${rule}`}>
                <TableCell>{rule}</TableCell>
                <TableCell align="right">{ipbCounts?.[rule]?.yes ?? 0}</TableCell>
                <TableCell align="right">{ipbCounts?.[rule]?.no ?? 0}</TableCell>
                <TableCell align="right">
                  {formatQualityPercent(
                    computeRuleQualityPercent(ipbCounts?.[rule]?.yes, qualityScoreDenominator)
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

/**
 * A single run-history table for one target database.
 */
const RunHistoryTable = ({
  dbKey,
  rows,
  totalRows,
  page,
  isPageLoading,
  onPageChange,
  downloadingKey,
  onDownload,
  blobStatusByRowKey,
  onUpload,
  expandedRowKeys,
  ipbCountByRowKey,
  ipbLoadingRowKey,
  ipbErrorByRowKey,
  onToggleExpand,
  dbDisplayNames,
  canDeleteRunHistory,
  onDelete,
  deletingRowKey,
}) => {
  const handlePageChange = (_event, newPage) => {
    onPageChange(dbKey, newPage);
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Typography variant="h6">
          Run History — {dbDisplayNames[dbKey] || dbKey}
        </Typography>
        {isPageLoading && (
          <>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Loading page...
            </Typography>
          </>
        )}
      </Box>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          opacity: isPageLoading ? 0.65 : 1,
          transition: 'opacity 120ms ease-out',
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={56} />
              <TableCell>Run ID</TableCell>
              <TableCell>Batch Number</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>Completed</TableCell>
              <TableCell>Run Duration</TableCell>
              <TableCell align="right">Quality % CA</TableCell>
              <TableCell align="right">Quality % MOC</TableCell>
              <TableCell align="right">Invoices CA</TableCell>
              <TableCell align="right">Invoices MOC</TableCell>
              <TableCell align="right">Records ORMB</TableCell>
              <TableCell align="center">Results</TableCell>
              {canDeleteRunHistory && <TableCell align="center">Delete</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const rowKey = buildRowKey(row);
              const isExpanded = !!expandedRowKeys[rowKey];
              const ipbData = ipbCountByRowKey[rowKey];
              const isLoadingCounts = !!ipbLoadingRowKey[rowKey];
              const loadError = ipbErrorByRowKey[rowKey];
              const caOverallQuality = computeSourceQualityPercent(ipbData?.ca?.ipbCounts);
              const mocOverallQuality = computeSourceQualityPercent(ipbData?.moc?.ipbCounts);

              return (
                <Fragment key={rowKey}>
                  <TableRow key={`${rowKey}-main`} hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => onToggleExpand(row)}
                        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                      >
                        {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{row.runId}</TableCell>
                    <TableCell>{row.batchNumber}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.status}
                        size="small"
                        color={
                          row.status === 'COMPLETE' ? 'success'
                            : row.status === 'CANCELED' ? 'warning'
                              : 'error'
                        }
                      />
                    </TableCell>
                    <TableCell>{formatDate(row.startTs)}</TableCell>
                    <TableCell>{formatDate(row.endTs)}</TableCell>
                    <TableCell>{formatDuration(row.startTs, row.endTs)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {ipbData ? formatQualityPercent(caOverallQuality) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {ipbData ? formatQualityPercent(mocOverallQuality) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{row.invoicesCa ?? '—'}</TableCell>
                    <TableCell align="right">{row.invoicesRoc ?? '—'}</TableCell>
                    <TableCell align="right">{row.totalRecordsOrmb ?? '—'}</TableCell>
                    <TableCell align="center">
                      {(() => {
                        const rowKey = buildRowKey(row);
                        const canDownloadCa = Number(row.totalCompareCa || 0) > 0;
                        const canDownloadMoc = Number(row.totalCompareRoc || 0) > 0;

                        const renderResultAction = ({ invoiceType, label, isEnabled }) => {
                          const stateKey = `${rowKey}-${invoiceType}`;
                          const blobStatus = blobStatusByRowKey[stateKey];
                          const isBusy = downloadingKey === stateKey || blobStatus === 'uploading';

                          if (row.status !== 'COMPLETE') {
                            return (
                              <Tooltip title={`${label}: available after run completion.`}>
                                <span>
                                  <IconButton size="small" disabled aria-label={`Download ${label} unavailable`}>
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            );
                          }

                          if (!isEnabled) {
                            return (
                              <Tooltip title={`${label}: no records for this run.`}>
                                <span>
                                  <IconButton size="small" disabled aria-label={`No ${label} report available`}>
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            );
                          }

                          if (blobStatus === 'checking' || !blobStatus) {
                            return (
                              <Tooltip title={`${label}: checking report status...`}>
                                <span><CircularProgress size={18} /></span>
                              </Tooltip>
                            );
                          }

                          if (blobStatus === 'missing' || blobStatus === 'upload-failed') {
                            return (
                              <Tooltip title={blobStatus === 'upload-failed' ? `${label}: upload failed, click to retry.` : `${label}: not uploaded yet, click to upload.`}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    disabled={isBusy}
                                    onClick={() => onUpload(row, invoiceType)}
                                    aria-label={`Upload ${label} results`}
                                  >
                                    {blobStatus === 'uploading'
                                      ? <CircularProgress size={18} />
                                      : <UploadIcon color="secondary" fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            );
                          }

                          if (blobStatus === 'uploading') {
                            return (
                              <Tooltip title={`${label}: uploading results...`}>
                                <span><CircularProgress size={18} /></span>
                              </Tooltip>
                            );
                          }

                          return (
                            <Tooltip title={`Download ${label} results`}>
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={isBusy}
                                  onClick={() => onDownload(row, invoiceType)}
                                  aria-label={`Download ${label} results`}
                                >
                                  {downloadingKey === stateKey
                                    ? <CircularProgress size={18} />
                                    : <DownloadIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          );
                        };

                        return (
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            {renderResultAction({ invoiceType: 'ca', label: 'CA', isEnabled: canDownloadCa })}
                            {renderResultAction({ invoiceType: 'moc', label: 'MOC', isEnabled: canDownloadMoc })}
                          </Box>
                        );
                      })()}
                    </TableCell>
                    {canDeleteRunHistory && (
                      <TableCell align="center">
                        <Tooltip title="Delete run history">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={deletingRowKey === rowKey}
                              onClick={() => onDelete(row)}
                              aria-label={`Delete run history for run ${row.runId}`}
                            >
                              {deletingRowKey === rowKey
                                ? <CircularProgress size={18} />
                                : <DeleteOutlineIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>

                  <TableRow key={`${rowKey}-expanded`}>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={canDeleteRunHistory ? 14 : 13}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ m: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            IPB Match Counts
                          </Typography>

                          {isLoadingCounts && (
                            <Box sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CircularProgress size={18} />
                              <Typography variant="body2" color="text.secondary">
                                Loading counts...
                              </Typography>
                            </Box>
                          )}

                          {!isLoadingCounts && loadError && (
                            <Typography variant="body2" color="error.main">
                              {loadError}
                            </Typography>
                          )}

                          {!isLoadingCounts && !loadError && ipbData && (
                            <Box
                              sx={{
                                display: 'grid',
                                gap: 2,
                                gridTemplateColumns: {
                                  xs: '1fr',
                                  lg: 'repeat(2, minmax(320px, 1fr))',
                                },
                              }}
                            >
                              <IpbCountsTable
                                title="CA Results"
                                totalRecords={ipbData.ca?.totalRecords}
                                invoiceCount={row.invoicesCa}
                                rules={CA_IPB_RULES}
                                ipbCounts={ipbData.ca?.ipbCounts}
                                rowKeyPrefix={`${rowKey}-ca`}
                              />
                              <IpbCountsTable
                                title="MOC Results"
                                totalRecords={ipbData.moc?.totalRecords}
                                invoiceCount={row.invoicesRoc}
                                rules={MOC_IPB_RULES}
                                ipbCounts={ipbData.moc?.ipbCounts}
                                rowKeyPrefix={`${rowKey}-moc`}
                              />
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>

        {totalRows > PAGE_SIZE && (
          <TablePagination
            component="div"
            count={totalRows}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        )}
      </TableContainer>
    </Box>
  );
};

const UPLOAD_POLL_INTERVAL_MS = 5000;

const BatchHistory = ({ refreshKey = 0, envName, canDeleteRunHistory = false }) => {
  const DB_ORDER = useMemo(() => getKpifTargetDatabases(envName), [envName]);
  const DB_DISPLAY_NAMES = useMemo(
    () => Object.fromEntries(
      getKpifTargetDatabaseOptions(envName).map((option) => [option.value, option.label])
    ),
    [envName]
  );
  const [historyByDb, setHistoryByDb] = useState({});
  const [loading, setLoading] = useState(true);
  const [pendingPageByDb, setPendingPageByDb] = useState({});
  const [pageLoadingByDb, setPageLoadingByDb] = useState({});
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [blobStatusByRowKey, setBlobStatusByRowKey] = useState({});
  const [expandedRowKeys, setExpandedRowKeys] = useState({});
  const [ipbCountByRowKey, setIpbCountByRowKey] = useState({});
  const [ipbLoadingRowKey, setIpbLoadingRowKey] = useState({});
  const [ipbErrorByRowKey, setIpbErrorByRowKey] = useState({});
  const [deleteTargetRow, setDeleteTargetRow] = useState(null);
  const [deletingRowKey, setDeletingRowKey] = useState(null);
  const paginationTimeoutsRef = useRef({});
  const paginationRequestIdRef = useRef({});

  const handleDownload = async (row, invoiceType) => {
    if (Number(row.totalRecords) === 0) {
      return;
    }

    const blobStateKey = buildBlobStateKey(row, invoiceType);
    setDownloadingKey(blobStateKey);
    try {
      await downloadFinalResults({
        runId: row.runId,
        batchNumber: row.batchNumber,
        targetDatabase: row.targetDatabase,
        invoiceType,
      });
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingKey(null);
    }
  };

  /**
   * Poll for a single row until the blob exists or we time out.
   */
  const pollUntilReady = useCallback((row, invoiceType) => {
    const blobStateKey = buildBlobStateKey(row, invoiceType);

    const poll = async (attempt = 0) => {
      try {
        const data = await checkFinalResultsExist({
          runId: row.runId,
          batchNumber: row.batchNumber,
          targetDatabase: row.targetDatabase,
          invoiceType,
        });

        if (data.exists) {
          setBlobStatusByRowKey((prev) => ({ ...prev, [blobStateKey]: 'exists' }));
          return;
        }
      } catch {
        // Ignore check errors, keep polling.
      }

      // Give up after ~2 minutes (24 attempts × 5 s).
      if (attempt >= 24) {
        setBlobStatusByRowKey((prev) => ({ ...prev, [blobStateKey]: 'upload-failed' }));
        return;
      }

      setTimeout(() => poll(attempt + 1), UPLOAD_POLL_INTERVAL_MS);
    };

    poll(0);
  }, []);

  /**
   * Check blob existence for all COMPLETE rows and update blobStatusByRowKey.
   * If a row already has an upload in progress (lock blob) we set its status
   * to 'uploading' and immediately start polling.
   */
  const checkBlobStatuses = useCallback(async (rows) => {
    const targets = [];
    for (const row of rows) {
      if (row.status !== 'COMPLETE') continue;
      if (Number(row.totalCompareCa || 0) > 0) {
        targets.push({ row, invoiceType: 'ca' });
      }
      if (Number(row.totalCompareRoc || 0) > 0) {
        targets.push({ row, invoiceType: 'moc' });
      }
    }

    if (targets.length === 0) return;

    const checking = {};
    for (const target of targets) {
      checking[buildBlobStateKey(target.row, target.invoiceType)] = 'checking';
    }
    setBlobStatusByRowKey((prev) => ({ ...prev, ...checking }));

    const results = await Promise.all(
      targets.map(async ({ row, invoiceType }) => {
        try {
          const data = await checkFinalResultsExist({
            runId: row.runId,
            batchNumber: row.batchNumber,
            targetDatabase: row.targetDatabase,
            invoiceType,
          });
          return { row, invoiceType, exists: data.exists, uploading: data.uploading, error: false };
        } catch {
          return { row, invoiceType, exists: false, uploading: false, error: true };
        }
      }),
    );

    const statusUpdate = {};
    const targetsToStartPolling = [];

    for (const { row, invoiceType, exists, uploading, error } of results) {
      const blobStateKey = buildBlobStateKey(row, invoiceType);

      if (error) {
        statusUpdate[blobStateKey] = 'missing';
      } else if (exists) {
        statusUpdate[blobStateKey] = 'exists';
      } else if (uploading) {
        statusUpdate[blobStateKey] = 'uploading';
        targetsToStartPolling.push({ row, invoiceType });
      } else {
        statusUpdate[blobStateKey] = 'missing';
      }
    }

    setBlobStatusByRowKey((prev) => ({ ...prev, ...statusUpdate }));

    for (const target of targetsToStartPolling) {
      pollUntilReady(target.row, target.invoiceType);
    }
  }, [pollUntilReady]);

  const clearPaginationTimeout = useCallback((dbKey) => {
    const timeoutId = paginationTimeoutsRef.current[dbKey];
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete paginationTimeoutsRef.current[dbKey];
    }
  }, []);

  const fetchHistoryPage = useCallback(async (dbKey, pageNumber = 1, requestId) => {
    try {
      const data = await getRunHistory({
        targetDatabase: dbKey,
        page: pageNumber,
        pageSize: PAGE_SIZE,
      });

      if (requestId && paginationRequestIdRef.current[dbKey] !== requestId) {
        return;
      }

      const rows = data?.rows || [];
      const nextPage = Math.max(1, Number(data?.page || pageNumber));
      const nextHistory = {
        rows,
        totalRows: Number(data?.totalRows || 0),
        page: nextPage,
        totalPages: Math.max(1, Number(data?.totalPages || 1)),
      };

      setHistoryByDb((prev) => ({
        ...prev,
        [dbKey]: nextHistory,
      }));

      setPendingPageByDb((prev) => ({
        ...prev,
        [dbKey]: nextPage,
      }));

      setIpbCountByRowKey((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (row.ipbCount) {
            next[buildRowKey(row)] = row.ipbCount;
          }
        }
        return next;
      });
    } finally {
      if (!requestId || paginationRequestIdRef.current[dbKey] === requestId) {
        setPageLoadingByDb((prev) => ({
          ...prev,
          [dbKey]: false,
        }));
      }
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setHistoryByDb({});
    setPendingPageByDb({});
    setPageLoadingByDb({});
    setExpandedRowKeys({});
    setIpbCountByRowKey({});
    setIpbLoadingRowKey({});
    setIpbErrorByRowKey({});
    setBlobStatusByRowKey({});

    DB_ORDER.forEach((dbKey) => clearPaginationTimeout(dbKey));

    try {
      await Promise.all(DB_ORDER.map((dbKey) => {
        const requestId = `${dbKey}-initial-${Date.now()}`;
        paginationRequestIdRef.current[dbKey] = requestId;
        return fetchHistoryPage(dbKey, 1, requestId);
      }));
    } catch {
      // Silently fail — tables stay empty
    } finally {
      setLoading(false);
    }
  }, [DB_ORDER, clearPaginationTimeout, fetchHistoryPage]);

  const fetchIpbCounts = useCallback(async (row, rowKey) => {
    setIpbLoadingRowKey((prev) => ({ ...prev, [rowKey]: true }));
    setIpbErrorByRowKey((prev) => ({ ...prev, [rowKey]: null }));

    try {
      const data = await getIpbCount({
        runId: row.runId,
        batchNumber: row.batchNumber,
        targetDatabase: row.targetDatabase,
      });

      setIpbCountByRowKey((prev) => ({ ...prev, [rowKey]: data }));
    } catch (error) {
      setIpbErrorByRowKey((prev) => ({
        ...prev,
        [rowKey]: error?.message || 'Failed to load IPB count data.',
      }));
    } finally {
      setIpbLoadingRowKey((prev) => ({ ...prev, [rowKey]: false }));
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTargetRow) {
      return;
    }

    const rowKey = buildRowKey(deleteTargetRow);
    const { targetDatabase } = deleteTargetRow;

    // Optimistically remove the row from state immediately.
    setHistoryByDb((prev) => {
      const existing = prev[targetDatabase];
      if (!existing) return prev;
      return {
        ...prev,
        [targetDatabase]: {
          ...existing,
          rows: existing.rows.filter((r) => buildRowKey(r) !== rowKey),
          totalRows: Math.max(0, (existing.totalRows || 0) - 1),
        },
      };
    });

    setDeleteTargetRow(null);
    setDeletingRowKey(rowKey);

    try {
      await deleteRunHistory({
        runId: deleteTargetRow.runId,
        batchNumber: deleteTargetRow.batchNumber,
        targetDatabase,
      });
    } catch (error) {
      console.error('Delete run history failed:', error);
      // Roll back by reloading — the row may not have been deleted.
      await fetchAll();
    } finally {
      setDeletingRowKey(null);
    }
  }, [deleteTargetRow, fetchAll]);

  const handleUpload = useCallback(async (row, invoiceType) => {
    if (Number(row.totalRecords) === 0) {
      return;
    }

    const blobStateKey = buildBlobStateKey(row, invoiceType);
    setBlobStatusByRowKey((prev) => ({ ...prev, [blobStateKey]: 'uploading' }));

    // Fire off the upload request (don't block on it — we'll poll instead).
    uploadFinalResults({
      runId: row.runId,
      batchNumber: row.batchNumber,
      targetDatabase: row.targetDatabase,
      invoiceType,
    }).catch(() => {
      // Upload errors are handled by the polling fallback below.
    });

    // Start polling after a short initial delay to give the upload time.
    setTimeout(() => pollUntilReady(row, invoiceType), UPLOAD_POLL_INTERVAL_MS);
  }, [pollUntilReady]);

  const handleDelete = useCallback((row) => {
    setDeleteTargetRow(row);
  }, []);

  const handleToggleExpand = useCallback((row) => {
    const rowKey = buildRowKey(row);
    const isCurrentlyExpanded = !!expandedRowKeys[rowKey];

    setExpandedRowKeys((prev) => ({
      ...prev,
      [rowKey]: !isCurrentlyExpanded,
    }));

    if (!isCurrentlyExpanded && !ipbCountByRowKey[rowKey] && !ipbLoadingRowKey[rowKey]) {
      fetchIpbCounts(row, rowKey);
    }
  }, [expandedRowKeys, ipbCountByRowKey, ipbLoadingRowKey, fetchIpbCounts]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  useEffect(() => () => {
    Object.values(paginationTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
  }, []);

  const handleTablePageChange = useCallback((dbKey, newPage) => {
    const requestedPage = newPage + 1;
    const requestId = `${dbKey}-${requestedPage}-${Date.now()}`;

    clearPaginationTimeout(dbKey);
    paginationRequestIdRef.current[dbKey] = requestId;

    setPendingPageByDb((prev) => ({
      ...prev,
      [dbKey]: requestedPage,
    }));

    setPageLoadingByDb((prev) => ({
      ...prev,
      [dbKey]: true,
    }));

    paginationTimeoutsRef.current[dbKey] = setTimeout(() => {
      fetchHistoryPage(dbKey, requestedPage, requestId);
    }, PAGINATION_DEBOUNCE_MS);
  }, [clearPaginationTimeout, fetchHistoryPage]);

  /** Build per-database views in display order. */
  const groupedByDb = useMemo(() => {
    return DB_ORDER.map((dbKey) => {
      const history = historyByDb[dbKey] || {};
      return {
        dbKey,
        rows: history.rows || [],
        totalRows: history.totalRows || 0,
        page: pendingPageByDb[dbKey] || history.page || 1,
      };
    }).filter((group) => group.totalRows > 0);
  }, [DB_ORDER, historyByDb, pendingPageByDb]);

  const visibleRows = useMemo(
    () => groupedByDb.flatMap(({ dbKey, rows }) => (pageLoadingByDb[dbKey] ? [] : rows)),
    [groupedByDb, pageLoadingByDb]
  );

  useEffect(() => {
    if (visibleRows.length === 0) {
      return;
    }

    checkBlobStatuses(visibleRows);
  }, [checkBlobStatuses, visibleRows]);

  if (loading) {
    return (
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (groupedByDb.length === 0) {
    return (
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Run History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No completed runs found.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      {groupedByDb.map(({ dbKey, rows, totalRows, page }) => (
        <RunHistoryTable
          key={dbKey}
          dbKey={dbKey}
          rows={rows}
          totalRows={totalRows}
          page={Math.max(0, page - 1)}
          isPageLoading={!!pageLoadingByDb[dbKey]}
          onPageChange={handleTablePageChange}
          downloadingKey={downloadingKey}
          onDownload={handleDownload}
          blobStatusByRowKey={blobStatusByRowKey}
          onUpload={handleUpload}
          expandedRowKeys={expandedRowKeys}
          ipbCountByRowKey={ipbCountByRowKey}
          ipbLoadingRowKey={ipbLoadingRowKey}
          ipbErrorByRowKey={ipbErrorByRowKey}
          onToggleExpand={handleToggleExpand}
          dbDisplayNames={DB_DISPLAY_NAMES}
          canDeleteRunHistory={canDeleteRunHistory}
          onDelete={handleDelete}
          deletingRowKey={deletingRowKey}
        />
      ))}

      <Dialog open={!!deleteTargetRow} onClose={() => setDeleteTargetRow(null)}>
        <DialogTitle>Delete run history?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes run <strong>{deleteTargetRow?.runId}</strong> for batch <strong>{deleteTargetRow?.batchNumber}</strong> and removes its generated KPIF results.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDeleteTargetRow(null)} disabled={!!deletingRowKey}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={!!deletingRowKey}
            startIcon={deletingRowKey ? <CircularProgress size={16} /> : <DeleteOutlineIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BatchHistory;