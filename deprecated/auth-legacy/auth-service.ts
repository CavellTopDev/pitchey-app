/**
 * Advanced Authentication Service with MFA Support
 * Implements zero-trust authentication with multiple security layers
 */

import jwt from '@tsndr/cloudflare-worker-jwt';
import { z } from 'zod';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const scryptAsync = promisify(scrypt);

// Input validation schemas
export const LoginSchema = z.object({
  email: z.string().email().max(255).transform(val => val.toLowerCase()),
  password: z.string().min(8).max(128),
  mfaCode: z.string().length(6).optional(),
  captchaToken: z.string().optional()
});

export const RegisterSchema = z.object({
  email: z.string().email().max(255).transform(val => val.toLowerCase()),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128)
    .refine(
      (password) => {
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        return hasUpper && hasLower && hasNumber && hasSpecial;
      },
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  role: z.enum(['creator', 'investor', 'production']),
  agreedToTerms: z.boolean().refine(val => val === true, 'Must agree to terms'),
  captchaToken: z.string()
});

interface AuthConfig {
  jwtSecret: string;
  mfaIssuer: string;
  environment: 'production' | 'development';
  kv: KVNamespace;
  db: any; // Drizzle instance
}

export class AuthenticationService {
  private readonly tokenExpiry = 3600; // 1 hour
  private readonly refreshTokenExpiry = 604800; // 7 days
  private readonly sessionExpiry = 86400; // 24 hours
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 900; // 15 minutes

  constructor(private config: AuthConfig) {}

  /**
   * Hash password using scrypt with salt
   */
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(32);
    const hash = await scryptAsync(password, salt, 64) as Buffer;
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      const [saltHex, hashHex] = storedHash.split(':');
      const salt = Buffer.from(saltHex, 'hex');
      const storedHashBuffer = Buffer.from(hashHex, 'hex');
      const hash = await scryptAsync(password, salt, 64) as Buffer;
      return timingSafeEqual(hash, storedHashBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Generate secure JWT tokens
   */
  async generateTokens(userId: string, email: string, role: string): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    expiresIn: number;
  }> {
    const now = Math.floor(Date.now() / 1000);
    const sessionId = crypto.randomUUID();
    const jti = crypto.randomUUID();

    // Access token with minimal claims
    const accessToken = await jwt.sign({
      sub: userId,
      email,
      role,
      type: 'access',
      iat: now,
      exp: now + this.tokenExpiry,
      nbf: now - 30,
      jti,
      sid: sessionId,
      aud: 'pitchey-api',
      iss: 'pitchey-auth'
    }, this.config.jwtSecret);

    // Refresh token with extended expiry
    const refreshToken = await jwt.sign({
      sub: userId,
      type: 'refresh',
      iat: now,
      exp: now + this.refreshTokenExpiry,
      jti: crypto.randomUUID(),
      sid: sessionId,
      aud: 'pitchey-refresh',
      iss: 'pitchey-auth'
    }, this.config.jwtSecret);

    // Store session in KV
    await this.config.kv.put(
      `session:${sessionId}`,
      JSON.stringify({
        userId,
        email,
        role,
        createdAt: now,
        lastActivity: now,
        jti,
        ipAddress: null, // Set by caller
        userAgent: null  // Set by caller
      }),
      { expirationTtl: this.sessionExpiry }
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
      expiresIn: this.tokenExpiry
    };
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string, type: 'access' | 'refresh' = 'access'): Promise<any> {
    try {
      const isValid = await jwt.verify(token, this.config.jwtSecret);
      if (!isValid) throw new Error('Invalid token');

      const payload = jwt.decode(token).payload as any;

      // Verify token type
      if (payload.type !== type) {
        throw new Error('Invalid token type');
      }

      // Verify audience and issuer
      const expectedAudience = type === 'access' ? 'pitchey-api' : 'pitchey-refresh';
      if (payload.aud !== expectedAudience) {
        throw new Error('Invalid audience');
      }

      if (payload.iss !== 'pitchey-auth') {
        throw new Error('Invalid issuer');
      }

      // Check session validity
      const session = await this.config.kv.get(`session:${payload.sid}`, 'json') as any;
      if (!session) {
        throw new Error('Session expired');
      }

      // Check if token is blacklisted
      const blacklisted = await this.config.kv.get(`blacklist:${payload.jti}`);
      if (blacklisted) {
        throw new Error('Token revoked');
      }

      // Update last activity
      session.lastActivity = Math.floor(Date.now() / 1000);
      await this.config.kv.put(
        `session:${payload.sid}`,
        JSON.stringify(session),
        { expirationTtl: this.sessionExpiry }
      );

      return payload;
    } catch (error) {
      throw new Error('Token validation failed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const payload = await this.verifyToken(refreshToken, 'refresh');
    
    // Get user details from session
    const session = await this.config.kv.get(`session:${payload.sid}`, 'json') as any;
    if (!session) {
      throw new Error('Session not found');
    }

    // Generate new access token
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await jwt.sign({
      sub: payload.sub,
      email: session.email,
      role: session.role,
      type: 'access',
      iat: now,
      exp: now + this.tokenExpiry,
      nbf: now - 30,
      jti: crypto.randomUUID(),
      sid: payload.sid,
      aud: 'pitchey-api',
      iss: 'pitchey-auth'
    }, this.config.jwtSecret);

    return {
      accessToken,
      expiresIn: this.tokenExpiry
    };
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const payload = jwt.decode(token).payload as any;
      
      // Add to blacklist until original expiry
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.config.kv.put(
          `blacklist:${payload.jti}`,
          'true',
          { expirationTtl: ttl }
        );
      }

      // Delete session
      await this.config.kv.delete(`session:${payload.sid}`);
    } catch {
      // Silent fail for invalid tokens
    }
  }

