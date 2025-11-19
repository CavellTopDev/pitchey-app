/**
 * Authentication Utilities for Phase 2 Service Architecture
 * Handles JWT validation, user authentication, and authorization
 */

// JWT payload interface
export interface AuthPayload {
  userId: string;
  email: string;
  userType: 'creator' | 'investor' | 'production';
  iat?: number;
  exp?: number;
}

// JWT secret validation
export function validateJWTSecret(secret?: string): void {
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
}

// Extract auth token from request
export function extractAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

// JWT validation function
export async function validateJWT(token: string, secret: string): Promise<AuthPayload> {
  validateJWTSecret(secret);
  
  try {
    // Simple JWT decode for Phase 2 - in production use proper JWT library
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // Decode header and payload
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Basic validation
    if (!payload.userId || !payload.email || !payload.userType) {
      throw new Error('Invalid JWT payload');
    }
    
    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new Error('JWT token has expired');
    }
    
    return {
      userId: payload.userId,
      email: payload.email,
      userType: payload.userType,
      iat: payload.iat,
      exp: payload.exp
    };
    
  } catch (error) {
    throw new Error(`JWT validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Check user permissions
export function hasPermission(auth: AuthPayload, requiredTypes: string[]): boolean {
  return requiredTypes.includes(auth.userType);
}

// Create standardized auth error response
export function createAuthErrorResponse(message: string, status: number = 401): Response {
  return new Response(JSON.stringify({
    success: false,
    error: {
      message,
      code: 'AUTH_ERROR'
    }
  }), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

// Create unauthorized response
export function createUnauthorizedResponse(): Response {
  return createAuthErrorResponse('Unauthorized - valid token required', 401);
}

// Create forbidden response
export function createForbiddenResponse(userType: string, required: string[]): Response {
  return createAuthErrorResponse(
    `Access forbidden - user type '${userType}' not in required types: ${required.join(', ')}`,
    403
  );
}

// Validate user type
export function validateUserType(userType: string): boolean {
  return ['creator', 'investor', 'production'].includes(userType);
}

// Extract user ID from request with auth validation
export async function extractAuthenticatedUserId(request: Request, jwtSecret: string): Promise<string> {
  const token = extractAuthToken(request);
  if (!token) {
    throw new Error('No authentication token provided');
  }
  
  const auth = await validateJWT(token, jwtSecret);
  return auth.userId;
}
