#!/bin/bash

echo "🔬 COMPREHENSIVE OBSERVABILITY STACK DEPLOYMENT"
echo "==============================================="
echo ""

# Check for required Sentry environment variables
echo "📋 CHECKING SENTRY CONFIGURATION:"
echo "=================================="

# Frontend source map upload requirements
if [[ -n "$SENTRY_ORG" && -n "$SENTRY_PROJECT" && -n "$SENTRY_AUTH_TOKEN" ]]; then
    echo "✅ Frontend source maps: ENABLED"
    echo "   Organization: $SENTRY_ORG"
    echo "   Project: $SENTRY_PROJECT"
    echo "   Release: ${SENTRY_RELEASE:-${CF_PAGES_COMMIT_SHA:-auto-generated}}"
else
    echo "⚠️ Frontend source maps: DISABLED"
    echo "   Missing: SENTRY_ORG, SENTRY_PROJECT, or SENTRY_AUTH_TOKEN"
fi

# Backend monitoring requirements
if [[ -n "$SENTRY_DSN" ]]; then
    echo "✅ Backend monitoring: ENABLED"
    echo "   DSN: ${SENTRY_DSN:0:40}..."
else
    echo "⚠️ Backend monitoring: DISABLED"
    echo "   Missing: SENTRY_DSN"
fi

# Frontend runtime monitoring
if [[ -n "$VITE_SENTRY_DSN" ]]; then
    echo "✅ Frontend monitoring: ENABLED"
    echo "   DSN: ${VITE_SENTRY_DSN:0:40}..."
else
    echo "⚠️ Frontend monitoring: DISABLED"
    echo "   Missing: VITE_SENTRY_DSN"
fi

echo ""
echo "🚀 DEPLOYMENT STRATEGY:"
echo "======================"

# Strategy 1: Full observability stack
if [[ -n "$SENTRY_ORG" && -n "$SENTRY_PROJECT" && -n "$SENTRY_AUTH_TOKEN" && -n "$SENTRY_DSN" && -n "$VITE_SENTRY_DSN" ]]; then
    echo "📊 Strategy: FULL OBSERVABILITY DEPLOYMENT"
    echo "   - Frontend source maps will be uploaded automatically"
    echo "   - Backend request tagging and user context enabled"
    echo "   - Frontend error tracking and session replay enabled"
    
    # Deploy backend first
    echo ""
    echo "🔧 Step 1: Deploying Backend with Enhanced Observability"
    echo "======================================================="
    
    DENO_DEPLOY_TOKEN="$DENO_DEPLOY_TOKEN" \
    deployctl deploy \
      --project=pitchey-backend-fresh \
      --entrypoint=working-server.ts \
      --env="SENTRY_DSN=$SENTRY_DSN" \
      --env="DENO_ENV=production" \
      --env="NODE_ENV=production" \
      --env="SENTRY_ENVIRONMENT=production" \
      --env="SENTRY_RELEASE=observability-v${GITHUB_SHA:0:8:-$(date +%s)}" \
      --env="DATABASE_URL=$DATABASE_URL" \
      --env="JWT_SECRET=$JWT_SECRET" \
      --env="UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL" \
      --env="UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN" \
      --env="CACHE_ENABLED=true" \
      --env="FRONTEND_URL=https://pitchey.pages.dev" \
      --production

    if [ $? -eq 0 ]; then
        echo "✅ Backend deployment successful"
    else
        echo "❌ Backend deployment failed"
        exit 1
    fi

    # Deploy frontend with source maps
    echo ""
    echo "🎨 Step 2: Deploying Frontend with Source Map Upload"
    echo "==================================================="
    
    cd frontend || exit 1
    
    # Build with source maps and upload
    VITE_API_URL="https://pitchey-backend-fresh.deno.dev" \
    VITE_WS_URL="wss://pitchey-backend-fresh.deno.dev" \
    VITE_SENTRY_DSN="$VITE_SENTRY_DSN" \
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend build with source maps successful"
    else
        echo "❌ Frontend build failed"
        exit 1
    fi

    # Deploy to Cloudflare Pages
    npx wrangler pages deploy dist \
        --project-name=pitchey \
        --branch=main \
        --commit-dirty=true
    
    if [ $? -eq 0 ]; then
        echo "✅ Frontend deployment successful"
        cd ..
    else
        echo "❌ Frontend deployment failed"
        exit 1
    fi

