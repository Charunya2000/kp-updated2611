'use client';

import { Box } from '@mui/material';
import PropTypes from 'prop-types';
import Request from './Request.js';
import Response from './Response.js';
import { ChatInteractionType } from '@reducers/SmartNoteTypes.js';

const ChatInteraction = ({ chatInteraction, isComplete }) => {

  return (
    <Box sx={{ width: '100%', paddingY: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flexShrink: 0, margin: 0 }}>
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: 2, minWidth: '60%' }}>
        <Request chatInteraction={chatInteraction} />
      </Box>
      {chatInteraction.response && <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-start', minWidth: '60%' }}>
        <Response chatInteraction={chatInteraction} isComplete={chatInteraction.isComplete} />
      </Box>}
    </Box>
  );
};

export default ChatInteraction;

ChatInteraction.propTypes = {
  chatInteraction: PropTypes.arrayOf(ChatInteractionType).isRequired,
  isComplete: PropTypes.bool.isRequired
};