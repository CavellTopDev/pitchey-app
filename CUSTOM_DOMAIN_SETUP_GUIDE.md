# Custom Domain Configuration Guide for Pitchey

## Overview
This guide walks you through setting up a custom domain (e.g., pitchey.com) for your Pitchey platform on Cloudflare.

## Prerequisites
- Domain registered with any registrar
- Access to domain's DNS settings
- Cloudflare account (cavelltheleaddev@gmail.com)

## Step 1: Add Domain to Cloudflare

### 1.1 Add Site to Cloudflare
```bash
1. Log into Cloudflare Dashboard
2. Click "Add a Site"
3. Enter your domain: pitchey.com
4. Select the Free plan (or upgrade as needed)
5. Cloudflare will scan existing DNS records
```

### 1.2 Update Nameservers
Cloudflare will provide nameservers like:
- ns1.cloudflare.com
- ns2.cloudflare.com

Update these at your domain registrar.

## Step 2: Configure DNS Records

### 2.1 Frontend (Pages) Configuration
```
Type: CNAME
Name: @ (or pitchey.com)
Target: pitchey.pages.dev
Proxy: ON (Orange cloud)
TTL: Auto

Type: CNAME
Name: www
Target: pitchey.pages.dev
Proxy: ON (Orange cloud)
TTL: Auto
```

### 2.2 API Configuration
```
Type: CNAME
Name: api
Target: pitchey-optimized.cavelltheleaddev.workers.dev
Proxy: ON (Orange cloud)
TTL: Auto
```

### 2.3 Alternative Setup (A Records)
If CNAME doesn't work for root domain:
```
Type: A
Name: @
IP: 192.0.2.1 (Cloudflare's IP)
Proxy: ON
```

## Step 3: Configure Pages Custom Domain

### 3.1 Add Custom Domain to Pages
```bash
# Using Wrangler CLI
wrangler pages deployment create-alias \
  --project-name=pitchey \
  --deployment=production \
  --alias=pitchey.com

# Or via Dashboard:
1. Go to Pages > pitchey project
2. Click "Custom domains"
3. Add "pitchey.com" and "www.pitchey.com"
4. Cloudflare will auto-configure SSL
```

### 3.2 Verify Domain Setup
```bash
# Check DNS propagation
dig pitchey.com
dig api.pitchey.com

# Test HTTPS
curl https://pitchey.com
curl https://api.pitchey.com/api/health
```

## Step 4: Update Worker Configuration

### 4.1 Update wrangler.toml
```toml
# Add routes for custom domain
routes = [
  { pattern = "api.pitchey.com/*", zone_name = "pitchey.com" },
  { pattern = "pitchey.com/api/*", zone_name = "pitchey.com" }
]

# Alternative: Use custom domain directly
route = "api.pitchey.com/*"
```

### 4.2 Update CORS Configuration
```typescript
// In worker-platform-fixed.ts or worker-optimized-performance.ts
const ALLOWED_ORIGINS = [
  'https://pitchey.pages.dev',
  'https://pitchey.com',
  'https://www.pitchey.com',
  'http://localhost:5173' // Development
];

// Update CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : 'https://pitchey.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};
```

### 4.3 Deploy Updated Worker
```bash
# Deploy with updated configuration
wrangler deploy --config wrangler-optimized.toml

# Verify deployment
curl https://api.pitchey.com/api/health
```

## Step 5: Update Frontend Configuration

### 5.1 Update Production Environment
```bash
# frontend/.env.production
VITE_API_URL=https://api.pitchey.com
VITE_WS_URL=wss://api.pitchey.com
VITE_APP_URL=https://pitchey.com
```

### 5.2 Rebuild and Deploy Frontend
```bash
# Build with new configuration
cd frontend
npm run build

# Deploy to Pages
wrangler pages deploy dist --project-name=pitchey
```

## Step 6: SSL/TLS Configuration

### 6.1 SSL Mode
In Cloudflare Dashboard:
```
SSL/TLS > Overview > Full (strict)
```

### 6.2 Edge Certificate
Automatically provisioned by Cloudflare:
- Universal SSL certificate
- Covers: pitchey.com, *.pitchey.com
- Auto-renewal enabled

