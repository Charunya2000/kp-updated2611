'use client';

import React, { useCallback, useMemo } from 'react';
import {
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { List as WindowList } from 'react-window';
import CloseIcon from '@mui/icons-material/Close';

const AssignedUsersList = ({ assignedUsers, onRemoveUser }) => {
  // Memoize the VirtualizedUserItem to prevent unnecessary re-renders
  const VirtualizedUserItem = useMemo(() => {
    return ({ index, style, data }) => {
      const user = data[index];
      return (
        <div style={style} key={user.nuid}>
          <ListItem
            sx={{ py: 1 }}
            secondaryAction={
              <IconButton
                edge="end"
                aria-label="remove user"
                onClick={() => onRemoveUser(user.nuid)}
                sx={{
                  color: 'error.dark',
                  '&:hover': { color: 'error.main' }
                }}
                size="small"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={user.nuid}
                    size="small"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }}
                  />
                  <Typography variant="body2">
                    {user.name}
                  </Typography>
                </Stack>
              }
            />
          </ListItem>
          {index < assignedUsers.length - 1 && <Divider />}
        </div>
      );
    };
  }, [assignedUsers, onRemoveUser]);

  // Don't render if no users
  if (!assignedUsers || assignedUsers.length === 0) {
    return null;
  }

  return (
    <WindowList
      rowCount={assignedUsers.length}
      rowHeight={48}
      overscanCount={5}
      rowProps={{ data: assignedUsers }}
      rowComponent={VirtualizedUserItem}
    />
  );
};

export default React.memo(AssignedUsersList);