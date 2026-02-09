@echo off

# Production Sentry Fix Deployment Script
# Fixes telemetry initialization issues

set -e

echo "🔧 Deploying Sentry Production Fix..."

# 1. Deploy backend with correct environment variables
echo "📡 Deploying Deno Deploy backend with production config..."

DENO_DEPLOY_TOKEN="${DENO_DEPLOY_TOKEN:-$DENO_DEPLOY_TOKEN}"
SENTRY_DSN="https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536"

deno run --allow-all --no-check https://deno.land/x/deploy@1.12.0/deployctl.ts deploy \
  --project=pitchey-backend-fresh \
  --entrypoint=working-server.ts \
  --env="SENTRY_DSN=$SENTRY_DSN" \
  --env="DENO_ENV=production" \
  --env="NODE_ENV=production" \
  --env="SENTRY_ENVIRONMENT=production" \
  --env="SENTRY_RELEASE=pitchey-backend-v3.4" \
  --env="DATABASE_URL=${DATABASE_URL}" \
  --env="JWT_SECRET=${JWT_SECRET}" \
  --env="FRONTEND_URL=https://pitchey-5o8.pages.dev" \
  --env="UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}" \
  --env="UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}" \
  --env="CACHE_ENABLED=true" \
  --production

echo "✅ Backend deployed successfully!"

# 2. Test telemetry initialization
echo "🧪 Testing telemetry initialization..."

sleep 10

HEALTH_RESPONSE=$(curl -s https://pitchey-backend-fresh.deno.dev/api/health)
echo "Health response: $HEALTH_RESPONSE"

# Check if telemetry is now initialized
if echo "$HEALTH_RESPONSE" | grep -q '"initialized":true'; then
  echo "✅ Telemetry successfully initialized!"
else
  echo "❌ Telemetry still not initialized"
  echo "Response: $HEALTH_RESPONSE"
  exit 1
fi

# 3. Send test error to validate Sentry
echo "📤 Sending test error to Sentry..."

TEST_RESPONSE=$(curl -s -X POST "https://pitchey-backend-fresh.deno.dev/api/test-telemetry-error" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' || echo "Test endpoint not available")

echo "Test error sent: $TEST_RESPONSE"

echo "🎉 Sentry production fix deployment completed!"
echo ""
echo "📊 Next steps:"
echo "1. Check Sentry dashboard for incoming events"
echo "2. Verify telemetry health at: https://pitchey-backend-fresh.deno.dev/api/health"
echo "3. Monitor error tracking in production"
