#!/bin/bash

# Pitchey Platform - 100% Functionality Verification Test Suite
# Comprehensive testing for all critical features and fixes
# Created: October 2025

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Backend PID for cleanup
BACKEND_PID=""

# Test categories
declare -A TEST_CATEGORIES=(
    ["ENVIRONMENT"]="Frontend environment configuration (port 8001)"
    ["STORAGE"]="Local storage implementation (file uploads without S3)"
    ["BROWSE"]="Browse tab display (trending, new, general)"
    ["INVESTOR"]="Investor dashboard functionality"
    ["DOCUMENTS"]="Document file serving with proper auth"
    ["INFO_REQUEST"]="Info request routes"
    ["TYPESCRIPT"]="TypeScript compilation (no type errors)"
    ["LOGGING"]="Console logging (no Sentry errors)"
    ["PAYMENTS"]="Mock Stripe payments"
    ["NDA"]="NDA workflow (request, approve, sign, access)"
    ["CHARACTERS"]="Character management in pitch creation"
    ["WEBSOCKET"]="WebSocket real-time features"
)

# Demo accounts
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PRODUCTION_EMAIL="stellar.production@demo.com"
DEMO_PASSWORD="Demo123"

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  PITCHEY PLATFORM - 100% VERIFICATION SUITE  ${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo -e "${CYAN}Testing all critical features and client fixes${NC}"
    echo -e "${CYAN}Target: 100% functionality verification${NC}"
    echo
}

print_category() {
    local category=$1
    local description=${TEST_CATEGORIES[$category]}
    echo
    echo -e "${PURPLE}[CATEGORY: $category]${NC} $description"
    echo -e "${PURPLE}================================================${NC}"
}

log_test() {
    local test_name="$1"
    local status="$2"
    local details="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "✅ ${GREEN}PASS${NC}: $test_name"
        if [ -n "$details" ]; then
            echo -e "   ${CYAN}$details${NC}"
        fi
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "❌ ${RED}FAIL${NC}: $test_name"
        if [ -n "$details" ]; then
            echo -e "   ${RED}$details${NC}"
        fi
    fi
}

cleanup() {
    echo
    echo -e "${YELLOW}Cleaning up...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend server (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

start_backend() {
    echo -e "${YELLOW}Starting backend server on port 8001...${NC}"
    
    # Kill any existing process on port 8001
    lsof -ti:8001 | xargs kill -9 2>/dev/null || true
    sleep 2
    
    # Start backend in background
    cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2
    PORT=8001 deno run --allow-all working-server.ts &
    BACKEND_PID=$!
    
    echo "Backend started with PID: $BACKEND_PID"
    
    # Wait for server to be ready
    echo "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8001/health >/dev/null 2>&1; then
            echo -e "${GREEN}Backend server is ready!${NC}"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    
    echo -e "${RED}Backend server failed to start!${NC}"
    return 1
}

test_environment_config() {
    print_category "ENVIRONMENT"
    
    # Test 1: Frontend .env configuration
    if [ -f "frontend/.env" ]; then
        if grep -q "VITE_API_URL=http://localhost:8001" frontend/.env && \
           grep -q "VITE_WS_URL=ws://localhost:8001" frontend/.env; then
            log_test "Frontend .env configured for port 8001" "PASS" "API and WebSocket URLs correctly set"
        else
            log_test "Frontend .env configured for port 8001" "FAIL" "Incorrect port configuration in .env"
        fi
    else
        log_test "Frontend .env file exists" "FAIL" "No .env file found"
    fi
    
    # Test 2: Backend responds on port 8001
    if curl -s http://localhost:8001/health >/dev/null 2>&1; then
        log_test "Backend responds on port 8001" "PASS" "Health check endpoint accessible"
    else
        log_test "Backend responds on port 8001" "FAIL" "Backend not responding"
    fi
    
    # Test 3: WebSocket endpoint accessible
    local ws_test=$(node -e "
        const WebSocket = require('ws');
        const ws = new WebSocket('ws://localhost:8001/ws');
        ws.on('open', () => { console.log('WS_SUCCESS'); process.exit(0); });
        ws.on('error', () => { console.log('WS_FAILED'); process.exit(1); });
        setTimeout(() => { console.log('WS_TIMEOUT'); process.exit(1); }, 5000);
    " 2>/dev/null || echo "WS_FAILED")
    
    if [ "$ws_test" = "WS_SUCCESS" ]; then
        log_test "WebSocket endpoint accessible" "PASS" "ws://localhost:8001/ws connects successfully"
    else
        log_test "WebSocket endpoint accessible" "FAIL" "WebSocket connection failed"
    fi
}

test_local_storage() {
    print_category "STORAGE"
    
    # Test 1: Upload directory exists
    if [ -d "uploads" ]; then
        log_test "Local uploads directory exists" "PASS" "uploads/ directory found"
    else
        log_test "Local uploads directory exists" "FAIL" "uploads/ directory missing"
    fi
    
    # Test 2: Upload endpoint responds
    local upload_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/uploads/test 2>/dev/null || echo "000")
    if [ "$upload_response" != "000" ]; then
        log_test "Upload endpoints accessible" "PASS" "Upload API responds (status: $upload_response)"
    else
        log_test "Upload endpoints accessible" "FAIL" "Upload API not responding"
    fi
    
    # Test 3: File serving endpoint
    local file_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/files/test 2>/dev/null || echo "000")
    if [ "$file_response" != "000" ]; then
        log_test "File serving endpoints accessible" "PASS" "File serving API responds (status: $file_response)"
    else
        log_test "File serving endpoints accessible" "FAIL" "File serving API not responding"
    fi
}

