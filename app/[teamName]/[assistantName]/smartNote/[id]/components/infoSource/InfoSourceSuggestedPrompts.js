'use client';

import { Box, Link, Typography } from '@mui/material';
import PropTypes from 'prop-types';

const InfoSourceSuggestedPrompts = ({ prompts }) => {
  if (!Array.isArray(prompts) || prompts.length === 0) {
    return null;
  }

  const handlePromptClick = (prompt) => {
    if (!prompt) {
      return;
    }

    window.dispatchEvent(new CustomEvent('infosource-suggested-prompt', {
      detail: { prompt }
    }));
  };

  return (
    <Box sx={{ mt: 0.75, mb: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
        You might also ask
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {prompts.map((item, index) => {
          const prompt = typeof item === 'string' ? item : item?.prompt;
          const key = item?.id || `${index}-${prompt}`;
          if (!prompt) {
            return null;
          }

          return (
            <Box component="li" key={key} sx={{ lineHeight: 1.25 }}>
              <Link
                component="button"
                type="button"
                underline="hover"
                color="primary"
                onClick={() => handlePromptClick(prompt)}
                sx={{
                  textAlign: 'left',
                  fontSize: '0.9rem',
                  lineHeight: 1.3,
                  display: 'inline',
                  maxWidth: '100%'
                }}
              >
                {prompt}
              </Link>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

InfoSourceSuggestedPrompts.propTypes = {
  prompts: PropTypes.array
};

export default InfoSourceSuggestedPrompts;
