'use client';

import { getQuery, updateQuery, createQuery } from "@/app/clientServices/cacControlReportService";
import { Alert, Box, Button, MenuItem, Select, Skeleton, Snackbar, TextField, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const enrollmentEntity = 'Regions';
const availableEntities = ['plan', 'policy'];
const availableLineOfBusinesses = ['Billing', 'Enrollment'];

const QueryEditor = () => {
  const [dataset, setDataSet] = useState('Billing');
  const [entity, setEntity] = useState('plan');
  const [query, setQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entityOptions, setEntityOptions] = useState(availableEntities);
  const { teamName } = useParams();
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info"
  });

  useEffect(() => {
    handleSelectionChanged(dataset, entity);
  }, []);

  const handleSelectionChanged = async (dataset, selectedEntity) => {
    try {
      setLoading(true);
      let response = await getQuery(teamName, dataset, selectedEntity);

      if (response?.error) {
        // create a new document
        response = await createQuery(teamName, dataset, selectedEntity);
      }

      if (response) {
        setQuery(response.query);
        setSelectedDoc(response);
      }
    } catch (error) {
      console.error(error);
      showSnackbar("Error fetching query", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleDatasetChange = async (event) => {
    const dataset = event.target.value;
    setDataSet(dataset);

    if (dataset === 'Enrollment') {
      setEntityOptions([enrollmentEntity]);
      setEntity(enrollmentEntity);
      handleSelectionChanged(dataset, enrollmentEntity);
    } else {
      setEntityOptions(availableEntities);
      setEntity('plan');
      handleSelectionChanged(dataset, 'plan');
    }
  }

  const handleEntityChange = (event) => {
    const selectedEntity = event.target.value;
    setEntity(selectedEntity);

    handleSelectionChanged(dataset, selectedEntity);
  }

  const handleQueryChange = (event) => {
    let newQuery = event.target.value;
    // remove semi-colons
    newQuery = newQuery.replaceAll(';', '');

    setQuery(newQuery);
  }

  const handleSaveQuery = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateQuery(teamName, entity, query, selectedDoc.id);
      showSnackbar("Query saved successfully", "success");
    } catch (error) {
      console.error(error);
      showSnackbar("Error saving query", "error");
    } finally {
      setLoading(false);
    }
  }

  const showSnackbar = (message, severity = "info") => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({
      ...prev,
      open: false
    }));
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
      <Typography variant="h3">Query Editor</Typography>
      <Select onChange={handleDatasetChange} value={dataset} >
        {availableLineOfBusinesses.map((dataset) => (
          <MenuItem key={dataset} value={dataset}>
            {dataset}
          </MenuItem>
        ))}
      </Select>
      {
        dataset !== 'Enrollment' ? (
          <Select onChange={handleEntityChange} value={entity}>
            {entityOptions.sort().map((entity) => (
              <MenuItem key={entity} value={entity}>
                {entity}
              </MenuItem>
            ))}
          </Select>
        ) : null
      }
      {
        !loading ? (
          <Box sx={{ display: 'flex', flex: 1, pt: 1, flexDirection: 'column' }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              SQL Query <Typography sx={{ color: 'red' }} variant='body2' component={'span'}>- NOTE: You must use ':region' in your where clause to filter by region. Semi-colon's are not allowed and will be automatically removed.</Typography>
            </Typography>

            <TextField
              multiline
              variant="outlined"
              fullWidth
              placeholder="Enter your SQL query here..."
              onChange={handleQueryChange}
              value={query}
              sx={{
                flex: 1,
                "& .MuiInputBase-root": {
                  height: "100%",
                  alignItems: "flex-start",
                },
                "& .MuiInputBase-input": {
                  height: "100% !important",
                  overflow: "auto !important",
                  resize: "none",
                },
              }}
            />
          </Box>
        ) : <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 1 }} />
      }
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button disabled={!query} variant="primary" onClick={handleSaveQuery}>Save</Button>
      </Box>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default QueryEditor;