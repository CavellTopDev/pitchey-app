#!/bin/bash

# Performance testing script for cache layer
# Compares response times with and without caching

WORKER_URL="${1:-https://pitchey-production.cavelltheleaddev.workers.dev}"
ITERATIONS=10

echo "🔬 Cache Performance Testing"
echo "============================"
echo "Worker URL: $WORKER_URL"
echo "Iterations: $ITERATIONS"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test endpoints
ENDPOINTS=(
    "/api/pitches/trending?limit=10"
    "/api/pitches/new?limit=10"
    "/api/pitches/public?limit=10"
    "/api/pitches/1"
    "/api/search?q=horror&genre=Horror"
)

echo -e "${CYAN}Testing endpoints...${NC}"
echo "-------------------"

for endpoint in "${ENDPOINTS[@]}"; do
    echo -e "\n${YELLOW}Testing: $endpoint${NC}"
    
    # First request (cache miss)
    echo -n "  First request (cache miss): "
    FIRST_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$WORKER_URL$endpoint")
    echo "${FIRST_TIME}s"
    
    # Warm up cache
    curl -s -o /dev/null "$WORKER_URL$endpoint"
    
    # Test cached responses
    TOTAL_TIME=0
    MIN_TIME=999999
    MAX_TIME=0
    
    echo -n "  Cached requests: "
    for i in $(seq 1 $ITERATIONS); do
        TIME=$(curl -s -o /dev/null -w "%{time_total}" "$WORKER_URL$endpoint")
        TOTAL_TIME=$(echo "$TOTAL_TIME + $TIME" | bc)
        
        # Track min/max
        if (( $(echo "$TIME < $MIN_TIME" | bc -l) )); then
            MIN_TIME=$TIME
        fi
        if (( $(echo "$TIME > $MAX_TIME" | bc -l) )); then
            MAX_TIME=$TIME
        fi
        
        echo -n "."
    done
    echo ""
    
    # Calculate average
    AVG_TIME=$(echo "scale=4; $TOTAL_TIME / $ITERATIONS" | bc)
    
    # Calculate improvement
    IMPROVEMENT=$(echo "scale=2; (($FIRST_TIME - $AVG_TIME) / $FIRST_TIME) * 100" | bc)
    
    echo -e "  ${GREEN}Results:${NC}"
    echo "    - First request: ${FIRST_TIME}s"
    echo "    - Avg cached: ${AVG_TIME}s"
    echo "    - Min cached: ${MIN_TIME}s"
    echo "    - Max cached: ${MAX_TIME}s"
    echo -e "    - ${GREEN}Improvement: ${IMPROVEMENT}%${NC}"
done

echo ""
echo -e "${CYAN}Cache Statistics${NC}"
echo "----------------"

# Get cache stats
STATS=$(curl -s "$WORKER_URL/api/cache/stats" 2>/dev/null)

if [ $? -eq 0 ] && [ ! -z "$STATS" ]; then
    echo "$STATS" | jq -r '
        if .success then
            "  Cache Enabled: \(.stats.enabled)
  Memory Cache Size: \(.stats.memoryCacheSize // 0)
  Hit Rate: \(.stats.hitRate // 0)%
  Total Hits: \(.stats.hits // 0)
  Total Misses: \(.stats.misses // 0)
  Cache Errors: \(.stats.errors // 0)"
        else
            "  Cache stats not available"
        end
    ' 2>/dev/null || echo "  Could not parse cache stats"
else
    echo "  Cache stats endpoint not available"
fi

echo ""
echo -e "${CYAN}Load Testing (Concurrent Requests)${NC}"
echo "-----------------------------------"

# Test concurrent requests
CONCURRENT=20
TOTAL_REQUESTS=100

echo "Sending $TOTAL_REQUESTS requests with $CONCURRENT concurrent..."

# Use Apache Bench if available
if command -v ab &> /dev/null; then
    echo ""
    ab -n $TOTAL_REQUESTS -c $CONCURRENT -g /tmp/ab-results.tsv \
       "$WORKER_URL/api/pitches/trending?limit=10" 2>&1 | \
       grep -E "Requests per second:|Time per request:|Transfer rate:" | \
       sed 's/^/  /'
else
    # Fallback to curl in background
    echo "  Apache Bench not found, using curl..."
    
    START_TIME=$(date +%s%N)
    
    for i in $(seq 1 $TOTAL_REQUESTS); do
        curl -s -o /dev/null "$WORKER_URL/api/pitches/trending?limit=10" &
        
        # Limit concurrent requests
        if [ $((i % CONCURRENT)) -eq 0 ]; then
            wait
        fi
    done
    wait
    
    END_TIME=$(date +%s%N)
    DURATION=$((($END_TIME - $START_TIME) / 1000000))
    RPS=$(echo "scale=2; $TOTAL_REQUESTS * 1000 / $DURATION" | bc)
    
    echo "  Total time: ${DURATION}ms"
    echo "  Requests per second: $RPS"
fi

echo ""
echo -e "${GREEN}✅ Performance testing complete!${NC}"
echo ""
echo "📊 Recommendations:"
echo "  - Monitor cache hit rate (target >80%)"
echo "  - Adjust TTL values based on data volatility"
echo "  - Consider implementing cache warming for critical endpoints"
echo "  - Set up alerts for cache miss spikes"