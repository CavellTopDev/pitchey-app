#!/bin/bash

# Cache Optimization Deployment and Testing Script

set -e

echo "🚀 Cache Optimization Testing Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it first.${NC}"
    echo "Run: npm install -g wrangler"
    exit 1
fi

# Check if node-fetch is available for testing
if ! node -e "import('node-fetch')" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  node-fetch not found. Installing for testing...${NC}"
    npm install node-fetch
fi

echo -e "${BLUE}📦 Deploying cache-optimized worker...${NC}"

# Deploy the cache-optimized worker
wrangler deploy --config wrangler.cache-test.toml

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}⏳ Waiting 10 seconds for deployment to stabilize...${NC}"
sleep 10

echo ""
echo -e "${BLUE}🧪 Running cache performance tests...${NC}"

# Run the performance tests
node test-cache-performance.js

echo ""
echo -e "${BLUE}📋 Additional manual testing suggestions:${NC}"
echo ""
echo "1. Cache Statistics:"
echo "   curl https://pitchey-cache-test.ndlovucavelle.workers.dev/api/cache/stats"
echo ""
echo "2. Cache Report:"
echo "   curl https://pitchey-cache-test.ndlovucavelle.workers.dev/api/cache/report"
echo ""
echo "3. Manual Cache Warming:"
echo "   curl -X POST https://pitchey-cache-test.ndlovucavelle.workers.dev/api/cache/warm"
echo ""
echo "4. Test Specific Endpoint:"
echo "   curl https://pitchey-cache-test.ndlovucavelle.workers.dev/api/pitches/browse/enhanced"
echo ""
echo "5. Reset Cache Stats:"
echo "   curl -X POST https://pitchey-cache-test.ndlovucavelle.workers.dev/api/cache/reset"
echo ""

echo -e "${GREEN}🎉 Cache optimization testing deployment complete!${NC}"
echo ""
echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo "- Run the same endpoint multiple times to see cache HIT status"
echo "- Check X-Cache-Status header in responses"
echo "- Monitor cache hit rate in the /api/cache/stats endpoint"
echo "- Target hit rate should be >80% for frequently accessed endpoints"