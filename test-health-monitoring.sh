#!/bin/bash

# Health Monitoring Test and Deployment Script
# Tests health endpoints locally and in production

set -e

echo "🏥 Pitchey Health Monitoring Test & Deployment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test endpoints
PRODUCTION_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
LOCAL_URL="http://localhost:8001"

# Function to test an endpoint
test_endpoint() {
    local url=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    
    echo -e "\n${BLUE}Testing: ${description}${NC}"
    echo "URL: ${url}${endpoint}"
    
    # Make request and capture response
    response=$(curl -s -w "\n%{http_code}" "${url}${endpoint}" 2>/dev/null || echo -e "\nERROR")
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    
    # Extract body (all lines except last)
    body=$(echo "$response" | head -n -1)
    
    if [ "$status_code" = "ERROR" ]; then
        echo -e "${RED}❌ FAILED - Connection error${NC}"
        return 1
    elif [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED - Status: $status_code${NC}"
        echo "Response preview:"
        echo "$body" | jq -r '.status // .ready // .alive // "No status field"' 2>/dev/null || echo "Invalid JSON response"
        return 0
    else
        echo -e "${RED}❌ FAILED - Expected: $expected_status, Got: $status_code${NC}"
        echo "Response: $body"
        return 1
    fi
}

# Function to test health monitoring
test_health_monitoring() {
    local base_url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}🔍 Testing Health Monitoring - $environment${NC}"
    echo "================================================"
    
    local failed=0
    
    # Test basic health endpoint
    test_endpoint "$base_url" "/api/health" 200 "Basic Health Check" || ((failed++))
    
    # Test detailed health endpoint
    test_endpoint "$base_url" "/api/health/detailed" 200 "Detailed Health Check" || ((failed++))
    
    # Test readiness probe
    test_endpoint "$base_url" "/api/health/ready" 200 "Readiness Probe" || ((failed++))
    
    # Test liveness probe
    test_endpoint "$base_url" "/api/health/live" 200 "Liveness Probe" || ((failed++))
    
    if [ $failed -eq 0 ]; then
        echo -e "\n${GREEN}✅ All health checks passed for $environment!${NC}"
        return 0
    else
        echo -e "\n${RED}❌ $failed health checks failed for $environment${NC}"
        return 1
    fi
}

