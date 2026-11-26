'use client';

import { Box, Button } from '@mui/material';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import { useUserAssistants } from '@/reducers/UserAssistantContext';

const CASE360_ASSISTANTS = [
  'case-360-assistant',
  'medicare-companion',
];

const RequestFooter = ({ saveToSources }) => {
  const { selectedUserAssistant } = useUserAssistants();

  if (selectedUserAssistant && CASE360_ASSISTANTS.includes(selectedUserAssistant.name)) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: 1 }}>
      <Button
        variant="action"
        onClick={saveToSources}
        startIcon={<BookmarkBorderOutlinedIcon style={{ fontSize: '16px' }} />}
      >
        Save to sources
      </Button>
    </Box>
  );
};

export default RequestFooter;