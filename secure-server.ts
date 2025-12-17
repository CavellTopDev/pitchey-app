// Secure Multi-Portal Server for Pitchey Platform
// Implements comprehensive security controls following OWASP best practices

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { db } from "./src/db/client.ts";
import { users, pitches } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import { hash, compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Security imports
import { getCorsHeaders, getSecurityHeaders, securityConfig } from "./src/config/security.config.ts";
import { 
  securityMiddleware, 
  authMiddleware, 
  csrfProtection,
  generateCSRFToken,
  composeMiddleware,
  publicApiMiddleware,
  secureApiMiddleware,
  adminApiMiddleware
} from "./src/middleware/security.middleware.ts";
import { rateLimiters, trackViolation } from "./src/middleware/rate-limit.middleware.ts";
import { 
  createToken, 
  verifyToken, 
  refreshAccessToken,
  extractTokenFromHeader,
  TokenType
} from "./src/utils/jwt.ts";
import { 
  validateEmail, 
  validatePassword, 
  validateAndSanitizeText,
  validateObject,
  escapeHtml
} from "./src/utils/validation.ts";
import { 
  loginSchema, 
  registrationSchema,
  pitchCreationSchema,
  pitchUpdateSchema,
  messageSchema,
  ndaRequestSchema
} from "./src/schemas/validation.schemas.ts";

// Environment configuration
const port = Deno.env.get("PORT") || "8000";
const isDevelopment = Deno.env.get("DENO_ENV") === "development";

// Check for required environment variables
if (!isDevelopment) {
  const requiredEnvVars = [
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "SESSION_SECRET",
    "DATABASE_URL",
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !Deno.env.get(varName));
  
  if (missingVars.length > 0) {
    console.error(`[SECURITY] Missing required environment variables: ${missingVars.join(", ")}`);
    console.error("Please configure these variables before running in production");
    Deno.exit(1);
  }
  
  // Warn about default values
  if (Deno.env.get("JWT_SECRET") === "your-secret-key-change-this-in-production") {
    console.error("[SECURITY] JWT_SECRET is using default value. This is a critical security vulnerability!");
    Deno.exit(1);
  }
}

// Initialize services
console.log("[SERVER] Initializing Pitchey Secure Server...");

// Track active sessions for additional security
const activeSessions = new Map<string, { userId: string; expires: number; ipAddress: string }>();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.expires <= now) {
      activeSessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Helper function to get client IP
function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
         req.headers.get("x-real-ip") ||
         "unknown";
}

// Helper function to create secure response with all headers
function createSecureResponse(
  body: any,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  const headers = {
    ...getSecurityHeaders(),
    "Content-Type": "application/json",
    ...additionalHeaders,
  };
  
  return new Response(
    JSON.stringify(body),
    { status, headers }
  );
}

// Main request handler with comprehensive security
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  
  // Log all requests in development
  if (isDevelopment) {
    console.log(`[${method}] ${path} from ${getClientIp(req)}`);
  }
  
  // Handle CORS preflight requests
  if (method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  
  // Apply security headers to all responses
  const secureHandler = async () => {
    try {
      // Route handling
      if (path === "/api/health") {
        return handleHealthCheck(req);
      } else if (path === "/api/auth/register") {
        return await handleRegistration(req);
      } else if (path === "/api/auth/login") {
        return await handleLogin(req);
      } else if (path === "/api/auth/refresh") {
        return await handleTokenRefresh(req);
      } else if (path === "/api/auth/logout") {
        return await handleLogout(req);
      } else if (path.startsWith("/api/pitches")) {
        return await handlePitchRoutes(req, path, method);
      } else if (path.startsWith("/api/messages")) {
        return await handleMessageRoutes(req, path, method);
      } else if (path.startsWith("/api/ndas")) {
        return await handleNDARoutes(req, path, method);
      } else if (path.startsWith("/api/users")) {
        return await handleUserRoutes(req, path, method);
      } else {
        return createSecureResponse(
          { error: "Not Found", message: "Endpoint not found" },
          404
        );
      }
    } catch (error) {
      console.error(`[ERROR] ${method} ${path}:`, error);
      
      // Don't leak error details in production
      const message = isDevelopment 
        ? error.message 
        : "An error occurred processing your request";
      
      return createSecureResponse(
        { error: "Internal Server Error", message },
        500
      );
    }
  };
  
  // Apply security middleware
  return securityMiddleware(req, secureHandler);
}

// Health check endpoint
function handleHealthCheck(req: Request): Response {
  return createSecureResponse({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    secure: true,
  });
}

