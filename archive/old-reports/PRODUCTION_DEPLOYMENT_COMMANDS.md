# Production Deployment Commands

## 🚀 Quick Deployment

### 1. Security-Hardened Worker Deployment
```bash
# Deploy with security configurations
wrangler deploy --config wrangler-production-secure.toml

# Or use the automated script
./deploy-production-secure.sh
```

### 2. Frontend Deployment
```bash
cd frontend

# Build for production
npm run build

# Deploy to Cloudflare Pages  
wrangler pages deploy dist --project-name=pitchey
```

## 📊 Verification Commands

### Health Check
```bash
# Test worker health
curl https://pitchey-production-secure.ndlovucavelle.workers.dev/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-12-02T...",
  "version": "production-v1.0-security",
  "services": {
    "cache": true,
    "database": false,
    "websocket": true,
    "storage": true
  }
}
```

### Security Headers Test
```bash
# Check security headers
curl -I https://pitchey-production-secure.ndlovucavelle.workers.dev/api/health

# Should include:
# strict-transport-security: max-age=31536000; includeSubDomains; preload
# x-content-type-options: nosniff
# x-frame-options: DENY
# content-security-policy: default-src 'self'; ...
```

### Rate Limiting Test
```bash
# Test auth endpoint rate limiting (should block after 5 attempts)
for i in {1..6}; do
  echo "Attempt $i:"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    https://pitchey-production-secure.ndlovucavelle.workers.dev/api/auth/creator/login \
    -X POST -H "Content-Type: application/json" -d '{}'
done

# Expected: First 5 attempts return 401, 6th returns 429
```

### CORS Test
```bash
# Test CORS with allowed origin
curl -s -I \
  -H "Origin: https://pitchey-5o8.pages.dev" \
  https://pitchey-production-secure.ndlovucavelle.workers.dev/api/health

# Should include: access-control-allow-origin: https://pitchey-5o8.pages.dev

# Test CORS with disallowed origin
curl -s -I \
  -H "Origin: https://evil-site.com" \
  https://pitchey-production-secure.ndlovucavelle.workers.dev/api/health

# Should include: access-control-allow-origin: https://pitchey-5o8.pages.dev (not evil-site.com)
```

### Monitoring Endpoints
```bash
# Check monitoring status (requires auth in production)
curl https://pitchey-production-secure.ndlovucavelle.workers.dev/api/monitoring/status

# Check metrics (admin only)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://pitchey-production-secure.ndlovucavelle.workers.dev/api/metrics
```

## 🔧 Environment Configuration

### Update Frontend Environment
```bash
# Update frontend/.env.production
cat > frontend/.env.production << EOF
VITE_API_URL=https://pitchey-production-secure.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-production-secure.ndlovucavelle.workers.dev
VITE_NODE_ENV=production
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_WEBSOCKETS=true
VITE_ENABLE_PUSH_NOTIFICATIONS=false
VITE_CORS_ENABLED=true
VITE_SECURE_COOKIES=true
EOF
```

### Wrangler Configuration Management
```bash
# List current deployments
wrangler deployments list --name pitchey-production-secure

# View environment variables
wrangler secret list --name pitchey-production-secure

# Update JWT secret (if needed)
wrangler secret put JWT_SECRET --name pitchey-production-secure
```

## 📈 Production Monitoring Commands

### Real-time Logs
```bash
# Stream worker logs
wrangler tail --name pitchey-production-secure

# Filter for errors
wrangler tail --name pitchey-production-secure --format json | jq 'select(.level == "error")'

# Filter for security events
wrangler tail --name pitchey-production-secure --format json | jq 'select(.message | contains("security"))'
```

### Performance Monitoring
```bash
# Get analytics data
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/analytics/dashboard" \
  -G --data-urlencode "since=2024-12-01T00:00:00Z"
```

### KV Storage Management
```bash
# List KV keys for debugging
wrangler kv:key list --binding=KV

# Check cache entries
wrangler kv:key get "pitches:public:limit10" --binding=KV

# Check rate limit entries
wrangler kv:key list --binding=KV --prefix="rate_limit:"

# Check security events
wrangler kv:key list --binding=KV --prefix="security_events_"
```

