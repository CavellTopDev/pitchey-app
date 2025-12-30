#!/bin/bash

# Performance Testing Script for Optimized Worker
# Tests response times, cache hit rates, and error handling

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Cloudflare Worker Performance Testing${NC}"
echo "==========================================="
echo "Target: $API_URL"
echo "Time: $(date)"
echo ""

# Function to test endpoint with detailed metrics
test_endpoint() {
    local endpoint=$1
    local name=$2
    local method=${3:-GET}
    local data=${4:-}
    
    echo -e "\n${YELLOW}📊 Testing: $name${NC}"
    echo "Endpoint: $method $endpoint"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Arrays to store metrics
    declare -a response_times=()
    local cache_hits=0
    local total_requests=5
    local errors=0
    
    # Warm up request (not counted)
    curl -s -o /dev/null "$API_URL$endpoint"
    sleep 1
    
    # Perform test requests
    for i in $(seq 1 $total_requests); do
        # Prepare curl command
        if [ "$method" = "GET" ]; then
            response=$(curl -s -w "\n%{time_total}|%{http_code}|%{size_download}" \
                -H "Accept: application/json" \
                -D /tmp/headers_$$.txt \
                "$API_URL$endpoint" 2>/dev/null)
        else
            response=$(curl -s -w "\n%{time_total}|%{http_code}|%{size_download}" \
                -X "$method" \
                -H "Accept: application/json" \
                -H "Content-Type: application/json" \
                -D /tmp/headers_$$.txt \
                ${data:+-d "$data"} \
                "$API_URL$endpoint" 2>/dev/null)
        fi
        
        # Parse metrics
        metrics=$(echo "$response" | tail -1)
        time=$(echo "$metrics" | cut -d'|' -f1)
        code=$(echo "$metrics" | cut -d'|' -f2)
        size=$(echo "$metrics" | cut -d'|' -f3)
        
        # Check cache status from headers
        cache_status=$(grep -i "x-cache-status" /tmp/headers_$$.txt 2>/dev/null | cut -d' ' -f2 | tr -d '\r\n')
        response_time_header=$(grep -i "x-response-time" /tmp/headers_$$.txt 2>/dev/null | cut -d' ' -f2 | tr -d '\r\n')
        
        # Convert to milliseconds
        time_ms=$(echo "$time * 1000" | bc | cut -d'.' -f1)
        response_times+=($time_ms)
        
        # Count cache hits
        if [ "$cache_status" = "HIT" ]; then
            ((cache_hits++))
            cache_indicator="${GREEN}✓ CACHE HIT${NC}"
        else
            cache_indicator="${YELLOW}○ CACHE MISS${NC}"
        fi
        
        # Check for errors
        if [ "$code" -ge 400 ]; then
            ((errors++))
            status_indicator="${RED}✗ ERROR${NC}"
        else
            status_indicator="${GREEN}✓ OK${NC}"
        fi
        
        # Display request result
        printf "  Request %d: %4dms | HTTP %s | %s | %s | Size: %s bytes\n" \
            $i $time_ms $code "$status_indicator" "$cache_indicator" $size
        
        # Small delay between requests
        sleep 0.2
    done
    
    # Calculate statistics
    local sum=0
    local min=999999
    local max=0
    
    for time in "${response_times[@]}"; do
        sum=$((sum + time))
        if [ $time -lt $min ]; then min=$time; fi
        if [ $time -gt $max ]; then max=$time; fi
    done
    
    local avg=$((sum / total_requests))
    local cache_rate=$((cache_hits * 100 / total_requests))
    local success_rate=$(( (total_requests - errors) * 100 / total_requests ))
    
    # Display statistics
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}📈 Statistics:${NC}"
    echo "  • Average Response: ${avg}ms"
    echo "  • Min/Max: ${min}ms / ${max}ms"
    echo "  • Cache Hit Rate: ${cache_rate}%"
    echo "  • Success Rate: ${success_rate}%"
    
    # Performance rating
    if [ $avg -lt 100 ]; then
        rating="${GREEN}⚡ EXCELLENT${NC}"
    elif [ $avg -lt 300 ]; then
        rating="${YELLOW}✓ GOOD${NC}"
    else
        rating="${RED}⚠ NEEDS IMPROVEMENT${NC}"
    fi
    echo -e "  • Performance: $rating"
    
    # Clean up
    rm -f /tmp/headers_$$.txt
    
    return $errors
}