// Registration handler with validation
async function handleRegistration(req: Request): Promise<Response> {
  // Apply rate limiting for auth endpoints
  const rateLimitResponse = await rateLimiters.auth(req, async () => null as any);
  if (rateLimitResponse) return rateLimitResponse;
  
  // Parse and validate request body
  const body = await req.json().catch(() => null);
  if (!body) {
    return createSecureResponse(
      { error: "Bad Request", message: "Invalid JSON body" },
      400
    );
  }
  
  // Validate input using schema
  const validation = validateObject(body, registrationSchema);
  if (!validation.isValid) {
    trackViolation(req, "registration_validation");
    return createSecureResponse(
      { error: "Validation Error", errors: validation.errors },
      400
    );
  }
  
  const sanitized = validation.sanitized!;
  
  // Additional password validation with username context
  const passwordValidation = validatePassword(
    body.password,
    sanitized.name,
    sanitized.email
  );
  
  if (!passwordValidation.isValid) {
    return createSecureResponse(
      { error: "Validation Error", errors: passwordValidation.errors },
      400
    );
  }
  
  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, sanitized.email))
      .limit(1);
    
    if (existingUser.length > 0) {
      // Don't reveal that the email exists - same error as validation
      return createSecureResponse(
        { error: "Validation Error", errors: ["Unable to create account"] },
        400
      );
    }
    
    // Hash password with proper salt rounds
    const passwordHash = await hash(sanitized.password, securityConfig.crypto.saltRounds);
    
    // Create user
    const userId = crypto.randomUUID();
    const newUser = await db.insert(users).values({
      id: userId,
      email: sanitized.email,
      passwordHash,
      name: sanitized.name,
      role: sanitized.role,
      company: sanitized.company || null,
      bio: sanitized.bio || null,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    // Generate session
    const sessionId = crypto.randomUUID();
    const accessToken = await createToken(userId, TokenType.ACCESS, {
      role: sanitized.role,
      sessionId,
    });
    
    const refreshToken = await createToken(userId, TokenType.REFRESH, {
      sessionId,
    });
    
    // Track session
    activeSessions.set(sessionId, {
      userId,
      expires: Date.now() + 2 * 60 * 60 * 1000,
      ipAddress: getClientIp(req),
    });
    
    // Generate CSRF token
    const csrfToken = generateCSRFToken(sessionId);
    
    return createSecureResponse(
      {
        message: "Registration successful",
        user: {
          id: userId,
          email: sanitized.email,
          name: sanitized.name,
          role: sanitized.role,
        },
        accessToken,
        refreshToken,
        csrfToken,
      },
      201
    );
  } catch (error) {
    console.error("[REGISTRATION] Error:", error);
    return createSecureResponse(
      { error: "Internal Server Error", message: "Failed to create account" },
      500
    );
  }
}

// Login handler with validation
async function handleLogin(req: Request): Promise<Response> {
  // Apply rate limiting for auth endpoints
  const rateLimitResponse = await rateLimiters.auth(req, async () => null as any);
  if (rateLimitResponse) return rateLimitResponse;
  
  // Parse and validate request body
  const body = await req.json().catch(() => null);
  if (!body) {
    return createSecureResponse(
      { error: "Bad Request", message: "Invalid JSON body" },
      400
    );
  }
  
  // Validate input using schema
  const validation = validateObject(body, loginSchema);
  if (!validation.isValid) {
    trackViolation(req, "login_validation");
    return createSecureResponse(
      { error: "Validation Error", errors: validation.errors },
      400
    );
  }
  
  const sanitized = validation.sanitized!;
  
  try {
    // Find user by email
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, sanitized.email))
      .limit(1);
    
    if (userResult.length === 0) {
      // Use same error as wrong password to prevent user enumeration
      await new Promise(resolve => setTimeout(resolve, 100)); // Prevent timing attacks
      trackViolation(req, "login_invalid_user");
      return createSecureResponse(
        { error: "Authentication Failed", message: "Invalid email or password" },
        401
      );
    }
    
    const user = userResult[0];
    
    // Verify password
    const passwordValid = await compare(sanitized.password, user.passwordHash);
    if (!passwordValid) {
      trackViolation(req, "login_invalid_password");
      return createSecureResponse(
        { error: "Authentication Failed", message: "Invalid email or password" },
        401
      );
    }
    
    // Check if email is verified (optional based on requirements)
    if (!user.emailVerified && !isDevelopment) {
      return createSecureResponse(
        { error: "Email Not Verified", message: "Please verify your email before logging in" },
        403
      );
    }
    
    // Generate session
    const sessionId = crypto.randomUUID();
    const accessToken = await createToken(user.id, TokenType.ACCESS, {
      role: user.role,
      sessionId,
    });
    
    const refreshToken = await createToken(user.id, TokenType.REFRESH, {
      sessionId,
    });
    
    // Track session
    activeSessions.set(sessionId, {
      userId: user.id,
      expires: Date.now() + 2 * 60 * 60 * 1000,
      ipAddress: getClientIp(req),
    });
    
    // Generate CSRF token
    const csrfToken = generateCSRFToken(sessionId);
    
    // Update last login
    await db
      .update(users)
      .set({ 
        lastLogin: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    
    return createSecureResponse({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
      csrfToken,
    });
  } catch (error) {
    console.error("[LOGIN] Error:", error);
    return createSecureResponse(
      { error: "Internal Server Error", message: "Login failed" },
      500
    );
  }
}

