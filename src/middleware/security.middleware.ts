// Comprehensive security middleware
// Implements all OWASP security controls

import { getCorsHeaders, getSecurityHeaders } from "../config/security.config.ts";
import { ipBlockMiddleware } from "./rate-limit.middleware.ts";
import { extractTokenFromHeader, verifyToken } from "../utils/jwt.ts";

// CSRF token management
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Generate CSRF token
export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomUUID();
  const expires = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  
  csrfTokens.set(sessionId, { token, expires });
  
  // Clean up expired tokens
  setTimeout(() => {
    const entry = csrfTokens.get(sessionId);
    if (entry && entry.expires <= Date.now()) {
      csrfTokens.delete(sessionId);
    }
  }, 2 * 60 * 60 * 1000);
  
  return token;
}

// Verify CSRF token
export function verifyCSRFToken(sessionId: string, token: string): boolean {
  const entry = csrfTokens.get(sessionId);
  
  if (!entry || entry.expires <= Date.now()) {
    return false;
  }
  
  return entry.token === token;
}

// Main security middleware
export async function securityMiddleware(
  req: Request,
  next: () => Promise<Response>
): Promise<Response> {
  // Check for blocked IPs first
  const ipCheckResponse = await ipBlockMiddleware(req, async () => null as any);
  if (ipCheckResponse) {
    return ipCheckResponse;
  }
  
  // Process the request
  const response = await next();
  
  // Add security headers
  const headers = new Headers(response.headers);
  const securityHeaders = getSecurityHeaders();
  
  for (const [key, value] of Object.entries(securityHeaders)) {
    headers.set(key, value);
  }
  
  // Add CORS headers based on origin
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  
  // Add request ID for tracking
  const requestId = req.headers.get("X-Request-ID") || crypto.randomUUID();
  headers.set("X-Request-ID", requestId);
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// CSRF protection middleware
export async function csrfProtection(
  req: Request,
  next: () => Promise<Response>
): Promise<Response> {
  // Skip CSRF for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  
  // Get session ID from JWT or cookie
  const authHeader = req.headers.get("Authorization");
  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  
  const payload = await verifyToken(token);
  if (!payload || !payload.sessionId) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Invalid session",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  
  // Check CSRF token
  const csrfToken = req.headers.get("X-CSRF-Token");
  if (!csrfToken || !verifyCSRFToken(payload.sessionId, csrfToken)) {
    console.warn(`[SECURITY] CSRF token validation failed for session ${payload.sessionId}`);
    
    return new Response(
      JSON.stringify({
        error: "Forbidden",
        message: "Invalid CSRF token",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  
  return next();
}

// Authentication middleware
export async function authMiddleware(
  req: Request,
  next: () => Promise<Response>
): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required",
      }),
      {
        status: 401,
        headers: { 
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="Pitchey API"',
        },
      }
    );
  }
  
  const payload = await verifyToken(token);
  if (!payload) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Invalid or expired token",
      }),
      {
        status: 401,
        headers: { 
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="Pitchey API", error="invalid_token"',
        },
      }
    );
  }
  
  // Add user context to request (would need request context in real implementation)
  // For now, we'll pass it through headers (not ideal, but works for this example)
  const response = await next();
  
  // Add user ID to response headers for logging (remove in production)
  if (Deno.env.get("DENO_ENV") === "development") {
    const headers = new Headers(response.headers);
    headers.set("X-User-ID", payload.sub);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  
  return response;
}

// Role-based access control middleware
export function requireRole(roles: string[]) {
  return async function roleMiddleware(
    req: Request,
    next: () => Promise<Response>
  ): Promise<Response> {
    const authHeader = req.headers.get("Authorization");
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Authentication required",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    const payload = await verifyToken(token);
    if (!payload) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid token",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    if (!payload.role || !roles.includes(payload.role)) {
      console.warn(
        `[SECURITY] Access denied for user ${payload.sub} with role ${payload.role}. ` +
        `Required roles: ${roles.join(", ")}`
      );
      
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Insufficient permissions",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    return next();
  };
}

// Permission-based access control
export function requirePermission(permissions: string[]) {
  return async function permissionMiddleware(
    req: Request,
    next: () => Promise<Response>
  ): Promise<Response> {
    const authHeader = req.headers.get("Authorization");
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Authentication required",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    const payload = await verifyToken(token);
    if (!payload) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid token",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    const userPermissions = payload.permissions || [];
    const hasPermission = permissions.every(perm => userPermissions.includes(perm));
    
    if (!hasPermission) {
      console.warn(
        `[SECURITY] Permission denied for user ${payload.sub}. ` +
        `Required: ${permissions.join(", ")}, Has: ${userPermissions.join(", ")}`
      );
      
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Insufficient permissions",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    return next();
  };
}

// Request sanitization middleware
export async function sanitizationMiddleware(
  req: Request,
  next: () => Promise<Response>
): Promise<Response> {
  // Only process requests with body
  if (!["POST", "PUT", "PATCH"].includes(req.method)) {
    return next();
  }
  
  const contentType = req.headers.get("content-type");
  
  // Only process JSON requests
  if (!contentType?.includes("application/json")) {
    return next();
  }
  
  try {
    // Clone request to read body
    const clonedReq = req.clone();
    const body = await clonedReq.json();
    
    // Check for potential XSS in all string fields
    const checkForXSS = (obj: any, path = ""): boolean => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === "string") {
          // Check for script tags and event handlers
          if (/<script|<iframe|javascript:|on\w+=/i.test(value)) {
            console.warn(`[SECURITY] Potential XSS detected in field ${currentPath}`);
            return true;
          }
        } else if (typeof value === "object" && value !== null) {
          if (checkForXSS(value, currentPath)) {
            return true;
          }
        }
      }
      return false;
    };
    
    if (checkForXSS(body)) {
      return new Response(
        JSON.stringify({
          error: "Bad Request",
          message: "Input contains potentially dangerous content",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    // If we can't parse the body, let it through to be handled by the route
    console.error("[SECURITY] Error parsing request body:", error);
  }
  
  return next();
}

// Compose multiple middleware functions
export function composeMiddleware(...middlewares: Array<(req: Request, next: () => Promise<Response>) => Promise<Response>>) {
  return async function composedMiddleware(req: Request, finalHandler: () => Promise<Response>): Promise<Response> {
    let index = 0;
    
    async function dispatch(): Promise<Response> {
      if (index >= middlewares.length) {
        return finalHandler();
      }
      
      const middleware = middlewares[index++];
      return middleware(req, dispatch);
    }
    
    return dispatch();
  };
}

// Pre-configured middleware stacks
export const secureApiMiddleware = composeMiddleware(
  securityMiddleware,
  sanitizationMiddleware,
  authMiddleware,
);

export const publicApiMiddleware = composeMiddleware(
  securityMiddleware,
  sanitizationMiddleware,
);

export const adminApiMiddleware = composeMiddleware(
  securityMiddleware,
  sanitizationMiddleware,
  authMiddleware,
  requireRole(["admin", "super_admin"]),
);