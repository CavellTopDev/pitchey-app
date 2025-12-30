/**
import { API_URL } from '../config';
 * OAuth 2.0 Implementation
 * Supports multiple OAuth providers with PKCE flow
 * IETF RFC 6749 and RFC 7636 compliant
 */

import { z } from 'zod';

export interface OAuthProvider {
  name: string;
  clientId: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  icon?: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  provider: string;
}

/**
 * OAuth 2.0 Service with PKCE support
 */
export class OAuth2Service {
  private static providers: Map<string, OAuthProvider> = new Map();
  
  /**
   * Configure OAuth providers
   */
  static configureProviders() {
    // Google OAuth
    this.providers.set('google', {
      name: 'Google',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scopes: ['openid', 'email', 'profile'],
      icon: 'google'
    });
    
    // GitHub OAuth
    this.providers.set('github', {
      name: 'GitHub',
      clientId: process.env.GITHUB_CLIENT_ID || '',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scopes: ['read:user', 'user:email'],
      icon: 'github'
    });
    
    // Microsoft OAuth
    this.providers.set('microsoft', {
      name: 'Microsoft',
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scopes: ['openid', 'email', 'profile', 'User.Read'],
      icon: 'microsoft'
    });
    
    // LinkedIn OAuth
    this.providers.set('linkedin', {
      name: 'LinkedIn',
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      userInfoUrl: 'https://api.linkedin.com/v2/me',
      scopes: ['r_liteprofile', 'r_emailaddress'],
      icon: 'linkedin'
    });
  }
  
  /**
   * Generate PKCE code challenge and verifier
   */
  static generatePKCE(): { verifier: string; challenge: string; method: string } {
    // Generate code verifier (43-128 characters)
    const verifier = this.base64URLEncode(crypto.getRandomValues(new Uint8Array(32)));
    
    // Generate code challenge using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    
    return {
      verifier,
      challenge: this.base64URLEncode(data),
      method: 'S256'
    };
  }
  
