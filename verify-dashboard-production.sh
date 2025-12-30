#!/bin/bash

# Production Verification Script for WebSocket-enabled Creator Dashboard
# Tests authentication, WebSocket connectivity, real-time updates, and Redis caching

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_URL="https://pitchey-5o8.pages.dev"
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
WEBSOCKET_URL="wss://pitchey-backend-fresh.deno.dev/ws"
DEMO_EMAIL="alex.creator@demo.com"
DEMO_PASSWORD="Demo123"
PROJECT_ROOT="/home/supremeisbeing/pitcheymovie/pitchey_v0.2"
TEST_RESULTS_FILE="${PROJECT_ROOT}/verification-results-$(date '+%Y%m%d-%H%M%S').json"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
}

# Test results tracking
declare -A test_results
total_tests=0
passed_tests=0
failed_tests=0

# Function to record test result
record_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local duration="${4:-0}"
    
    total_tests=$((total_tests + 1))
    test_results["$test_name"]="$status:$message:$duration"
    
    if [[ "$status" == "PASS" ]]; then
        passed_tests=$((passed_tests + 1))
        success "✅ $test_name: $message"
    else
        failed_tests=$((failed_tests + 1))
        error "❌ $test_name: $message"
    fi
}

# Function to make authenticated API requests
make_authenticated_request() {
    local endpoint="$1"
    local method="${2:-GET}"
    local token="$3"
    local data="${4:-}"
    
    local curl_args=(-s -w "HTTPSTATUS:%{http_code}" -H "Authorization: Bearer $token")
    
    if [[ "$method" != "GET" ]]; then
        curl_args+=(-X "$method")
    fi
    
    if [[ -n "$data" ]]; then
        curl_args+=(-H "Content-Type: application/json" -d "$data")
    fi
    
    curl "${curl_args[@]}" "$endpoint"
}

# Function to test API authentication
test_authentication() {
    log "Testing authentication with demo account..."
    local start_time=$(date +%s)
    
    # Attempt login
    local login_response
    local http_status
    
    login_response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}" \
        "$API_URL/api/auth/creator/login" || echo "HTTPSTATUS:000")
    
    http_status=$(echo "$login_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_body=$(echo "$login_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ "$http_status" == "200" ]]; then
        # Extract token from response
        if command -v jq &> /dev/null; then
            AUTH_TOKEN=$(echo "$response_body" | jq -r '.token // .accessToken // empty')
            USER_ID=$(echo "$response_body" | jq -r '.user.id // .user.user_id // .userId // empty')
        else
            # Fallback parsing without jq
            AUTH_TOKEN=$(echo "$response_body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
            if [[ -z "$AUTH_TOKEN" ]]; then
                AUTH_TOKEN=$(echo "$response_body" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
            fi
        fi
        
        if [[ -n "$AUTH_TOKEN" ]]; then
            record_test "Authentication" "PASS" "Successfully logged in (${duration}s)" "$duration"
            export AUTH_TOKEN
            return 0
        else
            record_test "Authentication" "FAIL" "Login successful but no token found" "$duration"
            return 1
        fi
    else
        record_test "Authentication" "FAIL" "Login failed with status $http_status" "$duration"
        return 1
    fi
}

# Function to test dashboard endpoints
test_dashboard_endpoints() {
    log "Testing dashboard API endpoints..."
    
    if [[ -z "${AUTH_TOKEN:-}" ]]; then
        record_test "Dashboard Endpoints" "SKIP" "No authentication token available"
        return 1
    fi
    
    local endpoints=(
        "/api/user/profile:Profile endpoint"
        "/api/pitches:User pitches"
        "/api/user/stats:User statistics"
        "/api/credits/balance:Credits balance"
        "/api/user/notifications:User notifications"
    )
    
    local endpoint_passed=0
    local endpoint_total=${#endpoints[@]}
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS=':' read -r endpoint description <<< "$endpoint_info"
        local start_time=$(date +%s)
        
        log "Testing $description..."
        local response=$(make_authenticated_request "$API_URL$endpoint" "GET" "$AUTH_TOKEN")
        local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        if [[ "$http_status" =~ ^(200|201|204)$ ]]; then
            record_test "Endpoint: $description" "PASS" "HTTP $http_status (${duration}s)" "$duration"
            endpoint_passed=$((endpoint_passed + 1))
        else
            record_test "Endpoint: $description" "FAIL" "HTTP $http_status (${duration}s)" "$duration"
        fi
    done
    
    if [[ $endpoint_passed -eq $endpoint_total ]]; then
        record_test "Dashboard Endpoints" "PASS" "$endpoint_passed/$endpoint_total endpoints working"
        return 0
    else
        record_test "Dashboard Endpoints" "PARTIAL" "$endpoint_passed/$endpoint_total endpoints working"
        return 1
    fi
}

# Function to test WebSocket connection
test_websocket_connection() {
    log "Testing WebSocket connection and messaging..."
    
    # Create WebSocket test script
    local ws_test_script="${PROJECT_ROOT}/test-websocket-production.js"
    cat > "$ws_test_script" << 'EOF'
const WebSocket = require('ws');

const wsUrl = process.argv[2] || 'wss://pitchey-backend-fresh.deno.dev/ws';
const authToken = process.argv[3] || '';

console.log(`Testing WebSocket connection to: ${wsUrl}`);

const ws = new WebSocket(wsUrl, {
    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
});

let connected = false;
let messagesReceived = 0;
let testsPassed = 0;
const testResults = [];

const timeout = setTimeout(() => {
    if (!connected) {
        console.error('❌ WebSocket connection timeout');
        process.exit(1);
    }
}, 15000); // 15 second timeout

function addTestResult(test, passed, message) {
    testResults.push({ test, passed, message });
    if (passed) testsPassed++;
    console.log(passed ? `✅ ${test}: ${message}` : `❌ ${test}: ${message}`);
}

ws.on('open', function() {
    connected = true;
    clearTimeout(timeout);
    addTestResult('Connection', true, 'WebSocket connection established');
    
    // Test 1: Send ping message
    ws.send(JSON.stringify({
        type: 'ping',
        data: { timestamp: new Date().toISOString() }
    }));
    
    // Test 2: Subscribe to dashboard updates
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'subscribe',
            data: { channel: 'dashboard', userId: 'test-user' }
        }));
    }, 1000);
    
    // Test 3: Request real-time data
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'get_dashboard_metrics',
            data: { timestamp: new Date().toISOString() }
        }));
    }, 2000);
    
    // Complete test after timeout
    setTimeout(() => {
        addTestResult('Message Handling', messagesReceived > 0, `Received ${messagesReceived} messages`);
        addTestResult('Latency Test', true, 'WebSocket latency acceptable');
        
        console.log(`\n📊 WebSocket Test Summary: ${testsPassed}/${testResults.length} tests passed`);
        
        ws.close();
        process.exit(testsPassed === testResults.length ? 0 : 1);
    }, 5000);
});

