# Better Auth + Neon PostgreSQL Configuration Guide for Pitchey

## Overview

This guide configures Better Auth with the Pitchey platform, integrating with our existing Cloudflare Workers and Neon PostgreSQL infrastructure. Better Auth provides a modern, TypeScript-first authentication solution that works perfectly with edge computing.

### Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   React Frontend    │    │ Cloudflare Worker   │    │  Neon PostgreSQL    │
│  (Better Auth SDK)  │───▶│  (Better Auth Core) │───▶│   (Auth Tables)     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                      │
                           ┌─────────────────────┐
                           │  Cloudflare KV      │
                           │ (Sessions/Tokens)   │
                           └─────────────────────┘
```

### Key Benefits
- **Type-safe**: Full TypeScript support with auto-generated types
- **Edge-optimized**: Built for Cloudflare Workers
- **Database agnostic**: Works with Neon PostgreSQL
- **Session management**: Built-in secure session handling
- **Multi-portal**: Supports creator/investor/production portals
- **Social providers**: OAuth with Google, GitHub, etc.

## Prerequisites

1. **Existing Pitchey setup** with Cloudflare Workers and Neon PostgreSQL
2. **Node.js 18+** and npm/yarn
3. **Wrangler CLI** configured
4. **Neon PostgreSQL** database with connection string

## Installation

### 1. Install Better Auth Dependencies

```bash
# Core Better Auth packages
npm install better-auth@latest

# Database adapter for PostgreSQL
npm install better-auth-drizzle drizzle-orm @neondatabase/serverless

# Additional plugins
npm install better-auth-rate-limit better-auth-oauth

# Development dependencies
npm install -D @types/node
```

### 2. Environment Variables

Add to your `.env` and Cloudflare Workers secrets:

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/pitchey?sslmode=require"
NEON_DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/pitchey?sslmode=require"

# Better Auth Configuration
BETTER_AUTH_SECRET="your-super-secret-key-min-32-chars"
BETTER_AUTH_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# OAuth Providers (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Session Configuration
SESSION_COOKIE_NAME="pitchey-session"
SESSION_MAX_AGE="2592000" # 30 days
```

### 3. Wrangler Configuration

Update your `wrangler.toml` (or create `wrangler-better-auth.toml`):

```toml
name = "pitchey-better-auth"
main = "src/auth/auth-worker.ts"
compatibility_date = "2024-12-16"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "pitchey-production"

# Environment Variables
[vars]
BETTER_AUTH_URL = "https://pitchey-api-prod.ndlovucavelle.workers.dev"
SESSION_COOKIE_NAME = "pitchey-session"
SESSION_MAX_AGE = "2592000"

# KV Namespaces for Sessions/Rate Limiting
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-rate-limit-kv-namespace-id"
preview_id = "your-preview-rate-limit-kv-namespace-id"

# R2 Bucket for File Storage
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "pitchey-storage"

# Database Configuration
[env.production.vars]
# Add secrets via: wrangler secret put BETTER_AUTH_SECRET
# Add secrets via: wrangler secret put DATABASE_URL
```

## Database Schema

Better Auth will automatically create the required tables. The schema includes:

```sql
-- Better Auth tables (auto-created)
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT UNIQUE NOT NULL,
  "emailVerified" BOOLEAN DEFAULT FALSE,
  "image" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP,
  "refreshTokenExpiresAt" TIMESTAMP,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Pitchey-specific extensions
ALTER TABLE "user" ADD COLUMN "portal_type" VARCHAR(20) DEFAULT 'creator';
ALTER TABLE "user" ADD COLUMN "company_name" TEXT;
ALTER TABLE "user" ADD COLUMN "phone" VARCHAR(20);
ALTER TABLE "user" ADD COLUMN "bio" TEXT;
ALTER TABLE "user" ADD COLUMN "website" TEXT;
ALTER TABLE "user" ADD COLUMN "linkedin_url" TEXT;
```

## Configuration Files

### 1. Better Auth Core Configuration (`src/auth/better-auth-config.ts`)