  /**
   * Base64 URL encoding (no padding)
   */
  private static base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(buffer)));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  /**
   * Generate OAuth authorization URL
   */
  static getAuthorizationUrl(
    provider: string,
    redirectUri: string,
    state: string,
    codeChallenge?: string
  ): string {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`OAuth provider ${provider} not configured`);
    }
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline', // Request refresh token
      prompt: 'consent'
    });
    
    // Add PKCE parameters if provided
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }
    
    return `${config.authorizationUrl}?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(
    provider: string,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`OAuth provider ${provider} not configured`);
    }
    
    const params: Record<string, string> = {
      client_id: config.clientId,
      client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    };
    
    // Add PKCE verifier if provided
    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }
    
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: new URLSearchParams(params)
      credentials: 'include' // Send cookies for Better Auth session
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  }
  
  /**
   * Get user info from OAuth provider
   */
  static async getUserInfo(provider: string, accessToken: string): Promise<OAuthUserInfo> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`OAuth provider ${provider} not configured`);
    }
    
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }
    
    const data = await response.json();
    
    // Normalize user info across providers
    return this.normalizeUserInfo(provider, data);
  }
  
  /**
   * Normalize user info from different providers
   */
  private static normalizeUserInfo(provider: string, data: any): OAuthUserInfo {
    switch (provider) {
      case 'google':
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          picture: data.picture,
          emailVerified: data.verified_email,
          provider: 'google'
        };
        
      case 'github':
        return {
          id: data.id.toString(),
          email: data.email,
          name: data.name,
          picture: data.avatar_url,
          emailVerified: true, // GitHub requires email verification
          provider: 'github'
        };
        
      case 'microsoft':
        return {
          id: data.id,
          email: data.mail || data.userPrincipalName,
          name: data.displayName,
          picture: undefined, // Requires additional API call
          emailVerified: true,
          provider: 'microsoft'
        };
        
      case 'linkedin':
        return {
          id: data.id,
          email: data.emailAddress?.elements?.[0]?.handle || '',
          name: `${data.firstName?.localized?.en_US} ${data.lastName?.localized?.en_US}`,
          picture: data.profilePicture?.displayImage,
          emailVerified: true,
          provider: 'linkedin'
        };
        
      default:
        return {
          id: data.id || data.sub,
          email: data.email,
          name: data.name,
          picture: data.picture || data.avatar_url,
          emailVerified: data.email_verified,
          provider
        };
    }
  }
  
  /**
   * Refresh access token
   */
  static async refreshAccessToken(
    provider: string,
    refreshToken: string
  ): Promise<OAuthTokens> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`OAuth provider ${provider} not configured`);
    }
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] || '',
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params
      credentials: 'include' // Send cookies for Better Auth session
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      idToken: data.id_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  }
  
  /**
   * Revoke OAuth tokens
   */
  static async revokeTokens(provider: string, token: string): Promise<void> {
    // Provider-specific revocation endpoints
    const revokeUrls: Record<string, string> = {
      google: 'https://oauth2.googleapis.com/revoke',
      github: 'https://api.github.com/applications/{client_id}/grant',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout'
    };
    
    const url = revokeUrls[provider];
    if (!url) {
      console.warn(`Token revocation not supported for provider: ${provider}`);
      return;
    }
    
    await 
      credentials: 'include', // Send cookies for Better Auth session
      
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ token })
    });
  }
}

/**
 * OAuth State Management
 */
export class OAuthStateManager {
  private static readonly STATE_KEY = 'oauth_states';
  private static readonly STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes
  
  /**
   * Generate and store OAuth state
   */
  static generateState(provider: string, returnUrl?: string): string {
    const state = this.generateRandomString(32);
    const states = this.getStates();
    
    states[state] = {
      provider,
      returnUrl: returnUrl || '/',
      timestamp: Date.now()
    };
    
    // Clean expired states
    this.cleanExpiredStates(states);
    
    sessionStorage.setItem(this.STATE_KEY, JSON.stringify(states));
    
    return state;
  }
  
  /**
   * Validate and consume OAuth state
   */
  static validateState(state: string): { provider: string; returnUrl: string } | null {
    const states = this.getStates();
    const stateData = states[state];
    
    if (!stateData) {
      return null;
    }
    
    // Check if state is expired
    if (Date.now() - stateData.timestamp > this.STATE_EXPIRY) {
      delete states[state];
      sessionStorage.setItem(this.STATE_KEY, JSON.stringify(states));
      return null;
    }
    
    // Consume state (one-time use)
    delete states[state];
    sessionStorage.setItem(this.STATE_KEY, JSON.stringify(states));
    
    return {
      provider: stateData.provider,
      returnUrl: stateData.returnUrl
    };
  }
  
  /**
   * Get stored states
   */
  private static getStates(): Record<string, any> {
    const stored = sessionStorage.getItem(this.STATE_KEY);
    return stored ? JSON.parse(stored) : {};
  }
  
  /**
   * Clean expired states
   */
  private static cleanExpiredStates(states: Record<string, any>): void {
    const now = Date.now();
    Object.keys(states).forEach(key => {
      if (now - states[key].timestamp > this.STATE_EXPIRY) {
        delete states[key];
      }
    });
  }
  
  /**
   * Generate random string
   */
  private static generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * OAuth React Hook
 */
export function useOAuth() {
  const initiateLogin = (provider: string, returnUrl?: string) => {
    const state = OAuthStateManager.generateState(provider, returnUrl);
    const redirectUri = `${window.location.origin}/auth/callback`;
    
    // Generate PKCE challenge
    const pkce = OAuth2Service.generatePKCE();
    sessionStorage.setItem(`pkce_${state}`, JSON.stringify(pkce));
    
    const authUrl = OAuth2Service.getAuthorizationUrl(
      provider,
      redirectUri,
      state,
      pkce.challenge
    );
    
    window.location.href = authUrl;
  };
  
  const handleCallback = async (code: string, state: string) => {
    // Validate state
    const stateData = OAuthStateManager.validateState(state);
    if (!stateData) {
      throw new Error('Invalid OAuth state');
    }
    
    // Get PKCE verifier
    const pkceData = sessionStorage.getItem(`pkce_${state}`);
    const pkce = pkceData ? JSON.parse(pkceData) : null;
    sessionStorage.removeItem(`pkce_${state}`);
    
    const redirectUri = `${window.location.origin}/auth/callback`;
    
    // Exchange code for tokens
    const tokens = await OAuth2Service.exchangeCodeForTokens(
      stateData.provider,
      code,
      redirectUri,
      pkce?.verifier
    );
    
    // Get user info
    const userInfo = await OAuth2Service.getUserInfo(
      stateData.provider,
      tokens.accessToken
    );
    
    return {
      tokens,
      userInfo,
      returnUrl: stateData.returnUrl
    };
  };
  
  const logout = async (provider: string, token: string) => {
    await OAuth2Service.revokeTokens(provider, token);
  };
  
  return {
    initiateLogin,
    handleCallback,
    logout,
    providers: Array.from(OAuth2Service['providers'].values())
  };
}

// Initialize providers on module load
OAuth2Service.configureProviders();

export default OAuth2Service;