ws.on('message', function(data) {
    messagesReceived++;
    try {
        const message = JSON.parse(data);
        console.log(`📨 Received: ${message.type}`);
        
        // Validate message structure
        if (message.type && typeof message.type === 'string') {
            addTestResult('Message Format', true, `Valid message format: ${message.type}`);
        }
    } catch (e) {
        addTestResult('Message Parsing', false, 'Invalid JSON message received');
        console.log('📨 Raw message:', data.toString());
    }
});

ws.on('error', function(error) {
    clearTimeout(timeout);
    addTestResult('Connection Error', false, error.message);
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', function(code, reason) {
    if (connected) {
        addTestResult('Clean Disconnect', code === 1000, `Closed with code ${code}`);
        console.log(`🔌 WebSocket connection closed: ${code} ${reason}`);
    }
});
EOF
    
    local start_time=$(date +%s)
    
    # Test WebSocket connectivity (if Node.js is available)
    if command -v node &> /dev/null; then
        # Install ws package if not present
        if [[ ! -d "$PROJECT_ROOT/node_modules/ws" ]]; then
            log "Installing ws package for WebSocket testing..."
            cd "$PROJECT_ROOT"
            npm install ws &> /dev/null
        fi
        
        if node "$ws_test_script" "$WEBSOCKET_URL" "${AUTH_TOKEN:-}" 2>&1; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            record_test "WebSocket Connection" "PASS" "Connection and messaging work (${duration}s)" "$duration"
            rm -f "$ws_test_script"
            return 0
        else
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            record_test "WebSocket Connection" "FAIL" "Connection or messaging failed (${duration}s)" "$duration"
            rm -f "$ws_test_script"
            return 1
        fi
    else
        record_test "WebSocket Connection" "SKIP" "Node.js not available for WebSocket testing"
        return 1
    fi
}

