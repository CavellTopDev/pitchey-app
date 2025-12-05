# Session Security Migration Guide

## Overview
Migrating from localStorage JWT tokens to HTTPOnly cookie-based sessions with Redis backend for improved security and edge compatibility.

## Why This Migration is Critical

### Current Security Issues (localStorage)
1. **XSS Vulnerabilities**: Any JavaScript can access localStorage tokens
2. **No Server-Side Control**: Can't invalidate tokens server-side
3. **Token Exposure**: JWT tokens visible in browser DevTools
4. **CSRF Risks**: Without proper CSRF protection

### Benefits of New Architecture

#### Security Improvements
- **HTTPOnly Cookies**: JavaScript cannot access session tokens
- **Secure Flag**: Cookies only sent over HTTPS
- **SameSite Protection**: CSRF attack prevention
- **Server-Side Invalidation**: Instant session revocation
- **Rate Limiting**: Built-in brute force protection
- **Session Hashing**: Even if Redis is compromised, sessions are hashed

#### Edge Computing Benefits
- **Cloudflare Workers Compatible**: Sessions stored in Upstash Redis
- **Global Distribution**: Sessions accessible from any edge location
- **Low Latency**: Redis at the edge for fast session validation
- **Automatic Expiration**: Redis TTL handles session cleanup

## Implementation Steps

### 1. Backend Setup (Cloudflare Worker)

```typescript
// Already implemented in src/worker-session-auth.ts
- Session creation with secure cookies
- Redis session storage with Upstash
- Rate limiting on auth endpoints
- Session invalidation endpoints
```

### 2. Frontend Migration

```typescript
// Use new secure auth service
import { secureAuthService } from './services/auth-secure.service';

// Login with cookies
await secureAuthService.login('creator', email, password);

// Session validation (happens automatically via cookies)
const session = await secureAuthService.validateSession();

// Logout (clears cookie and Redis session)
await secureAuthService.logout();
```

### 3. Update All API Calls

```typescript
// Before (localStorage)
fetch(url, {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
  }
});

// After (cookies)
fetch(url, {
  credentials: 'include' // This sends cookies automatically
});
```

### 4. Database Schema for Session Tracking

```sql
-- Optional: Track sessions in database for audit
CREATE TABLE sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

## Security Best Practices

### 1. Cookie Configuration
```typescript
{
  httpOnly: true,       // Prevent JS access
  secure: true,         // HTTPS only
  sameSite: 'lax',     // CSRF protection
  maxAge: 604800,      // 7 days
  domain: '.pitchey.pages.dev' // Subdomain support
}
```

### 2. Session Management
- Rotate session IDs on privilege escalation
- Implement "Remember Me" with separate long-lived tokens
- Clear all sessions on password change
- Monitor for concurrent sessions from different locations

### 3. Rate Limiting
```typescript
// Implemented per IP address
- Login attempts: 5 per minute
- Session creation: 10 per hour
- API calls: 100 per minute (authenticated)
```

### 4. CSRF Protection
- SameSite=Lax cookies prevent most CSRF
- For state-changing operations, consider double-submit cookies
- Validate Origin/Referer headers for sensitive operations

## Migration Checklist

### Phase 1: Parallel Running (Current)
- [x] Implement secure session manager
- [x] Create cookie-based auth endpoints
- [x] Add Redis session storage
- [ ] Test with staging environment

### Phase 2: Gradual Migration
- [ ] Update login/logout flows to use cookies
- [ ] Migrate API calls to use `credentials: 'include'`
- [ ] Add session validation on app mount
- [ ] Implement session refresh logic

### Phase 3: Deprecate localStorage
- [ ] Remove localStorage token storage
- [ ] Update all API interceptors
- [ ] Remove Authorization headers
- [ ] Clean up old auth code

### Phase 4: Monitoring
- [ ] Add session analytics
- [ ] Monitor for auth failures
- [ ] Track session duration metrics
- [ ] Set up alerts for suspicious activity

## Environment Variables Required

```env
# Production (Cloudflare Workers)
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
ENVIRONMENT=production
FRONTEND_URL=https://pitchey.pages.dev

# Development
UPSTASH_REDIS_REST_URL=https://your-dev-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-dev-token
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
```

## Testing Strategy

### Security Tests
1. **XSS Prevention**: Verify cookies are HTTPOnly
2. **CSRF Protection**: Test cross-origin requests
3. **Session Hijacking**: Verify IP/UserAgent validation
4. **Brute Force**: Test rate limiting

### Functional Tests
1. **Login/Logout**: All portals (creator, investor, production)
2. **Session Persistence**: Across page refreshes
3. **Concurrent Sessions**: Multiple devices
4. **Session Expiration**: After timeout

### Performance Tests
1. **Session Creation**: < 100ms
2. **Validation**: < 50ms
3. **Redis Operations**: < 20ms at edge

## Rollback Plan

If issues arise:
1. Keep localStorage code as fallback
2. Use feature flag to toggle between systems
3. Gradual rollout by user percentage
4. Monitor error rates closely

## Additional Security Recommendations

### 1. Implement 2FA
```typescript
// After password validation
const twoFactorCode = await send2FACode(user.email);
// Verify before creating session
```

### 2. Device Fingerprinting
```typescript
// Track device characteristics
const fingerprint = await getDeviceFingerprint();
// Store with session for anomaly detection
```

### 3. Geolocation Verification
```typescript
// Using Cloudflare headers
const country = request.headers.get('CF-IPCountry');
// Alert on unusual login locations
```

### 4. Session Activity Logging
```typescript
// Log all session events
await logSessionEvent({
  action: 'login',
  userId: user.id,
  ip: request.headers.get('CF-Connecting-IP'),
  timestamp: Date.now()
});
```

## Support and Monitoring

- Monitor Redis memory usage
- Set up alerts for failed auth attempts
- Track session creation/destruction rates
- Monitor cookie rejection rates
- Log security events for audit

## Conclusion

This migration significantly improves security posture while maintaining excellent performance through edge computing. The HTTPOnly cookie approach with Redis backend provides enterprise-grade session management suitable for production use on Cloudflare's infrastructure.