'use client';

import { Box } from "@mui/material";
import Link from "next/link";

/**
 * A themed Next.js Link component that properly applies theme colors
 * This wrapper ensures that Next.js Link components inherit your theme's link styling
 */
const ThemedLink = ({ href, children, external = false, sx = {}, ...props }) => {
  // For external links, use a regular anchor tag
  if (external) {
    return (
      <Box
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          color: 'link.main',
          textDecoration: 'none',
          transition: 'color 0.2s ease-in-out',
          cursor: 'pointer',
          '&:hover': {
            color: 'link.hover',
            textDecoration: 'underline',
          },
          '&:visited': {
            color: 'link.visited',
          },
          '&:active': {
            color: 'link.active',
          },
          ...sx
        }}
        {...props}
      >
        {children}
      </Box>
    );
  }

  // For internal links, use Next.js Link with themed styling
  return (
    <Link
      href={href}
      style={{
        color: 'inherit',
        textDecoration: 'none'
      }}
      {...props}
    >
      <Box
        component="span"
        sx={{
          color: 'link.main',
          textDecoration: 'none',
          transition: 'color 0.2s ease-in-out',
          cursor: 'pointer',
          '&:hover': {
            color: 'link.hover',
            textDecoration: 'underline',
          },
          '&:visited': {
            color: 'link.visited',
          },
          '&:active': {
            color: 'link.active',
          },
          ...sx
        }}
      >
        {children}
      </Box>
    </Link>
  );
};

export default ThemedLink;