# Function to check if local server is running
check_local_server() {
    if curl -s "$LOCAL_URL/api/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start local server if needed
start_local_server() {
    echo -e "\n${YELLOW}🚀 Starting local development server...${NC}"
    
    # Check if PORT 8001 is already in use
    if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Local server already running on port 8001${NC}"
        return 0
    fi
    
    # Start the server in background
    echo "Starting: PORT=8001 deno run --allow-all working-server.ts"
    PORT=8001 JWT_SECRET="test-secret-key-for-development" \
    DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require" \
    timeout 10s deno run --allow-all working-server.ts &
    
    local pid=$!
    echo "Server PID: $pid"
    
    # Wait for server to start
    echo "Waiting for server to start..."
    for i in {1..20}; do
        if check_local_server; then
            echo -e "${GREEN}✅ Local server started successfully${NC}"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    
    echo -e "\n${RED}❌ Failed to start local server${NC}"
    return 1
}

# Function to deploy to production
deploy_to_production() {
    echo -e "\n${YELLOW}🚀 Deploying to Production...${NC}"
    echo "=============================="
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        echo -e "${RED}❌ Wrangler CLI not found. Please install: npm install -g wrangler${NC}"
        return 1
    fi
    
    # Deploy to Cloudflare Workers
    echo "Deploying worker..."
    if wrangler deploy; then
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        
        # Wait for deployment to propagate
        echo "Waiting for deployment to propagate..."
        sleep 10
        
        return 0
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        return 1
    fi
}

# Function to display health monitoring dashboard
show_dashboard() {
    local base_url=$1
    local environment=$2
    
    echo -e "\n${BLUE}📊 Health Monitoring Dashboard - $environment${NC}"
    echo "=============================================="
    
    # Get detailed health information
    response=$(curl -s "${base_url}/api/health/detailed" 2>/dev/null || echo '{"error":"Connection failed"}')
    
    if echo "$response" | jq -e .status > /dev/null 2>&1; then
        echo "Overall Status: $(echo "$response" | jq -r '.status // "unknown"')"
        echo "Timestamp: $(echo "$response" | jq -r '.timestamp // "unknown"')"
        echo "Uptime: $(echo "$response" | jq -r '.uptime // 0') ms"
        echo "Version: $(echo "$response" | jq -r '.version // "unknown"')"
        
        echo -e "\n${BLUE}Service Checks:${NC}"
        echo "Database: $(echo "$response" | jq -r '.checks.database // false')"
        echo "Cache: $(echo "$response" | jq -r '.checks.cache // false')"
        echo "Worker: $(echo "$response" | jq -r '.checks.worker // false')"
        echo "Storage: $(echo "$response" | jq -r '.checks.storage // false')"
        
        if echo "$response" | jq -e .metrics > /dev/null 2>&1; then
            echo -e "\n${BLUE}Metrics:${NC}"
            echo "DB Latency: $(echo "$response" | jq -r '.metrics.dbLatencyMs // "N/A"') ms"
            echo "Cache Latency: $(echo "$response" | jq -r '.metrics.cacheLatencyMs // "N/A"') ms"
        fi
    else
        echo -e "${RED}❌ Unable to fetch health data${NC}"
        echo "Response: $response"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Starting health monitoring test sequence...${NC}"
    
    local test_local=false
    local test_production=false
    local deploy=false
    
    # Parse command line arguments
    for arg in "$@"; do
        case $arg in
            --local)
                test_local=true
                shift
                ;;
            --production)
                test_production=true
                shift
                ;;
            --deploy)
                deploy=true
                shift
                ;;
            --all)
                test_local=true
                test_production=true
                deploy=true
                shift
                ;;
            *)
                # Default: test production only
                test_production=true
                ;;
        esac
    done
    
    # If no arguments, default to production testing
    if [ "$test_local" = false ] && [ "$test_production" = false ] && [ "$deploy" = false ]; then
        test_production=true
    fi
    
    local overall_success=true
    
    # Test local environment
    if [ "$test_local" = true ]; then
        if ! check_local_server; then
            start_local_server || overall_success=false
        fi
        
        if check_local_server; then
            test_health_monitoring "$LOCAL_URL" "LOCAL" || overall_success=false
            show_dashboard "$LOCAL_URL" "LOCAL"
        else
            echo -e "${RED}❌ Local server not available${NC}"
            overall_success=false
        fi
    fi
    
    # Deploy if requested
    if [ "$deploy" = true ]; then
        deploy_to_production || overall_success=false
    fi
    
    # Test production environment
    if [ "$test_production" = true ]; then
        test_health_monitoring "$PRODUCTION_URL" "PRODUCTION" || overall_success=false
        show_dashboard "$PRODUCTION_URL" "PRODUCTION"
    fi
    
    # Final summary
    echo -e "\n${BLUE}📋 Test Summary${NC}"
    echo "==============="
    
    if [ "$overall_success" = true ]; then
        echo -e "${GREEN}✅ All tests completed successfully!${NC}"
        echo -e "\n${BLUE}🔗 Available Endpoints:${NC}"
        if [ "$test_local" = true ]; then
            echo "Local Health: $LOCAL_URL/api/health"
        fi
        if [ "$test_production" = true ]; then
            echo "Production Health: $PRODUCTION_URL/api/health"
        fi
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Check the output above.${NC}"
        exit 1
    fi
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Health Monitoring Test Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --local       Test local development server"
    echo "  --production  Test production server (default)"
    echo "  --deploy      Deploy to production before testing"
    echo "  --all         Run local, deploy, and production tests"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Test production only"
    echo "  $0 --local           # Test local server only"
    echo "  $0 --all             # Full test cycle"
    echo "  $0 --deploy --production  # Deploy and test production"
    exit 0
fi

# Run main function with all arguments
main "$@"