import React, { useState } from 'react';
import { Box, Typography, IconButton, Divider } from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import WorkflowSection from './WorkflowSection';
import FindTestDataSection from './FindTestDataSection';
import PropTypes from 'prop-types';

const DesktopColumn = ({ position, widths, label, width, onExpand, onShrink }) => {
  const [focusedSection, setFocusedSection] = useState(null);

  const handleSectionFocus = (section) => {
    onExpand('mid');
    setFocusedSection(section);
  };

  const handleCloseFocus = () => {
    setFocusedSection(null);
  };

  const handleBackToMain = () => {
    setFocusedSection(null);
  };

  const getWidth = () => {
    if (width === 'min') return widths[0];
    if (width === 'mid') return widths[1];
    if (width === 'max') return widths[2];
    return '60%';
  };

  const desktopSections = [{
    id: 1,
    summary: <WorkflowSection onFocus={handleSectionFocus} onBlur={handleCloseFocus} onBack={handleBackToMain} />
  }];

  return (
    <Box sx={{ width: getWidth(), height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'white', border: '1px solid', borderColor: 'color.dolphin', borderRadius: '15px' }}>
      {focusedSection ? (
        <Box sx={{ width: '100%', height: '100%', overflowY: 'auto' }}>
          {focusedSection}
        </Box>
      ) : (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', flexGrow: 0, justifyContent: 'space-between', height: '4em', alignItems: 'center', p: 1 }}>
            <Typography variant="h5">{label}</Typography>
            {position === 'right' &&
              <Box>
                {width !== 'max' && (
                  <IconButton onClick={() => onExpand(width)}>
                    <FirstPageIcon />
                  </IconButton>
                )}
                {width !== 'min' && (
                  <IconButton onClick={() => onShrink(width)}>
                    <LastPageIcon />
                  </IconButton>
                )}
              </Box>
            }
            {position !== 'right' &&
              <Box>
                {width !== 'min' && (
                  <IconButton onClick={() => onShrink(width)}>
                    <FirstPageIcon />
                  </IconButton>
                )}
                {width !== 'max' && (
                  <IconButton onClick={() => onExpand(width)}>
                    <LastPageIcon />
                  </IconButton>
                )}
              </Box>
            }
          </Box>
          <Divider sx={{ width: '100%' }} />
          <Box sx={{ flex: 1, overflowY: 'auto', margin: 1.5, marginLeft: 0, marginTop: 0, '&::-webkit-scrollbar': { width: '12px' }, '&::-webkit-scrollbar-thumb': { backgroundColor: '#b0c4de', borderRadius: '6px' } }}>
            {desktopSections.map((section, index) => (
              <React.Fragment key={section.id}>
                {section.summary}
                {index < desktopSections.length - 1 && <Divider sx={{ width: '100%', my: 2 }} />}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

DesktopColumn.propTypes = {
  position: PropTypes.oneOf(['left', 'center', 'right']).isRequired,
  widths: PropTypes.arrayOf(PropTypes.string).isRequired,
  label: PropTypes.string.isRequired,
  width: PropTypes.oneOf(['min', 'mid', 'max']).isRequired,
  sections: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string.isRequired,
    items: PropTypes.array.isRequired
  })).isRequired,
  onExpand: PropTypes.func.isRequired,
  onShrink: PropTypes.func.isRequired
};

export default DesktopColumn;