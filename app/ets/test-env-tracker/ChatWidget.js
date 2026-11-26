'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/app/contexts/OpenIdAuthContext';
import {
  Box,
  Fab,
  Paper,
  Typography,
  TextField,
  IconButton,
  Collapse,
  List,
  ListItem,
  CircularProgress,
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReactMarkdown from 'react-markdown';

const API_PREFIX = '/api/envtracker';

export default function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState([
    { id: 1, text: 'Hello! How can I help you with the Environment Tracker? Ask me about releases, milestones, or environments.', sender: 'bot' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClearSession = () => {
    setSessionId(crypto.randomUUID());
    setMessages([
      { id: Date.now(), text: 'Hello! How can I help you with the Environment Tracker? Ask me about releases, milestones, or environments.', sender: 'bot' }
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userQuery = inputValue.trim();

    // Add user message
    const userMessage = {
      id: Date.now(),
      text: userQuery,
      sender: 'user'
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_PREFIX}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userQuery,
          session_id: sessionId,
          nuid: user?.nuid || 'unknown'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const botMessage = {
        id: Date.now() + 1,
        text: data.response || 'No response received.',
        sender: 'bot'
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat query error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
        sender: 'bot'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Chat Panel */}
      <Collapse in={isOpen}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            width: 480,
            height: 600,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1300,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Environment Tracker Assistant
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                size="small"
                onClick={handleClearSession}
                sx={{ color: 'white' }}
                title="Clear chat history"
              >
                <RefreshIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleToggle}
                sx={{ color: 'white' }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Messages Area */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
              bgcolor: '#f5f5f5',
            }}
          >
            <List sx={{ p: 0 }}>
              {messages.map((message) => (
                <ListItem
                  key={message.id}
                  sx={{
                    justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                    px: 0,
                    py: 0.5,
                  }}
                >
                  <Paper
                    sx={{
                      p: 1.5,
                      maxWidth: '90%',
                      bgcolor: message.sender === 'user' ? 'primary.main' : 'white',
                      color: message.sender === 'user' ? 'white' : 'text.primary',
                      borderRadius: 2,
                    }}
                  >
                    {message.sender === 'user' ? (
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                        {message.text}
                      </Typography>
                    ) : (
                      <Box
                        sx={{
                          '& p': { m: 0, mb: 1, fontSize: '0.875rem', lineHeight: 1.5 },
                          '& p:last-child': { mb: 0 },
                          '& ul, & ol': { m: 0, pl: 2, mb: 1 },
                          '& li': { fontSize: '0.8rem', lineHeight: 1.4, mb: 0.25 },
                          '& strong': { fontWeight: 600 },
                          '& code': { bgcolor: 'rgba(0,0,0,0.05)', px: 0.5, borderRadius: 0.5, fontSize: '0.8rem' },
                        }}
                      >
                        <ReactMarkdown>{message.text}</ReactMarkdown>
                      </Box>
                    )}
                  </Paper>
                </ListItem>
              ))}
              {isLoading && (
                <ListItem sx={{ justifyContent: 'flex-start', px: 0, py: 0.5 }}>
                  <Paper sx={{ p: 1.5, bgcolor: 'white', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">Thinking...</Typography>
                  </Paper>
                </ListItem>
              )}
              <div ref={messagesEndRef} />
            </List>
          </Box>

          {/* Input Area */}
          <Box
            sx={{
              p: 2,
              bgcolor: 'white',
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              gap: 1,
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="Ask about releases, environments..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              variant="outlined"
              multiline
              maxRows={3}
              disabled={isLoading}
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              sx={{ alignSelf: 'flex-end' }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      </Collapse>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="chat"
        onClick={handleToggle}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1300,
        }}
      >
        <ChatIcon />
      </Fab>
    </>
  );
}
