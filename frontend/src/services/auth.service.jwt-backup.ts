// Auth Service - Consolidated authentication for all user types
import { apiClient } from '../lib/api-client';
import { config } from '../config';
import type { 

  User, 
  LoginCredentials, 
  RegisterData, 
  AuthResponse,
  ApiResponse 
} from '../types/api';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

// Export types from centralized types file
export type { LoginCredentials, RegisterData, AuthResponse } from '../types/api';

export interface TokenValidation {
  valid: boolean;
  user?: User;
  exp?: number;
}

// LocalStorage helpers (namespaced by API host, with legacy fallback)
function nsKey(key: string): string {
  try {
    const host = new URL(API_BASE_URL).host;
    return `pitchey:${host}:${key}`;
  } catch {
    return `pitchey:${key}`;
  }
}
function getItem(key: string): string | null {
  return localStorage.getItem(nsKey(key)) ?? localStorage.getItem(key);
}
function setItem(key: string, value: string): void {
  localStorage.setItem(nsKey(key), value);
  localStorage.setItem(key, value); // keep legacy for compatibility
}
function removeItem(key: string): void {
  localStorage.removeItem(nsKey(key));
  localStorage.removeItem(key);
}

export class AuthService {
  // Generic login for all user types
  static async login(credentials: LoginCredentials, userType: 'creator' | 'investor' | 'production'): Promise<AuthResponse> {
    // Clear any existing auth data first to prevent conflicts
    removeItem('authToken');
    removeItem('user');
    removeItem('userType');
    
    const endpoint = `/api/auth/${userType}/login`;
    
    const response = await apiClient.post<AuthResponse>(endpoint, credentials);

    if (!response.success || !response.data?.token) {
      throw new Error(response.error?.message || 'Login failed');
    }

    // Store auth data (namespaced + legacy)
    setItem('authToken', response.data.token);
    setItem('user', JSON.stringify(response.data.user));
    setItem('userType', response.data.user.userType);

    return response.data;
  }