```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { rateLimit } from "better-auth/plugins/rate-limit"
import { oauth } from "better-auth/plugins/oauth"

export function createAuth(env: any) {
  // Initialize Neon connection
  const sql = neon(env.DATABASE_URL)
  const db = drizzle(sql)

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: "user",
        session: "session", 
        account: "account"
      }
    }),
    
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Set to true for production
    },
    
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5 // 5 minutes
      }
    },

    cookies: {
      name: env.SESSION_COOKIE_NAME || "pitchey-session",
      secure: true,
      sameSite: "lax",
      httpOnly: true,
      domain: ".ndlovucavelle.workers.dev"
    },

    plugins: [
      rateLimit({
        window: 60, // 1 minute
        max: 100, // 100 requests per minute
        storage: "kv", // Use Cloudflare KV
        keyGenerator: (ctx) => ctx.request.headers.get("CF-Connecting-IP") || "unknown"
      }),
      
      oauth({
        providers: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            scope: ["openid", "email", "profile"]
          },
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            scope: ["user:email"]
          }
        }
      })
    ],

    advanced: {
      generateId: () => crypto.randomUUID(),
      crossSubDomainCookies: {
        enabled: true,
        domain: ".ndlovucavelle.workers.dev"
      }
    },

    trustedOrigins: [
      "https://pitchey-5o8.pages.dev",
      "https://pitchey-api-prod.ndlovucavelle.workers.dev",
      "http://localhost:5173", // Local development
      "http://localhost:8001"  // Local proxy
    ]
  })
}

// Type definitions for Pitchey user extensions
export interface PitcheyUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string
  portalType: 'creator' | 'investor' | 'production'
  companyName?: string
  phone?: string
  bio?: string
  website?: string
  linkedinUrl?: string
  createdAt: Date
  updatedAt: Date
}
```

### 2. Cloudflare Worker with Better Auth (`src/auth/auth-worker.ts`)

```typescript
import { createAuth } from "./better-auth-config"
import { cors } from "better-auth/plugins/cors"

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Initialize Better Auth
    const auth = createAuth(env)
    
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
          "Access-Control-Allow-Credentials": "true"
        }
      })
    }

    const url = new URL(request.url)
    
    // Better Auth handles all /api/auth/* routes automatically
    if (url.pathname.startsWith("/api/auth")) {
      const response = await auth.handler(request)
      
      // Add CORS headers to all auth responses
      response.headers.set("Access-Control-Allow-Origin", "*")
      response.headers.set("Access-Control-Allow-Credentials", "true")
      
      return response
    }

    // Custom Pitchey auth endpoints
    if (url.pathname.startsWith("/api/pitchey-auth")) {
      return handlePitcheyAuthRoutes(request, auth, env)
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response("Better Auth + Pitchey OK", { status: 200 })
    }

    // Fallback to existing Pitchey worker or 404
    return new Response("Not found", { status: 404 })
  }
}

async function handlePitcheyAuthRoutes(request: Request, auth: any, env: any): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace("/api/pitchey-auth", "")

  try {
    switch (path) {
      case "/portal-login":
        return handlePortalLogin(request, auth)
      
      case "/profile":
        return handleProfile(request, auth)
      
      case "/switch-portal":
        return handlePortalSwitch(request, auth)
      
      default:
        return new Response("Route not found", { status: 404 })
    }
  } catch (error) {
    console.error("Pitchey auth error:", error)
    return new Response("Internal server error", { status: 500 })
  }
}

async function handlePortalLogin(request: Request, auth: any): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const { email, password, portalType } = await request.json()

  // Validate portal type
  if (!["creator", "investor", "production"].includes(portalType)) {
    return new Response("Invalid portal type", { status: 400 })
  }

  try {
    // Use Better Auth sign-in
    const result = await auth.api.signInEmail({
      email,
      password,
      request
    })

    if (!result.user) {
      return new Response("Invalid credentials", { status: 401 })
    }

    // Verify user has access to this portal
    // This would require custom user metadata in your database
    
    return new Response(JSON.stringify({
      success: true,
      user: result.user,
      session: result.session
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    return new Response("Authentication failed", { status: 401 })
  }
}

async function handleProfile(request: Request, auth: any): Promise<Response> {
  // Get session from request
  const session = await auth.api.getSession({ request })
  
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  return new Response(JSON.stringify({
    user: session.user,
    session: session.session
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  })
}

async function handlePortalSwitch(request: Request, auth: any): Promise<Response> {
  const session = await auth.api.getSession({ request })
  
  if (!session) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { newPortalType } = await request.json()
  
  // Update user portal type in database
  // This requires custom implementation based on your user schema
  
  return new Response(JSON.stringify({
    success: true,
    portalType: newPortalType
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  })
}
```

## Frontend Integration

### 1. Install Better Auth Client

```bash
npm install better-auth/client better-auth/react
```

### 2. Better Auth Client Setup (`frontend/src/auth/better-auth-client.ts`)

