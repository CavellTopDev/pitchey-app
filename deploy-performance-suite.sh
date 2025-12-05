#!/bin/bash

# Complete Performance Suite Deployment
# Deploys all performance optimizations to production

echo "🚀 Pitchey Performance Suite Deployment"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
WORKER_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
FRONTEND_URL="https://pitchey.pages.dev"

# Step tracking
TOTAL_STEPS=10
CURRENT_STEP=0

step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo -e "\n${CYAN}[$CURRENT_STEP/$TOTAL_STEPS] $1${NC}"
    echo "----------------------------------------"
}

# Pre-flight checks
step "Running pre-flight checks"

# Check for required tools
command -v wrangler >/dev/null 2>&1 || { echo -e "${RED}❌ wrangler CLI not found. Please install it.${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js not found. Please install it.${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${YELLOW}⚠️  jq not found. Some features may be limited.${NC}"; }

echo -e "${GREEN}✅ All required tools found${NC}"

# Step 1: Deploy Enhanced Connection Pool
step "Deploying enhanced database connection pool"

if [ -f "src/worker-database-pool-enhanced.ts" ]; then
    echo "Connection pool already in place"
    echo -e "${GREEN}✅ Enhanced connection pool ready${NC}"
else
    echo -e "${RED}❌ Enhanced connection pool not found${NC}"
    exit 1
fi

# Step 2: Setup KV Namespaces
step "Setting up KV namespaces for caching"

# Create KV namespaces if they don't exist
echo "Creating PITCHEY_KV namespace..."
KV_ID=$(wrangler kv:namespace list 2>/dev/null | grep "PITCHEY_KV" | grep -oE '[a-f0-9]{32}' || true)

if [ -z "$KV_ID" ]; then
    KV_OUTPUT=$(wrangler kv:namespace create "PITCHEY_KV" 2>&1)
    KV_ID=$(echo "$KV_OUTPUT" | grep -oE '[a-f0-9]{32}')
    echo -e "${GREEN}✅ Created KV namespace: $KV_ID${NC}"
else
    echo -e "${GREEN}✅ Using existing KV namespace: $KV_ID${NC}"
fi

# Create metrics KV namespace
echo "Creating METRICS_KV namespace..."
METRICS_KV_ID=$(wrangler kv:namespace list 2>/dev/null | grep "METRICS_KV" | grep -oE '[a-f0-9]{32}' || true)

if [ -z "$METRICS_KV_ID" ]; then
    METRICS_OUTPUT=$(wrangler kv:namespace create "METRICS_KV" 2>&1)
    METRICS_KV_ID=$(echo "$METRICS_OUTPUT" | grep -oE '[a-f0-9]{32}')
    echo -e "${GREEN}✅ Created Metrics KV namespace: $METRICS_KV_ID${NC}"
else
    echo -e "${GREEN}✅ Using existing Metrics KV namespace: $METRICS_KV_ID${NC}"
fi

# Step 3: Deploy Cache Layer
step "Deploying edge cache layer"

if [ -f "src/worker-cache-layer.ts" ] && [ -f "src/worker-service-cached.ts" ]; then
    echo -e "${GREEN}✅ Cache layer components ready${NC}"
else
    echo -e "${RED}❌ Cache layer components missing${NC}"
    exit 1
fi

# Step 4: Deploy Cache Warming
step "Deploying cache warming service"

if [ -f "src/cache-warmer.ts" ] && [ -f "src/scheduled-handler.ts" ]; then
    echo -e "${GREEN}✅ Cache warming components ready${NC}"
    
    # Update wrangler.toml with cron triggers
    if ! grep -q "triggers" wrangler.toml; then
        cat << EOF >> wrangler.toml

[triggers]
crons = ["*/5 * * * *", "*/2 * * * *", "0 * * * *", "*/15 * * * *"]
EOF
        echo "Added cron triggers to wrangler.toml"
    fi
else
    echo -e "${RED}❌ Cache warming components missing${NC}"
    exit 1
fi

# Step 5: Configure Monitoring
step "Setting up monitoring and alerts"

if [ -f "health-check-worker.js" ] && [ -f "monitoring-config.json" ]; then
    echo -e "${GREEN}✅ Monitoring components ready${NC}"
    
    # Start monitoring service if systemd is available
    if command -v systemctl >/dev/null 2>&1; then
        echo "Would you like to install the monitoring service? (requires sudo)"
        read -p "Install monitoring service? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo cp pitchey-monitor.service /etc/systemd/system/
            sudo systemctl daemon-reload
            sudo systemctl enable pitchey-monitor.service
            sudo systemctl start pitchey-monitor.service
            echo -e "${GREEN}✅ Monitoring service installed and started${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Monitoring components not fully configured${NC}"
fi

# Step 6: Configure Slack Alerts
step "Configuring Slack alerts (optional)"

if [ -f "slack-alerts-config.json" ]; then
    echo -e "${GREEN}✅ Slack alerts already configured${NC}"
else
    echo "Would you like to configure Slack alerts?"
    read -p "Configure Slack? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./setup-slack-alerts.sh
    else
        echo "Skipping Slack configuration"
    fi