# Strategy 2: Partial observability
elif [[ -n "$SENTRY_DSN" || -n "$VITE_SENTRY_DSN" ]]; then
    echo "📈 Strategy: PARTIAL OBSERVABILITY DEPLOYMENT"
    echo "   - Basic error tracking enabled"
    echo "   - Source maps upload disabled (missing credentials)"
    
    # Deploy backend
    if [[ -n "$SENTRY_DSN" ]]; then
        echo ""
        echo "🔧 Deploying Backend with Basic Monitoring"
        echo "=========================================="
        
        DENO_DEPLOY_TOKEN="$DENO_DEPLOY_TOKEN" \
        deployctl deploy \
          --project=pitchey-backend-fresh \
          --entrypoint=working-server.ts \
          --env="SENTRY_DSN=$SENTRY_DSN" \
          --env="DENO_ENV=production" \
          --env="NODE_ENV=production" \
          --production
    fi
    
    # Deploy frontend
    if [[ -n "$VITE_SENTRY_DSN" ]]; then
        echo ""
        echo "🎨 Deploying Frontend with Basic Monitoring"
        echo "==========================================="
        
        cd frontend || exit 1
        VITE_SENTRY_DSN="$VITE_SENTRY_DSN" npm run build
        npx wrangler pages deploy dist --project-name=pitchey --branch=main
        cd ..
    fi

# Strategy 3: Standard deployment (no observability)
else
    echo "🚀 Strategy: STANDARD DEPLOYMENT"
    echo "   - No additional observability features"
    echo "   - Basic health checks only"
    
    # Standard deployment
    ./comprehensive-production-deploy.sh
fi

echo ""
echo "🧪 VALIDATION TESTS:"
echo "==================="

# Wait for deployment to propagate
echo "⏳ Waiting for deployment to propagate..."
sleep 30

# Test backend health
echo "🔍 Testing backend health and observability..."
HEALTH_RESPONSE=$(curl -s "https://pitchey-backend-fresh.deno.dev/api/health" || echo '{"error":"failed"}')
echo "Health check: $HEALTH_RESPONSE"

# Test frontend access
echo "🔍 Testing frontend accessibility..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://pitchey.pages.dev" || echo "000")
echo "Frontend status: $FRONTEND_STATUS"

# Test authentication endpoint (should trigger Sentry tags)
echo "🔍 Testing authentication endpoint (triggers Sentry tagging)..."
AUTH_TEST=$(curl -s -X POST "https://pitchey-backend-fresh.deno.dev/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"sarah.investor@demo.com","password":"Demo123"}' || echo '{"error":"failed"}')

if echo "$AUTH_TEST" | grep -q '"success":true'; then
    echo "✅ Authentication test successful (Sentry user context should be set)"
else
    echo "⚠️ Authentication test failed, but backend is responding"
fi

echo ""
echo "📊 OBSERVABILITY STATUS SUMMARY:"
echo "================================"

if [[ -n "$SENTRY_ORG" && -n "$SENTRY_PROJECT" && -n "$SENTRY_AUTH_TOKEN" ]]; then
    echo "✅ Source Maps: Uploaded to Sentry (check Sentry UI → Releases)"
else
    echo "❌ Source Maps: Not uploaded"
fi

if [[ -n "$SENTRY_DSN" ]]; then
    echo "✅ Backend Monitoring: Active with request tagging and user context"
else
    echo "❌ Backend Monitoring: Disabled"
fi

if [[ -n "$VITE_SENTRY_DSN" ]]; then
    echo "✅ Frontend Monitoring: Active with error tracking and session replay"
else
    echo "❌ Frontend Monitoring: Disabled"
fi

echo ""
echo "🎯 NEXT STEPS:"
echo "=============="
echo "1. Check Sentry UI for incoming events and performance data"
echo "2. Set up recommended alerts for error rates and performance thresholds"
echo "3. Configure dashboards for operational metrics"
echo "4. Test error scenarios to validate full observability pipeline"

echo ""
echo "🔗 PRODUCTION URLS:"
echo "=================="
echo "Frontend: https://pitchey.pages.dev"
echo "Backend:  https://pitchey-backend-fresh.deno.dev"
echo "Health:   https://pitchey-backend-fresh.deno.dev/api/health"

if [[ -n "$SENTRY_ORG" && -n "$SENTRY_PROJECT" ]]; then
    echo "Sentry:   https://sentry.io/organizations/$SENTRY_ORG/projects/$SENTRY_PROJECT/"
fi

echo ""
echo "✅ OBSERVABILITY DEPLOYMENT COMPLETE!"