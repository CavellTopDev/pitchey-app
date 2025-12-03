/**
 * Authentication resource methods
 */

import { PitcheyAPIClient } from '../client';
import {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  UserType,
} from '../types';

export class AuthResource {
  constructor(private client: PitcheyAPIClient) {}

  /**
   * Universal login - auto-detects user type
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/login', credentials);
    
    // Auto-set the API key for future requests
    if (response.token) {
      this.client.setApiKey(response.token);
    }
    
    return response;
  }

  /**
   * Creator portal login
   */
  async creatorLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/creator/login', credentials);
    
    if (response.token) {
      this.client.setApiKey(response.token);
    }
    
    return response;
  }

  /**
   * Investor portal login
   */
  async investorLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/investor/login', credentials);
    
    if (response.token) {
      this.client.setApiKey(response.token);
    }
    
    return response;
  }

  /**
   * Production company portal login
   */
  async productionLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/api/auth/production/login', credentials);
    
    if (response.token) {
      this.client.setApiKey(response.token);
    }
    
    return response;
  }

  /**
   * Register a new user account
   */
  async register(data: RegisterData): Promise<{ message: string; user: any }> {
    return this.client.post('/api/auth/register', data);
  }

  /**
   * Register a new creator account
   */
  async creatorRegister(data: Omit<RegisterData, 'userType'>): Promise<{ message: string; user: any }> {
    return this.client.post('/api/auth/creator/register', {
      ...data,
      userType: 'creator' as UserType,
    });
  }

  /**
   * Register a new investor account
   */
  async investorRegister(data: Omit<RegisterData, 'userType'>): Promise<{ message: string; user: any }> {
    return this.client.post('/api/auth/investor/register', {
      ...data,
      userType: 'investor' as UserType,
    });
  }

  /**
   * Register a new production company account
   */
  async productionRegister(data: Omit<RegisterData, 'userType'>): Promise<{ message: string; user: any }> {
    return this.client.post('/api/auth/production/register', {
      ...data,
      userType: 'production' as UserType,
    });
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.client.post('/api/auth/forgot-password', { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.client.post('/api/auth/reset-password', { token, newPassword });
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.client.post('/api/auth/verify-email', { token });
  }

  /**
   * Logout and clear stored token
   */
  logout(): void {
    this.client.clearApiKey();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.client.getApiKey();
  }

  /**
   * Set authentication token manually
   */
  setToken(token: string): void {
    this.client.setApiKey(token);
  }

  /**
   * Get current authentication token
   */
  getToken(): string | undefined {
    return this.client.getApiKey();
  }

  // ============================================================================
  // Demo Account Helpers
  // ============================================================================

  /**
   * Login with demo creator account
   */
  async loginDemoCreator(): Promise<AuthResponse> {
    return this.creatorLogin({
      email: 'alex.creator@demo.com',
      password: 'Demo123',
    });
  }

  /**
   * Login with demo investor account
   */
  async loginDemoInvestor(): Promise<AuthResponse> {
    return this.investorLogin({
      email: 'sarah.investor@demo.com',
      password: 'Demo123',
    });
  }

  /**
   * Login with demo production company account
   */
  async loginDemoProduction(): Promise<AuthResponse> {
    return this.productionLogin({
      email: 'stellar.production@demo.com',
      password: 'Demo123',
    });
  }

  /**
   * Get all demo accounts
   */
  getDemoAccounts() {
    return {
      creator: {
        email: 'alex.creator@demo.com',
        password: 'Demo123',
        company: 'Independent Films',
      },
      investor: {
        email: 'sarah.investor@demo.com',
        password: 'Demo123',
        company: 'Johnson Ventures',
      },
      production: {
        email: 'stellar.production@demo.com',
        password: 'Demo123',
        company: 'Stellar Productions',
      },
    };
  }
}