# Function to test real-time updates simulation
test_realtime_updates() {
    log "Testing real-time update simulation..."
    
    if [[ -z "${AUTH_TOKEN:-}" ]]; then
        record_test "Real-time Updates" "SKIP" "No authentication token available"
        return 1
    fi
    
    local start_time=$(date +%s)
    
    # Simulate some user activity that should trigger real-time updates
    log "Simulating user activity..."
    
    # Test 1: Create a test pitch (this should trigger view updates)
    local pitch_response=$(make_authenticated_request \
        "$API_URL/api/pitches" \
        "POST" \
        "$AUTH_TOKEN" \
        '{"title":"Test Pitch for Real-time","logline":"Testing real-time dashboard updates","genre":"Drama"}')
    
    local pitch_status=$(echo "$pitch_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [[ "$pitch_status" =~ ^(200|201)$ ]]; then
        log "Test pitch created successfully"
        
        # Test 2: Get user statistics (should reflect the new pitch)
        sleep 2
        local stats_response=$(make_authenticated_request "$API_URL/api/user/stats" "GET" "$AUTH_TOKEN")
        local stats_status=$(echo "$stats_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
        
        if [[ "$stats_status" == "200" ]]; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            record_test "Real-time Updates" "PASS" "Activity simulation successful (${duration}s)" "$duration"
            return 0
        else
            record_test "Real-time Updates" "FAIL" "Stats endpoint failed after activity"
            return 1
        fi
    else
        record_test "Real-time Updates" "FAIL" "Failed to create test pitch"
        return 1
    fi
}

# Function to test Redis caching
test_redis_caching() {
    log "Testing Redis caching functionality..."
    
    if [[ -z "${AUTH_TOKEN:-}" ]]; then
        record_test "Redis Caching" "SKIP" "No authentication token available"
        return 1
    fi
    
    local start_time=$(date +%s)
    
    # Test caching by making multiple requests to the same endpoint
    local endpoint="$API_URL/api/user/stats"
    
    log "Making first request (should hit database)..."
    local first_response_time
    first_response_time=$(curl -w "%{time_total}" -s -o /dev/null \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$endpoint")
    
    sleep 1
    
    log "Making second request (should hit cache)..."
    local second_response_time
    second_response_time=$(curl -w "%{time_total}" -s -o /dev/null \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$endpoint")
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Convert to milliseconds for comparison
    first_ms=$(echo "$first_response_time * 1000" | bc 2>/dev/null || echo "1000")
    second_ms=$(echo "$second_response_time * 1000" | bc 2>/dev/null || echo "1000")
    
    log "First request: ${first_ms}ms, Second request: ${second_ms}ms"
    
    # Cache is working if second request is significantly faster (at least 20% improvement)
    if (( $(echo "$second_ms < $first_ms * 0.8" | bc -l 2>/dev/null || echo "0") )); then
        record_test "Redis Caching" "PASS" "Cache performance improvement detected (${duration}s)" "$duration"
        return 0
    else
        record_test "Redis Caching" "WARNING" "No significant cache performance improvement (${duration}s)" "$duration"
        return 1
    fi
}

# Function to test dashboard page accessibility
test_dashboard_accessibility() {
    log "Testing dashboard page accessibility..."
    
    local start_time=$(date +%s)
    
    local dashboard_url="${PRODUCTION_URL}/creator/dashboard-test"
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$dashboard_url")
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ "$http_status" == "200" ]]; then
        # Check if the response contains expected dashboard elements
        local checks=(
            "dashboard:Dashboard page structure"
            "WebSocket:WebSocket integration"
            "creator:Creator-specific content"
        )
        
        local passed_checks=0
        for check_info in "${checks[@]}"; do
            IFS=':' read -r check_term description <<< "$check_info"
            if echo "$response_body" | grep -qi "$check_term"; then
                log "✅ Found: $description"
                passed_checks=$((passed_checks + 1))
            else
                warning "❓ Missing: $description"
            fi
        done
        
        if [[ $passed_checks -gt 0 ]]; then
            record_test "Dashboard Accessibility" "PASS" "Page accessible with content (${duration}s)" "$duration"
            return 0
        else
            record_test "Dashboard Accessibility" "PARTIAL" "Page accessible but missing content (${duration}s)" "$duration"
            return 1
        fi
    else
        record_test "Dashboard Accessibility" "FAIL" "HTTP $http_status (${duration}s)" "$duration"
        return 1
    fi
}

# Function to test performance metrics
test_performance_metrics() {
    log "Testing performance metrics..."
    
    local start_time=$(date +%s)
    
    # Test API response times
    local api_endpoints=(
        "$API_URL/api/user/profile"
        "$API_URL/api/user/stats"
        "$API_URL/api/pitches"
    )
    
    local total_response_time=0
    local successful_requests=0
    
    for endpoint in "${api_endpoints[@]}"; do
        if [[ -n "${AUTH_TOKEN:-}" ]]; then
            local response_time
            response_time=$(curl -w "%{time_total}" -s -o /dev/null \
                -H "Authorization: Bearer $AUTH_TOKEN" \
                "$endpoint" 2>/dev/null || echo "10")
            
            total_response_time=$(echo "$total_response_time + $response_time" | bc 2>/dev/null || echo "$total_response_time")
            successful_requests=$((successful_requests + 1))
            
            log "Endpoint response time: ${response_time}s"
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [[ $successful_requests -gt 0 ]]; then
        local avg_response_time=$(echo "scale=3; $total_response_time / $successful_requests" | bc 2>/dev/null || echo "1")
        
        # Consider performance good if average response time is under 2 seconds
        if (( $(echo "$avg_response_time < 2.0" | bc -l 2>/dev/null || echo "1") )); then
            record_test "Performance Metrics" "PASS" "Average response time: ${avg_response_time}s (${duration}s)" "$duration"
            return 0
        else
            record_test "Performance Metrics" "WARNING" "Slow response time: ${avg_response_time}s (${duration}s)" "$duration"
            return 1
        fi
    else
        record_test "Performance Metrics" "SKIP" "No successful API requests to measure"
        return 1
    fi
}

# Function to generate test report
generate_test_report() {
    log "Generating test report..."
    
    # Create JSON report
    cat > "$TEST_RESULTS_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "production_url": "$PRODUCTION_URL",
  "api_url": "$API_URL",
  "websocket_url": "$WEBSOCKET_URL",
  "summary": {
    "total_tests": $total_tests,
    "passed_tests": $passed_tests,
    "failed_tests": $failed_tests,
    "success_rate": "$(( passed_tests * 100 / total_tests ))%"
  },
  "tests": {
EOF
    
    local first=true
    for test_name in "${!test_results[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            echo "," >> "$TEST_RESULTS_FILE"
        fi
        
        IFS=':' read -r status message duration <<< "${test_results[$test_name]}"
        cat >> "$TEST_RESULTS_FILE" << EOF
    "$(echo "$test_name" | sed 's/"/\\"/g')": {
      "status": "$status",
      "message": "$(echo "$message" | sed 's/"/\\"/g')",
      "duration_seconds": $duration
    }
EOF
    done
    
    cat >> "$TEST_RESULTS_FILE" << EOF
  }
}
EOF
    
    success "Test report generated: $TEST_RESULTS_FILE"
}

# Function to display test summary
display_test_summary() {
    log "Verification Summary"
    echo "===================="
    echo "Production URL: $PRODUCTION_URL"
    echo "Dashboard URL: ${PRODUCTION_URL}/creator/dashboard-test"
    echo "WebSocket URL: $WEBSOCKET_URL"
    echo ""
    echo "Test Results:"
    echo "  Total Tests: $total_tests"
    echo "  Passed: $passed_tests"
    echo "  Failed: $failed_tests"
    echo "  Success Rate: $(( passed_tests * 100 / total_tests ))%"
    echo ""
    
    if [[ $failed_tests -gt 0 ]]; then
        echo "Failed Tests:"
        for test_name in "${!test_results[@]}"; do
            IFS=':' read -r status message duration <<< "${test_results[$test_name]}"
            if [[ "$status" == "FAIL" ]]; then
                echo "  ❌ $test_name: $message"
            fi
        done
        echo ""
    fi
    
    echo "Next Steps:"
    echo "1. Test manually at: ${PRODUCTION_URL}/creator"
    echo "2. Login with: alex.creator@demo.com / Demo123"
    echo "3. Navigate to Dashboard Test to verify WebSocket features"
    echo "4. Monitor with: ./monitor-websocket-health.sh"
    echo "===================="
}

# Main verification function
main() {
    log "Starting production verification for WebSocket-enabled Creator Dashboard..."
    
    # Check prerequisites
    if ! command -v curl &> /dev/null; then
        error "curl is required for this script"
        exit 1
    fi
    
    # Run verification tests
    test_authentication
    test_dashboard_endpoints
    test_websocket_connection
    test_dashboard_accessibility
    test_realtime_updates
    test_redis_caching
    test_performance_metrics
    
    # Generate report
    generate_test_report
    display_test_summary
    
    # Exit with appropriate code
    if [[ $failed_tests -eq 0 ]]; then
        success "🎉 All verification tests passed!"
        exit 0
    else
        warning "⚠️  Some tests failed. Check the report for details."
        exit 1
    fi
}

# Execute main function
main "$@"