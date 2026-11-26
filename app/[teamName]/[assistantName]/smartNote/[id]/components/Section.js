import React, { useState } from 'react';
import { Box, Typography, Button, IconButton, Checkbox, Menu, MenuItem } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import PropTypes from 'prop-types';

const Section = ({ title, itemType, items, onAdd, onEdit, onDelete, onMove, onFocus }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleMenuOpen = (event, item) => {
    setAnchorEl(event.currentTarget);
    setSelectedItem(item);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  const handleEdit = () => {
    onFocus(selectedItem);
    handleMenuClose();
  };

  const handleDelete = () => {
    onDelete(selectedItem);
    handleMenuClose();
  };

  const handleAdd = () => {
    onFocus(null);
  };

  return (
    <Box sx={{ marginTop: 2, p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>{title}</Typography>
      <Button className='fullWidthButton' startIcon={<AddIcon />} onClick={handleAdd}>
        Add {itemType}
      </Button>
      {items.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
          <IconButton onClick={(event) => handleMenuOpen(event, item)}>
            <MoreVertIcon />
          </IconButton>
          <Typography>{item.text}</Typography>
          <Checkbox />
        </Box>
      ))}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button onClick={onMove}>
          Move to another list
        </Button>
      </Box>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleEdit}>Edit</MenuItem>
        <MenuItem onClick={handleDelete}>Delete</MenuItem>
      </Menu>
    </Box>
  );
};

Section.propTypes = {
  title: PropTypes.string.isRequired,
  itemType: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired
  })).isRequired,
  onAdd: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onMove: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired
};

export default Section;