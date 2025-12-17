/**
 * Enhanced Authentication Middleware
 * Standardized authentication and authorization handling with granular permissions
 */

import { AuthService } from "../services/auth.service.ts";
import { UserService } from "../services/userService.ts";
import { PermissionService } from "../services/permission.service.ts";
import { authErrorResponse, forbiddenResponse, serverErrorResponse, notFoundResponse } from "../utils/response.ts";
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || (() => {
  const isProduction = Deno.env.get("DENO_ENV") === "production" || 
                       Deno.env.get("NODE_ENV") === "production";
  if (isProduction) {
    throw new Error("CRITICAL: JWT_SECRET environment variable is not set in production!");
  }
  return "test-secret-key-for-development-only";
})();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    username: string;
    userType: string;
    role?: string;
    permissions?: string[];
    roles?: string[];
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
 * Enhanced role-based authorization middleware with granular permissions
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
 * Permission-based authorization middleware
 * @param requiredPermissions - Array of permission names or single permission string
 * @param options - Authorization options
 */
export function requirePermission(
  requiredPermissions: string | string[],
  options: {
    requireAll?: boolean; // If true, user must have ALL permissions (default: false = require ANY)
    resourceType?: string; // For resource-specific permissions
    resourceId?: number; // For resource-specific permissions
    checkOwnership?: boolean; // Check if user owns the resource
  } = {}
): (request: Request, user: any) => Promise<Response | null> {
  return async (request: Request, user: any): Promise<Response | null> => {
    if (!user) {
      return authErrorResponse("Authentication required");
    }

    try {
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      
      const hasPermission = await PermissionService.hasPermission(
        user.id,
        permissions,
        {
          requireAll: options.requireAll || false,
          resourceType: options.resourceType,
          resourceId: options.resourceId,
          checkOwnership: options.checkOwnership
        }
      );

      if (!hasPermission) {
        return forbiddenResponse(`Access denied. Required permissions: ${permissions.join(", ")}`);
      }

      return null; // No error, user authorized
    } catch (error) {
      console.error("Permission check error:", error);
      return serverErrorResponse("Authorization check failed");
    }
  };
}

/**
 * Combined role and permission authorization middleware
 */
export function requireRoleOrPermission(
  allowedRoles: string[],
  requiredPermissions: string | string[],
  options: { requireAll?: boolean; resourceType?: string; resourceId?: number } = {}
): (request: Request, user: any) => Promise<Response | null> {
  return async (request: Request, user: any): Promise<Response | null> => {
    if (!user) {
      return authErrorResponse("Authentication required");
    }

    // First check if user has required role
    const userRole = user.userType || user.role;
    if (allowedRoles.includes(userRole)) {
      return null; // User has required role
    }

    // If not, check if user has required permissions
    try {
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      
      const hasPermission = await PermissionService.hasPermission(
        user.id,
        permissions,
        {
          requireAll: options.requireAll || false,
          resourceType: options.resourceType,
          resourceId: options.resourceId
        }
      );

      if (!hasPermission) {
        return forbiddenResponse(
          `Access denied. Required: roles [${allowedRoles.join(", ")}] OR permissions [${permissions.join(", ")}]`
        );
      }

      return null; // User has required permission
    } catch (error) {
      console.error("Permission check error:", error);
      return serverErrorResponse("Authorization check failed");
    }
  };
}

/**
 * Enhanced ownership-based authorization
 */
export async function requireOwnershipOrPermission(
  request: Request,
  user: any,
  resourceId: number,
  resourceType: string,
  getResourceOwner: (id: number) => Promise<number | null>,
  fallbackPermission?: string
): Promise<Response | null> {
  if (!user) {
    return authErrorResponse("Authentication required");
  }

  try {
    // Check if user owns the resource
    const ownerId = await getResourceOwner(resourceId);
    
    if (ownerId === null) {
      return notFoundResponse("Resource");
    }

    if (ownerId === user.id) {
      return null; // User owns the resource
    }

    // If user doesn't own resource, check for admin permission
    if (fallbackPermission) {
      const hasPermission = await PermissionService.hasPermission(
        user.id,
        fallbackPermission,
        { resourceType, resourceId }
      );

      if (hasPermission) {
        return null; // User has admin permission
      }
    }

    return forbiddenResponse("You can only access your own resources");
  } catch (error) {
    console.error("Ownership check error:", error);
    return serverErrorResponse("Authorization check failed");
  }
}

/**
 * Dynamic permission middleware based on request context
 */
export function requireDynamicPermission(
  getPermissionConfig: (request: Request) => {
    permissions: string | string[];
    options?: {
      requireAll?: boolean;
      resourceType?: string;
      resourceId?: number;
      checkOwnership?: boolean;
    };
  }
): (request: Request, user: any) => Promise<Response | null> {
  return async (request: Request, user: any): Promise<Response | null> => {
    if (!user) {
      return authErrorResponse("Authentication required");
    }

    try {
      const { permissions, options = {} } = getPermissionConfig(request);
      
      const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
      
      const hasPermission = await PermissionService.hasPermission(
        user.id,
        permissionArray,
        options
      );

      if (!hasPermission) {
        return forbiddenResponse(`Access denied. Required permissions: ${permissionArray.join(", ")}`);
      }

      return null;
    } catch (error) {
      console.error("Dynamic permission check error:", error);
      return serverErrorResponse("Authorization check failed");
    }
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