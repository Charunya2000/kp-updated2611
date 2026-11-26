'use client';

import { Box, Typography } from '@mui/material';
import RequestFooter from './RequestFooter.js';
import PropTypes from 'prop-types';
import { ChatInteractionType } from '@reducers/SmartNoteTypes.js';

const Request = ({ chatInteraction }) => {
  return (
    <Box
      sx={{
        backgroundColor: 'prompt.request.background',
        color: 'prompt.request.text',
        paddingTop: 2.5, // 20px (2.5 * 8px)
        paddingRight: 2, // 16px (2 * 8px)
        paddingBottom: 1, // 20px (2.5 * 8px)
        paddingLeft: 2.5, // 20px (2.5 * 8px)
        borderRadius: '12px 12px 0 12px', // Rounded left, rounded upper right, squared lower right
        fontSize: '13pt',
        fontWeight: '400',
        textAlign: 'left',
        border: 'none',
        boxShadow: 'none',
        '&:hover': {
          boxShadow: 'none',
        },
        minWidth: '60%', // Set minimum width to 60%
        maxWidth: '95%', // Set maximum width to 95%
      }}
    >
      <Typography sx={{ whiteSpace: 'pre-wrap' }} variant="body1">{chatInteraction.prompt}</Typography>
      <RequestFooter prompt={chatInteraction.prompt} timeStamp={chatInteraction.createdAt} />
    </Box>
  );
};

export default Request;

Request.propTypes = {
  chatInteraction: PropTypes.arrayOf(ChatInteractionType).isRequired
};
