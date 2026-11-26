// OpenID Connect client implementation for Ping Federate
"use client";

import * as client from 'openid-client';

/**
 * OpenID Auth Service for Ping Federate
 */
export class OpenIdAuthService {
  constructor() {
    this.config = null;
    this.pkceVerifier = null;
  }

  async initialize() {
    if (this.config) return this.config;
    try {
      const issuerUrl = process.env.NEXT_PUBLIC_FAM_PREFIX;
      if (!issuerUrl) throw new Error('NEXT_PUBLIC_FAM_PREFIX not configured');

      // Discover OpenID configuration from issuer
      this.config = await client.discovery(
        new URL(issuerUrl),
        process.env.FAM_CLIENT_ID,
        process.env.FAM_CLIENT_SECRET
      );
      return this.config;
    } catch (error) {
      console.error('Failed to discover OpenID configuration:', error);
      throw error;
    }
  }

  async beginAuthorization() {
    const config = await this.initialize();

    // Generate random values for security
    const crypto = require('crypto');
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');
    const code_verifier = client.randomPKCECodeVerifier();
    const code_challenge = await client.calculatePKCECodeChallenge(code_verifier);

    this.pkceVerifier = code_verifier;

    // Build authorization URL
    const authUrl = client.buildAuthorizationUrl(config, {
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge,
      code_challenge_method: 'S256',
    });

    return {
      authorizationUrl: authUrl.href,
      pkceVerifier: code_verifier,
      state,
      nonce
    };
  }

  async handleCallback(callbackUrl) {
    const config = await this.initialize();
    if (!this.pkceVerifier) throw new Error('PKCE verifier not set');

    try {
      // Exchange authorization code for tokens
      const url = new URL(callbackUrl);
      const params = client.validateAuthResponse(config, url.searchParams);
      const tokenSet = await client.authorizationCodeGrant(config, params, {
        pkceCodeVerifier: this.pkceVerifier,
      });

      // Fetch user info
      const userinfo = await client.fetchUserInfo(config, tokenSet.access_token);

      const user = {
        id: userinfo.sub,
        email: userinfo.email,
        name: userinfo.name || `${userinfo.given_name || ''} ${userinfo.family_name || ''}`.trim(),
        firstName: userinfo.given_name,
        lastName: userinfo.family_name,
        nuid: userinfo.nuid || userinfo.employeeNumber || userinfo.uid,
      };

      const expires = new Date(Date.now() + (tokenSet.expires_in || 3600) * 1000);

      return {
        user,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expires,
      };
    } catch (error) {
      console.error('Callback handling failed:', error);
      throw error;
    }
  }

  async refreshSession(refreshToken) {
    try {
      const config = await this.initialize();
      const tokenSet = await client.refreshTokenGrant(config, refreshToken);
      const userinfo = await client.fetchUserInfo(config, tokenSet.access_token);

      const user = {
        id: userinfo.sub,
        email: userinfo.email,
        name: userinfo.name || `${userinfo.given_name || ''} ${userinfo.family_name || ''}`.trim(),
        firstName: userinfo.given_name,
        lastName: userinfo.family_name,
        nuid: userinfo.nuid || userinfo.employeeNumber || userinfo.uid,
      };

      const expires = new Date(Date.now() + (tokenSet.expires_in || 3600) * 1000);

      return {
        user,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expires,
      };
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  async validateSession(accessToken) {
    try {
      const config = await this.initialize();
      const userinfo = await client.fetchUserInfo(config, accessToken);

      return {
        id: userinfo.sub,
        email: userinfo.email,
        name: userinfo.name || `${userinfo.given_name || ''} ${userinfo.family_name || ''}`.trim(),
        firstName: userinfo.given_name,
        lastName: userinfo.family_name,
        nuid: userinfo.nuid || userinfo.employeeNumber || userinfo.uid,
      };
    } catch (error) {
      console.error('Session validation failed:', error);
      return null;
    }
  }
}

// Singleton instance
let openIdAuthService = null;

export function getOpenIdAuthService() {
  if (!openIdAuthService) {
    openIdAuthService = new OpenIdAuthService();
  }
  return openIdAuthService;
}
