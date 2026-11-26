'use client';

import { Box, TextField, Button } from '@mui/material';
import PropTypes from 'prop-types';
import { useState } from 'react';

const TextFieldResponse = ({ onSubmit }) => {
  const [response, setResponse] = useState('');

  const handleSubmit = () => {
    onSubmit(response);
    setResponse('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <TextField
        variant="outlined"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        sx={{ marginBottom: 2 }}
      />
      <Button variant="contained" onClick={handleSubmit} sx={{ borderRadius: '24px' }}>
        Submit
      </Button>
    </Box>
  );
};

TextFieldResponse.propTypes = {
  onSubmit: PropTypes.func.isRequired,
};

export default TextFieldResponse;