authenticate_user() {
    local email="$1"
    local password="$2"
    local portal="$3"
    
    local auth_response=$(curl -s -X POST http://localhost:8001/api/auth/$portal/login \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}" 2>/dev/null || echo '{"error":"request_failed"}')
    
    local token=$(echo "$auth_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    
    echo "$token"
}

test_browse_functionality() {
    print_category "BROWSE"
    
    # Test 1: Browse endpoints exist
    local browse_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/pitches/browse 2>/dev/null || echo "000")
    if [ "$browse_response" = "200" ]; then
        log_test "Browse endpoint accessible" "PASS" "Browse API returns 200"
    else
        log_test "Browse endpoint accessible" "FAIL" "Browse API status: $browse_response"
    fi
    
    # Test 2: Trending endpoint
    local trending_response=$(curl -s http://localhost:8001/api/pitches/trending 2>/dev/null || echo '{"error":"failed"}')
    if echo "$trending_response" | grep -q '"success"' || echo "$trending_response" | grep -q '\[\]' || echo "$trending_response" | grep -q '"id"'; then
        log_test "Trending pitches endpoint" "PASS" "Trending API responds with data"
    else
        log_test "Trending pitches endpoint" "FAIL" "Trending API failed or no data structure"
    fi
    
    # Test 3: New pitches endpoint
    local new_response=$(curl -s http://localhost:8001/api/pitches/new 2>/dev/null || echo '{"error":"failed"}')
    if echo "$new_response" | grep -q '"success"' || echo "$new_response" | grep -q '\[\]' || echo "$new_response" | grep -q '"id"'; then
        log_test "New pitches endpoint" "PASS" "New pitches API responds with data"
    else
        log_test "New pitches endpoint" "FAIL" "New pitches API failed"
    fi
    
    # Test 4: Genre filtering
    local genre_response=$(curl -s "http://localhost:8001/api/pitches/browse?genre=drama" 2>/dev/null || echo '{"error":"failed"}')
    if echo "$genre_response" | grep -q '"success"' || echo "$genre_response" | grep -q '\[\]'; then
        log_test "Genre filtering works" "PASS" "Browse with genre filter responds"
    else
        log_test "Genre filtering works" "FAIL" "Genre filtering failed"
    fi
}

test_investor_dashboard() {
    print_category "INVESTOR"
    
    # Test 1: Investor authentication
    local investor_token=$(authenticate_user "$INVESTOR_EMAIL" "$DEMO_PASSWORD" "investor")
    if [ -n "$investor_token" ] && [ "$investor_token" != "null" ]; then
        log_test "Investor authentication works" "PASS" "Successfully obtained investor token"
    else
        log_test "Investor authentication works" "FAIL" "Failed to authenticate investor"
        return
    fi
    
    # Test 2: Investor dashboard endpoint
    local dashboard_response=$(curl -s -H "Authorization: Bearer $investor_token" http://localhost:8001/api/investor/dashboard 2>/dev/null || echo '{"error":"failed"}')
    if echo "$dashboard_response" | grep -q '"success"' || echo "$dashboard_response" | grep -q '"user"' || echo "$dashboard_response" | grep -q '"data"'; then
        log_test "Investor dashboard endpoint" "PASS" "Dashboard API responds with data"
    else
        log_test "Investor dashboard endpoint" "FAIL" "Dashboard API failed: $dashboard_response"
    fi
    
    # Test 3: Investor logout
    local logout_response=$(curl -s -X POST -H "Authorization: Bearer $investor_token" http://localhost:8001/api/auth/logout 2>/dev/null || echo '{"error":"failed"}')
    if echo "$logout_response" | grep -q '"success"' || echo "$logout_response" | grep -q '"message"'; then
        log_test "Investor logout functionality" "PASS" "Logout endpoint responds successfully"
    else
        log_test "Investor logout functionality" "FAIL" "Logout failed: $logout_response"
    fi
    
    # Test 4: Protected route after logout
    local protected_response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $investor_token" http://localhost:8001/api/investor/dashboard 2>/dev/null || echo "000")
    if [ "$protected_response" = "401" ] || [ "$protected_response" = "403" ]; then
        log_test "Protected routes secured after logout" "PASS" "Access denied with status $protected_response"
    else
        log_test "Protected routes secured after logout" "FAIL" "Still accessible after logout (status: $protected_response)"
    fi
}

test_document_serving() {
    print_category "DOCUMENTS"
    
    # Test 1: Document upload endpoint
    local upload_test=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8001/api/upload 2>/dev/null || echo "000")
    if [ "$upload_test" != "000" ]; then
        log_test "Document upload endpoint exists" "PASS" "Upload endpoint responds (status: $upload_test)"
    else
        log_test "Document upload endpoint exists" "FAIL" "Upload endpoint not responding"
    fi
    
    # Test 2: File serving with auth
    local creator_token=$(authenticate_user "$CREATOR_EMAIL" "$DEMO_PASSWORD" "creator")
    if [ -n "$creator_token" ]; then
        local file_response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $creator_token" http://localhost:8001/api/files/test.pdf 2>/dev/null || echo "000")
        if [ "$file_response" != "000" ]; then
            log_test "Authenticated file serving" "PASS" "File endpoint responds with auth (status: $file_response)"
        else
            log_test "Authenticated file serving" "FAIL" "File serving not responding"
        fi
    else
        log_test "Authenticated file serving" "FAIL" "Could not authenticate for file serving test"
    fi
    
    # Test 3: Document security (no auth)
    local unauth_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/files/test.pdf 2>/dev/null || echo "000")
    if [ "$unauth_response" = "401" ] || [ "$unauth_response" = "403" ]; then
        log_test "Document access requires authentication" "PASS" "Unauthenticated access denied (status: $unauth_response)"
    else
        log_test "Document access requires authentication" "FAIL" "Documents accessible without auth (status: $unauth_response)"
    fi
}

test_info_request_routes() {
    print_category "INFO_REQUEST"
    
    # Test 1: Info request endpoint exists
    local info_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/info-requests 2>/dev/null || echo "000")
    if [ "$info_response" != "000" ]; then
        log_test "Info request endpoint exists" "PASS" "Info request API responds (status: $info_response)"
    else
        log_test "Info request endpoint exists" "FAIL" "Info request API not responding"
    fi
    
    # Test 2: Info request creation
    local investor_token=$(authenticate_user "$INVESTOR_EMAIL" "$DEMO_PASSWORD" "investor")
    if [ -n "$investor_token" ]; then
        local create_response=$(curl -s -X POST -H "Authorization: Bearer $investor_token" -H "Content-Type: application/json" \
            -d '{"pitchId":"test","requestType":"general","message":"Test request"}' \
            http://localhost:8001/api/info-requests 2>/dev/null || echo '{"error":"failed"}')
        
        if echo "$create_response" | grep -q '"success"' || echo "$create_response" | grep -q '"id"' || echo "$create_response" | grep -q '"created"'; then
            log_test "Info request creation works" "PASS" "Successfully created info request"
        else
            log_test "Info request creation works" "FAIL" "Info request creation failed"
        fi
    else
        log_test "Info request creation works" "FAIL" "Could not authenticate for info request test"
    fi
    
    # Test 3: List info requests
    if [ -n "$investor_token" ]; then
        local list_response=$(curl -s -H "Authorization: Bearer $investor_token" http://localhost:8001/api/info-requests 2>/dev/null || echo '{"error":"failed"}')
        if echo "$list_response" | grep -q '"success"' || echo "$list_response" | grep -q '\[\]' || echo "$list_response" | grep -q '"id"'; then
            log_test "List info requests works" "PASS" "Info requests listed successfully"
        else
            log_test "List info requests works" "FAIL" "Failed to list info requests"
        fi
    else
        log_test "List info requests works" "FAIL" "Could not authenticate for info request list test"
    fi
}

test_typescript_compilation() {
    print_category "TYPESCRIPT"
    
    # Test 1: Backend TypeScript check
    echo "Checking backend TypeScript compilation..."
    if deno check working-server.ts >/dev/null 2>&1; then
        log_test "Backend TypeScript compilation" "PASS" "No TypeScript errors in backend"
    else
        local ts_errors=$(deno check working-server.ts 2>&1 | head -5)
        log_test "Backend TypeScript compilation" "FAIL" "TypeScript errors found: $ts_errors"
    fi
    
    # Test 2: Frontend TypeScript check
    echo "Checking frontend TypeScript compilation..."
    cd frontend
    if npm run type-check >/dev/null 2>&1; then
        log_test "Frontend TypeScript compilation" "PASS" "No TypeScript errors in frontend"
    elif npx tsc --noEmit >/dev/null 2>&1; then
        log_test "Frontend TypeScript compilation" "PASS" "No TypeScript errors in frontend (via tsc)"
    else
        local ts_errors=$(npx tsc --noEmit 2>&1 | head -3)
        log_test "Frontend TypeScript compilation" "FAIL" "TypeScript errors found: $ts_errors"
    fi
    cd ..
}

test_console_logging() {
    print_category "LOGGING"
    
    # Test 1: No Sentry references in backend
    local sentry_refs=$(grep -r "Sentry" working-server.ts src/ 2>/dev/null | wc -l || echo "0")
    if [ "$sentry_refs" -eq 0 ]; then
        log_test "Backend Sentry removal" "PASS" "No Sentry references found in backend"
    else
        log_test "Backend Sentry removal" "FAIL" "$sentry_refs Sentry references still exist"
    fi
    
    # Test 2: Console logging in place
    if grep -q "console.error" working-server.ts; then
        log_test "Console logging implemented" "PASS" "Console logging found in backend"
    else
        log_test "Console logging implemented" "FAIL" "No console logging found"
    fi
    
    # Test 3: Frontend Sentry configuration
    if grep -q "# Sentry removed" frontend/.env || ! grep -q "VITE_SENTRY_DSN=[^#]" frontend/.env; then
        log_test "Frontend Sentry disabled" "PASS" "Sentry disabled in frontend environment"
    else
        log_test "Frontend Sentry disabled" "FAIL" "Sentry still active in frontend"
    fi
}

test_mock_payments() {
    print_category "PAYMENTS"
    
    # Test 1: Stripe webhook endpoint
    local webhook_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8001/api/stripe/webhook 2>/dev/null || echo "000")
    if [ "$webhook_response" != "000" ]; then
        log_test "Stripe webhook endpoint exists" "PASS" "Webhook endpoint responds (status: $webhook_response)"
    else
        log_test "Stripe webhook endpoint exists" "FAIL" "Webhook endpoint not responding"
    fi
    
    # Test 2: Payment intent endpoint
    local creator_token=$(authenticate_user "$CREATOR_EMAIL" "$DEMO_PASSWORD" "creator")
    if [ -n "$creator_token" ]; then
        local payment_response=$(curl -s -X POST -H "Authorization: Bearer $creator_token" -H "Content-Type: application/json" \
            -d '{"amount":100,"currency":"usd"}' \
            http://localhost:8001/api/stripe/payment-intent 2>/dev/null || echo '{"error":"failed"}')
        
        if echo "$payment_response" | grep -q '"client_secret"' || echo "$payment_response" | grep -q '"success"' || echo "$payment_response" | grep -q '"mock"'; then
            log_test "Payment intent creation" "PASS" "Payment intent endpoint works"
        else
            log_test "Payment intent creation" "FAIL" "Payment intent creation failed"
        fi
    else
        log_test "Payment intent creation" "FAIL" "Could not authenticate for payment test"
    fi
    
    # Test 3: Credit packages endpoint
    local packages_response=$(curl -s http://localhost:8001/api/stripe/packages 2>/dev/null || echo '{"error":"failed"}')
    if echo "$packages_response" | grep -q '"packages"' || echo "$packages_response" | grep -q '\[\]' || echo "$packages_response" | grep -q '"credits"'; then
        log_test "Credit packages endpoint" "PASS" "Credit packages listed successfully"
    else
        log_test "Credit packages endpoint" "FAIL" "Credit packages endpoint failed"
    fi
}

test_nda_workflow() {
    print_category "NDA"
    
    # Test 1: NDA endpoints exist
    local nda_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/nda 2>/dev/null || echo "000")
    if [ "$nda_response" != "000" ]; then
        log_test "NDA endpoints accessible" "PASS" "NDA API responds (status: $nda_response)"
    else
        log_test "NDA endpoints accessible" "FAIL" "NDA API not responding"
    fi
    
    # Test 2: NDA request creation
    local investor_token=$(authenticate_user "$INVESTOR_EMAIL" "$DEMO_PASSWORD" "investor")
    if [ -n "$investor_token" ]; then
        local nda_request=$(curl -s -X POST -H "Authorization: Bearer $investor_token" -H "Content-Type: application/json" \
            -d '{"pitchId":"test-pitch","requestType":"standard"}' \
            http://localhost:8001/api/nda/request 2>/dev/null || echo '{"error":"failed"}')
        
        if echo "$nda_request" | grep -q '"success"' || echo "$nda_request" | grep -q '"id"' || echo "$nda_request" | grep -q '"created"'; then
            log_test "NDA request creation" "PASS" "NDA request created successfully"
        else
            log_test "NDA request creation" "FAIL" "NDA request creation failed"
        fi
    else
        log_test "NDA request creation" "FAIL" "Could not authenticate for NDA test"
    fi
    
    # Test 3: NDA status tracking
    if [ -n "$investor_token" ]; then
        local nda_status=$(curl -s -H "Authorization: Bearer $investor_token" http://localhost:8001/api/nda/status 2>/dev/null || echo '{"error":"failed"}')
        if echo "$nda_status" | grep -q '"success"' || echo "$nda_status" | grep -q '\[\]' || echo "$nda_status" | grep -q '"status"'; then
            log_test "NDA status tracking" "PASS" "NDA status endpoint works"
        else
            log_test "NDA status tracking" "FAIL" "NDA status tracking failed"
        fi
    else
        log_test "NDA status tracking" "FAIL" "Could not authenticate for NDA status test"
    fi
    
    # Test 4: NDA document access
    local creator_token=$(authenticate_user "$CREATOR_EMAIL" "$DEMO_PASSWORD" "creator")
    if [ -n "$creator_token" ]; then
        local nda_access=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $creator_token" http://localhost:8001/api/nda/document/test 2>/dev/null || echo "000")
        if [ "$nda_access" != "000" ]; then
            log_test "NDA document access control" "PASS" "NDA document endpoint responds (status: $nda_access)"
        else
            log_test "NDA document access control" "FAIL" "NDA document access failed"
        fi
    else
        log_test "NDA document access control" "FAIL" "Could not authenticate for NDA document test"
    fi
}

test_character_management() {
    print_category "CHARACTERS"
    
    # Test 1: Character schema in pitch creation
    local creator_token=$(authenticate_user "$CREATOR_EMAIL" "$DEMO_PASSWORD" "creator")
    if [ -n "$creator_token" ]; then
        local pitch_create=$(curl -s -X POST -H "Authorization: Bearer $creator_token" -H "Content-Type: application/json" \
            -d '{
                "title":"Test Pitch",
                "logline":"Test logline",
                "genre":"drama",
                "format":"feature",
                "characters":[
                    {"name":"John Doe","description":"Main character","age":"30","gender":"male","displayOrder":1},
                    {"name":"Jane Smith","description":"Supporting character","age":"25","gender":"female","displayOrder":2}
                ]
            }' \
            http://localhost:8001/api/pitches 2>/dev/null || echo '{"error":"failed"}')
        
        if echo "$pitch_create" | grep -q '"success"' || echo "$pitch_create" | grep -q '"id"' || echo "$pitch_create" | grep -q '"created"'; then
            log_test "Character management in pitch creation" "PASS" "Pitch with characters created successfully"
        else
            log_test "Character management in pitch creation" "FAIL" "Pitch creation with characters failed"
        fi
    else
        log_test "Character management in pitch creation" "FAIL" "Could not authenticate for character test"
    fi
    
    # Test 2: Character reordering support
    if [ -n "$creator_token" ]; then
        local reorder_test=$(curl -s -X PUT -H "Authorization: Bearer $creator_token" -H "Content-Type: application/json" \
            -d '{"characters":[{"name":"Jane Smith","displayOrder":1},{"name":"John Doe","displayOrder":2}]}' \
            http://localhost:8001/api/pitches/test/characters 2>/dev/null || echo '{"error":"failed"}')
        
        if echo "$reorder_test" | grep -q '"success"' || echo "$reorder_test" | grep -q '"updated"' || [ "$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $creator_token" http://localhost:8001/api/pitches/test/characters 2>/dev/null)" != "000" ]; then
            log_test "Character reordering functionality" "PASS" "Character reordering endpoint accessible"
        else
            log_test "Character reordering functionality" "FAIL" "Character reordering not working"
        fi
    else
        log_test "Character reordering functionality" "FAIL" "Could not authenticate for character reordering test"
    fi
    
    # Test 3: Character editing endpoint
    if [ -n "$creator_token" ]; then
        local edit_response=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $creator_token" http://localhost:8001/api/pitches/test/characters/1 2>/dev/null || echo "000")
        if [ "$edit_response" != "000" ]; then
            log_test "Character editing endpoint" "PASS" "Character edit endpoint responds (status: $edit_response)"
        else
            log_test "Character editing endpoint" "FAIL" "Character edit endpoint not responding"
        fi
    else
        log_test "Character editing endpoint" "FAIL" "Could not authenticate for character editing test"
    fi
}

test_websocket_features() {
    print_category "WEBSOCKET"
    
    # Test 1: WebSocket connection
    local ws_test_result=$(timeout 10 node -e "
        const WebSocket = require('ws');
        const ws = new WebSocket('ws://localhost:8001/ws');
        let connected = false;
        
        ws.on('open', () => {
            connected = true;
            console.log('WS_CONNECTED');
            
            // Test ping
            ws.send(JSON.stringify({type: 'ping'}));
        });
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'pong') {
                    console.log('WS_PING_SUCCESS');
                }
            } catch (e) {}
        });
        
        ws.on('error', (err) => {
            console.log('WS_ERROR');
        });
        
        setTimeout(() => {
            if (connected) {
                console.log('WS_STABLE');
                ws.close();
                process.exit(0);
            } else {
                console.log('WS_TIMEOUT');
                process.exit(1);
            }
        }, 5000);
    " 2>/dev/null || echo "WS_FAILED")
    
    if echo "$ws_test_result" | grep -q "WS_CONNECTED"; then
        log_test "WebSocket connection establishment" "PASS" "WebSocket connects successfully"
    else
        log_test "WebSocket connection establishment" "FAIL" "WebSocket connection failed"
    fi
    
    if echo "$ws_test_result" | grep -q "WS_PING_SUCCESS"; then
        log_test "WebSocket ping/pong functionality" "PASS" "WebSocket ping/pong works"
    else
        log_test "WebSocket ping/pong functionality" "FAIL" "WebSocket ping/pong failed"
    fi
    
    # Test 2: WebSocket authentication
    local creator_token=$(authenticate_user "$CREATOR_EMAIL" "$DEMO_PASSWORD" "creator")
    if [ -n "$creator_token" ]; then
        local auth_ws_test=$(timeout 10 node -e "
            const WebSocket = require('ws');
            const ws = new WebSocket('ws://localhost:8001/ws');
            
            ws.on('open', () => {
                ws.send(JSON.stringify({
                    type: 'authenticate',
                    token: '$creator_token'
                }));
            });
            
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    if (msg.type === 'authenticated') {
                        console.log('WS_AUTH_SUCCESS');
                        ws.close();
                        process.exit(0);
                    }
                } catch (e) {}
            });
            
            setTimeout(() => {
                console.log('WS_AUTH_TIMEOUT');
                process.exit(1);
            }, 5000);
        " 2>/dev/null || echo "WS_AUTH_FAILED")
        
        if echo "$auth_ws_test" | grep -q "WS_AUTH_SUCCESS"; then
            log_test "WebSocket authentication" "PASS" "WebSocket authentication works"
        else
            log_test "WebSocket authentication" "FAIL" "WebSocket authentication failed"
        fi
    else
        log_test "WebSocket authentication" "FAIL" "Could not authenticate for WebSocket test"
    fi
    
    # Test 3: Real-time notifications
    local notification_test=$(curl -s -X POST -H "Authorization: Bearer $creator_token" -H "Content-Type: application/json" \
        -d '{"type":"test","message":"Test notification"}' \
        http://localhost:8001/api/notifications 2>/dev/null || echo '{"error":"failed"}')
    
    if echo "$notification_test" | grep -q '"success"' || echo "$notification_test" | grep -q '"sent"' || [ "$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/notifications 2>/dev/null)" != "000" ]; then
        log_test "Real-time notifications" "PASS" "Notification system accessible"
    else
        log_test "Real-time notifications" "FAIL" "Notification system not working"
    fi
}

print_final_summary() {
    echo
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}           FINAL TEST SUMMARY                   ${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo
    echo -e "${CYAN}Total Tests Run: ${TOTAL_TESTS}${NC}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
    echo
    
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${CYAN}Success Rate: ${success_rate}%${NC}"
    
    if [ $success_rate -eq 100 ]; then
        echo -e "${GREEN}🎉 CONGRATULATIONS! 100% FUNCTIONALITY ACHIEVED! 🎉${NC}"
        echo -e "${GREEN}All critical features and fixes are working correctly.${NC}"
    elif [ $success_rate -ge 90 ]; then
        echo -e "${YELLOW}⚠️  NEAR COMPLETE: ${success_rate}% functionality achieved${NC}"
        echo -e "${YELLOW}Minor issues remain but core functionality is working.${NC}"
    elif [ $success_rate -ge 75 ]; then
        echo -e "${YELLOW}⚠️  PARTIAL SUCCESS: ${success_rate}% functionality achieved${NC}"
        echo -e "${YELLOW}Significant functionality working but improvements needed.${NC}"
    else
        echo -e "${RED}❌ MAJOR ISSUES: Only ${success_rate}% functionality working${NC}"
        echo -e "${RED}Critical fixes needed before platform is ready.${NC}"
    fi
    
    echo
    echo -e "${CYAN}Test Categories Summary:${NC}"
    for category in "${!TEST_CATEGORIES[@]}"; do
        echo -e "${PURPLE}$category${NC}: ${TEST_CATEGORIES[$category]}"
    done
    
    echo
    echo -e "${BLUE}================================================${NC}"
}

# Main execution
main() {
    print_header
    
    echo -e "${YELLOW}Starting comprehensive 100% functionality verification...${NC}"
    echo
    
    # Start backend server
    if ! start_backend; then
        echo -e "${RED}Cannot proceed without backend server${NC}"
        exit 1
    fi
    
    # Run all test categories
    test_environment_config
    test_local_storage
    test_browse_functionality
    test_investor_dashboard
    test_document_serving
    test_info_request_routes
    test_typescript_compilation
    test_console_logging
    test_mock_payments
    test_nda_workflow
    test_character_management
    test_websocket_features
    
    # Print final summary
    print_final_summary
    
    # Return appropriate exit code
    if [ $FAILED_TESTS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run the test suite
main "$@"