  // Creator login
  static async creatorLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.login(credentials, 'creator');
  }

  // Investor login
  static async investorLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.login(credentials, 'investor');
  }

  // Production login
  static async productionLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.login(credentials, 'production');
  }

  // Generic registration
  static async register(data: RegisterData): Promise<AuthResponse> {
    const endpoint = `/api/auth/${data.userType}/register`;
    
    const response = await apiClient.post<AuthResponse>(endpoint, data);

    if (!response.success || !response.data?.token) {
      throw new Error(response.error?.message || 'Registration failed');
    }

    // Store auth data (namespaced + legacy)
    setItem('authToken', response.data.token);
    setItem('user', JSON.stringify(response.data.user));
    setItem('userType', response.data.user.userType);

    return response.data;
  }

  // Creator registration
  static async creatorRegister(data: Omit<RegisterData, 'userType'>): Promise<AuthResponse> {
    return this.register({ ...data, userType: 'creator' });
  }

  // Investor registration
  static async investorRegister(data: Omit<RegisterData, 'userType'>): Promise<AuthResponse> {
    return this.register({ ...data, userType: 'investor' });
  }

  // Production registration
  static async productionRegister(data: Omit<RegisterData, 'userType'>): Promise<AuthResponse> {
    return this.register({ ...data, userType: 'production' });
  }

  // Logout
  static async logout(): Promise<void> {
    try {
      // Call backend logout endpoint if exists
      await apiClient.post('/api/auth/logout', {});
    } catch {
      // Ignore errors, still clear local storage
    } finally {
      // Clear all auth data
      removeItem('authToken');
      removeItem('user');
      removeItem('userType');
      localStorage.clear();

      // Redirect to home
      window.location.href = '/';
    }
  }

  // Validate token
  static async validateToken(): Promise<TokenValidation> {
    const token = getItem('authToken');
    
    if (!token) {
      return { valid: false };
    }

    try {
      const response = await apiClient.get<{ success: boolean; user: User; exp: number }>(
        '/api/validate-token'
      );

      if (response.success && response.data?.user) {
        // Update stored user data
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        return {
          valid: true,
          user: response.data.user,
          exp: response.data.exp
        };
      }
    } catch {
      // Token is invalid
    }

    return { valid: false };
  }

  // Check if authenticated
  static isAuthenticated(): boolean {
    const token = getItem('authToken');
    const user = getItem('user');
    
    if (!token || !user) {
      return false;
    }

    try {
      // Check if token is expired
      const userData = JSON.parse(user);
      if (userData.tokenExp && userData.tokenExp * 1000 < Date.now()) {
        this.logout();
        return false;
      }
    } catch {
      return false;
    }

    return true;
  }

  // Get current user
  static getCurrentUser(): User | null {
    const userStr = getItem('user');
    
    if (!userStr) {
      return null;
    }

    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  }

  // Get current user type
  static getUserType(): 'creator' | 'investor' | 'production' | null {
    const userType = getItem('userType');
    return userType as 'creator' | 'investor' | 'production' | null;
  }

  // Get auth token
  static getToken(): string | null {
    return getItem('authToken');
  }

  // Refresh token
  static async refreshToken(): Promise<string | null> {
    try {
      const response = await apiClient.post<{ success: boolean; token: string }>(
        '/api/refresh-token',
        {}
      );

      if (response.success && response.data?.token) {
        setItem('authToken', response.data.token);
        return response.data.token;
      }
    } catch {
      // Failed to refresh
    }

    return null;
  }

  // Request password reset
  static async requestPasswordReset(email: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/auth/forgot-password',
      { email }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to request password reset');
    }
  }

  // Reset password with token
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/auth/reset-password',
      { token, newPassword }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to reset password');
    }
  }

  // Verify email
  static async verifyEmail(token: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/auth/verify-email',
      { token }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to verify email');
    }
  }

  // Resend verification email
  static async resendVerificationEmail(): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/auth/resend-verification',
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to resend verification email');
    }
  }

  // Two-factor authentication
  static async setupTwoFactor(): Promise<{ qrCode: string; secret: string }> {
    const response = await apiClient.post<{ 
      success: boolean; 
      qrCode: string; 
      secret: string 
    }>('/api/auth/2fa/setup', {});

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to setup 2FA');
    }

    return response.data;
  }

  static async verifyTwoFactor(code: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/auth/2fa/verify',
      { code }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to verify 2FA');
    }
  }

  static async disableTwoFactor(password: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/auth/2fa/disable',
      { password }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to disable 2FA');
    }
  }

  // Session management
  static async getSessions(): Promise<any[]> {
    const response = await apiClient.get<{ success: boolean; sessions: any[] }>(
      '/api/auth/sessions'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch sessions');
    }

    return response.data?.sessions || [];
  }

  static async revokeSession(sessionId: string): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/auth/sessions/${sessionId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to revoke session');
    }
  }

  static async revokeAllSessions(): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/auth/sessions/revoke-all',
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to revoke all sessions');
    }
  }

  // Check user permissions
  static hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    
    if (!user) {
      return false;
    }

    // Check based on user type and permission
    switch (permission) {
      case 'create_pitch':
        return user.userType === 'creator';
      case 'view_full_pitch':
        return user.userType === 'investor' || user.userType === 'production';
      case 'manage_productions':
        return user.userType === 'production';
      case 'invest':
        return user.userType === 'investor';
      default:
        return false;
    }
  }

  // OAuth providers
  static async loginWithGoogle(): Promise<void> {
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  }

  static async loginWithLinkedIn(): Promise<void> {
    window.location.href = `${API_BASE_URL}/api/auth/linkedin`;
  }

  static async handleOAuthCallback(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const user = params.get('user');

    if (token && user) {
      setItem('authToken', token);
      setItem('user', decodeURIComponent(user));
      
      const userData = JSON.parse(decodeURIComponent(user));
      setItem('userType', userData.userType);

      // Redirect to dashboard
      window.location.href = `/${userData.userType}`;
    }
  }
}

// Export singleton instance
export const authService = AuthService;