// Token refresh handler
async function handleTokenRefresh(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || !body.refreshToken) {
    return createSecureResponse(
      { error: "Bad Request", message: "Refresh token required" },
      400
    );
  }
  
  const result = await refreshAccessToken(body.refreshToken);
  if (!result) {
    return createSecureResponse(
      { error: "Unauthorized", message: "Invalid refresh token" },
      401
    );
  }
  
  return createSecureResponse({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

// Logout handler
async function handleLogout(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const token = extractTokenFromHeader(authHeader);
  
  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.sessionId) {
      activeSessions.delete(payload.sessionId);
    }
  }
  
  return createSecureResponse({
    message: "Logout successful",
  });
}

// Pitch routes handler (simplified example)
async function handlePitchRoutes(req: Request, path: string, method: string): Promise<Response> {
  // Apply authentication middleware
  const authResponse = await authMiddleware(req, async () => null as any);
  if (authResponse) return authResponse;
  
  if (path === "/api/pitches" && method === "GET") {
    // Get all pitches (with pagination)
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 100);
    
    const pitchList = await db
      .select()
      .from(pitches)
      .limit(limit)
      .offset((page - 1) * limit);
    
    return createSecureResponse({
      pitches: pitchList,
      page,
      limit,
    });
  }
  
  if (path === "/api/pitches" && method === "POST") {
    // Create new pitch
    const body = await req.json().catch(() => null);
    if (!body) {
      return createSecureResponse(
        { error: "Bad Request", message: "Invalid JSON body" },
        400
      );
    }
    
    // Validate input
    const validation = validateObject(body, pitchCreationSchema);
    if (!validation.isValid) {
      return createSecureResponse(
        { error: "Validation Error", errors: validation.errors },
        400
      );
    }
    
    // Create pitch (simplified)
    const sanitized = validation.sanitized!;
    const authHeader = req.headers.get("Authorization");
    const token = extractTokenFromHeader(authHeader);
    const payload = await verifyToken(token!);
    
    const newPitch = await db.insert(pitches).values({
      ...sanitized,
      creatorId: payload!.sub,
      status: "draft",
      viewCount: 0,
      likeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    return createSecureResponse(
      { pitch: newPitch[0] },
      201
    );
  }
  
  return createSecureResponse(
    { error: "Not Found", message: "Endpoint not found" },
    404
  );
}

// Message routes handler (placeholder)
async function handleMessageRoutes(req: Request, path: string, method: string): Promise<Response> {
  // Apply authentication and CSRF protection
  const protectedHandler = composeMiddleware(authMiddleware, csrfProtection);
  const authResponse = await protectedHandler(req, async () => null as any);
  if (authResponse) return authResponse;
  
  // Message handling logic would go here
  return createSecureResponse(
    { error: "Not Implemented", message: "Messages endpoint coming soon" },
    501
  );
}

// NDA routes handler (placeholder)
async function handleNDARoutes(req: Request, path: string, method: string): Promise<Response> {
  // Apply authentication and CSRF protection
  const protectedHandler = composeMiddleware(authMiddleware, csrfProtection);
  const authResponse = await protectedHandler(req, async () => null as any);
  if (authResponse) return authResponse;
  
  // NDA handling logic would go here
  return createSecureResponse(
    { error: "Not Implemented", message: "NDA endpoint coming soon" },
    501
  );
}

// User routes handler (placeholder)
async function handleUserRoutes(req: Request, path: string, method: string): Promise<Response> {
  // Apply authentication
  const authResponse = await authMiddleware(req, async () => null as any);
  if (authResponse) return authResponse;
  
  // User profile handling logic would go here
  return createSecureResponse(
    { error: "Not Implemented", message: "User endpoint coming soon" },
    501
  );
}

// Start the server
console.log(`[SERVER] Starting secure server on http://localhost:${port}`);
console.log(`[SERVER] Environment: ${isDevelopment ? "DEVELOPMENT" : "PRODUCTION"}`);
console.log("[SERVER] Security features enabled:");
console.log("  - JWT authentication with secure secret management");
console.log("  - Rate limiting on all endpoints");
console.log("  - CORS with origin validation");
console.log("  - Security headers (CSP, HSTS, etc.)");
console.log("  - Input validation and sanitization");
console.log("  - SQL injection protection");
console.log("  - XSS prevention");
console.log("  - CSRF protection");
console.log("  - Password policy enforcement");
console.log("  - Session tracking");

await serve(handler, { port: parseInt(port) });