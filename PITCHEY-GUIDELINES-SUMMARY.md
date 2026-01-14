# Pitchey Platform - Concise Development Guidelines & Checkpoints

## 🎯 PROJECT CONTEXT SUMMARY
**Platform:** Movie pitch marketplace with 3 authenticated portals (Creator/Investor/Production)
**Stack:** Cloudflare Workers + Neon PostgreSQL + React + Better Auth
**Current State:** 85% complete, critical authentication & connection issues blocking launch

---

## 🔴 CRITICAL BLOCKERS (Fix First)

### 1. Authentication Breaking
**Issue:** Sessions drop between portals, cookies misconfigured
**File:** `src/auth/better-auth-neon-raw-sql.ts`
**Fix:** Set cookie domain to `.pitchey.pages.dev` for production

### 2. Database Connections Exhausting  
**Issue:** Neon 25-connection limit hit, causing 500 errors
**Fix:** Implement connection pooling in Worker, add timeouts

### 3. WebSocket Disconnecting
**Issue:** Drops after 60 seconds, no reconnection logic
**Fix:** Add 30-second heartbeat in `worker-integrated.ts`

---

## ✅ DEVELOPMENT CHECKPOINTS

### Before ANY Code Change:
```bash
□ Pull latest: git pull origin main
□ Check server: PORT=8001 deno run --allow-all working-server.ts
□ Verify frontend: npm run dev (should connect to :8001)
```

### Before EVERY Commit:
```bash
□ Type check: npm run typecheck
□ Test locally: npm run build
□ Sync lockfile: npm ci (if package.json changed)
```

### Before Push to Production:
```bash
□ Test auth flow with all 3 demo accounts
□ Check database connections: < 20 active
□ Verify WebSocket stays connected > 2 minutes
□ Run: ./test-critical-systems.sh
```

---

## 🚦 QUICK DECISION TREE

**Q: Frontend not loading?**
→ Check if backend proxy running on port 8001
→ Verify `.env` has `VITE_API_URL=http://localhost:8001`

**Q: Authentication failing?**
→ Check Better Auth cookies in DevTools
→ Verify session endpoint returns 200
→ Ensure cookie domain matches environment

**Q: Database errors?**
→ Check connection count: `SELECT count(*) FROM pg_stat_activity;`
→ Look for missing `await` on queries
→ Verify Neon connection string has `?sslmode=require`

**Q: WebSocket not connecting?**
→ Check URL: should be `ws://localhost:8001` locally
→ Verify Redis is accessible (Upstash)
→ Look for CORS errors in console

---

## 📋 STEP-BY-STEP FIXES

### Fix #1: Authentication (30 min)
1. Open `src/auth/better-auth-neon-raw-sql.ts`
2. Add cookie config with proper domain
3. Test with: `curl -X POST /api/auth/sign-in`
4. Verify cookie set correctly in browser

### Fix #2: Database Pooling (45 min)
1. Add to Worker: `const pool = new Pool({ max: 10 })`
2. Set query timeout: `statement_timeout = '30s'`
3. Monitor with: `wrangler tail | grep "database"`
4. Test with 50 concurrent requests

### Fix #3: WebSocket Stability (20 min)
1. Add heartbeat interval every 30 seconds
2. Implement auto-reconnect with exponential backoff
3. Test with: `wscat -c ws://localhost:8001/ws`
4. Verify stays connected for 5+ minutes

---

## 🎮 COMMAND SHORTCUTS

```bash
# Start development environment
alias pitchey-dev='PORT=8001 deno run --allow-all working-server.ts & npm run dev'

# Quick health check
alias pitchey-health='curl https://pitchey-api-prod.ndlovucavelle.workers.dev/health | jq'

# Database connection check
alias pitchey-db='PGPASSWORD="npg_YibeIGRuv40J" psql -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech -U neondb_owner -d neondb -c "SELECT count(*) FROM pg_stat_activity;"'

# Deploy to production
alias pitchey-deploy='npm run build && wrangler pages deploy frontend/dist --project-name=pitchey'

# Watch Worker logs
alias pitchey-logs='wrangler tail --env production --format pretty'
```

---

## 🏁 COMPLETION CHECKLIST

**Phase 1: Stabilization (This Week)**
- [ ] Authentication working across all portals
- [ ] Database connections stable under load
- [ ] WebSocket maintaining persistent connection
- [ ] All demo accounts accessible

**Phase 2: Core Features (Next Week)**
- [ ] NDA workflow complete (request → approve → access)
- [ ] File upload supporting multiple documents
- [ ] Browse tabs properly filtered (Trending vs New)
- [ ] Search and filtering functional

**Phase 3: Production Ready (Week 3)**
- [ ] Error rate < 1%
- [ ] Response time < 500ms (P95)
- [ ] Monitoring alerts configured
- [ ] Documentation updated

---

## 🆘 EMERGENCY CONTACTS

**When You're Stuck:**
1. Check Sentry for error details: https://sentry.io/organizations/pitchey
2. View Worker logs: `wrangler tail --env production`
3. Database status: Neon Dashboard → ep-old-snow-abpr94lc
4. Redis status: Upstash Console → chief-anteater-20186

**Common Error Codes:**
- `401`: Authentication failed - check Better Auth session
- `429`: Rate limited - check Cloudflare WAF rules
- `500`: Server error - check database connections
- `502`: Worker timeout - check for infinite loops
- `503`: Service unavailable - check Cloudflare status

---

## 📝 KEY FILES TO KNOW

```
working-server.ts          # Local proxy server (PORT 8001)
worker-integrated.ts       # Main Cloudflare Worker
src/auth/better-auth-*.ts  # Authentication logic
src/db/schema.ts          # Database schema
frontend/.env             # Local environment vars
wrangler.toml            # Worker configuration
```

---

**Remember:** Every LLM interaction should reference this context. You have the full project understanding - use these guidelines to avoid confusion and maintain consistency.