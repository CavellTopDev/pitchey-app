#!/bin/bash

# Comprehensive test script for Phase 1 optimizations
# Tests caching, WebSocket hibernation, and database optimizations

PRODUCTION_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
LOCAL_URL="http://localhost:8787"
LOG_FILE="optimization-test-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 Testing Pitchey Optimization Implementation" | tee -a "$LOG_FILE"
echo "=============================================" | tee -a "$LOG_FILE"
echo "Production URL: $PRODUCTION_URL" | tee -a "$LOG_FILE"
echo "Local URL: $LOCAL_URL" | tee -a "$LOG_FILE"
echo "Test Started: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test Environment Detection
echo "🔍 Environment Detection Test" | tee -a "$LOG_FILE"
echo "----------------------------" | tee -a "$LOG_FILE"

# Check if local development server is running
if curl -s --connect-timeout 3 "$LOCAL_URL/api/health" > /dev/null 2>&1; then
    TEST_URL="$LOCAL_URL"
    echo "✅ Local development server detected" | tee -a "$LOG_FILE"
    echo "   Testing against: $LOCAL_URL" | tee -a "$LOG_FILE"
else
    TEST_URL="$PRODUCTION_URL"
    echo "🌐 Using production server" | tee -a "$LOG_FILE"
    echo "   Testing against: $PRODUCTION_URL" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 1: Database Connection Pool Optimization
echo "🗄️  Test 1: Database Connection Pool" | tee -a "$LOG_FILE"
echo "-----------------------------------" | tee -a "$LOG_FILE"

echo -n "Health endpoint response time: " | tee -a "$LOG_FILE"
HEALTH_TIME=$(curl -w "%{time_total}" -s -o /tmp/health_response.json "$TEST_URL/api/health")
echo "${HEALTH_TIME}s" | tee -a "$LOG_FILE"

# Check pool stats
POOL_SIZE=$(cat /tmp/health_response.json 2>/dev/null | jq -r '.poolStats.poolSize // "N/A"')
POOL_INITIALIZED=$(cat /tmp/health_response.json 2>/dev/null | jq -r '.poolStats.initialized // false')

echo "Database pool size: $POOL_SIZE" | tee -a "$LOG_FILE"
echo "Pool initialized: $POOL_INITIALIZED" | tee -a "$LOG_FILE"

if [ "$POOL_SIZE" == "1" ] && [ "$POOL_INITIALIZED" == "true" ]; then
    echo "✅ Database pool optimization: PASS" | tee -a "$LOG_FILE"
else
    echo "⚠️  Database pool optimization: NEEDS REVIEW" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 2: Caching Strategy Implementation
echo "🧊 Test 2: Multi-Layer Caching Strategy" | tee -a "$LOG_FILE"
echo "--------------------------------------" | tee -a "$LOG_FILE"

# Test dashboard endpoint caching
echo "Testing dashboard caching..." | tee -a "$LOG_FILE"

# First request (should be cache miss)
echo -n "First dashboard request (cache miss): " | tee -a "$LOG_FILE"
FIRST_TIME=$(curl -w "%{time_total}" -s -o /tmp/dashboard_first.json "$TEST_URL/api/investor/dashboard" \
    -H "Authorization: Bearer fake-token-for-testing")
echo "${FIRST_TIME}s" | tee -a "$LOG_FILE"

# Second request (should be cache hit)
sleep 1
echo -n "Second dashboard request (cache hit): " | tee -a "$LOG_FILE"
SECOND_TIME=$(curl -w "%{time_total}" -s -o /tmp/dashboard_second.json "$TEST_URL/api/investor/dashboard" \
    -H "Authorization: Bearer fake-token-for-testing")
echo "${SECOND_TIME}s" | tee -a "$LOG_FILE"

# Compare response times
IMPROVEMENT=$(echo "scale=2; ($FIRST_TIME - $SECOND_TIME) / $FIRST_TIME * 100" | bc -l 2>/dev/null || echo "0")
echo "Cache performance improvement: ${IMPROVEMENT}%" | tee -a "$LOG_FILE"

if (( $(echo "$SECOND_TIME < $FIRST_TIME" | bc -l) )); then
    echo "✅ Caching optimization: PASS (${IMPROVEMENT}% improvement)" | tee -a "$LOG_FILE"
else
    echo "⚠️  Caching optimization: NO IMPROVEMENT DETECTED" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 3: WebSocket Hibernation Support
echo "🔌 Test 3: WebSocket Hibernation API" | tee -a "$LOG_FILE"
echo "----------------------------------" | tee -a "$LOG_FILE"

