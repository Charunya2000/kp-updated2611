'use client';

import React, { useState } from 'react';
import { Button, TextField, Typography, Paper, Box } from '@mui/material';
import MermaidRenderer from '../[teamName]/[assistantName]/smartNote/[id]/components/MermaidRenderer';

const MermaidTestPage = () => {
  const [mermaidCode, setMermaidCode] = useState(`graph TD
    A --> B
    B --> C
    C --> D`);

  const [submittedCode, setSubmittedCode] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmittedCode(mermaidCode);
    setIsSubmitted(true);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setSubmittedCode('');
  };

  return (
    <Box sx={{ width: "100%", height: "100%", flex: 1, overflow: 'auto' }}>
      <Box sx={{ padding: 3, maxWidth: 1200, margin: '0 auto' }}>
        <Typography variant="h4" gutterBottom>
          Mermaid Graph Tester
        </Typography>

        <Paper elevation={2} sx={{ padding: 3, marginBottom: 3 }}>
          <Typography variant="h6" gutterBottom>
            Enter Mermaid Code:
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={10}
            variant="outlined"
            value={mermaidCode}
            onChange={(e) => setMermaidCode(e.target.value)}
            placeholder="Enter your Mermaid graph code here..."
            sx={{ marginBottom: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!mermaidCode.trim()}
            >
              Render Graph
            </Button>

            {isSubmitted && (
              <Button
                variant="secondary"
                onClick={handleReset}
              >
                Reset
              </Button>
            )}
          </Box>
        </Paper>

        {isSubmitted && submittedCode && (
          <Paper elevation={2} sx={{ padding: 3 }}>
            <Typography variant="h6" gutterBottom>
              Rendered Graph:
            </Typography>

            <Box sx={{
              border: '1px solid #ddd',
              borderRadius: 1,
              padding: 2,
              minHeight: 200
            }}>
              <MermaidRenderer
                content={submittedCode}
                isComplete={true}
              />
            </Box>
          </Paper>
        )}

        <Paper elevation={1} sx={{ padding: 2, marginTop: 3 }}>
          <Typography variant="h6" gutterBottom>
            Example Mermaid Graphs:
          </Typography>

          <Typography variant="body2" component="div">
            <strong>Simple Test (try this first):</strong>
            <pre style={{ fontSize: '12px', margin: '8px 0' }}>
              {`graph LR
    A --> B
    B --> C`}
            </pre>

            <strong>Basic Flowchart:</strong>
            <pre style={{ fontSize: '12px', margin: '8px 0' }}>
              {`flowchart TD
    Start --> Stop`}
            </pre>

            <strong>Flowchart with Shapes:</strong>
            <pre style={{ fontSize: '12px', margin: '8px 0' }}>
              {`graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]`}
            </pre>

            <strong>Sequence Diagram:</strong>
            <pre style={{ fontSize: '12px', margin: '8px 0' }}>
              {`sequenceDiagram
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>John: How about you John?
    Bob--x Alice: I am good thanks!`}
            </pre>

            <strong>Gantt Chart:</strong>
            <pre style={{ fontSize: '12px', margin: '8px 0' }}>
              {`gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Development
    Task 1 :a1, 2024-01-01, 30d
    Task 2 :after a1, 20d`}
            </pre>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default MermaidTestPage;
