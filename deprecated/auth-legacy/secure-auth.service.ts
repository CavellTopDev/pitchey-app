/**
 * Secure Authentication Service
 * Implements OWASP authentication best practices
 */

import { db } from "../db/client.ts";
import { 
  users, 
  sessions, 
  passwordResetTokens, 
  emailVerificationTokens,
  loginAttempts,
  securityEvents,
  twoFactorAuth 
} from "../db/schema.ts";
import { eq, and, gt, desc, sql } from "drizzle-orm";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { validatePassword, hashPassword, verifyPassword } from "../utils/password-validation.ts";
import { getNotificationEmailService } from "./notification-email.service.ts";

// Configuration
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const JWT_REFRESH_SECRET = Deno.env.get("JWT_REFRESH_SECRET") || JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days
const PASSWORD_RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

// Create JWT keys
const accessKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

const refreshKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(JWT_REFRESH_SECRET),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

// Validation schemas
export const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens and underscores"),
  password: z.string().min(12),
  userType: z.enum(["creator", "production", "investor", "viewer"]),
  companyName: z.string().optional(),
  companyNumber: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, "You must accept the terms and conditions"),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  fingerprint: z.string().optional(), // Browser fingerprint for enhanced security
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const PasswordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(12),
});

export class SecureAuthService {
  /**
   * Register a new user with email verification
   */
  static async register(data: z.infer<typeof RegisterSchema>, ipAddress?: string, userAgent?: string) {
    // Validate input
    const validated = RegisterSchema.parse(data);
    
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validated.email),
    });
    
    if (existingUser) {
      // Don't reveal if email exists for security
      await this.logSecurityEvent({
        userId: existingUser.id,
        eventType: "registration_attempt",
        eventStatus: "failure",
        ipAddress,
        userAgent,
        metadata: { reason: "email_exists" },
      });
      throw new Error("Registration failed. Please try again.");
    }
    
    // Check username availability
    const existingUsername = await db.query.users.findFirst({
      where: eq(users.username, validated.username),
    });
    
    if (existingUsername) {
      throw new Error("Username is already taken");
    }
    
    // Validate password strength
    const passwordValidation = await validatePassword(validated.password, {
      userInfo: {
        email: validated.email,
        username: validated.username,
      },
    });
    
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors[0] || "Password does not meet security requirements");
    }
    
    // Hash password
    const passwordHash = await hashPassword(validated.password);
    
    // Generate email verification token
    const verificationToken = crypto.randomUUID();
    const verificationTokenHash = await hashPassword(verificationToken);
    
    // Create user
    const [newUser] = await db.insert(users)
      .values({
        email: validated.email,
        username: validated.username,
        passwordHash,
        userType: validated.userType,
        companyName: validated.companyName,
        companyNumber: validated.companyNumber,
        emailVerified: false,
        passwordHistory: [{ hash: passwordHash, changedAt: new Date().toISOString() }],
        lastPasswordChangeAt: new Date(),
      })
      .returning();
    
    // Create email verification token
    await db.insert(emailVerificationTokens)
      .values({
        userId: newUser.id,
        email: newUser.email,
        token: verificationToken,
        tokenHash: verificationTokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRY),
      });
    
    // Send verification email
    const notificationService = getNotificationEmailService();
    await notificationService.sendEmailVerification({
      userId: newUser.id,
      email: newUser.email,
      token: verificationToken,
    });
    
    // Log security event
    await this.logSecurityEvent({
      userId: newUser.id,
      eventType: "registration",
      eventStatus: "success",
      ipAddress,
      userAgent,
    });
    
    // Don't auto-login - require email verification first
    return { 
      user: {
        ...newUser,
        passwordHash: undefined, // Never send password hash
        passwordHistory: undefined,
      },
      requiresVerification: true,
    };
  }
  
  /**
   * Login with enhanced security checks
   */
  static async login(
    data: z.infer<typeof LoginSchema>, 
    ipAddress?: string, 
    userAgent?: string
  ) {
    const validated = LoginSchema.parse(data);
    
    // Check for recent failed attempts from this IP
    const recentAttempts = await db.query.loginAttempts.findMany({
      where: and(
        eq(loginAttempts.ipAddress, ipAddress || ''),
        gt(loginAttempts.attemptedAt, new Date(Date.now() - LOCKOUT_DURATION)),
      ),
      orderBy: [desc(loginAttempts.attemptedAt)],
      limit: MAX_LOGIN_ATTEMPTS,
    });
    
    const failedAttempts = recentAttempts.filter(a => !a.successful).length;
    
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      await this.recordLoginAttempt({
        email: validated.email,
        successful: false,
        failureReason: "rate_limit_exceeded",
        ipAddress,
        userAgent,
      });
      throw new Error("Too many failed login attempts. Please try again later.");
    }
    
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, validated.email),
    });
    
    if (!user) {
      await this.recordLoginAttempt({
        email: validated.email,
        successful: false,
        failureReason: "user_not_found",
        ipAddress,
        userAgent,
      });
      // Generic error message to prevent user enumeration
      throw new Error("Invalid credentials");
    }
    
    // Check if account is locked
    if (user.accountLockedAt && user.accountLockedAt > new Date(Date.now() - LOCKOUT_DURATION)) {
      await this.recordLoginAttempt({
        email: validated.email,
        successful: false,
        failureReason: "account_locked",
        ipAddress,
        userAgent,
      });
      throw new Error("Account is temporarily locked. Please try again later.");
    }
    
    // Check if account is active
    if (!user.isActive) {
      await this.recordLoginAttempt({
        email: validated.email,
        successful: false,
        failureReason: "account_inactive",
        ipAddress,
        userAgent,
      });
      throw new Error("Account is inactive. Please contact support.");
    }
    
    // Verify password
    const validPassword = await verifyPassword(validated.password, user.passwordHash);
    
    if (!validPassword) {
      // Increment failed login attempts
      const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
      
      await db.update(users)
        .set({ 
          failedLoginAttempts: newFailedAttempts,
          accountLockedAt: newFailedAttempts >= MAX_LOGIN_ATTEMPTS ? new Date() : null,
          accountLockReason: newFailedAttempts >= MAX_LOGIN_ATTEMPTS ? "Too many failed login attempts" : null,
        })
        .where(eq(users.id, user.id));
      
      await this.recordLoginAttempt({
        email: validated.email,
        successful: false,
        failureReason: "invalid_password",
        ipAddress,
        userAgent,
      });
      
      await this.logSecurityEvent({
        userId: user.id,
        eventType: "login_failed",
        eventStatus: "failure",
        ipAddress,
        userAgent,
        metadata: { attempts: newFailedAttempts },
      });
      
      throw new Error("Invalid credentials");
    }
    
    // Check if email is verified for critical user types
    if (!user.emailVerified && user.userType !== "viewer") {
      await this.recordLoginAttempt({
        email: validated.email,
        successful: false,
        failureReason: "email_not_verified",
        ipAddress,
        userAgent,
      });
      
      // Resend verification email
      await this.resendVerificationEmail(user.email);
      
      throw new Error("Please verify your email address. A new verification link has been sent.");
    }
    
    // Check if password change is required
    if (user.requirePasswordChange) {
      // Allow limited access but flag for password change
      // This would be handled by the frontend
    }
    
    // Reset failed login attempts on successful login
    await db.update(users)
      .set({ 
        failedLoginAttempts: 0,
        accountLockedAt: null,
        accountLockReason: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, user.id));
    
    // Record successful login
    await this.recordLoginAttempt({
      email: validated.email,
      successful: true,
      failureReason: null,
      ipAddress,
      userAgent,
    });
    
    // Create session with refresh token
    const session = await this.createSession(
      user.id, 
      ipAddress, 
      userAgent, 
      validated.fingerprint
    );
    
    // Log security event
    await this.logSecurityEvent({
      userId: user.id,
      eventType: "login",
      eventStatus: "success",
      ipAddress,
      userAgent,
    });
    
    return { 
      user: {
        ...user,
        passwordHash: undefined,
        passwordHistory: undefined,
      },
      session,
      requiresPasswordChange: user.requirePasswordChange || false,
      requires2FA: user.twoFactorEnabled || false,
    };
  }
  
  /**
   * Create session with access and refresh tokens
   */
  static async createSession(
    userId: number, 
    ipAddress?: string, 
    userAgent?: string,
    fingerprint?: string
  ) {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    
    // Create access token (short-lived)
    const accessToken = await create(
      { alg: "HS256", typ: "JWT" }, 
      {
        userId,
        sessionId,
        type: "access",
        exp: now + ACCESS_TOKEN_EXPIRY,
        iat: now,
        fingerprint: fingerprint ? await this.hashFingerprint(fingerprint) : undefined,
      }, 
      accessKey
    );
    
    // Create refresh token (long-lived)
    const refreshToken = await create(
      { alg: "HS256", typ: "JWT" }, 
      {
        userId,
        sessionId,
        type: "refresh",
        exp: now + REFRESH_TOKEN_EXPIRY,
        iat: now,
      }, 
      refreshKey
    );
    
    // Store session in database
    const [session] = await db.insert(sessions)
      .values({
        id: sessionId,
        userId,
        token: accessToken,
        refreshToken,
        ipAddress,
        userAgent,
        fingerprint: fingerprint ? await this.hashFingerprint(fingerprint) : undefined,
        expiresAt: new Date(now + ACCESS_TOKEN_EXPIRY),
        refreshExpiresAt: new Date(now + REFRESH_TOKEN_EXPIRY),
      })
      .returning();
    
    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY / 1000, // seconds
      refreshExpiresIn: REFRESH_TOKEN_EXPIRY / 1000,
      tokenType: "Bearer",
    };
  }
  
  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string, fingerprint?: string) {
    try {
      const payload = await verify(refreshToken, refreshKey);
      
      if (payload.type !== "refresh") {
        throw new Error("Invalid token type");
      }
      
      // Find session
      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.refreshToken, refreshToken),
          gt(sessions.refreshExpiresAt, new Date()),
        ),
        with: {
          user: true,
        },
      });
      
      if (!session) {
        throw new Error("Invalid or expired refresh token");
      }
      
      // Validate fingerprint if provided
      if (fingerprint && session.fingerprint) {
        const fingerprintHash = await this.hashFingerprint(fingerprint);
        if (fingerprintHash !== session.fingerprint) {
          // Possible token theft - invalidate session
          await this.invalidateSession(session.id);
          await this.logSecurityEvent({
            userId: session.userId,
            eventType: "suspicious_token_use",
            eventStatus: "warning",
            metadata: { sessionId: session.id },
          });
          throw new Error("Session validation failed");
        }
      }
      
      // Generate new access token
      const now = Date.now();
      const newAccessToken = await create(
        { alg: "HS256", typ: "JWT" }, 
        {
          userId: session.userId,
          sessionId: session.id,
          type: "access",
          exp: now + ACCESS_TOKEN_EXPIRY,
          iat: now,
          fingerprint: session.fingerprint,
        }, 
        accessKey
      );
      
      // Update session
      await db.update(sessions)
        .set({
          token: newAccessToken,
          lastActivity: new Date(),
          expiresAt: new Date(now + ACCESS_TOKEN_EXPIRY),
        })
        .where(eq(sessions.id, session.id));
      
      return {
        accessToken: newAccessToken,
        expiresIn: ACCESS_TOKEN_EXPIRY / 1000,
        tokenType: "Bearer",
      };
    } catch (error) {
      throw new Error("Failed to refresh token");
    }
  }
  
  /**
   * Verify session
   */
  static async verifySession(token: string, fingerprint?: string) {
    try {
      const payload = await verify(token, accessKey);
      
      if (payload.type !== "access") {
        return null;
      }
      
      // Check if session exists and is valid
      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date()),
        ),
        with: {
          user: true,
        },
      });
      
      if (!session) {
        return null;
      }
      
      // Validate fingerprint if provided
      if (fingerprint && payload.fingerprint) {
        const fingerprintHash = await this.hashFingerprint(fingerprint);
        if (fingerprintHash !== payload.fingerprint) {
          await this.logSecurityEvent({
            userId: session.userId,
            eventType: "fingerprint_mismatch",
            eventStatus: "warning",
            metadata: { sessionId: session.id },
          });
          return null;
        }
      }
      
      // Update last activity
      await db.update(sessions)
        .set({ lastActivity: new Date() })
        .where(eq(sessions.id, session.id));
      
      return session;
    } catch {
      return null;
    }
  }
  
  /**
   * Initiate password reset
   */
  static async initiatePasswordReset(email: string, ipAddress?: string, userAgent?: string) {
    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    // Always return success to prevent user enumeration
    if (!user) {
      await this.logSecurityEvent({
        userId: null,
        eventType: "password_reset_request",
        eventStatus: "failure",
        ipAddress,
        userAgent,
        metadata: { reason: "user_not_found", email },
      });
      return { success: true, message: "If an account exists, a password reset link has been sent." };
    }
    
    // Check for recent password reset requests
    const recentRequests = await db.query.passwordResetTokens.findMany({
      where: and(
        eq(passwordResetTokens.userId, user.id),
        gt(passwordResetTokens.createdAt, new Date(Date.now() - 60 * 60 * 1000)), // Last hour
      ),
    });
    
    if (recentRequests.length >= 3) {
      await this.logSecurityEvent({
        userId: user.id,
        eventType: "password_reset_rate_limit",
        eventStatus: "warning",
        ipAddress,
        userAgent,
      });
      return { success: true, message: "If an account exists, a password reset link has been sent." };
    }
    
    // Generate reset token
    const resetToken = crypto.randomUUID();
    const resetTokenHash = await hashPassword(resetToken);
    
    // Store reset token
    await db.insert(passwordResetTokens)
      .values({
        userId: user.id,
        token: resetToken,
        tokenHash: resetTokenHash,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY),
      });
    
    // Send password reset email
    const notificationService = getNotificationEmailService();
    await notificationService.sendPasswordResetEmail({
      userId: user.id,
      resetToken,
      expiresIn: "1 hour",
    });
    
    // Log security event
    await this.logSecurityEvent({
      userId: user.id,
      eventType: "password_reset_request",
      eventStatus: "success",
      ipAddress,
      userAgent,
    });
    
    return { success: true, message: "If an account exists, a password reset link has been sent." };
  }
  
  /**
   * Reset password with token
   */
  static async resetPassword(
    token: string, 
    newPassword: string, 
    ipAddress?: string, 
    userAgent?: string
  ) {
    // Hash the token to compare with database
    const tokenHash = await hashPassword(token);
    
    // Find valid reset token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        eq(passwordResetTokens.used, false),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
      with: {
        user: true,
      },
    });
    
    if (!resetToken) {
      await this.logSecurityEvent({
        userId: null,
        eventType: "password_reset_attempt",
        eventStatus: "failure",
        ipAddress,
        userAgent,
        metadata: { reason: "invalid_token" },
      });
      throw new Error("Invalid or expired reset token");
    }
    
    const user = resetToken.user;
    
    // Validate new password
    const passwordValidation = await validatePassword(newPassword, {
      userInfo: {
        email: user.email,
        username: user.username,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
      },
      previousPasswords: user.passwordHistory?.map(h => h.hash) || [],
    });
    
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors[0] || "Password does not meet security requirements");
    }
    
    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    
    // Update password history
    const passwordHistory = user.passwordHistory || [];
    passwordHistory.unshift({ hash: newPasswordHash, changedAt: new Date().toISOString() });
    if (passwordHistory.length > 5) {
      passwordHistory.pop(); // Keep only last 5 passwords
    }
    
    // Update user password
    await db.update(users)
      .set({
        passwordHash: newPasswordHash,
        passwordHistory,
        lastPasswordChangeAt: new Date(),
        failedLoginAttempts: 0,
        accountLockedAt: null,
        accountLockReason: null,
        requirePasswordChange: false,
      })
      .where(eq(users.id, user.id));
    
    // Mark token as used
    await db.update(passwordResetTokens)
      .set({
        used: true,
        usedAt: new Date(),
      })
      .where(eq(passwordResetTokens.id, resetToken.id));
    
    // Invalidate all existing sessions for security
    await db.delete(sessions)
      .where(eq(sessions.userId, user.id));
    
    // Log security event
    await this.logSecurityEvent({
      userId: user.id,
      eventType: "password_reset",
      eventStatus: "success",
      ipAddress,
      userAgent,
    });
    
    // Send confirmation email
    const notificationService = getNotificationEmailService();
    await notificationService.sendPasswordChangeConfirmation({
      userId: user.id,
      ipAddress,
    });
    
    return { success: true, message: "Password has been reset successfully" };
  }
  
  /**
   * Verify email address
   */
  static async verifyEmail(token: string, ipAddress?: string, userAgent?: string) {
    // Hash the token to compare with database
    const tokenHash = await hashPassword(token);
    
    // Find valid verification token
    const verificationToken = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        eq(emailVerificationTokens.verified, false),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ),
      with: {
        user: true,
      },
    });
    
    if (!verificationToken) {
      throw new Error("Invalid or expired verification token");
    }
    
    // Update user email verification status
    await db.update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
      })
      .where(eq(users.id, verificationToken.userId));
    
    // Mark token as verified
    await db.update(emailVerificationTokens)
      .set({
        verified: true,
        verifiedAt: new Date(),
      })
      .where(eq(emailVerificationTokens.id, verificationToken.id));
    
    // Log security event
    await this.logSecurityEvent({
      userId: verificationToken.userId,
      eventType: "email_verified",
      eventStatus: "success",
      ipAddress,
      userAgent,
    });
    
    return { 
      success: true, 
      message: "Email verified successfully",
      user: verificationToken.user,
    };
  }
  
  /**
   * Resend verification email
   */
  static async resendVerificationEmail(email: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (!user || user.emailVerified) {
      return { success: true }; // Don't reveal user existence
    }
    
    // Check for recent verification emails
    const recentTokens = await db.query.emailVerificationTokens.findMany({
      where: and(
        eq(emailVerificationTokens.userId, user.id),
        gt(emailVerificationTokens.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    });
    
    if (recentTokens.length >= 3) {
      return { success: true }; // Rate limit
    }
    
    // Generate new token
    const verificationToken = crypto.randomUUID();
    const verificationTokenHash = await hashPassword(verificationToken);
    
    // Create new verification token
    await db.insert(emailVerificationTokens)
      .values({
        userId: user.id,
        email: user.email,
        token: verificationToken,
        tokenHash: verificationTokenHash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRY),
      });
    
    // Send verification email
    const notificationService = getNotificationEmailService();
    await notificationService.sendEmailVerification({
      userId: user.id,
      email: user.email,
      token: verificationToken,
    });
    
    return { success: true };
  }
  
  /**
   * Logout and invalidate session
   */
  static async logout(token: string) {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.token, token),
    });
    
    if (session) {
      await this.invalidateSession(session.id);
      
      await this.logSecurityEvent({
        userId: session.userId,
        eventType: "logout",
        eventStatus: "success",
      });
    }
  }
  
  /**
   * Invalidate a session
   */
  static async invalidateSession(sessionId: string) {
    await db.delete(sessions)
      .where(eq(sessions.id, sessionId));
  }
  
  /**
   * Invalidate all user sessions
   */
  static async invalidateAllUserSessions(userId: number) {
    await db.delete(sessions)
      .where(eq(sessions.userId, userId));
  }
  
  /**
   * Record login attempt
   */
  private static async recordLoginAttempt(data: {
    email: string;
    successful: boolean;
    failureReason: string | null;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await db.insert(loginAttempts)
      .values({
        email: data.email,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent,
        successful: data.successful,
        failureReason: data.failureReason,
      });
  }
  
  /**
   * Log security event
   */
  private static async logSecurityEvent(data: {
    userId: number | null;
    eventType: string;
    eventStatus: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }) {
    await db.insert(securityEvents)
      .values({
        userId: data.userId,
        eventType: data.eventType,
        eventStatus: data.eventStatus,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      });
  }
  
  /**
   * Hash browser fingerprint
   */
  private static async hashFingerprint(fingerprint: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  }
}