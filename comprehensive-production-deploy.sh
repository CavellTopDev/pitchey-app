#!/bin/bash
echo "🚀 COMPREHENSIVE PRODUCTION DEPLOYMENT"
echo "====================================="
echo ""

echo "🔧 Deploying with comprehensive fixes:"
echo "   ✅ Enhanced Sentry telemetry initialization"
echo "   🔒 Removed exposed database test endpoint"
echo "   📊 Enhanced health reporting"
echo ""

# Deploy with all environment variables explicitly set
DENO_DEPLOY_TOKEN=ddp_0xCz7itR2p7NIjymyodtIOI3wfjS2n0LB8oH \
deployctl deploy \
  --project=pitchey-backend-fresh \
  --entrypoint=working-server.ts \
  --env="SENTRY_DSN=https://fd5664ae577039ccb7cce31e91f54533@o4510137537396736.ingest.de.sentry.io/4510138308755536" \
  --env="DENO_ENV=production" \
  --env="NODE_ENV=production" \
  --env="SENTRY_ENVIRONMENT=production" \
  --env="SENTRY_RELEASE=pitchey-backend-v3.8-comprehensive-fix" \
  --env="SENTRY_SERVER_NAME=pitchey-backend-fresh.deno.dev" \
  --env="CACHE_ENABLED=true" \
  --env="DATABASE_URL=$DATABASE_URL" \
  --env="JWT_SECRET=$JWT_SECRET" \
  --env="UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL" \
  --env="UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN" \
  --env="FRONTEND_URL=https://pitchey-5o8.pages.dev" \
  --production \
  --force

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔍 Testing deployment in 20 seconds..."
sleep 20

echo "📊 Testing Sentry initialization:"
curl -s "https://pitchey-backend-fresh.deno.dev/api/health" | jq '.telemetry'

echo ""
echo "🔒 Verifying security fix (should return 404):"
curl -s -w "Status: %{http_code}\n" "https://pitchey-backend-fresh.deno.dev/api/db-test" -o /dev/null

echo ""
echo "✅ Comprehensive production fix deployment complete!"
echo "🎯 Production URLs:"
echo "   Frontend: https://pitchey-5o8.pages.dev"
echo "   Backend:  https://pitchey-backend-fresh.deno.dev"
echo "   Health:   https://pitchey-backend-fresh.deno.dev/api/health"
