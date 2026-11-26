'use client';

import { Box } from '@mui/material';
import PropTypes from 'prop-types';
import { ChatInteractionType } from '@reducers/SmartNoteTypes.js';
import InfoSourceRequest from './InfoSourceRequest';
import InfoSourceResponse from './InfoSourceResponse';

const InfoSourceChatInteraction = ({ chatInteraction, isComplete }) => {
  return (
    <Box
      sx={{
        width: '100%',
        paddingY: 1.25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        flexShrink: 0,
        margin: 0,
        gap: 1.25
      }}
    >
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end', minWidth: '60%' }}>
        <InfoSourceRequest chatInteraction={chatInteraction} />
      </Box>
      {chatInteraction.response && (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-start', minWidth: '60%' }}>
          <InfoSourceResponse chatInteraction={chatInteraction} isComplete={chatInteraction.isComplete || isComplete} />
        </Box>
      )}
    </Box>
  );
};

InfoSourceChatInteraction.propTypes = {
  chatInteraction: PropTypes.arrayOf(ChatInteractionType).isRequired,
  isComplete: PropTypes.bool.isRequired
};

export default InfoSourceChatInteraction;
