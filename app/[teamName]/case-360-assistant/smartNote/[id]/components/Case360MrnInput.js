import { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const Case360MrnInput = ({ chatInputRef, smartNote, teamName, assistantName, mrnInput, onMrnChange, envName }) => {
  // Calculate default start date as 1 year prior to today
  const getDefaultStartDate = () => {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    return oneYearAgo;
  };

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(new Date());
  const [dataEnv, setDataEnv] = useState('dev');
  const [showDataEnvSelector, setShowDataEnvSelector] = useState(envName === 'dev');

  useEffect(() => {
    if (!chatInputRef?.current) return;
    if (dataEnv) {
      chatInputRef.current.dataset.case360DataEnv = dataEnv;
    } else {
      delete chatInputRef.current.dataset.case360DataEnv;
    }
  }, [chatInputRef, dataEnv]);

  const handleMrnInputChange = (e) => {
    onMrnChange(e.target.value);
  };

  const formatDate = (date) => {
    if (!date) return null;
    try {
      return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    } catch {
      return null;
    }
  };

  const handleSubmitMrnPrompt = async () => {
    if (chatInputRef.current && mrnInput) {
      const sd = formatDate(startDate);
      const ed = formatDate(endDate);
      chatInputRef.current.value = `Retrieve plan and billing details for MRN ${mrnInput} from ${sd} to ${ed}`;
      chatInputRef.current.dataset.case360PromptCategory = 'mrn';

      const form = chatInputRef.current.closest('form');
      if (form) {
        const submitEvent = new Event('submit', {
          bubbles: true,
          cancelable: true
        });
        form.dispatchEvent(submitEvent);
      }

      // Guard: Only update if smartNote and smartNote.id are present
      if (!smartNote || !smartNote.id) {
        console.error('Case360MrnInput: smartNote or smartNote.id is missing, cannot update SmartNote after MRN submit.');
        return;
      }
    }
  }

  return (
    <Box
      sx={{
        backgroundColor: 'form.background',
        padding: 2,              // smaller padding
        borderRadius: '12px',
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        width: '100%',
        flexShrink: 0,
        alignSelf: 'flex-end',
        overflow: 'auto',
        height: '100%'
      }}
    >
      <Typography variant="h6">Medical Record No.</Typography>
      <Box>
        <Typography variant="body1" sx={{ mb: 1 }}>
          Submit an MRN to retrieve plan and billing details.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            variant="outlined"
            placeholder="Enter MRN"
            value={mrnInput}
            onChange={handleMrnInputChange}
            size="small"
            sx={{ flexGrow: 1, minWidth: { xs: '180px' } }} // larger on wider screens
          />
          <Button
            variant="primary"
            onClick={handleSubmitMrnPrompt}
            disabled={!mrnInput.trim()}
            size="medium"
            sx={{ minWidth: '80px' }}
          >
            Submit
          </Button>
        </Box>

        {showDataEnvSelector && (
          <Box sx={{ mt: 1.5, maxWidth: '180px' }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="case360-data-env-label">Data Env</InputLabel>
              <Select
                labelId="case360-data-env-label"
                value={dataEnv}
                label="Data Env"
                onChange={(e) => setDataEnv(e.target.value)}
              >
                <MenuItem value="dev">dev</MenuItem>
                <MenuItem value="perf">perf</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(newValue) => setStartDate(newValue)}
              format="yyyy-MM-dd"
              slotProps={{
                textField: {
                  size: 'small'
                }
              }}
            />
            <DatePicker
              label="End Date"
              value={endDate}
              onChange={(newValue) => setEndDate(newValue)}
              format="yyyy-MM-dd"
              minDate={new Date('1999-01-01')}
              maxDate={new Date('4001-12-31')}
              slotProps={{
                textField: {
                  error: false,
                  size: 'small'
                }
              }}
            />
          </Box>
        </LocalizationProvider>
      </Box>
    </Box>
  );
}

export default Case360MrnInput;