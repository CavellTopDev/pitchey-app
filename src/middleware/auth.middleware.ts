/**
 * Authentication Middleware
 * Standardized authentication handling for all protected endpoints
 */

import { AuthService } from "../services/auth.service.ts";
import { UserService } from "../services/userService.ts";
import { authErrorResponse, forbiddenResponse, serverErrorResponse, notFoundResponse } from "../utils/response.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key-change-this-in-production";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    username: string;
    userType: string;
    role?: string;
  };
}

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
  response?: Response;
}

/**
 * Main authentication middleware
 */
export async function authenticate(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      error: "No authorization header",
      response: authErrorResponse("Authorization header required")
    };
  }

  const token = authHeader.substring(7);
  
  try {
    // First try JWT validation for demo accounts and API tokens
    const jwtResult = await validateJWT(token);
    if (jwtResult.success) {
      return jwtResult;
    }

    // Then try database session validation
    const sessionResult = await validateSession(token);
    if (sessionResult.success) {
      return sessionResult;
    }

    return {
      success: false,
      error: "Invalid token",
      response: authErrorResponse("Invalid or expired token")
    };

  } catch (error) {
    console.error("Authentication error:", error);
    return {
      success: false,
      error: "Authentication failed",
      response: serverErrorResponse("Authentication service error")
    };
  }
}

/**
 * JWT validation for demo accounts and API tokens
 */
async function validateJWT(token: string): Promise<AuthResult> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    
    const payload = await verify(token, key);
    
    // Check if it's a demo account (IDs 1, 2, or 3)
    const userId = payload.userId as number;
    const email = payload.email as string;
    const username = payload.username as string;
    const userType = payload.userType as string || payload.role as string;
    
    if (payload && userId >= 1 && userId <= 3) {
      const user = {
        id: userId,
        email: email,
        username: username || `demo_user_${userId}`,
        userType: userType || "creator",
        role: userType || "creator"
      };
      
      return { success: true, user };
    }

    // Valid JWT but not a demo account - could be API token
    if (payload && userId) {
      // Try to get user from database
      const user = await UserService.getUserById(userId);
      if (user) {
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            userType: user.userType,
            role: user.userType
          }
        };
      }
    }

    return { success: false, error: "Invalid JWT payload" };
  } catch (error) {
    // JWT validation failed, not a valid JWT
    return { success: false, error: "Not a valid JWT" };
  }
}

/**
 * Database session validation
 */
async function validateSession(token: string): Promise<AuthResult> {
  try {
    const session = await AuthService.verifySession(token);
    
    if (!session || !session.user) {
      return { success: false, error: "Invalid session" };
    }

    return {
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        username: session.user.username,
        userType: session.user.userType,
        role: session.user.userType
      }
    };
  } catch (error) {
    console.error("Session validation error:", error);
    return { success: false, error: "Session validation failed" };
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: string[]): (request: Request, user: any) => Response | null {
  return (request: Request, user: any): Response | null => {
    if (!user) {
      return authErrorResponse("Authentication required");
    }

    const userRole = user.userType || user.role;
    if (!allowedRoles.includes(userRole)) {
      return forbiddenResponse(`Access denied. Required roles: ${allowedRoles.join(", ")}`);
    }

    return null; // No error, user authorized
  };
}

/**
 * Resource ownership middleware
 */
export async function requireOwnership(
  request: Request, 
  user: any, 
  resourceId: number,
  getResourceOwner: (id: number) => Promise<number | null>
): Promise<Response | null> {
  if (!user) {
    return authErrorResponse("Authentication required");
  }

  try {
    const ownerId = await getResourceOwner(resourceId);
    
    if (ownerId === null) {
      return notFoundResponse("Resource");
    }

    if (ownerId !== user.id) {
      return forbiddenResponse("You can only access your own resources");
    }

    return null; // No error, user is owner
  } catch (error) {
    console.error("Ownership check error:", error);
    return serverErrorResponse("Authorization check failed");
  }
}

/**
 * Optional authentication middleware (doesn't fail if no auth)
 */
export async function optionalAuth(request: Request): Promise<{ user?: any }> {
  const authHeader = request.headers.get("authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: undefined };
  }

  const result = await authenticate(request);
  return { user: result.success ? result.user : undefined };
}

/**
 * Create demo user for development
 */
export function createDemoUser(userId: number): any {
  const demoUsers: Record<number, any> = {
    1: {
      id: 1,
      email: "creator@demo.com",
      username: "demo_creator",
      userType: "creator",
      role: "creator"
    },
    2: {
      id: 2,
      email: "investor@demo.com", 
      username: "demo_investor",
      userType: "investor",
      role: "investor"
    },
    3: {
      id: 3,
      email: "production@demo.com",
      username: "demo_production", 
      userType: "production",
      role: "production"
    }
  };

  return demoUsers[userId] || null;
}