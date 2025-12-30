#!/bin/bash

# Health Check Testing Script for Pitchey Platform
# Tests all health endpoints locally and in production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LOCAL_URL="${LOCAL_URL:-http://localhost:8787}"
PROD_URL="${PROD_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
AUTH_TOKEN="${AUTH_TOKEN:-}" # Optional: Set for workflow tests

# Function to test endpoint
test_endpoint() {
    local url=$1
    local endpoint=$2
    local expected_status=$3
    local auth=$4

    echo -e "\nTesting: ${YELLOW}$endpoint${NC}"
    
    if [ -n "$auth" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $auth" "$url$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" "$url$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} Status: $http_code (Expected: $expected_status)"
        echo "Response: $body" | jq -C '.' 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗${NC} Status: $http_code (Expected: $expected_status)"
        echo "Response: $body"
        return 1
    fi
}

# Function to run all tests
run_tests() {
    local base_url=$1
    local env_name=$2
    
    echo -e "\n${YELLOW}=== Testing $env_name Environment ===${NC}"
    echo "URL: $base_url"
    
    # Basic liveness check
    test_endpoint "$base_url" "/api/health" 200
    test_endpoint "$base_url" "/api/alive" 200
    test_endpoint "$base_url" "/api/ready" 200
    
    # Component health checks
    test_endpoint "$base_url" "/api/health/db" 200
    test_endpoint "$base_url" "/api/health/worker" 200
    test_endpoint "$base_url" "/api/health/integration" 200
    
    # Workflow checks (requires auth)
    if [ -n "$AUTH_TOKEN" ]; then
        test_endpoint "$base_url" "/api/health/workflows" 200 "$AUTH_TOKEN"
        test_endpoint "$base_url" "/api/health/all" 200 "$AUTH_TOKEN"
    else
        echo -e "\n${YELLOW}Skipping workflow tests (no AUTH_TOKEN provided)${NC}"
        test_endpoint "$base_url" "/api/health/all" 200
    fi
}

# Function to test rate limiting
test_rate_limiting() {
    local base_url=$1
    echo -e "\n${YELLOW}=== Testing Rate Limiting ===${NC}"
    
    # Make 11 requests rapidly (limit is 10/minute)
    for i in {1..11}; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/health/db")
        if [ $i -le 10 ]; then
            if [ "$response" == "200" ] || [ "$response" == "503" ] || [ "$response" == "500" ]; then
                echo -e "${GREEN}✓${NC} Request $i: Status $response (Allowed)"
            else
                echo -e "${RED}✗${NC} Request $i: Status $response (Unexpected)"
            fi
        else
            if [ "$response" == "429" ]; then
                echo -e "${GREEN}✓${NC} Request $i: Status $response (Rate limited as expected)"
            else
                echo -e "${RED}✗${NC} Request $i: Status $response (Should be rate limited)"
            fi
        fi
    done
}

# Function to test security headers
test_security_headers() {
    local base_url=$1
    echo -e "\n${YELLOW}=== Testing Security Headers ===${NC}"
    
    headers=$(curl -sI "$base_url/api/health")
    
    # Check for cache control
    if echo "$headers" | grep -qi "Cache-Control: no-cache"; then
        echo -e "${GREEN}✓${NC} Cache-Control header present"
    else
        echo -e "${RED}✗${NC} Cache-Control header missing"
    fi
    
    # Check content type
    if echo "$headers" | grep -qi "Content-Type: application/json"; then
        echo -e "${GREEN}✓${NC} Content-Type header correct"
    else
        echo -e "${RED}✗${NC} Content-Type header incorrect"
    fi
}

# Function to test error handling
test_error_handling() {
    local base_url=$1
    echo -e "\n${YELLOW}=== Testing Error Handling ===${NC}"
    
    # Test invalid endpoint
    response=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/health/invalid")
    if [ "$response" == "404" ]; then
        echo -e "${GREEN}✓${NC} Invalid endpoint returns 404"
    else
        echo -e "${RED}✗${NC} Invalid endpoint returns $response (expected 404)"
    fi
    
    # Test workflow without auth
    response=$(curl -s "$base_url/api/health/workflows")
    if echo "$response" | grep -q "Authentication required"; then
        echo -e "${GREEN}✓${NC} Workflow endpoint requires authentication"
    else
        echo -e "${RED}✗${NC} Workflow endpoint doesn't enforce authentication"
    fi
}

# Function to generate summary report
generate_report() {
    local base_url=$1
    echo -e "\n${YELLOW}=== Health Check Summary Report ===${NC}"
    
    response=$(curl -s "$base_url/api/health/all")
    if [ $? -eq 0 ]; then
        echo "$response" | jq -C '
            {
                overall: .overall,
                timestamp: .timestamp,
                database: {
                    status: .checks.database.status,
                    latency: .checks.database.latencyMs,
                    ssl: .checks.database.ssl
                },
                worker: {
                    status: .checks.worker.status,
                    bindings: .checks.worker.bindings
                },
                integration: {
                    status: .checks.integration.status,
                    services: .checks.integration.services
                }
            }
        ' 2>/dev/null || echo "$response"
    fi
}

# Main execution
main() {
    echo -e "${GREEN}Pitchey Platform Health Check Testing${NC}"
    echo "======================================="
    
    # Test local environment
    if [ "$1" != "--prod-only" ]; then
        echo -e "\n${YELLOW}Testing Local Environment${NC}"
        if curl -s -f "$LOCAL_URL/api/health" > /dev/null 2>&1; then
            run_tests "$LOCAL_URL" "Local"
            test_rate_limiting "$LOCAL_URL"
            test_security_headers "$LOCAL_URL"
            test_error_handling "$LOCAL_URL"
            generate_report "$LOCAL_URL"
        else
            echo -e "${RED}Local environment not accessible at $LOCAL_URL${NC}"
        fi
    fi
    
    # Test production environment
    if [ "$1" != "--local-only" ]; then
        echo -e "\n${YELLOW}Testing Production Environment${NC}"
        if curl -s -f "$PROD_URL/api/health" > /dev/null 2>&1; then
            run_tests "$PROD_URL" "Production"
            test_security_headers "$PROD_URL"
            test_error_handling "$PROD_URL"
            generate_report "$PROD_URL"
        else
            echo -e "${RED}Production environment not accessible at $PROD_URL${NC}"
        fi
    fi
    
    echo -e "\n${GREEN}Health check testing complete!${NC}"
}

# Run main function
main "$@"