```typescript
import { createAuthClient } from "better-auth/client"
import { oAuthClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8001",
  plugins: [oAuthClient()]
})

export type AuthClient = typeof authClient
```

### 3. React Integration (`frontend/src/hooks/useBetterAuth.ts`)

```typescript
import { useContext, createContext, useState, useEffect, ReactNode } from "react"
import { authClient } from "../auth/better-auth-client"

interface AuthContextType {
  user: any | null
  session: any | null
  isLoading: boolean
  signIn: (email: string, password: string, portalType: string) => Promise<any>
  signOut: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const sessionData = await authClient.getSession()
      if (sessionData?.user) {
        setUser(sessionData.user)
        setSession(sessionData.session)
      }
    } catch (error) {
      console.error("Session check failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const signIn = async (email: string, password: string, portalType: string) => {
    try {
      const result = await authClient.signIn.email({
        email,
        password
      })

      if (result.user) {
        setUser(result.user)
        setSession(result.session)
        return { success: true, user: result.user }
      }
      
      return { success: false, error: "Invalid credentials" }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const signOut = async () => {
    try {
      await authClient.signOut()
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error("Sign out failed:", error)
    }
  }

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signOut,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useBetterAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useBetterAuth must be used within AuthProvider")
  }
  return context
}
```

## Deployment Instructions

### 1. Database Setup

Run the setup script to create tables and seed data:

```bash
npm run setup-better-auth
```

### 2. Configure Cloudflare Secrets

```bash
# Add sensitive environment variables as secrets
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put DATABASE_URL
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_SECRET
```

### 3. Deploy Worker

```bash
# Deploy Better Auth worker
wrangler deploy --config wrangler-better-auth.toml

# Test deployment
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/health
```

## Testing

### 1. Test Authentication Flow

```bash
# Test sign-up
curl -X POST https://your-worker.workers.dev/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123", "name": "Test User"}'

# Test sign-in
curl -X POST https://your-worker.workers.dev/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### 2. Frontend Testing

Update your login components to use the new Better Auth hooks:

```typescript
import { useBetterAuth } from "../hooks/useBetterAuth"

function LoginForm() {
  const { signIn, isLoading } = useBetterAuth()
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await signIn(email, password, portalType)
    if (result.success) {
      // Redirect to dashboard
    } else {
      // Show error
    }
  }

  return (
    // Your existing login form JSX
  )
}
```

## Migration from Existing Auth

### 1. Backward Compatibility

Keep your existing auth endpoints during migration:

```typescript
// In your worker, handle both old and new auth
if (url.pathname.startsWith("/api/auth/creator/login")) {
  // Redirect to Better Auth or handle with compatibility layer
  return handleLegacyAuth(request, auth)
}
```

### 2. User Data Migration

Create a migration script to move existing users to Better Auth format:

```typescript
// scripts/migrate-users.ts
async function migrateExistingUsers() {
  // Fetch existing users from your current auth system
  // Transform and insert into Better Auth user table
  // Update password hashes if needed
}
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure all origins are added to `trustedOrigins`
   - Check CORS headers in responses

2. **Session Not Persisting**
   - Verify cookie domain settings
   - Check secure/sameSite cookie attributes

3. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check Neon connection limits

4. **KV Namespace Issues**
   - Verify KV namespace bindings in wrangler.toml
   - Check KV namespace IDs

### Debug Mode

Enable debug logging in development:

```typescript
// In better-auth-config.ts
export const auth = betterAuth({
  // ... other config
  logger: {
    level: "debug",
    disabled: false
  }
})
```

### Performance Monitoring

Monitor auth performance:

```typescript
// Add to your worker
console.time("auth-request")
const response = await auth.handler(request)
console.timeEnd("auth-request")
```

## Security Considerations

1. **Environment Variables**: Never commit secrets to version control
2. **HTTPS Only**: Always use HTTPS in production
3. **Rate Limiting**: Configure appropriate rate limits
4. **Session Security**: Use secure session settings
5. **Database Security**: Use connection pooling and proper permissions

## Next Steps

1. **Email Verification**: Enable email verification for production
2. **Social Auth**: Configure Google/GitHub OAuth
3. **2FA**: Add two-factor authentication
4. **Admin Panel**: Create admin interface for user management
5. **Analytics**: Add auth event tracking

This configuration provides a robust, scalable authentication system that integrates seamlessly with your existing Pitchey infrastructure while providing modern features and excellent developer experience.