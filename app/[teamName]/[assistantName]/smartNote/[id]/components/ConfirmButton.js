'use client';

import { Button, Box } from '@mui/material';
import PropTypes from 'prop-types';

const ConfirmButton = ({ onConfirm }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <Button variant="contained" onClick={onConfirm} sx={{ borderRadius: '24px' }}>
        Confirm
      </Button>
    </Box>
  );
};

ConfirmButton.propTypes = {
  onConfirm: PropTypes.func.isRequired,
};

export default ConfirmButton;