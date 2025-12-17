# Migration Guide: Better Auth Integration

## 🎯 Quick Start

This guide walks you through migrating from the old JWT-based system to the new Better Auth architecture.

### 1. Update Cloudflare Secrets

**Required secrets to add:**
```bash
# Better Auth configuration
wrangler secret put BETTER_AUTH_SECRET
# Enter a secure random string (32+ characters)

wrangler secret put BETTER_AUTH_URL
# Enter: https://pitchey-production.cavelltheleaddev.workers.dev
```

**Optional OAuth secrets (for future use):**
```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_ID  
wrangler secret put GITHUB_CLIENT_SECRET
```

### 2. Deploy New Worker

```bash
# Deploy the updated worker
wrangler deploy

# Verify deployment
curl https://pitchey-production.cavelltheleaddev.workers.dev/health
```

### 3. Test Authentication

**Test endpoints:**
```bash
# Health check
GET /health

# Better Auth endpoints  
POST /api/auth/sign-up
POST /api/auth/sign-in
POST /api/auth/sign-out
GET /api/auth/session

# Protected endpoints (require authentication)
GET /api/user/profile
GET /api/pitch
GET /api/dashboard/stats
```

## 📋 Frontend Migration Checklist

### Update Authentication Service

**Before (JWT-based):**
```typescript
// Old authentication
const login = async (email, password, portal) => {
  const response = await fetch('/api/auth/creator/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const { token } = await response.json();
  localStorage.setItem('authToken', token);
};
```

**After (Better Auth session-based):**
```typescript
// New Better Auth
const login = async (email, password) => {
  const response = await fetch('/api/auth/sign-in', {
    method: 'POST',
    credentials: 'include', // Include cookies for session
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  // No token storage needed - session handled by cookies
  return response.json();
};
```

### Update API Requests

**Before:**
```typescript
// Old JWT header
const authHeaders = {
  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
  'Content-Type': 'application/json'
};
```

**After:**
```typescript
// New session-based (automatic with cookies)
const authHeaders = {
  'Content-Type': 'application/json'
  // No Authorization header needed
};

// Ensure credentials are included for cookies
fetch('/api/endpoint', {
  credentials: 'include',
  headers: authHeaders
});
```

### Update Authentication Context

**Before:**
```typescript
// Old JWT context
const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
const [user, setUser] = useState(null);

useEffect(() => {
  if (authToken) {
    // Decode JWT to get user info
    const decoded = jwt.decode(authToken);
    setUser(decoded);
  }
}, [authToken]);
```

**After:**
```typescript  
// New Better Auth context
const [user, setUser] = useState(null);
const [isAuthenticated, setIsAuthenticated] = useState(false);

useEffect(() => {
  // Check session on app load
  checkSession();
}, []);

const checkSession = async () => {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const { user } = await response.json();
      setUser(user);
      setIsAuthenticated(true);
    }
  } catch (error) {
    setIsAuthenticated(false);
    setUser(null);
  }
};
```

## 🔄 Gradual Migration Strategy

### Phase 1: Deploy Better Auth Worker (✅ COMPLETED)
- New worker deployed with Better Auth
- Legacy endpoints still work temporarily
- No impact on existing users

### Phase 2: Frontend Migration (NEXT)
- Update login/logout components
- Migrate from localStorage tokens to session cookies
- Update authentication service and context

### Phase 3: Cleanup (FUTURE)
- Remove legacy auth code from worker
- Clean up unused JWT dependencies
- Complete migration to Better Auth

## 🛡️ Security Improvements

### Better Auth Benefits
- **Session Security:** HTTPOnly cookies prevent XSS attacks
- **CSRF Protection:** Built-in CSRF tokens
- **Rate Limiting:** Automatic brute force protection  
- **Edge Optimization:** Sessions cached at Cloudflare edge

### Password Validation
```typescript
// New password requirements
- Minimum 8 characters
- Must contain: uppercase, lowercase, number
- Maximum 128 characters
```

## 🔧 Troubleshooting

### Common Issues

**1. CORS Errors**
```typescript
// Ensure credentials are included
fetch('/api/endpoint', {
  credentials: 'include', // Required for session cookies
  mode: 'cors'
});
```

**2. Session Not Persisting**
```bash
# Check cookie settings in browser dev tools
# Ensure secure cookies are enabled in production
# Verify BETTER_AUTH_URL matches production domain
```

**3. Database Connection Issues**
```bash
# Verify DATABASE_URL secret is set
wrangler secret list

# Check Hyperdrive connection
wrangler tail --format=pretty
```

### Debug Commands

```bash
# View worker logs
wrangler tail --format=pretty

# Test health endpoint
curl -v https://pitchey-production.cavelltheleaddev.workers.dev/health

# Test auth endpoints
curl -v -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

## 📊 Monitoring

### Key Metrics to Watch
- Authentication success/failure rates
- Session duration and renewal patterns  
- API endpoint response times
- Database connection health
- KV storage usage for sessions

### Health Checks
```bash
# Primary health check
GET /health

# Returns:
{
  "status": "healthy",
  "timestamp": "2024-12-16T...",
  "version": "2.0.0-better-auth", 
  "database": "connected",
  "auth": "better-auth"
}
```

## 🚀 Next Steps

1. **Update Frontend:** Migrate authentication service and context
2. **Test Portal Flows:** Verify all three portal types work correctly
3. **Performance Testing:** Monitor authentication performance
4. **User Training:** Update any admin documentation

## 📞 Support

If issues arise during migration:

1. **Quick Rollback:** Update `wrangler.toml` main entry point back to previous worker
2. **Debug Logs:** Use `wrangler tail` for real-time error monitoring  
3. **Legacy Code:** All previous code preserved in `/deprecated/` folder
4. **Health Monitoring:** `/health` endpoint provides system status

The migration preserves all existing functionality while providing a more secure, scalable authentication system.