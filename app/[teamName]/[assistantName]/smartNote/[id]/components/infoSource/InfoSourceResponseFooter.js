'use client';

import { useState } from 'react';
import { Box, Button, Menu, MenuItem, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BorderAllIcon from '@mui/icons-material/BorderAll';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import PropTypes from 'prop-types';

const InfoSourceResponseFooter = ({
  onCopyAction,
  copyOptions,
  isExcelExportEnabled,
  handleExportToExcel,
  timeStamp
}) => {
  const [copyMenuAnchor, setCopyMenuAnchor] = useState(null);
  const formattedTimeStamp = timeStamp ? new Date(timeStamp).toLocaleString() : null;
  const isCopyMenuOpen = Boolean(copyMenuAnchor);

  const handleOpenCopyMenu = (event) => {
    setCopyMenuAnchor(event.currentTarget);
  };

  const handleCloseCopyMenu = () => {
    setCopyMenuAnchor(null);
  };

  const handleCopyMenuItemSelect = (action) => {
    handleCloseCopyMenu();
    onCopyAction?.(action);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', mt: 0.5 }}>
      {isExcelExportEnabled && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', width: '100%', py: 0.6 }}>
          <Button
            variant='secondary'
            className='responseFooter'
            startIcon={<BorderAllIcon />}
            onClick={handleExportToExcel}
          >
            Export to Excel
          </Button>
        </Box>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', pr: 0.5, pb: 0.75 }}>
        {isExcelExportEnabled && (
          <Box sx={{ flex: 1 }} />
        )}
        <Button
          variant='secondary'
          className='responseFooter'
          onClick={handleOpenCopyMenu}
          startIcon={<ContentCopyIcon />}
          endIcon={<ArrowDropDownIcon />}
          aria-controls={isCopyMenuOpen ? 'infosource-copy-menu' : undefined}
          aria-haspopup='menu'
          aria-expanded={isCopyMenuOpen ? 'true' : undefined}
        >
          Copy
        </Button>
      </Box>
      <Menu
        id='infosource-copy-menu'
        anchorEl={copyMenuAnchor}
        open={isCopyMenuOpen}
        onClose={handleCloseCopyMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{
          dense: true,
          'aria-label': 'Copy menu options'
        }}
      >
        {(Array.isArray(copyOptions) ? copyOptions : []).map((option) => (
          <MenuItem
            key={option.key}
            disabled={Boolean(option.disabled)}
            onClick={() => handleCopyMenuItemSelect(option.key)}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
      {formattedTimeStamp && (
        <Typography variant="body2" sx={{ fontSize: '12px', opacity: 0.7, alignSelf: 'flex-end', pr: 0.6 }}>
          {formattedTimeStamp}
        </Typography>
      )}
    </Box>
  );
};

InfoSourceResponseFooter.propTypes = {
  onCopyAction: PropTypes.func.isRequired,
  copyOptions: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
  })),
  isExcelExportEnabled: PropTypes.bool,
  handleExportToExcel: PropTypes.func,
  timeStamp: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.instanceOf(Date)])
};

export default InfoSourceResponseFooter;
