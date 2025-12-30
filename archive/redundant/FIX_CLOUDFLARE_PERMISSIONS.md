# Fix Cloudflare API Token Permissions

## The Problem
The current `CLOUDFLARE_API_TOKEN` secret doesn't have permission to deploy Workers. The error shows:
```
Authentication error [code: 10000]
A request to the Cloudflare API (/accounts/***/workers/services/pitchey-optimized) failed.
```

## Solution: Create New API Token with Correct Permissions

### Step 1: Create New Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use **"Custom token"** template (not the limited Worker template)

### Step 2: Configure Token Permissions

Set these exact permissions:

**Account Permissions:**
- `Account:Cloudflare Workers Scripts:Edit` ✅
- `Account:Worker Scripts:Edit` ✅ 
- `Account:Workers KV Storage:Edit` ✅
- `Account:Workers R2 Storage:Edit` (if using R2)

**Zone Permissions:**
- `Zone:Worker Routes:Edit` ✅
- `Zone:Page Rules:Read` (optional)

### Step 3: Configure Token Resources

- **Account Resources**: Select your specific account or "All accounts"
- **Zone Resources**: Select "All zones" or your specific zone

### Step 4: Additional Settings

- **IP Address Filtering**: Leave blank (GitHub Actions uses various IPs)
- **TTL**: Set to "No expiry" or at least 1 year

### Step 5: Create and Copy Token

1. Click **"Continue to summary"**
2. Click **"Create Token"**
3. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### Step 6: Update GitHub Secret

Using GitHub CLI:
```bash
gh secret set CLOUDFLARE_API_TOKEN
# Paste your new token when prompted
```

Or via GitHub UI:
1. Go to your repo: https://github.com/CavellTopDev/pitchey-app
2. Settings → Secrets and variables → Actions
3. Find `CLOUDFLARE_API_TOKEN` and click "Update"
4. Paste the new token

### Step 7: Verify Required Secrets

Make sure all these secrets are set:
```bash
gh secret list
```

Required secrets:
- `CLOUDFLARE_API_TOKEN` (with correct permissions)
- `CLOUDFLARE_ACCOUNT_ID` (your account ID)
- `JWT_SECRET` 
- `DATABASE_URL` or `NEON_DATABASE_URL`
- `SENTRY_DSN` (optional but recommended)
- `UPSTASH_REDIS_REST_URL` (optional)
- `UPSTASH_REDIS_REST_TOKEN` (optional)

## Quick Test

After updating the token, trigger the deployment:
```bash
# Manually trigger the workflow
gh workflow run deploy-worker-npx.yml

# Watch the run
gh run watch
```

## Alternative: Use Wrangler Login

If you have issues with API tokens, you can use OAuth login instead:

1. Run locally:
```bash
npx wrangler login
```

2. This opens a browser for authentication
3. After login, check your config:
```bash
cat ~/.wrangler/config.json
```

4. Use the OAuth token from there

## Common Issues

### "Authentication error [code: 10000]"
- Token doesn't have Worker permissions
- Solution: Create new token with permissions above

### "Workers.dev subdomain not configured"
- Need to set up workers.dev subdomain first
- Solution: Run `npx wrangler subdomain` locally

### "Script not found"
- Worker name mismatch
- Solution: Check wrangler.toml for correct name

## The Permissions You're Missing

Based on the error, your token is missing:
- ✅ `Account:Cloudflare Workers Scripts:Edit`
- ✅ `Account:Worker Scripts:Edit`

The default "Edit Cloudflare Workers" template is too limited. You need a custom token with the full permissions listed above.