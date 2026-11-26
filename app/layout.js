'use client';

import React from 'react';
import { Box, CssBaseline } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import { AuthProvider } from '@/app/contexts/OpenIdAuthContext';
import { SmartNotesProvider } from '@reducers/improved/SmartNotesContext';
import { SmartNoteTemplatesProvider } from '@reducers/improved/SmartNoteTemplatesContext';
import { SmartNoteProvider } from '@reducers/improved/SmartNoteContext';
import { UserAssistantProvider } from '@/reducers/UserAssistantContext';
import { ThemeModeProvider, useAppTheme } from '../theme';
import { Roboto } from 'next/font/google';
import PropTypes from 'prop-types';
import '../styles/globals.css';



const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

// Component that uses the theme hook
function ThemedLayout({ children }) {
  const theme = useAppTheme();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRouterCacheProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </AppRouterCacheProvider>
    </ThemeProvider>
  );
}

export default function RootLayout(props) {
  const { children } = props;

  return (
    <html lang="en">
      <body className={roboto.variable}>
        <ThemeModeProvider>
          <UserAssistantProvider>
            <SmartNotesProvider>
              <SmartNoteTemplatesProvider>
                <SmartNoteProvider>
                  <ThemedLayout>
                    {children}
                  </ThemedLayout>
                </SmartNoteProvider>
              </SmartNoteTemplatesProvider>
            </SmartNotesProvider>
          </UserAssistantProvider>
        </ThemeModeProvider>
      </body>
    </html>
  );
}

RootLayout.propTypes = {
  children: PropTypes.node,
};