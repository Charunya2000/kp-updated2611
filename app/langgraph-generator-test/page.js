'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid2,
  TextField,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

export default function LangGraphGeneratorTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [customConfig, setCustomConfig] = useState('');

  const runTest = async (action, config = null) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/langgraph-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          config: config ? JSON.parse(config) : null,
          initialState: {
            userPrompt: 'Tell me about machine learning',
            user_name: 'Test User',
            role: 'AI researcher'
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sampleConfig = {
    nodes: [
      {
        id: 'start',
        type: 'start',
        data: { graph_id: 'demo_graph' }
      },
      {
        id: 'system',
        type: 'systemPrompt',
        data: {
          template: 'You are a knowledgeable {role}. Help the user understand {topic}.',
          variables: '{role}, {topic}',
          defaultValues: '{"role": "teacher", "topic": "general topics"}'
        }
      },
      {
        id: 'llm',
        type: 'llm',
        data: {
          model: 'gpt-4o',
          temperature: 0.7
        }
      },
      {
        id: 'end',
        type: 'end',
        data: { outputFormat: 'json' }
      }
    ],
    edges: [
      { source: 'start', target: 'system' },
      { source: 'system', target: 'llm' },
      { source: 'llm', target: 'end' }
    ]
  };

  return (
    <Box sx={{ p: 4, maxWidth: '1200px', mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        LangGraph Generator - Proof of Concept
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        This POC demonstrates generating executable LangGraphs from JSON configuration.
        Test the different scenarios below to see how the graph generator works.
      </Typography>

      <Grid2 container spacing={3}>
        {/* Predefined Tests */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Predefined Tests
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Run predefined test scenarios to validate the graph generator functionality.
              </Typography>
            </CardContent>
            <CardActions sx={{ flexDirection: 'column', gap: 1, align: 'stretch', p: 2 }}>
              <Button
                variant="contained"
                onClick={() => runTest('test')}
                disabled={loading}
                fullWidth
              >
                Run Complex Graph Test
              </Button>
              <Button
                variant="outlined"
                onClick={() => runTest('test-simple')}
                disabled={loading}
                fullWidth
              >
                Run Simple Graph Test
              </Button>
            </CardActions>
          </Card>
        </Grid2>

        {/* Custom Configuration */}
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Custom Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Test with a custom JSON configuration or use the sample below.
              </Typography>
              <TextField
                multiline
                rows={8}
                fullWidth
                value={customConfig || JSON.stringify(sampleConfig, null, 2)}
                onChange={(e) => setCustomConfig(e.target.value)}
                variant="outlined"
                sx={{
                  fontFamily: 'monospace',
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }
                }}
              />
            </CardContent>
            <CardActions sx={{ p: 2 }}>
              <Button
                variant="contained"
                onClick={() => runTest('generate', customConfig || JSON.stringify(sampleConfig))}
                disabled={loading}
                fullWidth
              >
                Generate & Execute Graph
              </Button>
            </CardActions>
          </Card>
        </Grid2>

        {/* Loading */}
        {loading && (
          <Grid2 size={12}>
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>
                Generating and executing graph...
              </Typography>
            </Box>
          </Grid2>
        )}

        {/* Error Display */}
        {error && (
          <Grid2 size={12}>
            <Alert severity="error">
              <Typography variant="h6">Error</Typography>
              {error}
            </Alert>
          </Grid2>
        )}

        {/* Results Display */}
        {result && (
          <Grid2 size={12}>
            <Alert severity="success" sx={{ mb: 2 }}>
              Graph execution completed successfully!
            </Alert>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6">Execution Results</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{
                  backgroundColor: '#f5f5f5',
                  p: 2,
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  overflow: 'auto'
                }}>
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Grid2>
        )}

        {/* Documentation */}
        <Grid2 size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                How It Works
              </Typography>
              <Typography variant="body2" component={"p"}>
                1. <strong>Configuration Input:</strong> Provide a JSON configuration with nodes and edges
              </Typography>
              <Typography variant="body2" component={"p"}>
                2. <strong>Graph Generation:</strong> The system creates a LangGraph StateGraph with appropriate annotations
              </Typography>
              <Typography variant="body2" component={"p"}>
                3. <strong>Node Functions:</strong> Each node type (start, systemPrompt, llm, tool, conditional, end) gets a corresponding function
              </Typography>
              <Typography variant="body2" component={"p"}>
                4. <strong>Edge Routing:</strong> Simple and conditional edges are added based on the configuration
              </Typography>
              <Typography variant="body2" component={"p"}>
                5. <strong>Execution:</strong> The compiled graph is executed with initial state and returns results
              </Typography>
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>
    </Box>
  );
}