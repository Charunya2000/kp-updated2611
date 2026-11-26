import React, { useState, useEffect } from 'react';
import { Box, Button, Breadcrumbs, Link, TextField, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const SectionDetail = ({ item, onSave, onClose }) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (item) {
      setText(item.text);
    }
  }, [item]);

  const handleSave = () => {
    onSave({ ...item, text });
  };

  return (
    <Box sx={{ p: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Breadcrumbs separator={<ArrowForwardIosIcon sx={{ fontSize: 20 }} />} aria-label="breadcrumb">
          <Link underline="hover" color="inherit">
            <Typography variant="h5">Desktop</Typography>
          </Link>
          <Typography variant="h5">{item ? 'Edit Item' : 'Add Item'}</Typography>
        </Breadcrumbs>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <TextField
        label="Text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        fullWidth
        multiline
        rows={4}
        sx={{ mb: 2, flexGrow: 1 }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Box sx={{ mr: 1 }}>
          <Button className='saveCancel' onClick={onClose}>
            Cancel
          </Button>
        </Box>
        <Box>
          <Button className='saveCancel' onClick={handleSave}>
            Save
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default SectionDetail;