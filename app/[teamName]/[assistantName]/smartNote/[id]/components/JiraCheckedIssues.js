import { Box, Chip } from '@mui/material';

const JiraCheckedIssues = ({ checkedIssues, handleRowClick }) => {
  if (!checkedIssues || checkedIssues.length === 0) {
    return null;
  }

  return (
    <Box sx={{
      padding: 1,
      border: '1px solid',
      borderColor: 'card.border.main',
      borderRadius: '4px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 1,
      alignItems: 'center',
      marginTop: 'auto'
    }}>
      {checkedIssues
        .map(issue => (
          <Chip
            key={issue.key}
            label={issue.key}
            onDelete={() => handleRowClick(issue)}
            variant="outlined"
            size="small"
            sx={{
              '& .MuiChip-deleteIcon': {
                color: 'error.main',
                borderRadius: '1000px',
                '&:hover': {
                  color: 'error.dark'
                }
              }
            }}
          />
        ))}
    </Box>
  );
}

export default JiraCheckedIssues;