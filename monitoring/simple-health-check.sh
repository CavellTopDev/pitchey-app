#!/bin/bash

# Simple Health Check Script
# Basic monitoring without complex dependencies

# Configuration
API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey.pages.dev}"
TIMEOUT=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Pitchey Health Check - $(date)${NC}"
echo "═══════════════════════════════════════════════════"
printf "%-25s %-10s %-10s %-10s\n" "Service" "Status" "Time(ms)" "HTTP Code"
echo "───────────────────────────────────────────────────"

# Test endpoint function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    # Make request and capture timing and status
    local start_time=$(date +%s%3N)
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
    local end_time=$(date +%s%3N)
    local duration=$((end_time - start_time))
    
    # Determine status and color
    local status="FAIL"
    local color="$RED"
    
    if [ "$response_code" = "$expected_status" ]; then
        if [ $duration -lt 1000 ]; then
            status="GOOD"
            color="$GREEN"
        elif [ $duration -lt 2000 ]; then
            status="SLOW"
            color="$YELLOW"
        else
            status="TIMEOUT"
            color="$RED"
        fi
    fi
    
    # Display result
    printf "%-25s %s%-10s%s %-10s %-10s\n" \
        "$name" "$color" "$status" "$NC" "${duration}ms" "$response_code"
    
    return $( [ "$status" = "FAIL" ] && echo 1 || echo 0 )
}

# Test cache endpoint
test_cache() {
    local url="$API_URL/api/pitches/browse/enhanced?limit=5"
    local hit_count=0
    local total_tests=3
    
    for i in $(seq 1 $total_tests); do
        local headers=$(curl -s -I "$url" --max-time $TIMEOUT 2>/dev/null)
        
        if echo "$headers" | grep -qi "x-cache-status: hit" || 
           echo "$headers" | grep -qi "cf-cache-status: hit"; then
            hit_count=$((hit_count + 1))
        fi
        
        sleep 1
    done
    
    local hit_rate=$((hit_count * 100 / total_tests))
    local cache_status="MISS"
    local color="$RED"
    
    if [ $hit_rate -gt 50 ]; then
        cache_status="HIT"
        color="$GREEN"
    elif [ $hit_rate -gt 0 ]; then
        cache_status="MIXED"
        color="$YELLOW"
    fi
    
    printf "%-25s %s%-10s%s %-10s %-10s\n" \
        "Cache Performance" "$color" "$cache_status" "$NC" "${hit_rate}%" "N/A"
}

# Run health checks
failed_count=0

# Core services
test_endpoint "Frontend" "$FRONTEND_URL" 200 || failed_count=$((failed_count + 1))
test_endpoint "Worker Health" "$API_URL/api/health" 200 || failed_count=$((failed_count + 1))
test_endpoint "Worker Detailed" "$API_URL/api/health/detailed" 200 || failed_count=$((failed_count + 1))
test_endpoint "Browse API" "$API_URL/api/pitches/browse/enhanced?limit=5" 200 || failed_count=$((failed_count + 1))
test_endpoint "Auth Check" "$API_URL/api/auth/check" 200 || failed_count=$((failed_count + 1))

# Cache test
echo "───────────────────────────────────────────────────"
test_cache

# Summary
echo "═══════════════════════════════════════════════════"
if [ $failed_count -eq 0 ]; then
    echo -e "${GREEN}✅ All services healthy${NC}"
else
    echo -e "${RED}❌ $failed_count service(s) failed${NC}"
fi

# System resources
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
echo "💾 Disk Usage: ${disk_usage}%"

if [ $failed_count -gt 0 ]; then
    echo ""
    echo "🔧 Troubleshooting:"
    echo "  • Check worker logs: wrangler tail --format=pretty"
    echo "  • Check service status: curl -v $API_URL/api/health"
    echo "  • Review monitoring dashboards"
    exit 1
fi

exit 0