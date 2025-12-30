# Cloudflare Security Configuration Guide

## 🌐 Overview

This guide provides step-by-step instructions for configuring Cloudflare security settings for the Pitchey platform production deployment. These configurations complement the Worker-level security measures.

## 🔐 Required Dashboard Configurations

### 1. SSL/TLS Settings

**Location:** SSL/TLS > Overview

```
Encryption Mode: Full (strict)
✅ Always Use HTTPS: ON
✅ HTTP Strict Transport Security (HSTS): Enable
  - Max Age Header: 6 months
  - Include Subdomains: ON  
  - Preload: ON
  - No-Sniff Header: ON
```

**Edge Certificates:**
```
✅ Always Use HTTPS: ON
✅ Automatic HTTPS Rewrites: ON
✅ Opportunistic Encryption: ON
```

### 2. Security Settings

**Location:** Security > Settings

```
Security Level: Medium (or High for extra protection)
Challenge Passage: 30 minutes
Browser Integrity Check: ON
Privacy Pass Support: ON
```

**Bot Fight Mode:**
```
✅ Bot Fight Mode: ON
Static Resource Protection: ON
```

### 3. Firewall Rules

**Location:** Security > WAF

**Custom Rules to Add:**

#### Rule 1: Block Suspicious User Agents
```
Rule Name: Block Bad Bots
Expression: (http.user_agent contains "sqlmap") or 
           (http.user_agent contains "nikto") or
           (http.user_agent contains "nessus")
Action: Block
```

#### Rule 2: Protect Admin Endpoints  
```
Rule Name: Admin Protection
Expression: http.request.uri.path matches "^/api/admin/"
Action: JS Challenge (or Block if not needed)
```

#### Rule 3: API Rate Limiting Backup
```
Rule Name: API Protection
Expression: http.request.uri.path matches "^/api/" and 
           (cf.threat_score gt 10)
Action: Challenge
```

#### Rule 4: Geographic Restrictions (Optional)
```
Rule Name: Geographic Blocking
Expression: ip.geoip.country in {"CN" "RU" "KP"}
Action: Block
Note: Only if business doesn't serve these regions
```

### 4. Page Rules (if using custom domain)

**Location:** Rules > Page Rules

#### Force HTTPS
```
URL Pattern: http://*pitchey.com/*
Settings: Always Use HTTPS
```

#### API Caching
```
URL Pattern: *pitchey.com/api/pitches/public*
Settings:
  - Cache Level: Standard
  - Edge Cache TTL: 5 minutes
  - Browser Cache TTL: 1 hour
```

### 5. Workers Configuration

**Location:** Workers & Pages > Overview

**Custom Domain Setup:**
```
1. Add custom domain (e.g., api.pitchey.com)
2. Route pattern: api.pitchey.com/*
3. Worker: pitchey-production-secure
4. Environment: production
```

### 6. Analytics & Logs

**Location:** Analytics & Logs

**Web Analytics:**
```
✅ Enable Web Analytics
Privacy Mode: ON (GDPR compliant)
```

**Logpush (Enterprise):**
```
Destination: Configure external log service
Fields: All security and performance fields
```

### 7. Network Settings

**Location:** Network

```
✅ HTTP/3 (with QUIC): ON
✅ 0-RTT Connection Resumption: ON  
✅ IPv6 Compatibility: ON
✅ Pseudo IPv4: Add header
✅ WebSockets: ON
✅ gRPC: OFF (not used)
```

### 8. DDoS Protection

**Location:** Security > DDoS

```
✅ HTTP DDoS Attack Protection: ON
✅ Layer 3/4 DDoS Attack Protection: ON

Sensitivity: Standard
(Increase if experiencing false positives)
```

### 9. Rate Limiting (Pro/Enterprise)

**Location:** Security > Rate Limiting

**If available, create these rules:**

#### API Rate Limiting
```
Rule Name: API Rate Limit
Match: api.pitchey.com/api/*
Rate: 100 requests per minute
Action: Block for 60 seconds
```

#### Auth Rate Limiting  
```
Rule Name: Auth Rate Limit
Match: api.pitchey.com/api/auth/*
Rate: 10 requests per minute  
Action: Block for 300 seconds
```

### 10. Transform Rules

**Location:** Rules > Transform Rules

#### Security Headers (Additional)
```
Rule Name: Additional Security Headers
Match: hostname eq "api.pitchey.com"
Add Headers:
  - X-Robots-Tag: noindex
  - X-Content-Type-Options: nosniff
```