### 6.3 HSTS Configuration
```
SSL/TLS > Edge Certificates > HTTP Strict Transport Security (HSTS)
- Enable HSTS
- Max Age: 31536000 (1 year)
- Include subdomains: ON
- Preload: ON (after testing)
```

## Step 7: Page Rules (Optional)

### 7.1 Force HTTPS
```
Page Rules > Create Page Rule
URL: http://*pitchey.com/*
Setting: Always Use HTTPS
```

### 7.2 Cache Everything for Static Assets
```
URL: *pitchey.com/static/*
Settings: 
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
```

## Step 8: Testing & Validation

### 8.1 DNS Verification
```bash
# Check DNS resolution
nslookup pitchey.com
nslookup api.pitchey.com

# Verify Cloudflare proxy
curl -I https://pitchey.com | grep "cf-ray"
```

### 8.2 SSL Verification
```bash
# Check SSL certificate
openssl s_client -connect pitchey.com:443 -servername pitchey.com

# Test SSL grade
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=pitchey.com
```

### 8.3 API Testing
```bash
# Test health endpoint
curl https://api.pitchey.com/api/health

# Test CORS
curl -H "Origin: https://pitchey.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS https://api.pitchey.com/api/health -v
```

### 8.4 Frontend Testing
```bash
# Test main site
curl -I https://pitchey.com

# Test www redirect
curl -I https://www.pitchey.com

# Check for mixed content
# Open DevTools Console and look for warnings
```

## Step 9: Monitoring Setup

### 9.1 Uptime Monitoring
```bash
# Cloudflare Analytics
1. Analytics > Web Analytics
2. Add site: pitchey.com
3. Get tracking code (optional)

# Health Check Monitoring
1. Create Worker for health checks
2. Schedule every 5 minutes
3. Alert on failures
```

### 9.2 Performance Monitoring
```javascript
// Add to frontend
if (typeof window !== 'undefined' && window.performance) {
  const perf = window.performance.getEntriesByType('navigation')[0];
  console.log('Page Load Time:', perf.loadEventEnd - perf.fetchStart, 'ms');
}
```

## Step 10: Rollback Plan

### If Issues Occur:
```bash
# 1. Revert DNS to original
# Point back to *.pages.dev and *.workers.dev

# 2. Update CORS to allow both
const ALLOWED_ORIGINS = [
  'https://pitchey.pages.dev',
  'https://pitchey.com',
  // Keep both during transition
];

# 3. Update frontend config
# Can use both URLs during transition
```

## Configuration Checklist

- [ ] Domain added to Cloudflare
- [ ] Nameservers updated at registrar
- [ ] DNS records configured (CNAME/A records)
- [ ] Custom domain added to Pages project
- [ ] Worker routes updated in wrangler.toml
- [ ] CORS updated to include custom domain
- [ ] Frontend .env.production updated
- [ ] SSL/TLS set to Full (strict)
- [ ] HSTS enabled
- [ ] Force HTTPS page rule created
- [ ] Health checks passing
- [ ] CORS tests passing
- [ ] SSL certificate valid
- [ ] Frontend loads on custom domain
- [ ] API accessible via custom domain
- [ ] WebSocket connections working

## Troubleshooting

### DNS Not Resolving
- Wait 24-48 hours for propagation
- Verify nameservers are correct
- Check DNS records in Cloudflare

### SSL Errors
- Ensure SSL mode is "Full (strict)"
- Wait for certificate provisioning (up to 24 hours)
- Check domain validation

### CORS Issues
- Verify origin is in ALLOWED_ORIGINS
- Check preflight OPTIONS responses
- Ensure credentials are handled correctly

### 404 Errors
- Check Worker routes configuration
- Verify Pages custom domain setup
- Ensure proper path handling

## Support Resources

- Cloudflare Docs: https://developers.cloudflare.com/pages/platform/custom-domains/
- DNS Checker: https://dnschecker.org/
- SSL Test: https://www.ssllabs.com/ssltest/
- CORS Tester: https://www.test-cors.org/

## Next Steps

After custom domain is configured:
1. Update all documentation with new domain
2. Set up email service with custom domain
3. Configure domain-based email (e.g., support@pitchey.com)
4. Update OAuth redirect URIs if applicable
5. Submit to search engines with new domain