// Secure JWT implementation with proper secret management
// Follows OWASP JWT security best practices

import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";
import { securityConfig } from "../config/security.config.ts";

// JWT secret management
class JWTSecretManager {
  private secret: CryptoKey | null = null;
  private refreshSecret: CryptoKey | null = null;
  private lastRotation: Date = new Date();
  
  async getSecret(): Promise<CryptoKey> {
    if (!this.secret) {
      await this.initializeSecrets();
    }
    return this.secret!;
  }
  
  async getRefreshSecret(): Promise<CryptoKey> {
    if (!this.refreshSecret) {
      await this.initializeSecrets();
    }
    return this.refreshSecret!;
  }
  
  private async initializeSecrets() {
    // Get secret from environment or generate a secure one
    const jwtSecret = Deno.env.get("JWT_SECRET");
    const refreshTokenSecret = Deno.env.get("JWT_REFRESH_SECRET");
    
    if (!jwtSecret || jwtSecret === "your-secret-key-change-this-in-production") {
      console.error("[SECURITY] JWT_SECRET is not properly configured!");
      
      // In development, generate a random secret
      if (Deno.env.get("DENO_ENV") === "development") {
        console.warn("[SECURITY] Generating temporary JWT secret for development");
        const randomSecret = crypto.getRandomValues(new Uint8Array(32));
        this.secret = await crypto.subtle.importKey(
          "raw",
          randomSecret,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign", "verify"]
        );
      } else {
        throw new Error("JWT_SECRET must be configured in production");
      }
    } else {
      // Import the secret as a CryptoKey
      this.secret = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(jwtSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      );
    }
    
    // Handle refresh token secret
    if (!refreshTokenSecret) {
      // Use a derived key from the main secret for refresh tokens
      const encoder = new TextEncoder();
      const refreshKey = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(jwtSecret + ":refresh")
      );
      
      this.refreshSecret = await crypto.subtle.importKey(
        "raw",
        refreshKey,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      );
    } else {
      this.refreshSecret = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(refreshTokenSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      );
    }
  }
  
  // Check if secrets should be rotated (for long-running applications)
  shouldRotate(): boolean {
    const daysSinceRotation = (Date.now() - this.lastRotation.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceRotation > 30; // Rotate every 30 days
  }
}

const secretManager = new JWTSecretManager();

// Token types
export enum TokenType {
  ACCESS = "access",
  REFRESH = "refresh",
  RESET_PASSWORD = "reset_password",
  EMAIL_VERIFICATION = "email_verification",
}

// JWT Payload interface
export interface JWTPayload {
  sub: string; // Subject (user ID)
  iat: number; // Issued at
  exp: number; // Expiration
  nbf?: number; // Not before
  iss: string; // Issuer
  aud: string | string[]; // Audience
  jti?: string; // JWT ID (for tracking/revocation)
  type: TokenType;
  role?: string;
  permissions?: string[];
  sessionId?: string;
}

// Token blacklist for revocation (in production, use Redis)
const tokenBlacklist = new Set<string>();

// Generate a secure token ID
function generateTokenId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Create a JWT token
export async function createToken(
  userId: string,
  type: TokenType = TokenType.ACCESS,
  additionalClaims: Record<string, any> = {}
): Promise<string> {
  const now = getNumericDate(0);
  const config = securityConfig.jwt;
  
  // Determine expiration based on token type
  let expirationTime: number;
  switch (type) {
    case TokenType.ACCESS:
      expirationTime = getNumericDate(2 * 60 * 60); // 2 hours
      break;
    case TokenType.REFRESH:
      expirationTime = getNumericDate(7 * 24 * 60 * 60); // 7 days
      break;
    case TokenType.RESET_PASSWORD:
      expirationTime = getNumericDate(15 * 60); // 15 minutes
      break;
    case TokenType.EMAIL_VERIFICATION:
      expirationTime = getNumericDate(24 * 60 * 60); // 24 hours
      break;
    default:
      expirationTime = getNumericDate(60 * 60); // 1 hour default
  }
  
  const payload: JWTPayload = {
    sub: userId,
    iat: now,
    exp: expirationTime,
    nbf: now,
    iss: config.issuer,
    aud: config.audience,
    jti: generateTokenId(),
    type,
    ...additionalClaims,
  };
  
  // Use different secrets for different token types
  const secret = type === TokenType.REFRESH 
    ? await secretManager.getRefreshSecret()
    : await secretManager.getSecret();
  
  return await create({ alg: "HS256", typ: "JWT" }, payload, secret);
}

