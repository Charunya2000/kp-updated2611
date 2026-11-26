import React, { useState, useCallback, useMemo} from 'react';
import { Snackbar, Alert } from '@mui/material'; // Assuming you're using Material UI

/**
 * Custom hook that provides a reusable snackbar functionality
 * @param {Object} options - Default options for the snackbar
 * @returns {Object} Snackbar component and control functions
 */
const useSnackbar = (options = {}) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info'); // 'error', 'warning', 'info', 'success'
  const [duration, setDuration] = useState(options.duration || 6000);
  // accept caller-provided sx options (whitespace / overflow / textOverflow etc.)
  const alertSx = useMemo(() => ({ width: '100%', ...(options.alertSx || {}) }), [options.alertSx]);
  const snackbarSx = useMemo(() => ({ ...(options.snackbarSx || {}) }), [options.snackbarSx]);

  const showSnackbar = useCallback((newMessage, newSeverity = 'info', newDuration) => {
    setMessage(newMessage);
    setSeverity(newSeverity);
    if (newDuration) setDuration(newDuration);
    setOpen(true);
  }, []);

  const hideSnackbar = useCallback(() => {
    setOpen(false);
  }, []);


  // The component that will be used in your JSX
  const SnackbarComponent = useCallback(() => (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={hideSnackbar}
      anchorOrigin={options.anchorOrigin || { vertical: 'bottom', horizontal: 'left' }}
      sx={snackbarSx}
    >
      <Alert onClose={hideSnackbar} severity={severity} sx={alertSx}>
        {message}
      </Alert>
    </Snackbar>
  ), [open, duration, message, severity, hideSnackbar, options.anchorOrigin]);

  return {
    SnackbarComponent,
    showSnackbar,
    hideSnackbar,
    snackbarIsOpen: open,
  };
};

export default useSnackbar;