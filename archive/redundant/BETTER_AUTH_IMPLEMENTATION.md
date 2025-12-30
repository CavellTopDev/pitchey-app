# 🔐 Better Auth Implementation Guide

## ⚡ CRITICAL: Better Auth is NOW LIVE in Pitchey Platform!

**Last Updated: December 2024**  
**Status: ✅ FULLY IMPLEMENTED AND OPERATIONAL**

---

## 🎯 Executive Summary

The Pitchey platform has successfully migrated from JWT-based authentication to **Better Auth**, a modern session-based authentication system. This migration is **100% complete** and all authentication flows now use Better Auth's cookie-based session management.

### Key Achievements:
- ✅ **Complete JWT to Better Auth migration**
- ✅ **All three portals (Creator, Investor, Production) working**
- ✅ **All demo accounts functional**
- ✅ **Backward compatibility maintained**
- ✅ **Zero authentication downtime during migration**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [What Changed](#what-changed)
3. [Implementation Details](#implementation-details)
4. [API Endpoints](#api-endpoints)
5. [Frontend Integration](#frontend-integration)
6. [Backend Integration](#backend-integration)
7. [Session Management](#session-management)
8. [Migration Path](#migration-path)
9. [Testing & Verification](#testing--verification)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Better Auth is a TypeScript-first authentication library that provides:
- **Session-based authentication** with secure HTTP-only cookies
- **Built-in CSRF protection**
- **Automatic session refresh**
- **Type-safe API**
- **Database agnostic** (works with PostgreSQL, MySQL, SQLite)
- **Framework agnostic** (works with any backend)

### Why Better Auth?

The migration from JWT to Better Auth provides:
1. **Enhanced Security**: HTTP-only cookies prevent XSS attacks
2. **Better Session Management**: Server-side sessions with automatic refresh
3. **Simplified Frontend**: No need to manage tokens manually
4. **CSRF Protection**: Built-in protection against CSRF attacks
5. **Type Safety**: Full TypeScript support throughout

---

## What Changed

### Before (JWT Authentication)
```javascript
// Frontend had to manage JWT tokens
const token = localStorage.getItem('token');
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Backend verified JWT on every request
const token = request.headers.get('Authorization');
const payload = jwt.verify(token, JWT_SECRET);
```

### After (Better Auth)
```javascript
// Frontend - no token management needed!
fetch('/api/protected', {
  credentials: 'include' // Cookies sent automatically
});

// Backend - session verified automatically
const session = await auth.api.getSession({ headers: request.headers });
if (!session) throw new Error('Unauthorized');
```

---

## Implementation Details

### Core Configuration

**Location**: `/src/lib/auth.ts`

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.ts";
import * as schema from "../db/schema.ts";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Currently disabled for demo
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // Update session if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,             // Cache for 5 minutes
    },
  },
  
  trustedOrigins: [
    "http://localhost:5173",      // Local frontend
    "http://localhost:8001",      // Local backend
    "https://pitchey-5o8.pages.dev",  // Production frontend
  ],
});
```

### Database Schema

Better Auth required new tables for session management:

```sql
-- Sessions table (new)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table (new) - for OAuth providers (future)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verifications table (new) - for email verification
CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Primary Better Auth Endpoints

All Better Auth endpoints are mounted at `/api/auth/*`:

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/auth/sign-in` | POST | Sign in user | `{email, password}` | User + Session |
| `/api/auth/sign-up` | POST | Create account | `{email, password, name}` | User + Session |
| `/api/auth/sign-out` | POST | Sign out user | None | Success message |
| `/api/auth/session` | GET | Get current session | None | Session or null |
| `/api/auth/session/refresh` | POST | Refresh session | None | New session |

### Portal-Specific Endpoints (Legacy Support)

These endpoints are maintained for backward compatibility but internally use Better Auth:

```typescript
// Example: Creator login endpoint
router.post("/api/auth/creator/login", async (ctx) => {
  const { email, password } = await ctx.request.body.json();
  
  // Use Better Auth internally
  const session = await auth.api.signIn({
    body: { email, password },
    headers: ctx.request.headers,
  });
  
  // Set portal type in session metadata
  await updateSessionMetadata(session.id, { portal: 'creator' });
  
  // Return legacy response format for compatibility
  return {
    success: true,
    user: session.user,
    token: session.token, // Included for legacy clients
  };
});
```

---

## Frontend Integration

### Authentication Service

**Location**: `/frontend/src/services/auth.service.ts`

```typescript
class AuthService {
  async login(email: string, password: string, portal: string) {
    // Use Better Auth endpoint
    const response = await fetch(`${API_URL}/api/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // CRITICAL: Include cookies
      body: JSON.stringify({ email, password, portal }),
    });
    
    if (!response.ok) throw new Error('Login failed');
    
    const data = await response.json();
    // No need to store token - it's in cookies!
    return data.user;
  }
  
  async logout() {
    await fetch(`${API_URL}/api/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });
  }
  
  async getSession() {
    const response = await fetch(`${API_URL}/api/auth/session`, {
      credentials: 'include',
    });
    
    if (!response.ok) return null;
    return response.json();
  }
}
```

### React Context

**Location**: `/frontend/src/contexts/AuthContext.tsx`

```typescript
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check session on mount
    checkSession();
  }, []);
  
  const checkSession = async () => {
    try {
      const session = await authService.getSession();
      setUser(session?.user || null);
    } finally {
      setLoading(false);
    }
  };
  
  // Auto-refresh session
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) checkSession();
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => clearInterval(interval);
  }, [user]);
  
  return (
    <AuthContext.Provider value={{ user, loading, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## Backend Integration

### Middleware

**Location**: `/src/middleware/auth.middleware.ts`

```typescript
export async function requireAuth(ctx: Context, next: Next) {
  // Get session from Better Auth
  const session = await auth.api.getSession({
    headers: ctx.request.headers,
  });
  
  if (!session) {
    ctx.response.status = 401;
    ctx.response.body = { error: 'Unauthorized' };
    return;
  }
  
  // Attach user to context
  ctx.state.user = session.user;
  ctx.state.session = session;
  
  await next();
}
```

### Protected Routes

```typescript
// Example protected route
router.get('/api/dashboard', requireAuth, async (ctx) => {
  const user = ctx.state.user; // User from Better Auth session
  
  // Fetch user-specific data
  const dashboardData = await getDashboardData(user.id);
  
  ctx.response.body = dashboardData;
});
```

---

## Session Management

### Session Lifecycle

1. **Creation**: Session created on sign-in/sign-up
2. **Storage**: Stored in PostgreSQL with secure token
3. **Cookie**: HTTP-only cookie sent to client
4. **Validation**: Validated on each request
5. **Refresh**: Auto-refreshed when nearing expiry
6. **Deletion**: Removed on sign-out

### Cookie Configuration

```typescript
{
  httpOnly: true,        // Prevents JavaScript access
  secure: true,          // HTTPS only in production
  sameSite: 'lax',      // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',            // Available site-wide
}
```

---

## Migration Path

### Phase 1: Parallel Implementation ✅
- Implemented Better Auth alongside JWT
- Both systems worked simultaneously
- No breaking changes for clients

### Phase 2: Internal Migration ✅
- Portal endpoints updated to use Better Auth internally
- JWT validation fallback for old sessions
- Gradual session migration

### Phase 3: Complete Transition ✅
- All new sessions use Better Auth
- Old JWT sessions expired naturally
- JWT code deprecated but not removed

### Phase 4: Cleanup (Current) ✅
- JWT dependencies can be removed
- Legacy code can be cleaned up
- Full Better Auth implementation

---

## Testing & Verification

### Test Accounts

All demo accounts work with Better Auth:

| Portal | Email | Password | Status |
|--------|-------|----------|--------|
| Creator | alex.creator@demo.com | Demo123 | ✅ Working |
| Investor | sarah.investor@demo.com | Demo123 | ✅ Working |
| Production | stellar.production@demo.com | Demo123 | ✅ Working |

### Verification Steps

1. **Test Sign-in**:
```bash
curl -X POST http://localhost:8001/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}' \
  -c cookies.txt
```

2. **Test Session**:
```bash
curl http://localhost:8001/api/auth/session \
  -b cookies.txt
```

3. **Test Protected Route**:
```bash
curl http://localhost:8001/api/dashboard \
  -b cookies.txt
```

4. **Test Sign-out**:
```bash
curl -X POST http://localhost:8001/api/auth/sign-out \
  -b cookies.txt
```

---

## Troubleshooting

### Common Issues

#### 1. "Unauthorized" errors after login
**Solution**: Ensure `credentials: 'include'` is set in fetch requests

#### 2. Session not persisting
**Solution**: Check cookie settings and CORS configuration

#### 3. Portal type not recognized
**Solution**: Session metadata includes portal type, check `session.metadata.portal`

#### 4. CSRF token errors
**Solution**: Better Auth handles CSRF automatically, ensure cookies are included

### Debug Mode

Enable debug logging:
```typescript
export const auth = betterAuth({
  // ... config
  logger: {
    level: 'debug',
    log: (level, message, ...args) => {
      console.log(`[BetterAuth ${level}]:`, message, ...args);
    },
  },
});
```

---

## Security Considerations

### What's Improved

1. **No XSS Token Theft**: Tokens in HTTP-only cookies can't be accessed by JavaScript
2. **CSRF Protection**: Built-in CSRF token validation
3. **Session Invalidation**: Server can invalidate sessions immediately
4. **Secure by Default**: Automatic security headers and cookie flags

### Best Practices

1. Always use HTTPS in production
2. Keep session duration reasonable (7 days default)
3. Implement rate limiting on auth endpoints
4. Monitor failed login attempts
5. Use email verification for new accounts (when enabled)

---

## Future Enhancements

### Planned Features

1. **OAuth Providers**: Google, GitHub, LinkedIn sign-in
2. **Two-Factor Authentication**: TOTP-based 2FA
3. **Email Verification**: Verify email before account activation
4. **Password Reset**: Secure password reset flow
5. **Session Management UI**: Allow users to see/manage active sessions
6. **Audit Logging**: Track all authentication events

### OAuth Provider Setup (Ready to Enable)

```typescript
export const auth = betterAuth({
  // ... existing config
  
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
});
```

---

## Conclusion

The Better Auth implementation is **fully operational** and provides a more secure, maintainable authentication system for the Pitchey platform. All existing functionality has been preserved while gaining significant security improvements.

### Key Takeaways:
- ✅ Migration complete with zero downtime
- ✅ All portals and demo accounts working
- ✅ Enhanced security with cookie-based sessions
- ✅ Backward compatibility maintained
- ✅ Ready for future enhancements

For questions or issues, refer to the troubleshooting section or check the Better Auth documentation at https://better-auth.com/docs

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Status**: ACTIVE AND OPERATIONAL