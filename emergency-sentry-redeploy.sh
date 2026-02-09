
#!/bin/bash
# DEPRECATED: This script was written for Deno Deploy. The project now uses Cloudflare Workers (wrangler deploy).
echo "🚨 Emergency Sentry Redeploy"
echo "============================"

echo "🔄 Force redeploying with explicit Sentry configuration..."

DENO_DEPLOY_TOKEN=YOUR_DENO_DEPLOY_TOKEN_HERE \
deployctl deploy \
  --project=pitchey-backend-fresh \
  --entrypoint=working-server.ts \
  --env="SENTRY_DSN=https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536" \
  --env="DENO_ENV=production" \
  --env="NODE_ENV=production" \
  --env="SENTRY_ENVIRONMENT=production" \
  --env="SENTRY_RELEASE=pitchey-backend-v3.7-emergency" \
  --env="CACHE_ENABLED=true" \
  --production \
  --force

echo "✅ Emergency deployment complete. Waiting for propagation..."
sleep 15

echo "🔍 Testing Sentry initialization..."
curl -s "https://pitchey-backend-fresh.deno.dev/api/health" | jq '.telemetry'

echo "🎯 If still failing, the issue may be in the Sentry initialization code itself."
