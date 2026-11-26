"use client"
import { Box, Checkbox } from '@mui/material';

const JiraIssueTable = ({ jiraIssues, handleRowClick, checkedIssues, existingSources }) => {
  const isDisabled = (jiraKey) => {
    return existingSources && existingSources.some(source => source.jiraKey === jiraKey);
  };

  const columnWidths = {
    checkbox: '50px',
    key: '100px',
    type: '100px',
    summary: '200px',
    description: 'flex',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        width: '100%',
        backgroundColor: 'table.head.background',
        fontWeight: 600,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <Box sx={{ margin: '12px 0px', width: columnWidths.checkbox, flexShrink: 0 }}></Box>
        <Box sx={{ margin: '12px', width: columnWidths.key, flexShrink: 0 }}>Key</Box>
        <Box sx={{ margin: '12px', width: columnWidths.type, flexShrink: 0 }}>Type</Box>
        <Box sx={{ margin: '12px', width: columnWidths.summary, flexShrink: 0 }}>Summary</Box>
        <Box sx={{ margin: '12px', flex: 1, minWidth: 0 }}>Description</Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, minHeight: 0, maxHeight: '100%', overflowY: 'auto', ml: '1px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {jiraIssues && jiraIssues.map((issue) => {
            const disabled = isDisabled(issue.key);
            const isChecked = disabled || (checkedIssues && checkedIssues.map(iss => iss.key).includes(issue.key));
            return (
              <Box
                key={issue.key}
                onClick={() => !disabled && handleRowClick(issue)}
                sx={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  backgroundColor: isChecked ? 'table.row.selected.background' : 'transparent',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: 'card.border.main',
                  '&:hover': {
                    backgroundColor: disabled ? 'table.row.selected.background' : 'table.row.hover.background',
                  },
                  alignItems: 'center',
                }}
              >
                {/* Cells */}
                <Box sx={{ height: '100%', width: columnWidths.checkbox, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '12px 0px' }}>
                  <Checkbox
                    checked={isChecked}
                    disabled={disabled}
                  />
                </Box>
                <Box sx={{ height: '100%', width: columnWidths.key, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', margin: '12px', display: 'flex', alignItems: 'center' }}>
                  {issue.key}
                </Box>
                <Box sx={{ height: '100%', width: columnWidths.type, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', margin: '12px', display: 'flex', alignItems: 'center' }}>
                  {issue.issueType}
                </Box>
                <Box sx={{ height: '100%', width: columnWidths.summary, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', margin: '12px', display: 'flex', alignItems: 'center' }}>
                  {issue.summary}
                </Box>
                <Box sx={{ height: '100%', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', margin: '12px', display: 'flex', maxHeight: '200px', overflow: 'auto' }}>
                  {issue.description}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  )
}

export default JiraIssueTable;