'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { Paper, Box, Typography, Button } from '@mui/material'
import { sessionManager } from '@/lib/sessionManager';
import { authApiClient } from '@/lib/authApiClient';
import { usePathname, useParams } from 'next/navigation';
import { LeftNavProvider, useLeftNav } from '@reducers/LeftNavContext';
import LeftNav from '../components/LeftNav';
import Header from '../components/Header';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  // Start with null user so SSR and initial client HTML match, preventing hydration mismatch (#418)
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeoutReason, setTimeoutReason] = useState(null);
  const pathname = usePathname();
  const params = useParams();

  // Check if route contains team and assistant but nothing past that
  const isAssistantRoute = params?.teamName && params?.assistantName && pathname?.split('/').length === 3;
  const isRoot = pathname === '/';

  // Check for existing session on mount; optionally use localStorage as a fast hint after mount only
  useEffect(() => {
    let preloaded = false;
    try {
      const stored = sessionManager.getStoredSession();
      const expiresAtMs = stored ? Date.parse(stored.expires) : 0;
      if (stored && expiresAtMs > Date.now() && stored.user?.id) {
        setUser(stored.user);
        preloaded = true;
      }
    } catch { }
    checkExistingSession(preloaded);
  }, []);

  // Safety fallback: if loading persists beyond timeout (e.g., network hang), force completion
  useEffect(() => {
    if (!loading) return;
    const timeoutMs = +(process.env.NEXT_PUBLIC_OPENID_LOADING_TIMEOUT_MS || 4000);
    const id = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          if (process.env.OPENID_DEBUG === 'true') console.warn('[AuthProvider] loading timeout fallback triggered');
          return false;
        }
        return prev;
      });
    }, timeoutMs);
    return () => clearTimeout(id);
  }, [loading]);

  // Set up automatic token refresh
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const storedSession = sessionManager.getStoredSession();
      if (storedSession && sessionManager.needsRefresh(storedSession)) {
        await refreshSession();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user]);

  // Heartbeat polling to detect server-side idle or absolute timeout proactively
  useEffect(() => {
    const intervalMs = +(process.env.NEXT_PUBLIC_OPENID_HEARTBEAT_MS || 60000); // default 60s
    if (loading) return; // wait until initial check done
    const poll = async () => {
      try {
        const response = await authApiClient.checkSession();
        if (response.success && response.data?.user?.id) {
          // Active session, ensure local storage stays in sync if missing
          if (!sessionManager.getStoredSession()) {
            sessionManager.storeSession({
              user: response.data.user,
              accessToken: '',
              expires: response.data.expires,
            });
            setUser(response.data.user);
          }
        } else {
          // Possibly timeout; inspect raw JSON for reason
          // Re-fetch raw to extract reason since authApiClient currently wraps data
          const raw = await fetch(`${globalThis.location.origin}/api/openid/session`, { credentials: 'include' });
          let reason = response?.data?.reason;
          if (!reason && raw.ok) {
            try {
              const j = await raw.json();
              reason = j.reason;
            } catch { }
          }
          sessionManager.clearSession();
          setUser(null);
          if (reason) setTimeoutReason(reason);
        }
      } catch (e) {
        // Network errors ignored; keep existing state
        if (process.env.OPENID_DEBUG === 'true') console.warn('heartbeat error', e);
      }
    };
    const id = setInterval(poll, intervalMs);
    return () => clearInterval(id);
  }, [loading]);

  const checkExistingSession = async (hadPreload) => {
    try {
      // First, check localStorage
      const storedSession = sessionManager.getStoredSession();
      // console.log('checkExistingSession, storedSession:', storedSession);
      const hasValidStoredUser = !!storedSession?.user?.id;
      if (hasValidStoredUser) {
        // console.log('checkExistingSession - found stored session with valid user id');
      } else if (storedSession) {
        // console.log('checkExistingSession - stored session invalid (missing user id), clearing');
        sessionManager.clearSession();
      }
      // Always ask server; it is source of truth
      const response = await authApiClient.checkSession();
      // console.log('checkExistingSession - server check response:', response);
      if (response.success && response.data?.user?.id) {
        const session = {
          user: response.data.user,
          accessToken: '',
          expires: response.data.expires,
        };
        sessionManager.storeSession(session);
        if (user?.id !== response.data.user.id) {
          setUser(response.data.user);
        }
      } else {
        setUser(null);
        const reason = response?.data?.reason;
        if (reason) {
          // Server returned a specific timeout reason (idle, absolute, revoked)
          setTimeoutReason(reason);
        } else if (hasValidStoredUser) {
          // Had a valid session before but server says unauthenticated — session was lost
          // Show "Session Ended" instead of just the Sign In button
          setTimeoutReason('session_lost');
        }
        sessionManager.clearSession();
      }
    } catch (error) {
      console.error('Session check failed:', error);
      sessionManager.clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const response = await authApiClient.refreshSession();
      if (response.success && response.data) {
        const session = {
          user: response.data.user,
          accessToken: '', // Server manages tokens
          expires: response.data.expires,
        };
        sessionManager.storeSession(session);
        setUser(response.data.user);
      } else if (response?.data?.error === 'no_refresh_token') {
        // Bypass mode — no refresh token, session is still valid, skip silently
        return;
      } else {
        // Refresh failed, clear session
        sessionManager.clearSession();
        setUser(null);
      }
    } catch (error) {
      console.error('Session refresh failed:', error);
      sessionManager.clearSession();
      setUser(null);
    }
  };

  const signIn = (targetPath = '/') => {
    console.log('Redirecting to openid sign-in, returnTo:', targetPath);
    // Normalize and encode returnTo
    const returnTo = targetPath.startsWith('/') ? targetPath : '/';
    globalThis.location.href = `/api/openid/signin?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const signOut = async () => {
    setLoading(true);
    try {
      // Call server logout
      await authApiClient.logout();

      // Clear local session
      sessionManager.clearSession();
      setUser(null);

      // Redirect to FAM logout page
      const famLogoutUrl = `${process.env.NEXT_PUBLIC_FAM_PREFIX || 'https://fam-uat.kp.org'}/ext/famlogout`;
      globalThis.location.href = famLogoutUrl;
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      <Header />
      {
        timeoutReason && !user ? (
          <>
            <Box sx={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
              <Box sx={{ backgroundColor: 'card.body.deep', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 0.5, borderRadius: 2, py: 4, px: 16, boxShadow: 3 }}>
                <Typography variant='h2' sx={{ mb: 4 }}>Session Ended</Typography>
                <Typography variant='body1'>
                  {timeoutReason === 'idle_timeout' && 'You were logged out due to inactivity.'}
                  {timeoutReason === 'absolute_timeout' && 'Your session reached its maximum duration.'}
                  {timeoutReason === 'revoked' && 'Your session was revoked.'}
                  {timeoutReason === 'session_lost' && 'Your session has ended. Please sign in again.'}
                </Typography>
                <Typography>
                  {!['idle_timeout', 'absolute_timeout', 'revoked', 'session_lost'].includes(timeoutReason) && 'Please log in again to continue.'}
                </Typography>
                <Button
                  sx={{ mt: 4 }}
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    setTimeoutReason(null);
                    signIn();
                  }}
                >Sign In Again</Button>
              </Box>
            </Box>
          </>
        ) : (
          <LeftNavProvider>
            <Box
              sx={{
                display: 'flex',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
              }}
            >
              {/* Conditionally render LeftNav only for the root route */}
              {(isAssistantRoute || isRoot) && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '100%',
                    overflowY: 'auto',
                    flexShrink: 0,
                  }}
                >
                  <LeftNav />
                </Box>
              )}
              <Box sx={{ width: "100%", height: "100%", flex: 1 }}>
                {children}
              </Box>
            </Box>
          </LeftNavProvider>
        )}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useOpenIdAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useOpenIdAuth must be used within an AuthProvider');
  }
  return context;
}

// Alternative hook name to avoid confusion with current useAuth
export function useAuth() {
  return useOpenIdAuth();
}