#!/bin/bash

# Cache Warming Script for Cloudflare Worker
# Pre-populates cache with frequently accessed endpoints

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔥 Cache Warming Script${NC}"
echo "=================================="
echo "Warming cache for: $API_URL"
echo ""

# Define endpoints to warm
declare -a ENDPOINTS=(
    "/api/health"
    "/api/pitches?limit=10"
    "/api/pitches?limit=20"
    "/api/pitches?limit=50"
    "/api/pitches?status=active"
    "/api/pitches?sort=created_at"
    "/api/pitches?sort=views"
    "/api/users?limit=10"
    "/api/users?userType=creator"
    "/api/users?userType=investor"
    "/api/users?userType=production"
    "/api/ndas?status=pending"
    "/api/ndas?status=approved"
    "/api/notifications?unread=true"
)

# Function to warm a single endpoint
warm_endpoint() {
    local endpoint=$1
    local index=$2
    local total=$3
    
    echo -n -e "[${index}/${total}] Warming ${endpoint}... "
    
    # First request to populate cache
    response=$(curl -s -o /dev/null -w "%{http_code}|%{time_total}" \
        -H "Accept: application/json" \
        "$API_URL$endpoint")
    
    code=$(echo "$response" | cut -d'|' -f1)
    time=$(echo "$response" | cut -d'|' -f2)
    
    # Convert to milliseconds
    time_ms=$(echo "$time * 1000" | bc | cut -d'.' -f1)
    
    if [ "$code" = "200" ]; then
        echo -e "${GREEN}✓${NC} (${time_ms}ms)"
    else
        echo -e "${YELLOW}⚠${NC} HTTP $code"
    fi
}

# Warm all endpoints
total=${#ENDPOINTS[@]}
warmed=0

echo "Warming ${total} endpoints..."
echo ""

for i in "${!ENDPOINTS[@]}"; do
    warm_endpoint "${ENDPOINTS[$i]}" $((i+1)) $total
    ((warmed++))
    sleep 0.1  # Small delay between requests
done

echo ""
echo -e "${GREEN}✅ Cache warming complete!${NC}"
echo "Warmed ${warmed} endpoints"
echo ""

# Verify cache status
echo "Verifying cache status..."
echo "━━━━━━━━━━━━━━━━━━━━━━━"

# Check a few endpoints for cache hits
for endpoint in "/api/pitches?limit=10" "/api/users?limit=10" "/api/health"; do
    cache_status=$(curl -sI "$API_URL$endpoint" | grep -i "x-cache-status" | cut -d' ' -f2 | tr -d '\r\n')
    
    if [ "$cache_status" = "HIT" ]; then
        echo -e "$endpoint: ${GREEN}✓ CACHED${NC}"
    else
        echo -e "$endpoint: ${YELLOW}○ NOT CACHED${NC}"
    fi
done

echo ""
echo "💡 Tips:"
echo "  • Run this script after deployments"
echo "  • Schedule it to run periodically"
echo "  • Add more endpoints as needed"
echo "  • Monitor cache hit rates with ./monitor-worker.sh"