#!/bin/bash

# Cache Warming Script for Pitchey Production
# Preloads critical endpoints into edge cache

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
ENDPOINTS=(
    "/api/health"
    "/api/pitches/browse/enhanced"
    "/api/pitches/browse/general"
    "/api/pitches/trending"
    "/api/pitches/new"
    "/api/dashboard/stats"
    "/api/dashboard/trending"
    "/api/dashboard/analytics"
)

echo -e "${BLUE}🔥 Starting Cache Warming for Pitchey Production${NC}"
echo "============================================================"
echo ""

# Function to warm a single endpoint
warm_endpoint() {
    local endpoint=$1
    local url="${API_URL}${endpoint}"
    
    echo -n "  Warming ${endpoint}: "
    
    # Make initial request to warm cache
    response=$(curl -s -w "\n%{http_code}|%{time_total}" -o /dev/null "${url}")
    http_code=$(echo "$response" | cut -d'|' -f1)
    time_taken=$(echo "$response" | cut -d'|' -f2)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ OK${NC} (${time_taken}s)"
        
        # Make second request to verify cache hit
        sleep 0.5
        response2=$(curl -s -D - "${url}" | head -20)
        cache_status=$(echo "$response2" | grep -i "x-cache-status:" | cut -d':' -f2 | tr -d ' \r')
        
        if [ -n "$cache_status" ]; then
            echo -e "    Cache Status: ${YELLOW}${cache_status}${NC}"
        fi
    else
        echo -e "${RED}✗ Failed${NC} (HTTP ${http_code})"
        return 1
    fi
}

# Function to test cache performance
test_cache_performance() {
    local endpoint=$1
    local url="${API_URL}${endpoint}"
    
    echo -e "\n${BLUE}Testing cache performance for ${endpoint}:${NC}"
    
    # Cold cache request
    curl -s -o /dev/null "${url}"
    sleep 1
    
    # Warm cache requests (should be faster)
    local total_time=0
    local count=0
    
    for i in {1..3}; do
        time_taken=$(curl -s -w "%{time_total}" -o /dev/null "${url}")
        total_time=$(echo "$total_time + $time_taken" | bc)
        count=$((count + 1))
        echo "  Request $i: ${time_taken}s"
    done
    
    avg_time=$(echo "scale=3; $total_time / $count" | bc)
    echo -e "  ${GREEN}Average response time: ${avg_time}s${NC}"
}

# Main execution
main() {
    local failed=0
    local succeeded=0
    
    echo -e "${YELLOW}📊 Warming ${#ENDPOINTS[@]} endpoints...${NC}"
    echo ""
    
    for endpoint in "${ENDPOINTS[@]}"; do
        if warm_endpoint "$endpoint"; then
            succeeded=$((succeeded + 1))
        else
            failed=$((failed + 1))
        fi
    done
    
    echo ""
    echo "============================================================"
    echo -e "${GREEN}✅ Succeeded: ${succeeded}${NC}"
    if [ $failed -gt 0 ]; then
        echo -e "${RED}❌ Failed: ${failed}${NC}"
    fi
    
    # Test performance on critical endpoints
    echo ""
    echo -e "${BLUE}🎯 Testing Cache Performance:${NC}"
    test_cache_performance "/api/pitches/browse/enhanced"
    test_cache_performance "/api/dashboard/stats"
    
    echo ""
    echo -e "${GREEN}✨ Cache warming complete!${NC}"
    
    # Generate cache statistics
    echo ""
    echo -e "${BLUE}📈 Cache Statistics:${NC}"
    echo "  - Endpoints warmed: ${succeeded}/${#ENDPOINTS[@]}"
    echo "  - Cache TTL: 300 seconds (5 minutes)"
    echo "  - Next warm recommended in: 4 minutes"
    
    return $failed
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi