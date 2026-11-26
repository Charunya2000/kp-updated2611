'use client'

import { ExpandMore } from "@mui/icons-material";
import { Box, FormControl, InputLabel, MenuItem, Select, Typography, Button, Skeleton, CircularProgress, Accordion, AccordionSummary, AccordionDetails, Snackbar, Alert } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { getReportStatuses, requestReportGeneration, selectCacControlReport } from "../../clientServices/cacControlReportService";

/// Mock data for source and target databases
const sourceDatabases = ["Customer & Contracts"];
const targetDatabases = ["Billing", "Enrollment"];
const getTargetDatabaseOptions = (envName) => {
  if (envName === 'dev') {
    return [
      { value: 'dev', label: 'DEV' },
      { value: 'rbc2', label: 'RBC2' },
    ];
  }
  if (envName === 'uat') {
    return [
      { value: 'uat', label: 'UAT' },
      { value: 'rbc2', label: 'RBC2' },
    ];
  }
  return [{ value: 'default', label: 'Default' }];
};
const initialBillingEntities = ['Plan', 'Policy'];
const initialRegions = ["GEO", "NCR", "COL", "KNW", "MAS", "HAW", "WAS", "SCR"];
const createDefaultRegion = (parent, region) => ({
  name: region,
  parent,
  lastRunDate: 'Never',
  downloadUrl: null,
  processingTime: null,
  isProcessing: false
});

const createDefaultEntities = (entityNames) => entityNames.map((entity) => ({
  name: entity,
  regions: initialRegions.map((region) => createDefaultRegion(entity, region))
}));

const createBillingEntities = () => createDefaultEntities(initialBillingEntities);
const createEnrollmentEntities = () => createDefaultEntities(["Regions"]);

const loadSourceDbs = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(sourceDatabases);
    }, 100);
  });
}

const loadTargetDbs = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(targetDatabases);
    }, 100);
  });
}

const FullCompare = ({ envName }) => {
  const [loadingDbLists, setLoadingDbLists] = useState(true);
  const [sourceDbList, setSourceDbList] = useState([]);
  const [targetDbList, setTargetDbList] = useState([]);
  const [targetDatabaseList, setTargetDatabaseList] = useState([]);
  const [selectedSourceDb, setSelectedSourceDb] = useState("");
  const [selectedTargetDb, setSelectedTargetDb] = useState("");
  const [selectedTargetDatabase, setSelectedTargetDatabase] = useState('');
  const [entities, setEntities] = useState(createBillingEntities());
  const [loadingEntities, setLoadingEntities] = useState(false);
  const latestLoadRequestRef = useRef(0);
  const selectedTargetDbRef = useRef('');
  const selectedTargetDatabaseRef = useRef('');
  const teamName = "kpit-ai-portal-members";
  const assistantName = "cac-data-control-report";

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("info"); // 'info', 'success', 'error', etc.

  useEffect(() => {
    const fetchDbLists = async () => {
      const [sourceDbs, targetDbs] = await Promise.all([loadSourceDbs(), loadTargetDbs()]);
      setSourceDbList(sourceDbs);
      setTargetDbList(targetDbs);
      const targetDatabaseOptions = getTargetDatabaseOptions(envName);
      setTargetDatabaseList(targetDatabaseOptions);
      setSelectedTargetDatabase('');
      setLoadingDbLists(false);
    };
    fetchDbLists();
  }, [envName]);

  useEffect(() => {
    selectedTargetDbRef.current = selectedTargetDb;
    selectedTargetDatabaseRef.current = selectedTargetDatabase;
  }, [selectedTargetDb, selectedTargetDatabase]);

  useEffect(() => {
    let eventSource = null;
    let reconnectTimeout = null;

    const connectEventSource = () => {
      console.log('Connecting to SSE...');
      eventSource = new EventSource(`/api/${teamName}/${assistantName}/cac-control-report/sql-request`);

      const handleEventMessage = async (event) => {
        try {
          console.log('SSE message received:', event.data);
          const msg = event.data;
          let jsonMsg = null;
          if (msg.startsWith('{') && msg.endsWith('}')) {
            jsonMsg = JSON.parse(msg);
          }

          if (jsonMsg?.action === 'ComparisonComplete') {
            console.log('ComparisonComplete received for:', jsonMsg.dataset, jsonMsg.parent, jsonMsg.name);

            const messageTargetDatabase = jsonMsg.targetDatabase || 'default';
            const isCurrentDataset = jsonMsg.dataset === selectedTargetDbRef.current;
            const isCurrentTargetDatabase = messageTargetDatabase === selectedTargetDatabaseRef.current;

            if (!isCurrentDataset || !isCurrentTargetDatabase) {
              return;
            }

            try {
              // fetch the report status for this parent/entity name
              const report = await selectCacControlReport(teamName, assistantName, { dataset: jsonMsg.dataset, name: jsonMsg.name, parent: jsonMsg.parent, targetDatabase: jsonMsg.targetDatabase || 'default' });
              console.log('Fetched report data:', report);

              if (report) {
                // replace the entity in the entities state with the new report status
                setEntities((prevEntities) => {
                  const updatedEntities = prevEntities.map((entity) => {
                    if (entity.name === jsonMsg.parent) {
                      return {
                        ...entity,
                        regions: entity.regions.map((region) => {
                          if (region.name === jsonMsg.name) {
                            console.log('Updating region:', jsonMsg.name, 'with data:', report);
                            return { ...region, ...report };
                          }
                          return region;
                        })
                      };
                    }
                    return entity;
                  });
                  return updatedEntities;
                });

                // Show success snackbar
                showSnackbar("Report is ready for download!", "success");
              } else {
                console.warn('No report data found for:', jsonMsg.name, jsonMsg.parent);
              }
            } catch (error) {
              console.error('Error fetching report data:', error);
              showSnackbar("Error loading report data", "error");
            }
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error, event);
        }
      };

      eventSource.onopen = () => {
        console.log('SSE connection opened');
      };

      eventSource.onmessage = handleEventMessage;

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed, attempting to reconnect...');
          // Attempt to reconnect after 3 seconds
          reconnectTimeout = setTimeout(connectEventSource, 3000);
        }
      };
    };

    connectEventSource();

    return () => {
      console.log('Cleaning up SSE connection');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const showSnackbar = (message, severity = "info") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarMessage("");
    setSnackbarSeverity("info");
    setSnackbarOpen(false);
  };

  const handleSourceDbChange = async (event) => {
    setSelectedSourceDb(event.target.value);

    if (selectedTargetDb && selectedTargetDatabase) {
      await loadReportStatus(selectedTargetDb);
    }
  };

  const handleTargetDbChange = async (event) => {
    setSelectedTargetDb(event.target.value);

    if (selectedSourceDb && selectedTargetDatabase) {
      await loadReportStatus(event.target.value);
    }
  }

  const handleTargetDatabaseChange = async (event) => {
    const newTargetDatabase = event.target.value;
    setSelectedTargetDatabase(newTargetDatabase);

    if (selectedSourceDb && selectedTargetDb) {
      await loadReportStatus(selectedTargetDb, newTargetDatabase);
    }
  }

  const loadReportStatus = async (dataset, targetDatabase = selectedTargetDatabase) => {
    const requestId = ++latestLoadRequestRef.current;
    setLoadingEntities(true);

    try {
      const statusList = await getReportStatuses(teamName, assistantName, dataset, targetDatabase);

      if (requestId !== latestLoadRequestRef.current) {
        return;
      }

      if (dataset === 'Billing') {
        handleSetBillingEntities(statusList);
      } else if (dataset === 'Enrollment') {
        handleSetEnrollmentEntities(statusList);
      }
    } catch (error) {
      if (requestId === latestLoadRequestRef.current) {
        showSnackbar("Failed to load report status.", "error");
      }
      throw error;
    } finally {
      if (requestId === latestLoadRequestRef.current) {
        setLoadingEntities(false);
      }
    }
  }

  const handleSetBillingEntities = (statusList) => {
    if (!statusList || statusList.length === 0) {
      setEntities(createBillingEntities());

      // Show info snackbar
      showSnackbar("Default entities loaded.", "info");
      return;
    }

    const newEntities = createBillingEntities();

    statusList.forEach((entity) => {
      const { name, parent } = entity;

      const regionParent = newEntities.find((e) => e.name === parent);
      const regionIndex = regionParent.regions.findIndex((region) => region.name === name);

      if (regionIndex !== -1) {
        regionParent.regions.splice(regionIndex, 1, entity);
      }
    });

    setEntities(newEntities);
  }

  const handleSetEnrollmentEntities = (statusList) => {
    if (!statusList || statusList.length === 0) {
      setEntities(createEnrollmentEntities())

      // Show info snackbar
      showSnackbar("Default entities loaded.", "info");
      return;
    }

    const newEntities = createEnrollmentEntities();

    statusList.forEach((entity) => {
      const { name, parent } = entity;

      const regionParent = newEntities.find((e) => e.name === parent);
      const regionIndex = regionParent.regions.findIndex((region) => region.name === name);

      if (regionIndex !== -1) {
        regionParent.regions.splice(regionIndex, 1, entity);
      }
    });

    setEntities(newEntities);
  }

  const handleGenerateComparison = async (dataset, entityName, regionName) => {

    setEntities((prevEntities) => {
      return prevEntities.map((entity) => {
        if (entity.name === entityName) {
          return {
            ...entity,
            regions: entity.regions.map((region) => {
              if (region.name === regionName) {
                return { ...region, isProcessing: true };
              }
              return region;
            })
          };
        }
        return entity;
      });
    });

    try {
      await requestReportGeneration(teamName, assistantName, dataset, entityName, regionName, selectedTargetDatabase);
    } catch (error) {
      console.error('Error requesting report generation:', error);

      setEntities((prevEntities) => {
        return prevEntities.map((entity) => {
          if (entity.name === entityName) {
            return {
              ...entity,
              regions: entity.regions.map((region) => {
                if (region.name === regionName) {
                  return { ...region, isProcessing: false };
                }
                return region;
              })
            };
          }
          return entity;
        });
      });

      // Show error snackbar
      showSnackbar("Failed to request report generation.", "error");
    }
  }

  return (
    <Box sx={{ overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, py: 2, mx: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 1, minWidth: '220px' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Target Database
            </Typography>
            {loadingDbLists ? <Skeleton variant="rectangular" sx={{ borderRadius: 1 }} width={220} height={56} animation="wave" /> :
              <DatabaseSelect
                label="Target Database"
                value={selectedTargetDatabase}
                onChange={handleTargetDatabaseChange}
                options={targetDatabaseList}
              />
            }
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 1, minWidth: '300px' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Select Source
            </Typography>
            {loadingDbLists ? <Skeleton variant="rectangular" sx={{ borderRadius: 1 }} width={300} height={56} animation="wave" /> :
              <DatabaseSelect
                label="Source"
                value={selectedSourceDb}
                onChange={handleSourceDbChange}
                options={sourceDbList}
                disabled={!selectedTargetDatabase}
              />
            }
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 1, minWidth: '300px' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Select Target
            </Typography>
            {loadingDbLists ? <Skeleton variant="rectangular" sx={{ borderRadius: 1 }} width={300} height={56} animation="wave" /> :
              <DatabaseSelect
                label="Target"
                value={selectedTargetDb}
                onChange={handleTargetDbChange}
                options={targetDbList}
                disabled={!selectedTargetDatabase}
              />
            }
          </Box>
          {
            selectedSourceDb && selectedTargetDb && entities.length > 0 && (
              <Box sx={{ ml: 'auto', display: 'flex', flexDirection: 'column', alignSelf: 'flex-end' }}>
                <Typography variant="body1" component={'span'}>
                  Download links expire after <Typography variant="body1" sx={{ fontWeight: 'bold' }} component={'span'}>48</Typography> hours.
                </Typography>
              </Box>
            )
          }
        </Box>

        {
          loadingEntities ? (selectedTargetDb === 'Billing' ? Array(initialBillingEntities.length).fill().map((_, index) =>
            <Skeleton key={index} variant="rectangular" sx={{ borderRadius: 1, mt: 1 }} height={56} />
          ) : <Skeleton key={0} variant="rectangular" sx={{ borderRadius: 1, mt: 1 }} height={56} />) :
            <EntitiesDisplay
              selectedSourceDb={selectedSourceDb}
              selectedTargetDb={selectedTargetDb}
              entities={entities}
              handleGenerateComparison={handleGenerateComparison}
            />
        }
      </Box>

      {/* Snackbar Component */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default FullCompare;

const DatabaseSelect = ({ label, value, onChange, options, disabled = false }) => (
  <FormControl fullWidth>
    <InputLabel>{label}</InputLabel>
    <Select value={value} onChange={onChange} label={label} disabled={disabled}>
      {options.map((option) => {
        const normalizedOption = typeof option === 'string' ? { value: option, label: option } : option;
        return (
          <MenuItem key={normalizedOption.value} value={normalizedOption.value}>
            {normalizedOption.label}
          </MenuItem>
        )
      })}
    </Select>
  </FormControl>
);

const EntitiesDisplay = ({ selectedSourceDb, selectedTargetDb, entities, handleGenerateComparison }) => {
  return (
    <>
      {
        selectedSourceDb && selectedTargetDb && entities && entities.length > 0 &&
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
          {
            entities.map((entity) => (
              <Accordion key={entity.name} sx={{ border: '1px solid', borderColor: 'grey.300', backgroundColor: 'background.drawer' }}>
                <AccordionSummary expandIcon={<ExpandMore sx={{ fontSize: '24px' }} />}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{entity.name}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {
                    entity.regions.map((region) => {
                      const isExpired = region.lastRunDate === 'Never' ? false : Date.now() - new Date(region.lastRunDate).getTime() > 48 * 60 * 60 * 1000;
                      return (
                        (
                          <Box key={region.name} sx={{ display: "flex", border: '1px solid', borderColor: 'grey.300', p: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 'bold', flexBasis: '6rem' }}>{region.name}</Typography>
                              <Button disabled={region.isProcessing} variant="secondary" onClick={() => handleGenerateComparison(selectedTargetDb, entity.name, region.name)}>Generate Report</Button>
                              {
                                region.isProcessing && (
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2">Generating Report... </Typography>
                                    <CircularProgress size={24} sx={{ ml: 1, color: 'primary.main' }} />
                                  </Box>
                                )
                              }
                              <Box sx={{ ml: 2 }}>
                                <Typography variant="body2" component={'span'}>Last Run Started: </Typography>
                                <Typography variant="body2" component={'span'} sx={{ fontWeight: 'bold' }}>{region.lastRunDate === 'Never' ? region.lastRunDate : new Date(region.lastRunDate).toLocaleString()}</Typography>
                              </Box>
                              <Box sx={{ ml: 2 }}>
                                <Typography variant="body2" component={'span'}>Previous Run Duration: </Typography>
                                <Typography variant="body2" component={'span'} sx={{ fontWeight: 'bold' }}>{region.processingTime > 0 ? (region.processingTime / 1000 / 60).toFixed(2) + " Minutes" : "No History"}</Typography>
                              </Box>
                            </Box>
                            <Button sx={{ textDecoration: 'none' }} disabled={!region.downloadUrl || isExpired} variant='text' href={region.downloadUrl}>{isExpired ? "Expired" : "Download"}</Button>
                          </Box>
                        )
                      )
                    })
                  }
                </AccordionDetails>
              </Accordion>
            ))
          }
        </Box>
      }
    </>)
}