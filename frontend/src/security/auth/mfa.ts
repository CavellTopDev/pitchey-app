/**
import { API_URL } from '../config';
 * Multi-Factor Authentication (MFA/2FA) Implementation
 * Supports TOTP (Time-based One-Time Passwords) and backup codes
 * OWASP MFA Cheat Sheet compliant
 */

import * as speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { z } from 'zod';

export interface MFASecret {
  ascii: string;
  hex: string;
  base32: string;
  qr_code_ascii: string;
  qr_code_hex: string;
  qr_code_base32: string;
  google_auth_qr: string;
  otpauth_url: string;
}

export interface MFASetup {
  userId: string;
  secret: string;
  qrCode: string;
  backupCodes: string[];
  createdAt: Date;
}

export interface MFAVerification {
  userId: string;
  token: string;
  backupCode?: string;
}

export interface MFAStatus {
  enabled: boolean;
  method?: 'totp' | 'sms' | 'email';
  backupCodesRemaining?: number;
  lastVerified?: Date;
}

/**
 * MFA Service - Handles multi-factor authentication
 */
export class MFAService {
  private static readonly TOTP_WINDOW = 2; // Allow 2 time steps before/after
  private static readonly BACKUP_CODE_COUNT = 10;
  private static readonly BACKUP_CODE_LENGTH = 8;
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  
  // Track failed attempts (in production, use Redis or database)
  private static failedAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  
  /**
   * Generate MFA secret and QR code
   */
  static async generateSecret(userId: string, email: string): Promise<MFASetup> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Pitchey (${email})`,
      issuer: 'Pitchey Platform',
      length: 32
    });
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    
    return {
      userId,
      secret: secret.base32,
      qrCode,
      backupCodes,
      createdAt: new Date()
    };
  }
  
  /**
   * Generate backup codes
   */
  private static generateBackupCodes(): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < this.BACKUP_CODE_COUNT; i++) {
      const buffer = randomBytes(this.BACKUP_CODE_LENGTH / 2);
      const code = buffer.toString('hex').toUpperCase();
      codes.push(code.match(/.{1,4}/g)!.join('-')); // Format: XXXX-XXXX
    }
    
    return codes;
  }
  
  /**
   * Verify TOTP token
   */
  static verifyToken(token: string, secret: string, userId: string): boolean {
    // Check rate limiting
    if (this.isRateLimited(userId)) {
      throw new Error('Too many failed attempts. Please try again later.');
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: this.TOTP_WINDOW
    });
    
    if (!verified) {
      this.recordFailedAttempt(userId);
      return false;
    }
    
    // Clear failed attempts on success
    this.clearFailedAttempts(userId);
    
    return true;
  }
  
  /**
   * Verify backup code
   */
  static verifyBackupCode(
    code: string, 
    hashedCodes: string[],
    hashFunction: (code: string) => string
  ): { valid: boolean; usedCodeHash?: string } {
    const normalizedCode = code.toUpperCase().replace(/[^A-F0-9]/g, '');
    const hashedInput = hashFunction(normalizedCode);
    
    for (const hashedCode of hashedCodes) {
      if (hashedCode === hashedInput) {
        return { valid: true, usedCodeHash: hashedCode };
      }
    }
    
    return { valid: false };
  }
  
  /**
   * Check if user is rate limited
   */
  private static isRateLimited(userId: string): boolean {
    const attempts = this.failedAttempts.get(userId);
    
    if (!attempts) {
      return false;
    }
    
    // Check if lockout period has expired
    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
    if (timeSinceLastAttempt > this.LOCKOUT_DURATION) {
      this.failedAttempts.delete(userId);
      return false;
    }
    
    return attempts.count >= this.MAX_FAILED_ATTEMPTS;
  }
  
  /**
   * Record failed attempt
   */
  private static recordFailedAttempt(userId: string): void {
    const attempts = this.failedAttempts.get(userId) || { count: 0, lastAttempt: new Date() };
    attempts.count++;
    attempts.lastAttempt = new Date();
    this.failedAttempts.set(userId, attempts);
  }
  
  /**
   * Clear failed attempts
   */
  private static clearFailedAttempts(userId: string): void {
    this.failedAttempts.delete(userId);
  }
  
  /**
   * Generate recovery codes
   */
  static generateRecoveryCodes(count: number = 8): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const buffer = randomBytes(6);
      const code = buffer.toString('base64')
        .replace(/[+/=]/g, '')
        .substring(0, 8)
        .toUpperCase();
      codes.push(code);
    }
    
    return codes;
  }
}

/**
 * MFA validation schemas
 */
export const MFASchemas = {
  setupRequest: z.object({
    userId: z.string().uuid(),
    password: z.string() // Require password confirmation
  }),
  
  verifySetup: z.object({
    userId: z.string().uuid(),
    token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits'),
    secret: z.string()
  }),
  
  verifyLogin: z.object({
    userId: z.string().uuid(),
    token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits').optional(),
    backupCode: z.string().optional()
  }).refine(data => data.token || data.backupCode, {
    message: 'Either token or backup code required'
  }),
  
  disable: z.object({
    userId: z.string().uuid(),
    password: z.string() // Require password confirmation
  })
};

/**
 * MFA API Client
 */
export class MFAClient {
  constructor(private apiUrl: string) {}
  
  /**
   * Setup MFA for user
   */
  async setupMFA(userId: string, password: string): Promise<MFASetup> {
    try {
      const response = await fetch(`${API_URL}/api/endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
        credentials: 'include' // Send cookies for Better Auth session
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to setup MFA: ${response.status} ${errorText}`);
      }
      
      return response.json();
    } catch (error) {
      console.error('MFA setup failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to setup MFA');
    }
  }
  
  /**
   * Verify MFA setup
   */
  async verifySetup(userId: string, token: string, secret: string): Promise<{ success: boolean; backupCodes?: string[] }> {
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token, secret }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    
    if (!response.ok) {
      throw new Error('Failed to verify MFA setup');
    }
    
    return response.json();
  }
  
  /**
   * Verify MFA during login
   */
  async verifyLogin(userId: string, token?: string, backupCode?: string): Promise<{ success: boolean; token?: string }> {
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token, backupCode }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify MFA');
    }
    
    return response.json();
  }
  
  /**
   * Get MFA status
   */
  async getStatus(userId: string): Promise<MFAStatus> {
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });
    
    if (!response.ok) {
      throw new Error('Failed to get MFA status');
    }
    
    return response.json();
  }
  
  /**
   * Disable MFA
   */
  async disableMFA(userId: string, password: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    
    if (!response.ok) {
      throw new Error('Failed to disable MFA');
    }
    
    return response.json();
  }
  
  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string, password: string): Promise<{ backupCodes: string[] }> {
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password }),
      credentials: 'include' // Send cookies for Better Auth session
    });
    
    if (!response.ok) {
      throw new Error('Failed to regenerate backup codes');
    }
    
    return response.json();
  }
  
  /**
   * Get stored token (implement based on your storage strategy)
   * Note: Using empty string for now as Better Auth uses cookie-based sessions
   */
  private getToken(): string {
    // Better Auth uses cookie-based sessions, not JWT tokens
    // MFA will need to be integrated with Better Auth's session management
    return '';
  }
}

/**
 * MFA React Hook
 */
export function useMFA(apiUrl: string) {
  const client = new MFAClient(apiUrl);
  
  return {
    setupMFA: client.setupMFA.bind(client),
    verifySetup: client.verifySetup.bind(client),
    verifyLogin: client.verifyLogin.bind(client),
    getStatus: client.getStatus.bind(client),
    disableMFA: client.disableMFA.bind(client),
    regenerateBackupCodes: client.regenerateBackupCodes.bind(client)
  };
}

/**
 * MFA Component Props
 */
export interface MFASetupProps {
  userId: string;
  onComplete: (backupCodes: string[]) => void;
  onCancel: () => void;
}

export interface MFAVerifyProps {
  userId: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
  allowBackupCode?: boolean;
}

// Export for use in components
export default MFAService;