## 🚨 Emergency Commands

### Rollback Deployment
```bash
# List previous deployments
wrangler deployments list --name pitchey-production-secure

# Rollback to previous version
wrangler rollback --name pitchey-production-secure [DEPLOYMENT_ID]
```

### Temporary Security Bypass
```bash
# If rate limiting is blocking legitimate traffic, temporarily increase limits
# Edit src/worker-platform-fixed.ts and update RATE_LIMITS constants
# Then redeploy:
wrangler deploy --config wrangler-production-secure.toml
```

### Clear KV Cache (Emergency)
```bash
# Clear all cache entries (emergency only)
wrangler kv:key list --binding=KV | grep "cache:" | while read key; do
  wrangler kv:key delete "$key" --binding=KV
done
```

### Block Malicious IP
```bash
# Add IP to temporary blocklist (implement in worker first)
wrangler kv:key put "ip_blocklist:MALICIOUS_IP" "blocked" --binding=KV --ttl=3600
```

## 📊 Performance Benchmarking

### Load Testing
```bash
# Install wrk or use existing tool
# Test API performance
wrk -t12 -c400 -d30s --latency \
  https://pitchey-production-secure.ndlovucavelle.workers.dev/api/health

# Test with authentication
wrk -t12 -c400 -d30s --latency \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://pitchey-production-secure.ndlovucavelle.workers.dev/api/pitches/public
```

### Security Scanning
```bash
# Use nmap for basic security scanning
nmap -sS -O pitchey-production-secure.ndlovucavelle.workers.dev

# Use curl to test for common vulnerabilities
curl -X POST https://pitchey-production-secure.ndlovucavelle.workers.dev/api/test \
  -d "'; DROP TABLE users; --"
# Should be blocked by input validation
```

## 🔍 Debugging Commands

### SSL Certificate Check
```bash
# Check SSL certificate details
echo | openssl s_client -connect pitchey-production-secure.ndlovucavelle.workers.dev:443 -servername pitchey-production-secure.ndlovucavelle.workers.dev 2>/dev/null | openssl x509 -noout -dates
```

### DNS Resolution
```bash
# Check DNS resolution
dig pitchey-production-secure.ndlovucavelle.workers.dev
nslookup pitchey-production-secure.ndlovucavelle.workers.dev
```

### Network Connectivity
```bash
# Test network connectivity
traceroute pitchey-production-secure.ndlovucavelle.workers.dev
ping pitchey-production-secure.ndlovucavelle.workers.dev
```

## 📋 Pre-deployment Checklist

```bash
# Run this before any production deployment
echo "🔍 Pre-deployment Security Check"

# 1. Check for sensitive data in code
grep -r "password\|secret\|key" src/ --exclude-dir=node_modules | grep -v "JWT_SECRET"

# 2. Validate wrangler.toml
wrangler validate --config wrangler-production-secure.toml

# 3. Test worker locally first
wrangler dev --config wrangler-production-secure.toml --local

# 4. Check environment variables
wrangler secret list --name pitchey-production-secure

# 5. Verify KV and R2 bindings
wrangler kv:namespace list
wrangler r2 bucket list

echo "✅ Pre-deployment check complete"
```

## 📞 Support Information

### Cloudflare Support
- **Dashboard:** https://dash.cloudflare.com/
- **Support:** https://support.cloudflare.com/
- **Status:** https://www.cloudflarestatus.com/

### Wrangler CLI Help
```bash
# Get help for any command
wrangler --help
wrangler deploy --help
wrangler kv --help

# Update wrangler to latest version
npm update -g wrangler
```

### Documentation Links
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Security Best Practices](https://developers.cloudflare.com/workers/learning/security-practices/)

---

**Last Updated:** December 2024  
**Worker URL:** https://pitchey-production-secure.ndlovucavelle.workers.dev  
**Frontend URL:** https://pitchey-5o8.pages.dev