## 🚀 Worker-Specific Configurations

### Environment Variables

**Location:** Workers & Pages > pitchey-production-secure > Settings

```
JWT_SECRET: [Generate new secure secret - 64+ characters]
ENVIRONMENT: production
API_VERSION: v1.0-secure
```

### KV Namespace Bindings

```
Binding Name: KV
Namespace ID: 98c88a185eb448e4868fcc87e458b3ac
```

### R2 Bucket Bindings

```
Binding Name: R2_BUCKET  
Bucket Name: pitchey-uploads
```

### Cron Triggers

```
✅ */2 * * * * - Health checks
✅ */5 * * * * - Security metrics  
✅ */15 * * * * - Cache cleanup
✅ 0 * * * * - Analytics aggregation
✅ 0 0 * * * - Daily security reports
```

## 📊 Monitoring Setup

### 1. Real User Monitoring (RUM)

**Location:** Speed > Optimization

```
✅ Enable RUM
Track: Page loads, API calls, errors
Privacy: Respect Do Not Track
```

### 2. GraphQL Analytics API

**Setup external monitoring:**

```bash
# Example query for security metrics
curl -X POST \
  https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { viewer { zones(filter: {zoneTag: $zoneId}) { firewallEventsAdaptive(limit: 10) { action source } } } }",
    "variables": {"zoneId": "your-zone-id"}
  }'
```

### 3. Webhook Notifications

**Setup webhook for security alerts:**

```
Webhook URL: https://your-monitoring-service.com/webhook
Events:
  - ddos_attack_l7
  - waf_rule_match  
  - rate_limit_exceeded
  - bot_management_action
```

## 🔧 Testing Configuration

### 1. Security Header Test

```bash
# Test security headers
curl -I https://api.pitchey.com/api/health

# Should show:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Content-Security-Policy: ...
```

### 2. SSL Configuration Test

```bash
# Test SSL configuration
openssl s_client -connect api.pitchey.com:443 -servername api.pitchey.com

# Use online tools:
# - SSL Labs SSL Test: ssllabs.com/ssltest/
# - Security Headers: securityheaders.com
```

### 3. Rate Limiting Test

```bash
# Test rate limiting
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://api.pitchey.com/api/auth/creator/login
done

# Should show rate limiting after configured threshold
```

## 📈 Performance Impact

### Expected Performance Improvements:
- **SSL/TLS:** ~2-5ms additional latency
- **Caching:** 90%+ cache hit ratio for static content  
- **Compression:** 60-80% size reduction
- **HTTP/3:** 10-20% faster connection establishment

### Monitoring KPIs:
- **Response Time:** Target <200ms for API calls
- **Cache Hit Ratio:** Target >90% for public content
- **Error Rate:** Target <0.1%
- **Security Events:** Monitor and investigate all events

## ⚠️ Troubleshooting

### Common Issues:

#### CORS Errors
```
Issue: CORS policy blocking requests
Solution: Check ALLOWED_ORIGINS in worker code
Verify: Origin header matches allowed origins
```

#### Rate Limiting False Positives  
```
Issue: Legitimate users getting rate limited
Solution: Adjust RATE_LIMITS constants in worker
Monitor: Check /api/monitoring/status for patterns
```

#### SSL Certificate Issues
```
Issue: SSL certificate warnings
Solution: Verify Full (strict) mode is enabled
Check: Certificate is not expired in SSL/TLS tab
```

#### Bot Protection Blocking Users
```
Issue: Legitimate users getting challenges
Solution: Lower security level or add bypass rules
Monitor: Bot management events in Security Events
```

## 📞 Support Escalation

### Critical Issues (Production Down):
1. Check Cloudflare Status Page
2. Disable security features temporarily if needed
3. Contact Cloudflare support with account details
4. Monitor social media for widespread issues

### Non-Critical Issues:
1. Check configuration against this guide
2. Review security event logs
3. Test with curl/Postman to isolate issues
4. Adjust settings incrementally

## 🔄 Regular Maintenance

### Daily:
- [ ] Check security event dashboard
- [ ] Monitor error rates and response times
- [ ] Review rate limiting metrics

### Weekly:  
- [ ] Review security event patterns
- [ ] Check SSL certificate expiration
- [ ] Update security rules if needed

### Monthly:
- [ ] Review and update firewall rules
- [ ] Analyze traffic patterns for optimization
- [ ] Update rate limiting thresholds if needed

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Account ID:** e16d3bf549153de23459a6c6a06a431b  
**Zone ID:** [Your zone ID here]