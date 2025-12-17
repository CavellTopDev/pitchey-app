#!/bin/bash

# Quick Hyperdrive Connection Test
# Run this script to quickly test if Hyperdrive is working

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Quick Hyperdrive Connection Test${NC}"
echo -e "${BLUE}===================================${NC}"

# Test 1: Check Hyperdrive configuration
echo -e "${BLUE}1. Checking Hyperdrive configuration...${NC}"
HYPERDRIVE_ID="983d4a1818264b5dbdca26bacf167dee"

if wrangler hyperdrive get "$HYPERDRIVE_ID" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Hyperdrive $HYPERDRIVE_ID is configured and accessible${NC}"
else
    echo -e "${RED}❌ Hyperdrive $HYPERDRIVE_ID not found or not accessible${NC}"
    exit 1
fi

# Test 2: Deploy test worker
echo -e "\n${BLUE}2. Deploying test worker...${NC}"

cat > "quick-test-worker.ts" << 'EOF'
interface Hyperdrive {
  prepare(sql: string): {
    bind(...params: any[]): { run(): Promise<any>; all(): Promise<any>; first(): Promise<any>; };
  };
}

interface Env {
  DATABASE_URL: string;
  HYPERDRIVE?: Hyperdrive;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/test') {
      const results: any = {
        timestamp: new Date().toISOString(),
        tests: {}
      };
      
      // Test Hyperdrive
      try {
        if (env.HYPERDRIVE) {
          const startTime = Date.now();
          const result = await env.HYPERDRIVE
            .prepare("SELECT 1 as test, current_timestamp as time, version() as pg_version")
            .first();
          const duration = Date.now() - startTime;
          
          results.tests.hyperdrive = {
            success: true,
            duration,
            result: {
              test: result.test,
              time: result.time,
              version: result.pg_version?.substring(0, 50) + '...'
            }
          };
        } else {
          results.tests.hyperdrive = {
            success: false,
            error: 'HYPERDRIVE binding not available'
          };
        }
      } catch (error) {
        results.tests.hyperdrive = {
          success: false,
          error: error.message
        };
      }
      
      // Test direct connection (fallback)
      try {
        if (env.DATABASE_URL) {
          // Note: This would require neon import in actual implementation
          results.tests.direct = {
            success: false,
            note: 'Direct connection test requires neon import (not included in quick test)'
          };
        } else {
          results.tests.direct = {
            success: false,
            error: 'DATABASE_URL not available'
          };
        }
      } catch (error) {
        results.tests.direct = {
          success: false,
          error: error.message
        };
      }
      
      const allSuccess = Object.values(results.tests).some(test => test.success);
      
      return new Response(JSON.stringify(results, null, 2), {
        status: allSuccess ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Quick Hyperdrive Test - Visit /test endpoint', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
EOF

# Create temporary wrangler config
cat > "quick-test.toml" << EOF
name = "pitchey-quick-hyperdrive-test"
main = "quick-test-worker.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
account_id = "e16d3bf549153de23459a6c6a06a431b"

[vars]
ENVIRONMENT = "test"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "$HYPERDRIVE_ID"
EOF

# Deploy test worker
echo -e "${YELLOW}Deploying test worker...${NC}"
wrangler deploy --config quick-test.toml

# Test 3: Run connectivity test
echo -e "\n${BLUE}3. Testing connectivity...${NC}"
TEST_URL="https://pitchey-quick-hyperdrive-test.cavelltheleaddev.workers.dev/test"

# Wait for deployment
sleep 5

echo -e "${YELLOW}Testing at: $TEST_URL${NC}"
RESPONSE=$(curl -s "$TEST_URL" || echo '{"error":"Failed to connect"}')

# Parse response
SUCCESS=$(echo "$RESPONSE" | jq -r '.tests.hyperdrive.success // false')
DURATION=$(echo "$RESPONSE" | jq -r '.tests.hyperdrive.duration // 0')
ERROR=$(echo "$RESPONSE" | jq -r '.tests.hyperdrive.error // ""')

echo -e "\n${BLUE}📊 Test Results:${NC}"
echo "$(echo "$RESPONSE" | jq '.')"

echo -e "\n${BLUE}📈 Summary:${NC}"

if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Hyperdrive connection: SUCCESS${NC}"
    echo -e "${GREEN}⚡ Response time: ${DURATION}ms${NC}"
    
    if [ "$DURATION" -lt 100 ]; then
        echo -e "${GREEN}🚀 Excellent performance!${NC}"
    elif [ "$DURATION" -lt 500 ]; then
        echo -e "${YELLOW}⚠️  Good performance${NC}"
    else
        echo -e "${YELLOW}⚠️  Slow response time${NC}"
    fi
else
    echo -e "${RED}❌ Hyperdrive connection: FAILED${NC}"
    echo -e "${RED}Error: $ERROR${NC}"
fi

# Test 4: Cleanup
echo -e "\n${BLUE}4. Cleaning up...${NC}"
wrangler delete "pitchey-quick-hyperdrive-test" --force 2>/dev/null || echo "Worker already deleted"
rm -f quick-test-worker.ts quick-test.toml

echo -e "\n${BLUE}🎯 Next Steps:${NC}"

if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Hyperdrive is working correctly!${NC}"
    echo -e "${BLUE}   To migrate to production:${NC}"
    echo -e "   📁 Run: ./scripts/migrate-to-hyperdrive.sh"
    echo -e "   📊 Monitor: https://dash.cloudflare.com"
else
    echo -e "${RED}❌ Hyperdrive needs configuration${NC}"
    echo -e "${BLUE}   Check the following:${NC}"
    echo -e "   🔧 Verify Hyperdrive ID in wrangler.toml"
    echo -e "   🌐 Check Neon database connectivity"
    echo -e "   📋 Review Hyperdrive configuration in Cloudflare dashboard"
    echo -e "   📖 Read: monitoring/performance/hyperdrive-diagnosis.md"
fi

echo -e "\n${BLUE}📚 Documentation:${NC}"
echo -e "   📄 monitoring/performance/hyperdrive-diagnosis.md"
echo -e "   📄 monitoring/performance/hyperdrive-best-practices.md"
echo -e "   🧪 monitoring/performance/test-hyperdrive-connection.ts"