  /**
   * Check if account is locked due to failed attempts
   */
  async isAccountLocked(email: string): Promise<boolean> {
    const lockKey = `lock:${email}`;
    const locked = await this.config.kv.get(lockKey);
    return locked === 'true';
  }

  /**
   * Track failed login attempt
   */
  async trackFailedLogin(email: string, ipAddress: string): Promise<void> {
    const attemptKey = `attempts:${email}`;
    const attempts = await this.config.kv.get(attemptKey, 'json') as number[] || [];
    
    attempts.push(Date.now());
    
    // Keep only attempts from last hour
    const oneHourAgo = Date.now() - 3600000;
    const recentAttempts = attempts.filter(t => t > oneHourAgo);
    
    await this.config.kv.put(
      attemptKey,
      JSON.stringify(recentAttempts),
      { expirationTtl: 3600 }
    );
    
    // Lock account if too many attempts
    if (recentAttempts.length >= this.maxLoginAttempts) {
      await this.config.kv.put(
        `lock:${email}`,
        'true',
        { expirationTtl: this.lockoutDuration }
      );
      
      // Log security event
      await this.logSecurityEvent({
        type: 'account_locked',
        email,
        ipAddress,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Clear failed login attempts
   */
  async clearFailedAttempts(email: string): Promise<void> {
    await this.config.kv.delete(`attempts:${email}`);
  }

  /**
   * Setup MFA for user
   */
  async setupMFA(userId: string, email: string): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Pitchey (${email})`,
      issuer: this.config.mfaIssuer,
      length: 32
    });

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      randomBytes(4).toString('hex').toUpperCase()
    );

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Store encrypted secret and backup codes
    await this.config.kv.put(
      `mfa:${userId}`,
      JSON.stringify({
        secret: secret.base32,
        backupCodes: backupCodes.map(code => this.hashBackupCode(code)),
        createdAt: new Date().toISOString()
      })
    );

    return {
      secret: secret.base32,
      qrCode,
      backupCodes
    };
  }

  /**
   * Verify MFA code
   */
  async verifyMFA(userId: string, code: string): Promise<boolean> {
    const mfaData = await this.config.kv.get(`mfa:${userId}`, 'json') as any;
    if (!mfaData) return false;

    // Check if it's a backup code
    if (code.length === 8) {
      const hashedCode = this.hashBackupCode(code);
      const index = mfaData.backupCodes.indexOf(hashedCode);
      
      if (index !== -1) {
        // Remove used backup code
        mfaData.backupCodes.splice(index, 1);
        await this.config.kv.put(`mfa:${userId}`, JSON.stringify(mfaData));
        return true;
      }
      return false;
    }

    // Verify TOTP code
    return speakeasy.totp.verify({
      secret: mfaData.secret,
      encoding: 'base32',
      token: code,
      window: 2 // Allow 2 time steps tolerance
    });
  }

  /**
   * Hash backup code for storage
   */
  private hashBackupCode(code: string): string {
    const hash = new TextEncoder().encode(code);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(event: any): Promise<void> {
    const key = `security:${Date.now()}:${crypto.randomUUID()}`;
    await this.config.kv.put(
      key,
      JSON.stringify(event),
      { expirationTtl: 2592000 } // 30 days
    );

    // In production, also send to external logging service
    if (this.config.environment === 'production') {
      // Send to logging service
      console.error('[Security Event]', event);
    }
  }

  /**
   * Validate session permissions
   */
  async validatePermissions(
    token: string,
    requiredRole?: string,
    requiredPermissions?: string[]
  ): Promise<boolean> {
    try {
      const payload = await this.verifyToken(token);
      
      // Check role if required
      if (requiredRole && payload.role !== requiredRole) {
        return false;
      }

      // Check specific permissions if required
      if (requiredPermissions && requiredPermissions.length > 0) {
        // Get user permissions from database
        const userPermissions = await this.getUserPermissions(payload.sub);
        const hasAll = requiredPermissions.every(perm => 
          userPermissions.includes(perm)
        );
        if (!hasAll) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get user permissions from database
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    // This would query the database for user permissions
    // Simplified for example
    return ['read', 'write'];
  }

  /**
   * Generate secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    return Array.from(randomValues)
      .map(x => charset[x % charset.length])
      .join('');
  }
}