# Test WebSocket upgrade
WS_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$TEST_URL/ws?userId=test&username=TestUser&roomId=optimization-test" \
    --http1.1 \
    --header "Connection: Upgrade" \
    --header "Upgrade: websocket" \
    --header "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    --header "Sec-WebSocket-Version: 13")

echo "WebSocket upgrade status: HTTP $WS_STATUS" | tee -a "$LOG_FILE"

if [ "$WS_STATUS" == "101" ] || [ "$WS_STATUS" == "426" ]; then
    echo "✅ WebSocket support: ENABLED" | tee -a "$LOG_FILE"
else
    echo "⚠️  WebSocket support: DISABLED OR ERROR (Status: $WS_STATUS)" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 4: Authentication Performance
echo "🔐 Test 4: Authentication Optimization" | tee -a "$LOG_FILE"
echo "------------------------------------" | tee -a "$LOG_FILE"

echo -n "Token validation latency: " | tee -a "$LOG_FILE"
AUTH_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$TEST_URL/api/validate-token" \
    -H "Authorization: Bearer invalid-token-for-testing")
echo "${AUTH_TIME}s" | tee -a "$LOG_FILE"

if (( $(echo "$AUTH_TIME < 0.05" | bc -l) )); then
    echo "✅ Authentication performance: EXCELLENT (<50ms)" | tee -a "$LOG_FILE"
elif (( $(echo "$AUTH_TIME < 0.1" | bc -l) )); then
    echo "✅ Authentication performance: GOOD (<100ms)" | tee -a "$LOG_FILE"
else
    echo "⚠️  Authentication performance: NEEDS OPTIMIZATION (>${AUTH_TIME}s)" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 5: Load Testing (Basic)
echo "⚡ Test 5: Basic Load Testing" | tee -a "$LOG_FILE"
echo "----------------------------" | tee -a "$LOG_FILE"

echo "Running 10 concurrent requests to health endpoint..." | tee -a "$LOG_FILE"
START_TIME=$(date +%s.%N)

# Run 10 concurrent health checks
for i in {1..10}; do
    (curl -s "$TEST_URL/api/health" > /tmp/load_test_$i.json) &
done
wait

END_TIME=$(date +%s.%N)
TOTAL_TIME=$(echo "$END_TIME - $START_TIME" | bc)
REQUESTS_PER_SECOND=$(echo "scale=2; 10 / $TOTAL_TIME" | bc)

echo "Total time for 10 requests: ${TOTAL_TIME}s" | tee -a "$LOG_FILE"
echo "Requests per second: ${REQUESTS_PER_SECOND}" | tee -a "$LOG_FILE"

if (( $(echo "$REQUESTS_PER_SECOND > 20" | bc -l) )); then
    echo "✅ Load performance: EXCELLENT (>20 RPS)" | tee -a "$LOG_FILE"
elif (( $(echo "$REQUESTS_PER_SECOND > 10" | bc -l) )); then
    echo "✅ Load performance: GOOD (>10 RPS)" | tee -a "$LOG_FILE"
else
    echo "⚠️  Load performance: NEEDS OPTIMIZATION (<10 RPS)" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Test 6: Error Handling & Resilience
echo "🛡️  Test 6: Error Handling & Resilience" | tee -a "$LOG_FILE"
echo "--------------------------------------" | tee -a "$LOG_FILE"

# Test invalid endpoint
INVALID_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$TEST_URL/api/nonexistent")
echo "Invalid endpoint status: HTTP $INVALID_STATUS" | tee -a "$LOG_FILE"

# Test malformed request
MALFORMED_STATUS=$(curl -s -w "%{http_code}" -o /dev/null "$TEST_URL/api/investor/dashboard" \
    -H "Authorization: Bearer malformed.jwt.token" \
    -H "Content-Type: application/json" \
    -d '{"invalid": json}')
echo "Malformed request status: HTTP $MALFORMED_STATUS" | tee -a "$LOG_FILE"

if [ "$INVALID_STATUS" == "404" ] && [ "$MALFORMED_STATUS" == "401" ]; then
    echo "✅ Error handling: PROPER" | tee -a "$LOG_FILE"
else
    echo "⚠️  Error handling: REVIEW NEEDED" | tee -a "$LOG_FILE"
fi
echo "" | tee -a "$LOG_FILE"

# Performance Summary
echo "📊 OPTIMIZATION PERFORMANCE SUMMARY" | tee -a "$LOG_FILE"
echo "===================================" | tee -a "$LOG_FILE"

