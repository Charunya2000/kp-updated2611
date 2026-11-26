/**
 * Client-side API client for OpenID authentication endpoints
 * Handles all client-server communication for authentication
 */

class AuthApiClient {
  constructor() {
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  }

  /**
   * Check current session status on server
   */
  async checkSession() {
    try {
      const response = await fetch(`${this.baseUrl}/api/openid/session`, {
        method: 'GET',
        credentials: 'include', // Include cookies
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (process.env.OPENID_DEBUG === 'true') {
          console.error('[authApiClient] checkSession HTTP error:', response.status);
        }
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (process.env.OPENID_DEBUG === 'true') {
        console.log('[authApiClient] checkSession response:', {
          authenticated: data.authenticated,
          userId: data.user?.id
        });
      }
      const userWithNuid = data.user ? { ...data.user, nuid: data.user.id } : null; // Add nuid for backwards compatibility
      return { success: true, data: { ...data, user: userWithNuid } };
    } catch (error) {
      if (process.env.OPENID_DEBUG === 'true') {
        console.error('[authApiClient] checkSession failed:', error);
      }
      return { success: false, error: error.message || 'Network error' };
    }
  }

  /**
   * Initiate login flow
   */
  async initiateLogin(returnTo = '/') {
    try {
      const url = new URL(`${this.baseUrl}/api/openid/signin`);
      url.searchParams.set('returnTo', returnTo);

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (process.env.OPENID_DEBUG === 'true') {
          console.error('[authApiClient] initiateLogin HTTP error:', response.status);
        }
        return { success: false, error: `HTTP ${response.status}` };
      }

      if (process.env.OPENID_DEBUG === 'true') {
        console.log('[authApiClient] initiateLogin successful');
      }
      return { success: true };
    } catch (error) {
      if (process.env.OPENID_DEBUG === 'true') {
        console.error('[authApiClient] initiateLogin failed:', error);
      }
      return { success: false, error: error.message || 'Network error' };
    }
  }

  /**
   * Handle logout and session revocation
   */
  async logout() {
    try {
      const response = await fetch(`${this.baseUrl}/api/openid/signout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnTo: '/' }),
      });

      // Accept both 200 and 204 as success
      if (response.status !== 200 && response.status !== 204) {
        if (process.env.OPENID_DEBUG === 'true') {
          console.warn('[authApiClient] logout returned non-2xx:', response.status);
        }
      }

      if (process.env.OPENID_DEBUG === 'true') {
        console.log('[authApiClient] logout successful');
      }
      return { success: true };
    } catch (error) {
      if (process.env.OPENID_DEBUG === 'true') {
        console.error('[authApiClient] logout failed:', error);
      }
      // Still return success as session is likely invalid anyway
      return { success: true };
    }
  }

  /**
   * Refresh session tokens
   */
  async refreshSession() {
    try {
      const response = await fetch(`${this.baseUrl}/api/openid/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        if (process.env.OPENID_DEBUG === 'true') {
          console.error('[authApiClient] refreshSession HTTP error:', response.status);
        }
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      if (process.env.OPENID_DEBUG === 'true') {
        console.log('[authApiClient] refreshSession response:', {
          authenticated: data.authenticated,
          userId: data.user?.id
        });
      }
      return { success: true, data };
    } catch (error) {
      if (process.env.OPENID_DEBUG === 'true') {
        console.error('[authApiClient] refreshSession failed:', error);
      }
      return { success: false, error: error.message || 'Network error' };
    }
  }
}

// Singleton instance
export const authApiClient = new AuthApiClient();
