'use client';

import { Box, Button } from '@mui/material';
import PropTypes from 'prop-types';

const MultipleChoice = ({ options, onSelect }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {options.map((option, index) => (
        <Button
          key={index}
          variant="outlined"
          onClick={() => onSelect(option)}
          sx={{ marginBottom: 1, borderRadius: '24px' }}
        >
          {option}
        </Button>
      ))}
    </Box>
  );
};

MultipleChoice.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default MultipleChoice;