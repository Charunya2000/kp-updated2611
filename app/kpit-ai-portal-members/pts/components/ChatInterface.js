'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Typography,
  Paper,
  InputAdornment,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';

const renderMarkdown = (text) => {
  if (!text) return '';

  let html = text;

  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3 style="margin: 8px 0; font-size: 1.1em; font-weight: bold;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="margin: 10px 0; font-size: 1.2em; font-weight: bold;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="margin: 12px 0; font-size: 1.3em; font-weight: bold;">$1</h1>');

  // Convert bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert line breaks to <br>
  html = html.replace(/\n/g, '<br>');

  // Convert lists
  html = html.replace(/^- (.+)$/gim, '<li style="margin-left: 20px;">$1</li>');

  return html;
};

const ChatInterface = ({ sessionId, sourceType, apiBaseUrl }) => {
  const { user } = useAuth();
  const currentUserNUID = user?.nuid || user?.userId || user?.id || '';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) {
      return;
    }

    if (!sessionId) {
      setError('Please enter a session ID first');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setError('');

    try {
      setLoading(true);

      const endpoint = `/api/pts/chat?session_id=${sessionId}`;

      console.log('💬 [PTS] Sending chat message...');
      console.log('📍 Chat API URL:', endpoint);
      console.log('📦 Question:', userMessage);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          source_type: sourceType,
          createdByNUID: currentUserNUID,
        }),
      });

      console.log('✅ Chat Response Status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.answer || 'Failed to get response');
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer || 'No response' },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card>
      <CardHeader
        title="Chat with Analysis Agent"
        subtitle="Ask questions about the performance analysis results"
      />
      <Divider />
      <CardContent>
        {/* Chat Display */}
        <Paper
          sx={{
            bgcolor: '#f5f5f5',
            p: 2,
            mb: 2,
            minHeight: 260,
            height: 'clamp(260px, 45vh, 520px)',
            maxHeight: '70vh',
            overflowY: 'auto',
            overflowX: 'auto',
            borderRadius: 1,
          }}
        >
          {messages.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 10 }}>
              Start chatting with the analysis agent. Ask questions about your performance test results!
            </Typography>
          ) : (
            messages.map((msg, idx) => (
              <Box
                key={idx}
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <Paper
                  sx={{
                    p: 1.5,
                    maxWidth: '70%',
                    bgcolor: msg.role === 'user' ? '#3498db' : '#ecf0f1',
                    color: msg.role === 'user' ? 'white' : 'black',
                    borderRadius: 2,
                  }}
                >
                  {msg.role === 'user' ? (
                    <Typography variant="body2">{msg.content}</Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      component="div"
                      sx={{
                        '& h1, & h2, & h3': { color: '#2c3e50' },
                        '& strong': { fontWeight: 'bold' },
                        '& li': { listStyleType: 'disc' },
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  )}
                </Paper>
              </Box>
            ))
          )}
          <div ref={messagesEndRef} />
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!sessionId && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Please enter a session ID to start chatting
          </Alert>
        )}

        {/* Input Area */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            placeholder="Ask a question about the performance analysis..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading || !sessionId}
            multiline
            maxRows={4}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {loading && <CircularProgress size={24} />}
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendMessage}
            disabled={loading || !input.trim() || !sessionId}
            endIcon={<SendIcon />}
            sx={{ height: '56px', alignSelf: 'flex-start' }}
          >
            Send
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          💡 Example questions: "What's the average response time?", "Which transactions failed?",
          "Are we meeting our SLAs?"
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ChatInterface;