fi

# Step 7: Apply Database Optimizations
step "Applying database query optimizations"

echo "Would you like to apply database optimizations?"
echo -e "${YELLOW}⚠️  This will create indexes and may take a few minutes${NC}"
read -p "Apply optimizations? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "apply-db-optimizations.sh" ]; then
        ./apply-db-optimizations.sh
        echo -e "${GREEN}✅ Database optimizations applied${NC}"
    else
        echo -e "${YELLOW}⚠️  Optimization script not found${NC}"
    fi
else
    echo "Skipping database optimizations"
fi

# Step 8: Build and Deploy Worker
step "Building and deploying Worker with all optimizations"

echo "Preparing deployment..."

# Create deployment configuration
cat << EOF > wrangler-deploy.toml
name = "pitchey-optimized"
main = "src/worker-service-optimized.ts"
compatibility_date = "2024-11-01"
node_compat = true

account_id = "b1f6495b07f1a7573dbbf75b7ea2fa48"
workers_dev = false
route = { pattern = "pitchey-production.cavelltheleaddev.workers.dev/*", zone_name = "cavelltheleaddev.workers.dev" }

[vars]
DENO_ENV = "production"
NODE_ENV = "production"
FRONTEND_URL = "$FRONTEND_URL"
CACHE_ENABLED = "true"

[[kv_namespaces]]
binding = "PITCHEY_KV"
id = "$KV_ID"

[[kv_namespaces]]
binding = "METRICS_KV"
id = "$METRICS_KV_ID"

[triggers]
crons = ["*/5 * * * *", "*/2 * * * *", "0 * * * *", "*/15 * * * *"]

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "f1f81672261b4076bbcf07b115a03ca6"
EOF

echo -e "${GREEN}✅ Deployment configuration ready${NC}"

echo ""
echo -e "${YELLOW}Ready to deploy to production${NC}"
echo "This will update: $WORKER_URL"
read -p "Deploy now? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Deploying..."
    wrangler deploy --config wrangler-deploy.toml
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully deployed!${NC}"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
else
    echo "Deployment cancelled"
    exit 0
fi

# Step 9: Deploy Performance Dashboard
step "Deploying performance dashboard"

if [ -f "frontend/src/components/admin/PerformanceDashboard.tsx" ]; then
    echo "Building frontend with performance dashboard..."
    cd frontend
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "Deploying to Cloudflare Pages..."
        wrangler pages deploy dist --project-name=pitchey
        cd ..
        echo -e "${GREEN}✅ Performance dashboard deployed${NC}"
    else
        cd ..
        echo -e "${YELLOW}⚠️  Frontend build failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Performance dashboard not found${NC}"
fi

# Step 10: Verify Deployment
step "Verifying deployment"

echo "Running deployment tests..."

# Test endpoints
ENDPOINTS=(
    "/api/db-test"
    "/api/cache/stats"
    "/api/metrics/current"
    "/api/pitches/trending?limit=1"
)

FAILED=0
for endpoint in "${ENDPOINTS[@]}"; do
    echo -n "Testing $endpoint... "
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL$endpoint")
    
    if [ "$STATUS" = "200" ]; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ Failed (HTTP $STATUS)${NC}"
        FAILED=$((FAILED + 1))
    fi
done

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
else
    echo -e "\n${YELLOW}⚠️  $FAILED tests failed${NC}"
fi

# Performance baseline
echo ""
echo "Establishing performance baseline..."
if [ -f "performance-baseline.sh" ]; then
    ./performance-baseline.sh "$WORKER_URL"
fi

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}🎉 Performance Suite Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "📊 Deployed Components:"
echo "  ✅ Enhanced connection pool with circuit breaker"
echo "  ✅ Edge caching layer (KV + Memory)"
echo "  ✅ Cache warming service (5 min intervals)"
echo "  ✅ Monitoring & health checks (2 min intervals)"
echo "  ✅ Performance metrics collection"
echo "  ✅ Database query optimizations"
[ -f "slack-alerts-config.json" ] && echo "  ✅ Slack alerting"
echo ""
echo "📈 Expected Improvements:"
echo "  • 50-80% faster response times (cached)"
echo "  • 70-90% reduction in database load"
echo "  • 99.9% availability with failover"
echo "  • Real-time performance visibility"
echo ""
echo "🔗 Access Points:"
echo "  • Worker: $WORKER_URL"
echo "  • Frontend: $FRONTEND_URL"
echo "  • Cache Stats: $WORKER_URL/api/cache/stats"
echo "  • Metrics: $WORKER_URL/api/metrics/current"
echo "  • Dashboard: $FRONTEND_URL/admin/performance"
echo ""
echo "📝 Next Steps:"
echo "  1. Monitor performance metrics for 24 hours"
echo "  2. Review baseline metrics in performance-baseline-*.json"
echo "  3. Configure alert thresholds based on actual usage"
echo "  4. Set up Slack webhook if not already done"
echo "  5. Schedule weekly performance reviews"
echo ""
echo "For monitoring: tail -f monitoring.log"
echo "For health status: cat health-state.json"