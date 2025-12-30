# 🚀 Running the Database Connection Pipeline - Step by Step

This guide walks you through setting up and running the complete database connection pipeline from GitHub → Cloudflare → Neon.

## Prerequisites Verification

First, run this command to check all tools are installed:

```bash
# Check prerequisites
echo "Checking wrangler..." && wrangler --version
echo "Checking GitHub CLI..." && gh --version
echo "Checking Node.js..." && node --version
echo "Checking OpenSSL..." && openssl version
```

If any are missing:
- Wrangler: `npm install -g wrangler`
- GitHub CLI: `brew install gh` (macOS) or check https://cli.github.com
- OpenSSL: Usually pre-installed on Linux/macOS

---

## Step 1: Get Your Neon Database URL

1. Go to https://console.neon.tech
2. Select your project (or create one)
3. Go to "Connection Details"
4. **IMPORTANT**: Use the "Pooled connection" string (not Direct)
5. Copy the connection string - it looks like:
   ```
   postgresql://neondb_owner:YOUR_PASSWORD@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

## Step 2: Get Your Cloudflare Credentials

1. **API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use template "Custom token"
   - Permissions needed:
     - Account: Cloudflare Workers Scripts:Edit
     - Account: Account Settings:Read
     - Zone: Zone:Read
   - Create token and copy it

2. **Account ID**:
   - Go to any domain in your Cloudflare dashboard
   - Right sidebar shows Account ID
   - Copy it (looks like: `e16d3bf549153de23459a6c6a06a431b`)

---

## Step 3: Set Environment Variables

Run these commands with YOUR actual values:

```bash
# Set your Neon database URL
export DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Set your Cloudflare API token
export CLOUDFLARE_API_TOKEN="YOUR_TOKEN_HERE"

# Set your Cloudflare Account ID  
export CLOUDFLARE_ACCOUNT_ID="YOUR_ACCOUNT_ID_HERE"

# Verify they're set
echo "DATABASE_URL length: ${#DATABASE_URL}"
echo "CLOUDFLARE_API_TOKEN length: ${#CLOUDFLARE_API_TOKEN}"
echo "CLOUDFLARE_ACCOUNT_ID: $CLOUDFLARE_ACCOUNT_ID"
```

---

## Step 4: Authenticate with GitHub

```bash
# Check if you're authenticated
gh auth status

# If not authenticated, login:
gh auth login
# Choose: GitHub.com → HTTPS → Authenticate with browser
```

---

## Step 5: Configure GitHub Secrets

Run these commands one by one:

```bash
# Navigate to your project
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# Set database URL secret
echo "$DATABASE_URL" | gh secret set NEON_DATABASE_URL

# Set Cloudflare API token
echo "$CLOUDFLARE_API_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN

# Set Cloudflare Account ID
echo "$CLOUDFLARE_ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID

# Generate and set JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "Generated JWT Secret: $JWT_SECRET"
echo "$JWT_SECRET" | gh secret set JWT_SECRET

# Optional: Set Sentry DSN if you have one
# echo "YOUR_SENTRY_DSN" | gh secret set SENTRY_DSN

# Optional: Set Upstash Redis credentials if you have them
# echo "YOUR_REDIS_URL" | gh secret set UPSTASH_REDIS_REST_URL
# echo "YOUR_REDIS_TOKEN" | gh secret set UPSTASH_REDIS_REST_TOKEN

# Verify all secrets are set
gh secret list
```

---

## Step 6: Configure Hyperdrive (Optional but Recommended)

Hyperdrive provides connection pooling at the edge:

```bash
# Navigate to worker directory
cd frontend/worker

# Create Hyperdrive configuration
wrangler hyperdrive create pitchey-db \
  --connection-string "$DATABASE_URL" \
  --max-idle-connections 10 \
  --max-connections 25

# This will output a Hyperdrive ID - SAVE IT!
# Example output: "Created Hyperdrive config with ID: abc123..."

# Set the Hyperdrive ID as a GitHub secret
echo "YOUR_HYPERDRIVE_ID" | gh secret set HYPERDRIVE_CONFIG_ID
```

---

## Step 7: Test Database Connection Locally

```bash
# Stay in the worker directory
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2/frontend/worker

# Test with wrangler dev
wrangler dev --local --env production

# In another terminal, test the endpoints:
curl http://localhost:8787/api/test
curl http://localhost:8787/api/test-db
```

Press `Ctrl+C` to stop the local server.

---

## Step 8: Deploy Using GitHub Actions

```bash
# Go back to project root
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# Trigger the deployment workflow
gh workflow run deploy-worker.yml \
  -f environment=production \
  -f debug_enabled=true

# Watch the deployment progress
gh run watch

# Or check the latest run
gh run list --workflow=deploy-worker.yml --limit=1
```

---

## Step 9: Verify Production Deployment

```bash
# Test the production endpoints
echo "Testing health endpoint..."
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/test

echo -e "\nTesting database connection..."
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/test-db

echo -e "\nTesting browse endpoint..."
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/pitches/browse
```

---

## Step 10: Monitor Production Logs

```bash
# Stream live logs from your worker
wrangler tail pitchey-production --format pretty

# Or get last 100 logs
wrangler tail pitchey-production --once --limit 100

# Filter for errors only
wrangler tail pitchey-production --status 500
```

---

## Troubleshooting

### If deployment fails:

1. **Check GitHub Actions logs**:
   ```bash
   gh run view
   ```

2. **Check secrets are set correctly**:
   ```bash
   gh secret list
   ```

3. **Test database connection directly**:
   ```bash
   # Install psql if needed: sudo apt install postgresql-client
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

4. **Check Cloudflare authentication**:
   ```bash
   wrangler whoami
   ```

### Common Issues:

- **"password authentication failed"**: Check your DATABASE_URL is correct and using the pooled connection string
- **"Cloudflare API error"**: Verify your API token has the correct permissions
- **"GitHub secret not found"**: Re-run the secret setup commands above

---

## Quick Command Reference

```bash
# Deploy directly (bypasses GitHub Actions)
cd frontend/worker
wrangler deploy --env production

# Check deployment status
wrangler deployments list

# View worker metrics
wrangler tail pitchey-production --format pretty

# Run GitHub Actions workflow
gh workflow run deploy-worker.yml

# Check workflow status
gh run list --workflow=deploy-worker.yml

# View secrets (names only, not values)
gh secret list
```

---

## Next Steps

Once deployed successfully:

1. **Set up monitoring**: Check Cloudflare Analytics dashboard
2. **Configure alerts**: Set up Sentry for error tracking
3. **Test all endpoints**: Run comprehensive tests
4. **Set up backup**: Configure regular database backups

---

## Support

If you encounter issues:
1. Check the logs: `wrangler tail pitchey-production`
2. Review GitHub Actions: `gh run view`
3. Verify environment variables are set correctly
4. Check the documentation in `/docs/DATABASE_CONNECTION_SETUP.md`

---

*Last tested: December 2024*
*Worker URL: https://pitchey-api-prod.ndlovucavelle.workers.dev*