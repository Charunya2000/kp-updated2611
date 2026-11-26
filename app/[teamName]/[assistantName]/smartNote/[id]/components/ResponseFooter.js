'use client';

import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QuickreplyOutlinedIcon from '@mui/icons-material/QuickreplyOutlined';
import BorderAllIcon from '@mui/icons-material/BorderAll';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import PropTypes from 'prop-types';

const ResponseFooter = ({ handleSaveResponse, handleCopy, isExcelExportEnabled, handleExportToExcel, timeStamp, showSaveResponse = true, feedback, onFeedback }) => {
  timeStamp = timeStamp ? new Date(timeStamp).toLocaleString() : null;
  const normalizedFeedback = feedback === '0' ? 0 : feedback === '1' ? 1 : feedback;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', py: 1, width: '100%' }}>
        {showSaveResponse && (
          <Button
            variant='secondary'
            className='responseFooter'
            startIcon={<QuickreplyOutlinedIcon />}
            onClick={handleSaveResponse}
          >
            Save response
          </Button>
        )}
        {isExcelExportEnabled && (
          <Button
            variant='secondary'
            className='responseFooter'
            startIcon={<BorderAllIcon />}
            onClick={handleExportToExcel}
          >
            Export to Excel
          </Button>
        )}
        <Button
          variant='secondary'
          className='responseFooter'
          sx={!showSaveResponse && !onFeedback ? { marginLeft: 'auto' } : undefined}
          onClick={handleCopy}
          startIcon={<ContentCopyIcon />}
        >
          Copy response
        </Button>
        {onFeedback && (
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', ml: 'auto' }}>
            <Typography variant='body2' sx={{ fontSize: '14px', opacity: 0.7, mr: 0.5 }}>
              Was this helpful?
            </Typography>
            <Tooltip title={normalizedFeedback === 1 ? 'Remove helpful rating' : 'Mark as helpful'}>
              <IconButton
                size='medium'
                onClick={() => onFeedback(1)}
                color={normalizedFeedback === 1 ? 'success' : 'default'}
                aria-label='helpful'
                sx={{ p: 0.75 }}
              >
                {normalizedFeedback === 1 ? <ThumbUpIcon sx={{ fontSize: 24 }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 24 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title={normalizedFeedback === 0 ? 'Remove not helpful rating' : 'Mark as not helpful'}>
              <IconButton
                size='medium'
                onClick={() => onFeedback(0)}
                color={normalizedFeedback === 0 ? 'success' : 'default'}
                aria-label='not helpful'
                sx={{ p: 0.75 }}
              >
                {normalizedFeedback === 0 ? <ThumbDownIcon sx={{ fontSize: 24 }} /> : <ThumbDownOutlinedIcon sx={{ fontSize: 24 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
      {timeStamp && <Typography variant="body2" sx={{ fontSize: '12px', opacity: 0.7 }}>{timeStamp}</Typography>}
    </Box>
  );
};

ResponseFooter.propTypes = {
  handleSaveResponse: PropTypes.func,
  showSaveResponse: PropTypes.bool,
  feedback: PropTypes.oneOf([1, 0, null]),
  onFeedback: PropTypes.func
};

export default ResponseFooter;