# Function to test cache invalidation
test_cache_invalidation() {
    echo -e "\n${YELLOW}🔄 Testing Cache Invalidation${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # First GET request (should be MISS)
    echo "1. Initial GET request..."
    response1=$(curl -s -I "$API_URL/api/pitches?limit=1" | grep -i "x-cache-status" | cut -d' ' -f2 | tr -d '\r\n')
    echo "   Cache Status: ${response1:-MISS}"
    
    sleep 1
    
    # Second GET request (should be HIT)
    echo "2. Second GET request..."
    response2=$(curl -s -I "$API_URL/api/pitches?limit=1" | grep -i "x-cache-status" | cut -d' ' -f2 | tr -d '\r\n')
    echo "   Cache Status: ${response2:-MISS}"
    
    # POST request (should invalidate cache)
    echo "3. POST request (mutation)..."
    curl -s -X POST "$API_URL/api/pitches" \
        -H "Content-Type: application/json" \
        -d '{"title":"Test"}' > /dev/null 2>&1
    
    sleep 1
    
    # Third GET request (should be MISS after invalidation)
    echo "4. GET after mutation..."
    response3=$(curl -s -I "$API_URL/api/pitches?limit=1" | grep -i "x-cache-status" | cut -d' ' -f2 | tr -d '\r\n')
    echo "   Cache Status: ${response3:-MISS}"
    
    if [ "$response2" = "HIT" ] && [ "$response3" != "HIT" ]; then
        echo -e "${GREEN}✓ Cache invalidation working correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Cache invalidation may not be working as expected${NC}"
    fi
}

# Function to test concurrent requests
test_concurrent_requests() {
    echo -e "\n${YELLOW}⚡ Testing Concurrent Requests${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Sending 10 concurrent requests..."
    
    start_time=$(date +%s%N)
    
    # Send concurrent requests in background
    for i in {1..10}; do
        curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/api/health" &
    done
    
    # Wait for all requests to complete
    wait
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))
    
    echo "Total time for 10 concurrent requests: ${duration}ms"
    avg_concurrent=$((duration / 10))
    echo "Average time per request: ${avg_concurrent}ms"
    
    if [ $avg_concurrent -lt 100 ]; then
        echo -e "${GREEN}✓ Excellent concurrent performance${NC}"
    else
        echo -e "${YELLOW}⚠ Concurrent performance could be improved${NC}"
    fi
}

# Main testing sequence
echo -e "${BLUE}Starting Performance Tests...${NC}\n"

# Test different endpoints
test_endpoint "/api/health" "Health Check" "GET"
test_endpoint "/api/pitches?limit=10" "List Pitches" "GET"
test_endpoint "/api/users?limit=5" "List Users" "GET"
test_endpoint "/api/pitches/1" "Single Pitch" "GET"

# Test cache invalidation
test_cache_invalidation

# Test concurrent requests
test_concurrent_requests

# Summary
echo -e "\n${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Performance Testing Complete${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
echo "📊 Key Metrics to Monitor:"
echo "  • Response times < 100ms (excellent)"
echo "  • Cache hit rate > 80%"
echo "  • Error rate < 1%"
echo "  • Concurrent handling smooth"
echo ""
echo "💡 Recommendations:"
echo "  • Monitor these metrics regularly"
echo "  • Set up alerts for degradation"
echo "  • Review cache TTL settings"
echo "  • Consider enabling Hyperdrive for DB"