echo "Database Pool Health:" | tee -a "$LOG_FILE"
echo "  - Pool Size: $POOL_SIZE (Target: 1)" | tee -a "$LOG_FILE"
echo "  - Initialized: $POOL_INITIALIZED" | tee -a "$LOG_FILE"
echo "  - Health Latency: ${HEALTH_TIME}s (Target: <0.1s)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "Caching Performance:" | tee -a "$LOG_FILE"
echo "  - Cache Miss Time: ${FIRST_TIME}s" | tee -a "$LOG_FILE"
echo "  - Cache Hit Time: ${SECOND_TIME}s" | tee -a "$LOG_FILE"
echo "  - Performance Improvement: ${IMPROVEMENT}% (Target: >50%)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "Authentication Performance:" | tee -a "$LOG_FILE"
echo "  - Token Validation: ${AUTH_TIME}s (Target: <0.05s)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "Load Performance:" | tee -a "$LOG_FILE"
echo "  - Concurrent RPS: ${REQUESTS_PER_SECOND} (Target: >20)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Overall Assessment
echo "🎯 OPTIMIZATION STATUS" | tee -a "$LOG_FILE"
echo "======================" | tee -a "$LOG_FILE"

PASSED=0
TOTAL=6

# Count passing tests
if [ "$POOL_SIZE" == "1" ] && [ "$POOL_INITIALIZED" == "true" ]; then ((PASSED++)); fi
if (( $(echo "$SECOND_TIME < $FIRST_TIME" | bc -l) )); then ((PASSED++)); fi
if [ "$WS_STATUS" == "101" ] || [ "$WS_STATUS" == "426" ]; then ((PASSED++)); fi
if (( $(echo "$AUTH_TIME < 0.1" | bc -l) )); then ((PASSED++)); fi
if (( $(echo "$REQUESTS_PER_SECOND > 10" | bc -l) )); then ((PASSED++)); fi
if [ "$INVALID_STATUS" == "404" ] && [ "$MALFORMED_STATUS" == "401" ]; then ((PASSED++)); fi

PERCENTAGE=$((PASSED * 100 / TOTAL))

echo "Tests Passed: $PASSED/$TOTAL ($PERCENTAGE%)" | tee -a "$LOG_FILE"

if [ $PERCENTAGE -ge 85 ]; then
    echo "🎉 Status: EXCELLENT - Optimizations working well!" | tee -a "$LOG_FILE"
elif [ $PERCENTAGE -ge 70 ]; then
    echo "✅ Status: GOOD - Minor issues to address" | tee -a "$LOG_FILE"
elif [ $PERCENTAGE -ge 50 ]; then
    echo "⚠️  Status: NEEDS WORK - Several optimizations incomplete" | tee -a "$LOG_FILE"
else
    echo "❌ Status: CRITICAL - Major optimization issues detected" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo "💡 NEXT STEPS:" | tee -a "$LOG_FILE"
echo "=============" | tee -a "$LOG_FILE"

if [ "$POOL_SIZE" != "1" ]; then
    echo "- Fix database connection pool singleton pattern" | tee -a "$LOG_FILE"
fi

if ! (( $(echo "$SECOND_TIME < $FIRST_TIME" | bc -l) )); then
    echo "- Implement caching strategy in endpoints" | tee -a "$LOG_FILE"
fi

if [ "$WS_STATUS" != "101" ] && [ "$WS_STATUS" != "426" ]; then
    echo "- Enable WebSocket Durable Objects" | tee -a "$LOG_FILE"
fi

if (( $(echo "$AUTH_TIME > 0.1" | bc -l) )); then
    echo "- Optimize JWT validation performance" | tee -a "$LOG_FILE"
fi

if (( $(echo "$REQUESTS_PER_SECOND < 20" | bc -l) )); then
    echo "- Investigate load handling bottlenecks" | tee -a "$LOG_FILE"
fi

echo "- Run 'monitor-performance.sh' for ongoing monitoring" | tee -a "$LOG_FILE"
echo "- Execute set-neon-limits.sql for cost controls" | tee -a "$LOG_FILE"
echo "- Consider Service Bindings implementation" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "Test completed: $(date)" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"

# Clean up temporary files
rm -f /tmp/health_response.json /tmp/dashboard_*.json /tmp/load_test_*.json

echo ""
echo "📄 Full test results saved to: $LOG_FILE"
echo ""
echo "🚀 Quick Status: $PASSED/$TOTAL tests passed ($PERCENTAGE%)"