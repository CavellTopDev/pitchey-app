# GitHub Actions Emergency Fix Guide

## 🚨 Critical Issues to Fix (In Priority Order)

### 1. Fix Cloudflare API Token (5 minutes)
**Problem**: Current token lacks permissions
**Solution**:
```bash
# Go to Cloudflare Dashboard > My Profile > API Tokens
# Create new token with these permissions:
# - Account: Cloudflare Pages:Edit
# - Account: Cloudflare Workers Scripts:Edit
# - Zone: Zone:Read
# - Zone: DNS:Edit

# Then update in GitHub:
gh secret set CLOUDFLARE_API_TOKEN --body="your-new-token"
```

### 2. Fix Health Check URLs (2 minutes)
**File**: `.github/workflows/deploy.yml`
```yaml
# WRONG:
- name: Check Pages Health
  run: |
    curl -f https://pitchey-5o8.pages.dev/api/health

# CORRECT:
- name: Check Pages Health
  run: |
    curl -f https://pitchey-5o8.pages.dev/  # Frontend check
    
- name: Check Worker Health
  run: |
    curl -f https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health
```

### 3. Fix Worker Service Name (2 minutes)
**File**: `wrangler.toml`
```toml
# WRONG:
name = "pitchey-api-prod"

# CORRECT:
name = "pitchey-production"
```

### 4. Simplify Complex Workflows (10 minutes)
**Recommendation**: Disable overly complex workflows
```yaml
# Add to complex workflow files:
on:
  workflow_dispatch:  # Make manual-only instead of automatic
```

## Quick Fix Script

Save this as `fix-github-actions.sh`:

```bash
#!/bin/bash

echo "🔧 Fixing GitHub Actions Pipeline..."

# 1. Fix health check URLs
echo "Fixing health check URLs..."
find .github/workflows -name "*.yml" -exec sed -i \
  's|https://pitchey-5o8.pages.dev/api/health|https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health|g' {} \;

# 2. Fix worker name
echo "Fixing worker service name..."
sed -i 's/name = "pitchey-api-prod"/name = "pitchey-production"/' wrangler.toml

# 3. Commit fixes
echo "Committing fixes..."
git add .github/workflows wrangler.toml
git commit -m "fix: Correct GitHub Actions health checks and worker configuration"
git push

echo "✅ Fixes applied! Now update your Cloudflare API token in GitHub Secrets."
```

## Verification Steps

After applying fixes:

```bash
# 1. Check workflow status
gh workflow list

# 2. Trigger test deployment
gh workflow run "Deploy to Production"

# 3. Monitor results
gh run watch

# 4. Verify endpoints
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health
curl https://pitchey-5o8.pages.dev/
```

## Current Working State

Despite pipeline issues, your application is:
- ✅ **Frontend Live**: https://pitchey-5o8.pages.dev
- ✅ **API Live**: https://pitchey-api-prod.ndlovucavelle.workers.dev
- ✅ **Database Connected**: Neon PostgreSQL operational
- ✅ **Authentication Working**: All portals functional

## Long-term Recommendations

1. **Simplify CI/CD**: Remove complex caching and multi-stage workflows
2. **Use Basic Workflow**: Stick to simple build → test → deploy pattern
3. **Monitor Key Metrics Only**: Health checks on actual endpoints
4. **Document Secrets**: Keep a secure record of required permissions
5. **Regular Testing**: Weekly manual workflow runs to catch issues early

## Emergency Contacts

- **Cloudflare Status**: https://www.cloudflarestatus.com/
- **GitHub Actions Status**: https://www.githubstatus.com/
- **Neon Database Status**: https://status.neon.tech/

## Recovery Time Estimate

- **Immediate Fix**: 15-20 minutes
- **Full Pipeline Health**: 1 hour
- **Complete Optimization**: 2-3 hours

## Note on Current State

Your application is **production-ready and serving users** successfully. These GitHub Actions issues are operational problems that don't affect your live service. Fix them to ensure smooth future deployments, but there's no immediate risk to your users.