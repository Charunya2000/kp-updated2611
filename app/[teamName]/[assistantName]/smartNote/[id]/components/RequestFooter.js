'use client';

import { Box, Button, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PropTypes from 'prop-types';

const RequestFooter = ({ prompt, timeStamp }) => {
  const handleCopy = () => {
    const promptText = prompt; // Replace with the actual text you want to copy
    navigator.clipboard.writeText(promptText);
  };

  timeStamp = timeStamp ? new Date(timeStamp).toLocaleString() : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <Button
        variant="secondary"
        startIcon={<ContentCopyIcon style={{ fontSize: '24px' }} />}
        sx={{ m: 1, mr: 0 }}
        onClick={handleCopy}
      >
        Copy Prompt
      </Button>
      {timeStamp && <Typography variant="body2" sx={{ fontSize: '12px', opacity: 0.7 }}>{timeStamp}</Typography>}
    </Box>
  );
};
RequestFooter.propTypes = {
  prompt: PropTypes.string.isRequired,
};

export default RequestFooter;
