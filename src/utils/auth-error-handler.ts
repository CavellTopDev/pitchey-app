/**
 * Authentication Error Handler
 * Provides helpful and secure authentication error messages
 */

import { authErrorResponse, errorResponse, validationErrorResponse } from "./response.ts";

export interface AuthErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  suggestedAction?: string;
  securityNote?: string;
}

/**
 * Authentication error types with user-friendly messages
 */
export const AuthErrors = {
  // Token-related errors
  MISSING_TOKEN: {
    code: 'MISSING_TOKEN',
    message: 'Authentication required',
    statusCode: 401,
    suggestedAction: 'Please log in to access this resource'
  },
  
  INVALID_TOKEN_FORMAT: {
    code: 'INVALID_TOKEN_FORMAT',
    message: 'Invalid authentication token format',
    statusCode: 401,
    suggestedAction: 'Please log in again to get a fresh authentication token'
  },
  
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Your session has expired',
    statusCode: 401,
    suggestedAction: 'Please log in again to continue'
  },
  
  TOKEN_INVALID: {
    code: 'TOKEN_INVALID',
    message: 'Invalid authentication token',
    statusCode: 401,
    suggestedAction: 'Please log in again to get a valid authentication token'
  },
  
  TOKEN_MALFORMED: {
    code: 'TOKEN_MALFORMED',
    message: 'Authentication token is corrupted',
    statusCode: 401,
    suggestedAction: 'Please clear your browser cache and log in again'
  },
  
  // Login-related errors
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    statusCode: 401,
    suggestedAction: 'Please check your email and password, or use the "Forgot Password" link if needed'
  },
  
  ACCOUNT_NOT_FOUND: {
    code: 'ACCOUNT_NOT_FOUND',
    message: 'No account found with this email address',
    statusCode: 401,
    suggestedAction: 'Please check your email address or create a new account'
  },
  
  ACCOUNT_DISABLED: {
    code: 'ACCOUNT_DISABLED',
    message: 'Your account has been disabled',
    statusCode: 403,
    suggestedAction: 'Please contact support for assistance'
  },
  
  ACCOUNT_LOCKED: {
    code: 'ACCOUNT_LOCKED',
    message: 'Your account has been temporarily locked due to multiple failed login attempts',
    statusCode: 423,
    suggestedAction: 'Please wait 15 minutes before trying again, or use the "Forgot Password" link'
  },
  
  // Password-related errors
  PASSWORD_TOO_WEAK: {
    code: 'PASSWORD_TOO_WEAK',
    message: 'Password does not meet security requirements',
    statusCode: 400,
    suggestedAction: 'Password must be at least 8 characters with uppercase, lowercase, and numbers'
  },
  
  PASSWORD_EXPIRED: {
    code: 'PASSWORD_EXPIRED',
    message: 'Your password has expired',
    statusCode: 401,
    suggestedAction: 'Please reset your password to continue'
  },
  
  // Permission-related errors
  INSUFFICIENT_PERMISSIONS: {
    code: 'INSUFFICIENT_PERMISSIONS',
    message: 'You do not have permission to access this resource',
    statusCode: 403,
    suggestedAction: 'This feature is not available for your account type'
  },
  
  WRONG_USER_TYPE: {
    code: 'WRONG_USER_TYPE',
    message: 'This feature is not available for your account type',
    statusCode: 403,
    suggestedAction: 'Please log in with the appropriate account type (creator/investor/production)'
  },
  
  // Rate limiting
  TOO_MANY_ATTEMPTS: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many login attempts',
    statusCode: 429,
    suggestedAction: 'Please wait before trying again'
  },
  
  // Generic errors
  AUTH_SERVICE_ERROR: {
    code: 'AUTH_SERVICE_ERROR',
    message: 'Authentication service temporarily unavailable',
    statusCode: 503,
    suggestedAction: 'Please try again in a moment'
  }
} as const;

/**
 * Analyze authentication error and return appropriate error details
 */
