#!/bin/bash
# DEPRECATED: This script was written for Deno Deploy. The project now uses Cloudflare Workers (wrangler deploy).

# Fix Production Deployment - Deploy with correct environment variables
# This script redeploys the backend with all required environment variables

set -e

echo "🔧 FIXING PRODUCTION DEPLOYMENT"
echo "=" | tr ' ' '='  | head -c 50 && echo ""

# Validate required environment variables are set
required_vars=(
  "JWT_SECRET" 
  "DATABASE_URL" 
  "SENTRY_DSN"
  "DENO_DEPLOY_TOKEN"
)

echo "📋 Checking required environment variables..."
missing_vars=()

for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    missing_vars+=("$var")
    echo "   ❌ $var: MISSING"
  else
    echo "   ✅ $var: SET"
  fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
  echo ""
  echo "❌ Missing required environment variables:"
  for var in "${missing_vars[@]}"; do
    echo "   - $var"
  done
  echo ""
  echo "Please set these variables and try again:"
  for var in "${missing_vars[@]}"; do
    echo "   export $var=\"your-$var-value\""
  done
  exit 1
fi

# Optional variables with defaults or warnings
echo ""
echo "📋 Checking optional environment variables..."
if [[ -z "$UPSTASH_REDIS_REST_URL" ]]; then
  echo "   ⚠️  UPSTASH_REDIS_REST_URL: NOT SET (Redis caching disabled)"
else
  echo "   ✅ UPSTASH_REDIS_REST_URL: SET"
fi

if [[ -z "$UPSTASH_REDIS_REST_TOKEN" ]]; then
  echo "   ⚠️  UPSTASH_REDIS_REST_TOKEN: NOT SET (Redis caching disabled)"  
else
  echo "   ✅ UPSTASH_REDIS_REST_TOKEN: SET"
fi

echo ""
echo "🚀 Deploying to Deno Deploy with all environment variables..."
echo "   Project: pitchey-backend-fresh"
echo "   Entry Point: working-server.ts"
echo "   Environment: production"

# Deploy with all required environment variables
deno run --allow-all https://deno.land/x/deploy/deployctl.ts deploy \
  --project=pitchey-backend-fresh \
  --token="$DENO_DEPLOY_TOKEN" \
  --entrypoint=working-server.ts \
  --env="DENO_ENV=production" \
  --env="NODE_ENV=production" \
  --env="DATABASE_URL=$DATABASE_URL" \
  --env="JWT_SECRET=$JWT_SECRET" \
  --env="SENTRY_DSN=$SENTRY_DSN" \
  --env="FRONTEND_URL=https://pitchey-5o8.pages.dev" \
  --env="CACHE_ENABLED=true" \
  ${UPSTASH_REDIS_REST_URL:+--env="UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL"} \
  ${UPSTASH_REDIS_REST_TOKEN:+--env="UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN"} \
  --production

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🧪 Testing deployment..."
sleep 10

# Test the deployment
echo "Testing health endpoint..."
health_response=$(curl -s "https://pitchey-backend-fresh.deno.dev/api/health" || echo "FAILED")

if [[ "$health_response" == *"FAILED"* ]] || [[ "$health_response" == *"Internal Server Error"* ]]; then
  echo "❌ Health check failed!"
  echo "Response: $health_response"
  echo ""
  echo "The deployment completed but the application is still not working."
  echo "Check Deno Deploy logs for more details."
  exit 1
else
  echo "✅ Health check passed!"
  echo "Response: $health_response"
fi

echo ""
echo "🎉 Production deployment fix completed successfully!"
echo ""
echo "📊 Next steps:"
echo "1. Monitor the application for any remaining issues"
echo "2. Check Sentry dashboard for any new errors"
echo "3. Verify all features are working correctly"
echo ""
echo "🔗 URLs:"
echo "   - Production API: https://pitchey-backend-fresh.deno.dev"
echo "   - Health Check: https://pitchey-backend-fresh.deno.dev/api/health"
echo "   - Frontend: https://pitchey-5o8.pages.dev"