// Verify a JWT token
export async function verifyToken(
  token: string,
  expectedType?: TokenType
): Promise<JWTPayload | null> {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      console.warn("[JWT] Attempted to use blacklisted token");
      return null;
    }
    
    // Try to decode without verification first to determine token type
    const [header, payload] = token.split(".").slice(0, 2);
    const decodedPayload = JSON.parse(atob(payload));
    
    // Use appropriate secret based on token type
    const secret = decodedPayload.type === TokenType.REFRESH
      ? await secretManager.getRefreshSecret()
      : await secretManager.getSecret();
    
    // Verify the token
    const verifiedPayload = await verify(token, secret) as JWTPayload;
    
    // Check token type if specified
    if (expectedType && verifiedPayload.type !== expectedType) {
      console.warn(`[JWT] Token type mismatch. Expected ${expectedType}, got ${verifiedPayload.type}`);
      return null;
    }
    
    // Check issuer and audience
    const config = securityConfig.jwt;
    if (verifiedPayload.iss !== config.issuer) {
      console.warn(`[JWT] Invalid issuer: ${verifiedPayload.iss}`);
      return null;
    }
    
    if (typeof verifiedPayload.aud === "string") {
      if (verifiedPayload.aud !== config.audience) {
        console.warn(`[JWT] Invalid audience: ${verifiedPayload.aud}`);
        return null;
      }
    } else if (Array.isArray(verifiedPayload.aud)) {
      if (!verifiedPayload.aud.includes(config.audience)) {
        console.warn(`[JWT] Invalid audience: ${verifiedPayload.aud.join(", ")}`);
        return null;
      }
    }
    
    // Check if token is expired
    const now = getNumericDate(0);
    if (verifiedPayload.exp && verifiedPayload.exp < now) {
      console.warn("[JWT] Token has expired");
      return null;
    }
    
    // Check not before
    if (verifiedPayload.nbf && verifiedPayload.nbf > now) {
      console.warn("[JWT] Token not yet valid");
      return null;
    }
    
    return verifiedPayload;
  } catch (error) {
    console.error("[JWT] Token verification failed:", error.message);
    return null;
  }
}

// Revoke a token (add to blacklist)
export function revokeToken(token: string) {
  tokenBlacklist.add(token);
  
  // Clean up expired tokens from blacklist periodically
  // In production, use Redis with TTL
  setTimeout(() => {
    tokenBlacklist.delete(token);
  }, 7 * 24 * 60 * 60 * 1000); // Remove after 7 days
}

// Revoke all tokens for a user (by jti pattern)
export function revokeUserTokens(userId: string) {
  // In production, this would query Redis/database for all user tokens
  // and add them to the blacklist
  console.log(`[JWT] Revoking all tokens for user ${userId}`);
}

// Extract token from Authorization header
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }
  
  return parts[1];
}

// Generate a secure refresh token
export async function generateRefreshToken(userId: string, sessionId?: string): Promise<string> {
  return createToken(userId, TokenType.REFRESH, { sessionId });
}

// Refresh an access token using a refresh token
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const payload = await verifyToken(refreshToken, TokenType.REFRESH);
  
  if (!payload) {
    return null;
  }
  
  // Generate new tokens
  const accessToken = await createToken(payload.sub, TokenType.ACCESS, {
    role: payload.role,
    permissions: payload.permissions,
  });
  
  // Optionally rotate refresh token
  const newRefreshToken = await generateRefreshToken(payload.sub, payload.sessionId);
  
  // Revoke old refresh token
  revokeToken(refreshToken);
  
  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

// Clean up blacklist periodically
setInterval(() => {
  // In production, this would be handled by Redis TTL
  console.log("[JWT] Cleaning up token blacklist");
  // For now, we'll just clear very old entries if the set gets too large
  if (tokenBlacklist.size > 10000) {
    tokenBlacklist.clear();
  }
}, 60 * 60 * 1000); // Every hour