export function analyzeAuthError(error: any): AuthErrorDetails {
  // Handle JWT-specific errors
  if (error && typeof error === 'object') {
    const errorMessage = error.message?.toLowerCase() || '';
    
    // JWT signature errors
    if (errorMessage.includes('invalid signature') || errorMessage.includes('jwt malformed')) {
      return AuthErrors.TOKEN_MALFORMED;
    }
    
    // JWT expiration
    if (errorMessage.includes('expired') || errorMessage.includes('exp')) {
      return AuthErrors.TOKEN_EXPIRED;
    }
    
    // JWT format errors
    if (errorMessage.includes('invalid token') || errorMessage.includes('malformed')) {
      return AuthErrors.INVALID_TOKEN_FORMAT;
    }
    
    // Database user not found
    if (errorMessage.includes('user not found') || errorMessage.includes('no rows')) {
      return AuthErrors.ACCOUNT_NOT_FOUND;
    }
    
    // Password mismatch
    if (errorMessage.includes('password') && errorMessage.includes('incorrect')) {
      return AuthErrors.INVALID_CREDENTIALS;
    }
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('no authorization header')) {
      return AuthErrors.MISSING_TOKEN;
    }
    
    if (errorLower.includes('invalid token')) {
      return AuthErrors.TOKEN_INVALID;
    }
    
    if (errorLower.includes('expired')) {
      return AuthErrors.TOKEN_EXPIRED;
    }
    
    if (errorLower.includes('malformed')) {
      return AuthErrors.TOKEN_MALFORMED;
    }
  }
  
  // Default to generic auth service error
  return AuthErrors.AUTH_SERVICE_ERROR;
}

/**
 * Create authentication error response with helpful messaging
 */
export function createAuthErrorResponse(error: any, origin?: string): Response {
  const authError = analyzeAuthError(error);
  
  // Log security-related events (but don't expose internal details)
  if (authError.securityNote) {
    console.warn(`Security event: ${authError.code} - ${authError.securityNote}`);
  } else {
    console.log(`Auth error: ${authError.code} - ${authError.message}`);
  }
  
  return errorResponse(authError.message, authError.statusCode, {
    code: authError.code,
    details: authError.suggestedAction
  }, origin);
}

/**
 * Validate user permissions for specific actions
 */
export function validateUserPermissions(
  user: any,
  requiredType?: string,
  requiredPermissions?: string[]
): { valid: boolean; error?: AuthErrorDetails } {
  if (!user) {
    return { valid: false, error: AuthErrors.MISSING_TOKEN };
  }
  
  // Check user type if specified
  if (requiredType && user.userType !== requiredType) {
    return { valid: false, error: AuthErrors.WRONG_USER_TYPE };
  }
  
  // Check specific permissions if specified
  if (requiredPermissions && requiredPermissions.length > 0) {
    const userPermissions = user.permissions || [];
    const hasRequiredPermissions = requiredPermissions.every(
      permission => userPermissions.includes(permission)
    );
    
    if (!hasRequiredPermissions) {
      return { valid: false, error: AuthErrors.INSUFFICIENT_PERMISSIONS };
    }
  }
  
  return { valid: true };
}

/**
 * Enhanced token validation with detailed error messages
 */
export function validateToken(token: string): { valid: boolean; error?: AuthErrorDetails } {
  if (!token || token.trim() === '') {
    return { valid: false, error: AuthErrors.MISSING_TOKEN };
  }
  
  // Check token format (Bearer token)
  if (!token.startsWith('Bearer ')) {
    return { valid: false, error: AuthErrors.INVALID_TOKEN_FORMAT };
  }
  
  const actualToken = token.substring(7); // Remove "Bearer " prefix
  
  // Check if token is present after Bearer
  if (!actualToken || actualToken.trim() === '') {
    return { valid: false, error: AuthErrors.MISSING_TOKEN };
  }
  
  // Basic JWT format validation (should have 3 parts separated by dots)
  const parts = actualToken.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: AuthErrors.TOKEN_MALFORMED };
  }
  
  // Check if parts are base64url encoded (basic validation)
  for (const part of parts) {
    if (!/^[A-Za-z0-9_-]+$/.test(part)) {
      return { valid: false, error: AuthErrors.TOKEN_MALFORMED };
    }
  }
  
  return { valid: true };
}

/**
 * Rate limiting for authentication attempts
 */
export class AuthRateLimiter {
  private attempts: Map<string, { count: number; firstAttempt: number; locked?: number }> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;
  
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000, lockoutMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;
  }
  
  recordAttempt(identifier: string): { allowed: boolean; error?: AuthErrorDetails } {
    const now = Date.now();
    const record = this.attempts.get(identifier) || { count: 0, firstAttempt: now };
    
    // Check if currently locked out
    if (record.locked && now < record.locked) {
      return { allowed: false, error: AuthErrors.ACCOUNT_LOCKED };
    }
    
    // Reset if window has passed
    if (now - record.firstAttempt > this.windowMs) {
      record.count = 0;
      record.firstAttempt = now;
      delete record.locked;
    }
    
    record.count++;
    
    // Check if limit exceeded
    if (record.count > this.maxAttempts) {
      record.locked = now + this.lockoutMs;
      this.attempts.set(identifier, record);
      return { allowed: false, error: AuthErrors.TOO_MANY_ATTEMPTS };
    }
    
    this.attempts.set(identifier, record);
    return { allowed: true };
  }
  
  recordSuccess(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

// Global rate limiter instance
export const globalAuthRateLimiter = new AuthRateLimiter();