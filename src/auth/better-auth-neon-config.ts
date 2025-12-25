/**
 * Better Auth Configuration for Cloudflare Workers with Neon PostgreSQL
 * Using withCloudflare wrapper for optimal integration
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import type { KVNamespace } from "@cloudflare/workers-types";

// Define environment interface
interface AuthEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  JWT_SECRET: string;
  SESSIONS_KV?: KVNamespace;
  KV?: KVNamespace;
  FRONTEND_URL?: string;
  ENVIRONMENT?: string;
}

/**
 * Create Better Auth instance optimized for Cloudflare Workers with Neon
 */
export function createBetterAuthInstance(env: AuthEnv, request?: Request) {
  // Create Neon SQL client
  const sql = neon(env.DATABASE_URL);
  
  // Create Drizzle instance for Neon
  const db = drizzle(sql);
  
  // Get Cloudflare context from request if available
  const cf = request ? (request as any).cf : undefined;
  
  return betterAuth(
    withCloudflare(
      {
        // Auto-detect IP from Cloudflare headers
        autoDetectIpAddress: true,
        
        // Track geolocation in sessions
        geolocationTracking: true,
        
        // Cloudflare context for geo data
        cf: cf || {},
        
        // KV storage for rate limiting and session caching
        kv: env.SESSIONS_KV || env.KV,
      },
      {
        // App configuration
        appName: "Pitchey",
        baseURL: env.FRONTEND_URL || "https://pitchey.pages.dev",
        secret: env.BETTER_AUTH_SECRET || env.JWT_SECRET,
        
        // Database adapter
        database: drizzleAdapter(db, {
          provider: "pg",
          usePlural: true, // Use plural table names (users, sessions)
        }),
        
        // Email & Password authentication
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
          autoSignIn: true,
          password: {
            minLength: 6,
            maxLength: 128
          }
        },
        
        // Session configuration
        session: {
          expiresIn: 60 * 60 * 24 * 7, // 7 days
          updateAge: 60 * 60 * 24, // Update if older than 1 day
          cookieCache: {
            enabled: true,
            maxAge: 5 * 60 // Cache for 5 minutes
          }
        },
        
        // Rate limiting configuration
        rateLimit: {
          enabled: true,
          window: 60, // Minimum KV TTL is 60s
          max: 100, // requests per window
          customRules: {
            "/sign-in/email": {
              window: 60,
              max: 10, // Strict for login attempts
            },
            "/sign-up": {
              window: 300,
              max: 5, // Limit registrations
            },
            "/api/auth/session": {
              window: 60,
              max: 60, // Allow frequent session checks
            }
          }
        },
        
        // User schema with custom fields
        user: {
          additionalFields: {
            userType: {
              type: "string",
              required: true,
              input: true,
              defaultValue: "creator"
            },
            username: {
              type: "string", 
              required: false,
              input: true
            },
            firstName: {
              type: "string",
              required: false,
              input: true
            },
            lastName: {
              type: "string",
              required: false,
              input: true
            },
            companyName: {
              type: "string",
              required: false,
              input: true
            },
            profileImage: {
              type: "string",
              required: false,
              input: true
            },
            bio: {
              type: "string",
              required: false,
              input: true
            },
            verified: {
              type: "boolean",
              required: false,
              input: false,
              defaultValue: false
            },
            subscriptionTier: {
              type: "string",
              required: false,
              input: false,
              defaultValue: "basic"
            }
          }
        },
        
        // Advanced settings
        advanced: {
          // Use secure cookies
          useSecureCookies: env.ENVIRONMENT === "production",
          
          // Cookie settings
          cookiePrefix: "pitchey",
          
          // CORS settings handled at worker level
          disableCSRFCheck: false,
        }
      }
    )
  );
}

/**
 * Portal-specific authentication helper
 */
export function createPortalAuth(auth: ReturnType<typeof createBetterAuthInstance>) {
  return {
    async signInCreator(email: string, password: string) {
      return auth.api.signInEmail({
        body: {
          email,
          password,
          remember: true,
        }
      });
    },
    
    async signInInvestor(email: string, password: string) {
      return auth.api.signInEmail({
        body: {
          email,
          password,
          remember: true,
        }
      });
    },
    
    async signInProduction(email: string, password: string) {
      return auth.api.signInEmail({
        body: {
          email,
          password,
          remember: true,
        }
      });
    },
    
    async signUp(data: {
      email: string;
      password: string;
      name: string;
      userType: 'creator' | 'investor' | 'production';
    }) {
      return auth.api.signUpEmail({
        body: {
          email: data.email,
          password: data.password,
          name: data.name,
          userType: data.userType,
        }
      });
    },
    
    async signOut() {
      return auth.api.signOut();
    },
    
    async getSession(headers: Headers) {
      return auth.api.getSession({
        headers,
      });
    }
  };
}