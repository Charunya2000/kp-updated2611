'use client';

import { Box } from '@mui/material';
import { useRef } from 'react';

const IFrame = ({ url, title, message = 'Message from AI Portal' }) => {
  const iFrameRef = useRef(null);

  // when the iframe loads, post a message to it
  const handleLoad = () => {
    const origin = new URL(iFrameRef.current.src).origin;
    iFrameRef.current.contentWindow.postMessage(message, origin);
  };

  return (
    <Box display={'flex'} flexDirection={'row'} width={'100%'} height={'100%'} marginBottom={'1em'}>
      <iframe
        src={url}
        onLoad={handleLoad}
        width="100%"
        height="100%"
        style={{ border: 'none' }}
        title={title}
        ref={iFrameRef}
      />
    </Box>
  );
}

export default IFrame;