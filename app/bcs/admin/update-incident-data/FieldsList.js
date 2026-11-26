'use client';

import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Skeleton
} from '@mui/material';

const FieldsList = ({ fields, isLoading, onFieldToggle, title = "Required Fields" }) => {
  const handleToggle = (fieldIndex) => {
    if (onFieldToggle) {
      onFieldToggle(fieldIndex);
    }
  };

  if (!isLoading && (!fields || fields.length === 0)) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No fields available
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {
        isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', mt: 2, ml: 2 }}>
            {Array(6).fill().map((_, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 4, height: '50px', alignItems: 'center' }}>
                <Skeleton variant="rectangular" width={24} height={24} />
                <Skeleton variant="rectangular" width={220} height={24} />
              </Box>
            ))
            }

          </Box>
        ) : (
          <List sx={{ width: '100%' }}>
            {fields.map((field, index) => (
              <ListItem key={`field-${index}`} disablePadding>
                <ListItemButton
                  onClick={() => handleToggle(index)}
                  dense
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={field.selected}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={field.name}
                    sx={{
                      textDecoration: field.selected ? 'none' : 'none',
                      color: field.selected ? 'primary.main' : 'text.primary'
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )
      }
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {fields.filter(field => field.selected).length} of {fields.length} fields selected
      </Typography>
    </Box>
  );
};

export default FieldsList;