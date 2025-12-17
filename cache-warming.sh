#!/bin/bash

# Cache Warming Script for Pitchey
# Warms up frequently accessed endpoints to improve performance

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

echo "🔥 Cache Warming Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Warming up frequently accessed endpoints..."
echo ""

# Track warming statistics
TOTAL=0
SUCCESS=0
CACHED=0

# Function to warm an endpoint
warm_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo -n "📍 Warming $description... "
    
    # First request to warm the cache
    response1=$(curl -s -w "\n%{http_code}" -o /dev/null -D - "$API_URL$endpoint")
    status1=$(echo "$response1" | tail -1)
    cache1=$(echo "$response1" | grep -i "x-cache-status:" | cut -d: -f2 | tr -d ' \r')
    
    # Second request to verify cache
    sleep 0.5
    response2=$(curl -s -w "\n%{http_code}" -o /dev/null -D - "$API_URL$endpoint")
    cache2=$(echo "$response2" | grep -i "x-cache-status:" | cut -d: -f2 | tr -d ' \r')
    
    TOTAL=$((TOTAL + 1))
    
    if [ "$status1" = "200" ]; then
        SUCCESS=$((SUCCESS + 1))
        if [ "$cache2" = "HIT" ]; then
            CACHED=$((CACHED + 1))
            echo "✅ Warmed (Cache: $cache1 → $cache2)"
        else
            echo "✅ Warmed (Cache: $cache1 → $cache2)"
        fi
    else
        echo "❌ Failed (Status: $status1)"
    fi
}

# Critical endpoints to warm
echo "🎯 Phase 1: Critical Endpoints"
echo "─────────────────────────────"
warm_endpoint "/api/health" "Health Check"
warm_endpoint "/api/pitches/browse/enhanced?limit=24" "Browse Enhanced (Default)"
warm_endpoint "/api/pitches/browse/enhanced?limit=12" "Browse Enhanced (Mobile)"
warm_endpoint "/api/pitches/browse/general?limit=24" "Browse General"

echo ""
echo "🎬 Phase 2: Genre-Specific Caches"
echo "─────────────────────────────"
for genre in "Action" "Comedy" "Drama" "Horror" "Sci-Fi"; do
    warm_endpoint "/api/pitches/browse/enhanced?genre=$genre&limit=10" "$genre Movies"
done

echo ""
echo "📊 Phase 3: Sorting Variants"
echo "─────────────────────────────"
warm_endpoint "/api/pitches/browse/enhanced?sort=date&order=desc&limit=10" "Latest Pitches"
warm_endpoint "/api/pitches/browse/enhanced?sort=views&order=desc&limit=10" "Most Viewed"
warm_endpoint "/api/pitches/browse/enhanced?sort=rating&order=desc&limit=10" "Top Rated"

echo ""
echo "🔍 Phase 4: Search Patterns"
echo "─────────────────────────────"
# Common search terms
for term in "thriller" "romance" "adventure"; do
    warm_endpoint "/api/search/pitches?q=$term&limit=10" "Search: $term"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cache Warming Complete!"
echo ""
echo "📊 Statistics:"
echo "  Total Endpoints: $TOTAL"
echo "  Successful: $SUCCESS"
echo "  Cached: $CACHED"
echo "  Success Rate: $(( SUCCESS * 100 / TOTAL ))%"
echo ""

# Verify cache status
echo "🔍 Verifying Cache Status..."
echo "─────────────────────────────"
for i in {1..3}; do
    echo -n "Test $i: "
    curl -s -D - "$API_URL/api/pitches/browse/enhanced?limit=5" | \
        grep -i "x-cache-status:" | tr -d '\r'
    sleep 1
done

echo ""
echo "💡 Recommendations:"
echo "  • Schedule this script to run every 4 hours"
echo "  • Add to crontab: 0 */4 * * * /path/to/cache-warming.sh"
echo "  • Monitor cache hit rates after warming"
echo "  • Adjust endpoints based on usage patterns"