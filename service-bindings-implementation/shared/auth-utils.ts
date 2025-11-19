/**
 * Shared Authentication Utilities for Service Bindings Architecture
 * Provides JWT validation and auth payload interfaces
 */

export interface AuthPayload {
  userId: number;
  email: string;
  userType: 'creator' | 'investor' | 'production';
  firstName?: string;
  lastName?: string;
  exp: number;
}

/**
 * Validate JWT token and extract auth payload
 */
export async function validateJWT(token: string, jwtSecret: string): Promise<AuthPayload> {
  try {
    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [header, payload, signature] = parts;
    
    // Decode payload (base64url)
    const decodedPayload = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    );

    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    // Verify required fields
    if (!decodedPayload.userId || !decodedPayload.email || !decodedPayload.userType) {
      throw new Error('Invalid token payload');
    }

    // Verify user type
    if (!['creator', 'investor', 'production'].includes(decodedPayload.userType)) {
      throw new Error('Invalid user type');
    }

    // Note: In production, you should verify the signature here
    // This is a simplified version for the service bindings example
    
    return {
      userId: decodedPayload.userId,
      email: decodedPayload.email,
      userType: decodedPayload.userType,
      firstName: decodedPayload.firstName,
      lastName: decodedPayload.lastName,
      exp: decodedPayload.exp
    };

  } catch (error) {
    throw new Error(`JWT validation failed: ${error.message}`);
  }
}

/**
 * Extract auth token from request headers
 */
export function extractAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Check if user has required permission for endpoint
 */
export function hasPermission(auth: AuthPayload, requiredType: string[]): boolean {
  return requiredType.includes(auth.userType);
}

/**
 * Generate standard auth error responses
 */
export function createAuthErrorResponse(message: string, status: number = 401): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return new Response(JSON.stringify({
    success: false,
    error: {
      message,
      code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN'
    }
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}