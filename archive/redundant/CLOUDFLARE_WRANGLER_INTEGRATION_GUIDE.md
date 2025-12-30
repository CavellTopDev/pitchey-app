# Cloudflare Wrangler Integration Guide

## Essential Questions for Understanding Your Setup

### 1. **Current Integration Status**
**Q: Am I connected to the Wrangler API?**
**A: Yes!** Your setup uses Wrangler in two ways:
- **GitHub Actions**: Automated deployment via `cloudflare/wrangler-action@v3`
- **Local CLI**: Direct access via `wrangler` command (after login)

### 2. **Local Development Integration**
**Q: Will localized testing integrate with Cloudflare?**
**A: Absolutely!** Here's your testing workflow:

```bash
# Test Worker locally with production-like environment
wrangler dev

# Test with specific environment
wrangler dev --env production

# Test Pages locally
wrangler pages dev frontend/dist --port 3000

# Test with local KV, R2, D1 bindings
wrangler dev --local --persist
```

### 3. **Authentication & Configuration**
**Q: How do I authenticate locally?**
```bash
# Interactive login (opens browser)
wrangler login

# Or use API token (CI/CD friendly)
export CLOUDFLARE_API_TOKEN="your-token-here"
wrangler whoami
```

### 4. **Development to Production Pipeline**

#### Local Development
```bash
# 1. Start local Worker
wrangler dev

# 2. Test with production bindings
wrangler dev --env production --remote

# 3. Preview deployment
wrangler deploy --dry-run
```

#### Staging Deployment
```bash
# Deploy to staging environment
wrangler deploy --env staging

# Preview URL: https://pitchey-staging.your-subdomain.workers.dev
```

#### Production Deployment
```bash
# Via GitHub Actions (recommended)
git push origin main

# Or manual deployment
wrangler deploy --env production
```

## Key Integration Points

### 1. **Environment Variables**
```toml
# wrangler.toml
[vars]
API_URL = "http://localhost:8001"  # Local
FRONTEND_URL = "http://localhost:5173"

[env.production.vars]
API_URL = "https://pitchey-api-prod.ndlovucavelle.workers.dev"
FRONTEND_URL = "https://pitchey-5o8.pages.dev"
```

### 2. **Secrets Management**
```bash
# Set secrets for production
wrangler secret put JWT_SECRET --env production
wrangler secret put DATABASE_URL --env production

# List secrets
wrangler secret list --env production
```

### 3. **KV Namespace (Cache)**
```bash
# Create KV namespace
wrangler kv:namespace create "CACHE"

# Put data
wrangler kv:key put --binding=CACHE "key" "value"

# Get data
wrangler kv:key get --binding=CACHE "key"
```

### 4. **R2 Storage (Files)**
```bash
# Create R2 bucket
wrangler r2 bucket create pitchey-uploads

# Upload file
wrangler r2 object put pitchey-uploads/test.pdf --file=./test.pdf

# List files
wrangler r2 object list pitchey-uploads
```

### 5. **Durable Objects (WebSocket)**
```bash
# Create Durable Object namespace
wrangler publish --new-class WebSocketRoom

# Tail logs
wrangler tail --format json
```

## Testing Workflows

### 1. **Unit Testing**
```bash
# Test Worker functions
npm test

# Test with Miniflare (local Cloudflare simulator)
npx miniflare --watch
```

### 2. **Integration Testing**
```bash
# Test against staging
ENVIRONMENT=staging npm run test:integration

# Test WebSocket connections
wscat -c wss://pitchey-staging.workers.dev/ws
```

### 3. **Performance Testing**
```bash
# Load test Worker
npx autocannon https://pitchey-staging.workers.dev/api/health -c 100 -d 30

# Monitor performance
wrangler tail --format json | jq '.logs[].message'
```

## Debugging & Monitoring

### 1. **Local Debugging**
```bash
# Start with debugging
wrangler dev --local --inspector

# Connect Chrome DevTools
# Navigate to: chrome://inspect
```

### 2. **Production Logs**
```bash
# Stream live logs
wrangler tail

# Filter logs
wrangler tail --search "error"

# Format as JSON
wrangler tail --format json
```

### 3. **Analytics**
```bash
# View Worker analytics
wrangler analytics --account-id=$CLOUDFLARE_ACCOUNT_ID
```

## Common Commands Reference

```bash
# Authentication
wrangler login                    # Interactive login
wrangler logout                   # Logout
wrangler whoami                   # Check authenticated user

# Development
wrangler init                     # Initialize new Worker
wrangler dev                      # Start local dev server
wrangler dev --remote            # Use remote bindings

# Deployment
wrangler deploy                   # Deploy to production
wrangler deploy --env staging    # Deploy to staging
wrangler deploy --dry-run        # Preview deployment
wrangler rollback                # Rollback to previous version

# Pages
wrangler pages dev ./dist        # Local Pages development
wrangler pages deploy ./dist     # Deploy Pages
wrangler pages project list      # List Pages projects

# Secrets & Variables
wrangler secret put KEY_NAME     # Add secret
wrangler secret delete KEY_NAME  # Remove secret
wrangler secret list             # List secrets

# KV Storage
wrangler kv:namespace create NAME
wrangler kv:key put --binding=KV "key" "value"
wrangler kv:key get --binding=KV "key"
wrangler kv:key list --binding=KV

# R2 Storage
wrangler r2 bucket create BUCKET_NAME
wrangler r2 object put BUCKET/key --file=./file
wrangler r2 object get BUCKET/key
wrangler r2 object list BUCKET

# Monitoring
wrangler tail                    # Stream logs
wrangler tail --search "pattern" # Filter logs
```

## Troubleshooting

### Issue: "Not authenticated"
```bash
wrangler login
# Or set environment variable
export CLOUDFLARE_API_TOKEN="your-token"
```

### Issue: "Cannot find module"
```bash
# Install dependencies
npm install
# Build project
npm run build
```

### Issue: "Deployment failed"
```bash
# Check configuration
wrangler deploy --dry-run

# Validate wrangler.toml
cat wrangler.toml

# Check secrets
wrangler secret list
```

### Issue: "Local dev not working"
```bash
# Use remote bindings
wrangler dev --remote

# Or reset local state
rm -rf .wrangler
wrangler dev --local --persist
```

## Best Practices

1. **Use GitHub Actions for production deployments**
2. **Test locally with `wrangler dev` before pushing**
3. **Use environment-specific configurations in wrangler.toml**
4. **Store secrets in Cloudflare, not in code**
5. **Monitor with `wrangler tail` during debugging**
6. **Use staging environment for testing**
7. **Implement health checks for monitoring**

## Next Steps

1. **Fix the current build error**: Install missing dependency
   ```bash
   npm install @radix-ui/react-switch
   git add package.json package-lock.json
   git commit -m "fix: Add missing @radix-ui/react-switch dependency"
   git push
   ```

2. **Set up local Wrangler**:
   ```bash
   npm install -g wrangler
   wrangler login
   wrangler dev
   ```

3. **Test your Worker locally**:
   ```bash
   # In one terminal
   wrangler dev
   
   # In another terminal
   curl http://localhost:8787/api/health
   ```

4. **Monitor deployment**:
   ```bash
   gh run watch
   wrangler tail
   ```

## Resources

- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Integration](https://github.com/cloudflare/wrangler-action)
- [Local Development Guide](https://developers.cloudflare.com/workers/testing/local-development/)
- [Cloudflare Workers Examples](https://developers.cloudflare.com/workers/examples/)