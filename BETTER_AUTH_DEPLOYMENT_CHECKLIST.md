# 🚀 Better Auth Deployment Checklist for Pitchey

**Created**: December 16, 2024  
**Status**: Ready for Deployment  
**Authentication System**: Better Auth (Session-based)  
**Infrastructure**: Cloudflare Workers + Neon PostgreSQL

---

## 📋 Pre-Deployment Checklist

### ✅ Completed Items
- [x] Fixed infinite loop at /marketplace
- [x] Standardized API response formats
- [x] Unified authentication patterns
- [x] Created Better Auth configuration files
- [x] Documented all authentication endpoints
- [x] Created monitoring scripts
- [x] Set up rollback procedures

### 🔄 Deployment Steps

## Step 1: Install Dependencies
```bash
# Install Better Auth and required packages
npm install better-auth@latest \
  @better-auth/drizzle-adapter \
  drizzle-orm \
  @neondatabase/serverless \
  pg

# Install dev dependencies
npm install --save-dev @types/pg
```

## Step 2: Configure Environment Variables

### A. Create KV Namespaces
```bash
# Create KV namespace for sessions
wrangler kv:namespace create "SESSIONS"
# Note the ID returned (e.g., 98c88a185eb448e4868fcc87e458b3ac)

# Create KV namespace for rate limiting
wrangler kv:namespace create "RATE_LIMIT"
# Note the ID returned
```

### B. Set Cloudflare Secrets
```bash
# Set Better Auth secret (generate a strong 32+ character secret)
wrangler secret put BETTER_AUTH_SECRET
# Enter: <your-generated-secret>

# Set database URL
wrangler secret put DATABASE_URL
# Enter: postgresql://neondb_owner:<password>@<host>/neondb?sslmode=require

# Set JWT secret (for backward compatibility)
wrangler secret put JWT_SECRET
# Enter: vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz
```

## Step 3: Update wrangler.toml
```toml
# Update your wrangler.toml with the KV namespace IDs
[[kv_namespaces]]
binding = "SESSIONS"
id = "<your-sessions-kv-id>"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<your-rate-limit-kv-id>"

# Ensure compatibility flags are set
compatibility_flags = ["nodejs_compat"]
compatibility_date = "2024-09-23"
```

## Step 4: Run Database Setup
```bash
# Set your database URL
export DATABASE_URL="postgresql://neondb_owner:<password>@<host>/neondb?sslmode=require"

# Run the Better Auth setup script
deno run --allow-all scripts/setup-better-auth.ts

# Verify tables were created
# Should see: user, session, account, verification tables
```

## Step 5: Deploy Better Auth Worker
```bash
# Deploy to production
wrangler deploy --config wrangler-better-auth.toml

# Or use existing wrangler.toml if updated
wrangler deploy
```

## Step 6: Test Authentication Endpoints

### A. Test Health Check
```bash
curl https://pitchey-production.cavelltheleaddev.workers.dev/health
# Should return: { "status": "healthy", "betterAuth": true }
```

### B. Test Demo Account Login
```bash
# Test Creator Login
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# Should return session and user data
```

### C. Test Portal-Specific Login (Backward Compatibility)
```bash
# Test Creator Portal
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}'

# Should return success with token (for backward compatibility)
```

## Step 7: Update Frontend Configuration

### A. Update Environment Variables
```env
# .env.production
VITE_API_URL=https://pitchey-production.cavelltheleaddev.workers.dev
VITE_AUTH_TYPE=better-auth
```

### B. Deploy Frontend
```bash
# Build frontend with Better Auth support
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy frontend/dist --project-name=pitchey
```

## Step 8: Verify Complete System

### A. Run Comprehensive Tests
```bash
# Run all endpoint tests
./test-all-endpoints.sh --test-type=full

# Run Better Auth specific tests
./test-better-auth.sh

# Run monitoring dashboard
./monitoring-dashboard.sh
```

### B. Check Critical Features
- [ ] Login works for all three portals
- [ ] Sessions persist across page refreshes
- [ ] Protected endpoints require authentication
- [ ] Logout clears session properly
- [ ] Rate limiting prevents abuse
- [ ] CORS headers are correct

---

## 🔍 Verification Points

### Database Tables Created
```sql
-- Should see these tables in Neon
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user', 'session', 'account', 'verification');
```

### KV Namespaces Active
```bash
# List KV namespaces
wrangler kv:namespace list
# Should see SESSIONS and RATE_LIMIT
```

### Worker Deployed
```bash
# Check worker status
wrangler tail
# Should see incoming requests
```

---

## 🚨 Rollback Plan (If Needed)

### Quick Rollback (< 2 minutes)
```bash
# Rollback to previous worker version
wrangler rollback

# Or deploy previous worker
wrangler deploy src/worker-production-db.ts
```

### Full Rollback
```bash
# Run rollback script
./rollback-plan.sh --immediate
```

---

## 📊 Success Criteria

### ✅ All Green Indicators
- Health endpoint returns `betterAuth: true`
- All demo accounts can login
- Sessions persist for 24 hours
- Rate limiting blocks excessive requests
- No authentication errors in logs

### 📈 Performance Metrics
- Login response time < 500ms
- Session validation < 100ms  
- Rate limit check < 50ms
- Database queries < 200ms

---

## 🔗 Important URLs

### Production Endpoints
- **Health**: https://pitchey-production.cavelltheleaddev.workers.dev/health
- **Sign In**: https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/sign-in
- **Session**: https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/session
- **Sign Out**: https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/sign-out

### Portal-Specific (Backward Compatible)
- **Creator**: /api/auth/creator/login
- **Investor**: /api/auth/investor/login
- **Production**: /api/auth/production/login

### Documentation
- **Better Auth Docs**: https://www.better-auth.com
- **Cloudflare Workers**: https://developers.cloudflare.com/workers
- **Neon PostgreSQL**: https://neon.tech/docs

---

## 📝 Post-Deployment Tasks

1. **Monitor Logs**
   ```bash
   wrangler tail --format pretty
   ```

2. **Check Error Rates**
   - Monitor Cloudflare dashboard
   - Check Sentry for auth errors

3. **Update Documentation**
   - Update API documentation
   - Update team runbooks
   - Notify team of changes

4. **Performance Tuning**
   - Monitor response times
   - Adjust rate limits if needed
   - Optimize database queries

---

## 🎯 Final Notes

### What's New
- **Session-based auth** instead of JWT tokens
- **Better security** with HTTP-only cookies
- **Rate limiting** to prevent abuse
- **Social login** support (Google, GitHub)
- **Magic links** for passwordless login

### What's Unchanged
- Demo accounts still work with password `Demo123`
- Portal-specific endpoints maintained for backward compatibility
- API response formats remain consistent
- Frontend can gradually migrate to new auth

### Support
- Check logs: `wrangler tail`
- Run tests: `./test-better-auth.sh`
- Monitor: `./monitoring-dashboard.sh`
- Rollback: `./rollback-plan.sh`

---

**Deployment Ready**: ✅ All systems configured and documented  
**Estimated Time**: 30-45 minutes for full deployment  
**Risk Level**: Low (with rollback plan in place)

---

*Generated: December 16, 2024*  
*Platform: Pitchey - Movie Pitch Marketplace*  
*Auth System: Better Auth + Cloudflare Workers + Neon PostgreSQL*