import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import AutoGraphOutlinedIcon from '@mui/icons-material/AutoGraphOutlined';
import PollOutlinedIcon from '@mui/icons-material/PollOutlined';
import FindDataSection from './FindTestDataSection';

const WorkflowSection = ({ onFocus, onblur, onBack }) => {

  return (
    <Box sx={{ marginTop: 2, p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Workflows</Typography>
      <Button startIcon={<AutoStoriesOutlinedIcon />}>
        Create user story
      </Button>
      <Button startIcon={<AutoGraphOutlinedIcon />} onClick={() => onFocus(<FindDataSection onblur={onblur} onBack={onBack} />)}>
        Identify test data
      </Button>
      <Button startIcon={<PollOutlinedIcon />}>
        Create diagram
      </Button>
    </Box>
  );
};

export default WorkflowSection;