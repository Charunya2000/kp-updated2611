'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box } from '@mui/material';
import PropTypes from 'prop-types';

const SmartNoteTable = ({ smartNotes, handleCardClick }) => {
  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell>Uploaded Documents</TableCell>
              <TableCell>References</TableCell>
              <TableCell>Jira Issues</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {smartNotes.map((smartNote) => (
              <TableRow key={smartNote.id} onClick={() => handleCardClick(smartNote)} sx={{ cursor: 'pointer' }}>
                <TableCell>{smartNote.title}</TableCell>
                <TableCell>{smartNote.savedNoteCount}</TableCell>
                <TableCell>{smartNote.uploadedDocumenteCount}</TableCell>
                <TableCell>{smartNote.designReferenceCount}</TableCell>
                <TableCell>{smartNote.jiraIssueCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

SmartNoteTable.propTypes = {
  smartNotes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      notesCount: PropTypes.number.isRequired,
      uploadedDocsCount: PropTypes.number.isRequired,
      referencesCount: PropTypes.number.isRequired,
      jiraType: PropTypes.string,
      jiraKey: PropTypes.string
    })
  ).isRequired,
  handleCardClick: PropTypes.func.isRequired
};

export default SmartNoteTable;