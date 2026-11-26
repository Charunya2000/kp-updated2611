'use client';

import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PropTypes from 'prop-types';
import RequestFooter from '../RequestFooter';
import { ChatInteractionType } from '@reducers/SmartNoteTypes.js';

const InfoSourceRequest = ({ chatInteraction }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        background: isDarkMode
          ? 'linear-gradient(180deg, rgba(129,212,250,0.18) 0%, rgba(14,116,144,0.18) 100%)'
          : 'linear-gradient(180deg, #e3f0fb 0%, #cbe6fa 100%)',
        color: isDarkMode ? theme.palette.text.primary : '#17436a',
        paddingTop: 2,
        paddingRight: 2.25,
        paddingBottom: 1.25,
        paddingLeft: 2.25,
        borderRadius: '20px 20px 6px 20px',
        border: '1px solid',
        borderColor: isDarkMode ? 'rgba(125,211,252,0.22)' : '#b3d3ee',
        boxShadow: isDarkMode ? '0 10px 24px rgba(2,6,23,0.18)' : '0 4px 12px rgba(3,105,161,0.08)',
        fontSize: '13pt',
        fontWeight: '400',
        textAlign: 'left',
        minWidth: '35%',
        maxWidth: '88%'
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.7, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 500, mb: 0.5, color: isDarkMode ? undefined : '#3973a6' }}>
        You
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }} variant="body1">{chatInteraction.prompt}</Typography>
      <RequestFooter prompt={chatInteraction.prompt} timeStamp={chatInteraction.createdAt} />
    </Box>
  );
};

InfoSourceRequest.propTypes = {
  chatInteraction: PropTypes.arrayOf(ChatInteractionType).isRequired
};

export default InfoSourceRequest;
