'use client';

import { getQuery, updateQuery, getQueryWithoutFilter, initializeQueries } from "@/app/clientServices/insight360Service";
import { Alert, Box, Button, MenuItem, Select, Skeleton, Snackbar, TextField, Typography } from "@mui/material";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const QueryEditor = () => {
  const [sqlQuery, setSQLQuery] = useState('');
  const [listSQLQueries, setListSQLQueries] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(false);

  const { teamName } = useParams();
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info"
  });

  useEffect(() => {
    handleLoadQueryList();
  }, []);

  const handleLoadQueryList = async () => {
    try {
      setLoading(true);
      let response = await getQueryWithoutFilter(teamName);
      if (response) {
        setListSQLQueries(response);
      }
    } catch (error) {
      console.error(error);
      showSnackbar("Error fetching query list", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleSelectionChanged = async (sqlQuery) => {
    try {
      setLoading(true);
      if (sqlQuery) {
        let responseResult = await getQuery(teamName, sqlQuery);
        if (responseResult && responseResult.length > 0) {
          setQuery(responseResult[0].query);
          setSelectedDoc(responseResult[0]);
        } else {
          setQuery('');
          setSelectedDoc(null);
        }
      }
    } catch (error) {
      console.error(error);
      showSnackbar("Error fetching named query", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleSQLQueryNameChange = async (event) => {
    const sqlQuery = event.target.value;
    setSQLQuery(sqlQuery);
    handleSelectionChanged(sqlQuery);
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
      await updateQuery(teamName, query, selectedDoc.id);
      showSnackbar("Query saved successfully", "success");
    } catch (error) {
      console.error(error);
      showSnackbar("Error saving query", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleInitializeQueries = async () => {
    setLoading(true);
    try {
      const response = await initializeQueries(teamName);
      if (response && response.message) {
        await handleLoadQueryList();
        showSnackbar(response.message, "success");
      }
    } catch (error) {
      console.error(error);
      showSnackbar("Error initializing queries", "error");
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h3">SQL Query</Typography>
        <Button variant='primary' disabled={loading} onClick={handleInitializeQueries}>Initialize Queries</Button>
      </Box>
      <Select onChange={handleSQLQueryNameChange} value={sqlQuery} >
        {listSQLQueries.map((sqlQuery) => (
          <MenuItem key={sqlQuery.id} value={sqlQuery.name}>
            {sqlQuery.name}
          </MenuItem>
        ))}
      </Select>
      {
        !loading ? (
          <Box sx={{ display: 'flex', flex: 1, pt: 1, flexDirection: 'column' }}>
            <Typography variant="body1" sx={{ mb: 1 }}>
              SQL Query Editor <Typography sx={{ color: 'red' }} variant='body2' component={'span'}>- NOTE: Semi-colon's are not allowed and will be automatically removed.</Typography>
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