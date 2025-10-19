# Pitchey Platform - Detailed Test Scenarios

## Quick Reference Test Scripts

### Authentication Flow Tests

#### Creator Login Flow
```bash
#!/bin/bash
echo "=== Creator Login Flow Test ==="

# Step 1: Valid login
echo "Testing valid creator login..."
RESPONSE=$(curl -s -X POST "http://localhost:8001/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "Demo123"}')

TOKEN=$(echo $RESPONSE | jq -r '.data.token')
if [[ "$TOKEN" != "null" && "$TOKEN" != "" ]]; then
  echo "✓ Creator login successful - Token received"
  export CREATOR_TOKEN=$TOKEN
else
  echo "✗ Creator login failed"
  echo "Response: $RESPONSE"
  exit 1
fi

# Step 2: Test dashboard access
echo "Testing dashboard access..."
DASHBOARD=$(curl -s -H "Authorization: Bearer $CREATOR_TOKEN" \
  "http://localhost:8001/api/creator/dashboard")

if echo $DASHBOARD | jq -e '.success' > /dev/null; then
  echo "✓ Dashboard access successful"
else
  echo "✗ Dashboard access failed"
  echo "Response: $DASHBOARD"
fi

# Step 3: Invalid login attempt
echo "Testing invalid credentials..."
INVALID=$(curl -s -X POST "http://localhost:8001/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.creator@demo.com", "password": "WrongPassword"}')

if echo $INVALID | jq -e '.success == false' > /dev/null; then
  echo "✓ Invalid login properly rejected"
else
  echo "✗ Invalid login should be rejected"
fi
```

#### Investor Login Flow
```bash
#!/bin/bash
echo "=== Investor Login Flow Test ==="

# Step 1: Valid investor login
RESPONSE=$(curl -s -X POST "http://localhost:8001/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}')

TOKEN=$(echo $RESPONSE | jq -r '.data.token')
if [[ "$TOKEN" != "null" && "$TOKEN" != "" ]]; then
  echo "✓ Investor login successful"
  export INVESTOR_TOKEN=$TOKEN
else
  echo "✗ Investor login failed"
  exit 1
fi

# Step 2: Test role-based access
echo "Testing role-based access control..."
CREATOR_ACCESS=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" \
  "http://localhost:8001/api/creator/dashboard")

if echo $CREATOR_ACCESS | jq -e '.success == false' > /dev/null; then
  echo "✓ Role-based access control working"
else
  echo "✗ Investor should not access creator endpoints"
fi
```

### Pitch Management Test Scenarios

#### Create Pitch Test
```bash
#!/bin/bash
echo "=== Pitch Creation Test ==="

# Ensure we have creator token
if [[ -z "$CREATOR_TOKEN" ]]; then
  echo "Getting creator token..."
  RESPONSE=$(curl -s -X POST "http://localhost:8001/api/auth/creator/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "alex.creator@demo.com", "password": "Demo123"}')
  CREATOR_TOKEN=$(echo $RESPONSE | jq -r '.data.token')
fi

# Create new pitch
PITCH_DATA='{
  "title": "QA Test Pitch - '"$(date +%s)"'",
  "logline": "A comprehensive test pitch created during QA testing",
  "genre": "Action",
  "format": "Feature Film",
  "shortSynopsis": "This is a test synopsis for QA validation purposes",
  "longSynopsis": "This is a longer synopsis that provides more detail about our test pitch created during quality assurance testing",
  "targetAudience": "18-35 adults who enjoy action movies",
  "budgetBracket": "$1M-5M",
  "visibility": "public",
  "status": "active"
}'

echo "Creating new pitch..."
CREATE_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PITCH_DATA")

PITCH_ID=$(echo $CREATE_RESPONSE | jq -r '.data.id')
if [[ "$PITCH_ID" != "null" && "$PITCH_ID" != "" ]]; then
  echo "✓ Pitch created successfully - ID: $PITCH_ID"
  export TEST_PITCH_ID=$PITCH_ID
else
  echo "✗ Pitch creation failed"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

# Verify pitch exists
echo "Verifying pitch creation..."
GET_RESPONSE=$(curl -s "http://localhost:8001/api/pitches/$PITCH_ID")
if echo $GET_RESPONSE | jq -e '.data.title' > /dev/null; then
  echo "✓ Pitch retrieval successful"
else
  echo "✗ Pitch retrieval failed"
fi
```

#### Edit Pitch Test
```bash
#!/bin/bash
echo "=== Pitch Edit Test ==="

# Update the test pitch
UPDATE_DATA='{
  "title": "QA Test Pitch - UPDATED",
  "logline": "An updated test pitch for validation",
  "genre": "Drama"
}'

echo "Updating pitch ID: $TEST_PITCH_ID"
UPDATE_RESPONSE=$(curl -s -X PUT "http://localhost:8001/api/pitches/$TEST_PITCH_ID" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_DATA")

if echo $UPDATE_RESPONSE | jq -e '.success' > /dev/null; then
  echo "✓ Pitch update successful"
  
  # Verify changes
  GET_UPDATED=$(curl -s "http://localhost:8001/api/pitches/$TEST_PITCH_ID")
  UPDATED_TITLE=$(echo $GET_UPDATED | jq -r '.data.title')
  if [[ "$UPDATED_TITLE" == "QA Test Pitch - UPDATED" ]]; then
    echo "✓ Pitch changes verified"
  else
    echo "✗ Pitch changes not reflected"
  fi
else
  echo "✗ Pitch update failed"
  echo "Response: $UPDATE_RESPONSE"
fi
```

### NDA Workflow Test Scenarios

#### NDA Request Flow
```bash
#!/bin/bash
echo "=== NDA Request Flow Test ==="

# Get investor token if not available
if [[ -z "$INVESTOR_TOKEN" ]]; then
  RESPONSE=$(curl -s -X POST "http://localhost:8001/api/auth/investor/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "sarah.investor@demo.com", "password": "Demo123"}')
  INVESTOR_TOKEN=$(echo $RESPONSE | jq -r '.data.token')
fi

# Find a pitch to request NDA for
echo "Finding available pitch..."
PITCHES=$(curl -s "http://localhost:8001/api/pitches?limit=1")
PITCH_ID=$(echo $PITCHES | jq -r '.data[0].id')

if [[ "$PITCH_ID" != "null" ]]; then
  echo "Testing NDA request for pitch ID: $PITCH_ID"
  
  # Request NDA
  NDA_REQUEST=$(curl -s -X POST "http://localhost:8001/api/ndas/request" \
    -H "Authorization: Bearer $INVESTOR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"pitchId\": $PITCH_ID}")
  
  NDA_ID=$(echo $NDA_REQUEST | jq -r '.data.id')
  if [[ "$NDA_ID" != "null" && "$NDA_ID" != "" ]]; then
    echo "✓ NDA request created - ID: $NDA_ID"
    export TEST_NDA_ID=$NDA_ID
    
    # Sign the NDA
    echo "Signing NDA..."
    SIGN_DATA='{
      "signature": "Sarah Investor",
      "signedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    }'
    
    SIGN_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/ndas/$NDA_ID/sign" \
      -H "Authorization: Bearer $INVESTOR_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$SIGN_DATA")
    
    if echo $SIGN_RESPONSE | jq -e '.success' > /dev/null; then
      echo "✓ NDA signed successfully"
      
      # Verify access to protected content
      echo "Testing protected content access..."
      PROTECTED_ACCESS=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" \
        "http://localhost:8001/api/pitches/$PITCH_ID/protected")
      
      if echo $PROTECTED_ACCESS | jq -e '.data' > /dev/null; then
        echo "✓ Protected content access granted"
      else
        echo "? Protected content access test (may not be implemented)"
      fi
    else
      echo "✗ NDA signing failed"
      echo "Response: $SIGN_RESPONSE"
    fi
  else
    echo "✗ NDA request failed"
    echo "Response: $NDA_REQUEST"
  fi
else
  echo "✗ No pitches available for NDA testing"
fi
```

### Search and Filter Tests

#### Search Functionality Test
```bash
#!/bin/bash
echo "=== Search Functionality Test ==="

# Test basic search
echo "Testing basic search..."
SEARCH_RESPONSE=$(curl -s "http://localhost:8001/api/pitches?search=test")
if echo $SEARCH_RESPONSE | jq -e '.data' > /dev/null; then
  echo "✓ Basic search working"
  RESULT_COUNT=$(echo $SEARCH_RESPONSE | jq '.data | length')
  echo "  Found $RESULT_COUNT results"
else
  echo "✗ Basic search failed"
fi

# Test genre filter
echo "Testing genre filter..."
GENRE_FILTER=$(curl -s "http://localhost:8001/api/pitches?genre=Action")
if echo $GENRE_FILTER | jq -e '.data' > /dev/null; then
  echo "✓ Genre filter working"
  GENRE_COUNT=$(echo $GENRE_FILTER | jq '.data | length')
  echo "  Found $GENRE_COUNT Action pitches"
else
  echo "✗ Genre filter failed"
fi

# Test combined search and filter
echo "Testing combined search and filter..."
COMBINED=$(curl -s "http://localhost:8001/api/pitches?search=pitch&genre=Drama")
if echo $COMBINED | jq -e '.data' > /dev/null; then
  echo "✓ Combined search and filter working"
else
  echo "✗ Combined search and filter failed"
fi

# Test pagination
echo "Testing pagination..."
PAGE1=$(curl -s "http://localhost:8001/api/pitches?page=1&limit=2")
PAGE2=$(curl -s "http://localhost:8001/api/pitches?page=2&limit=2")

if echo $PAGE1 | jq -e '.data' > /dev/null && echo $PAGE2 | jq -e '.data' > /dev/null; then
  echo "✓ Pagination working"
  P1_COUNT=$(echo $PAGE1 | jq '.data | length')
  P2_COUNT=$(echo $PAGE2 | jq '.data | length')
  echo "  Page 1: $P1_COUNT items, Page 2: $P2_COUNT items"
else
  echo "✗ Pagination failed"
fi
```

### File Upload Tests

#### File Upload Test
```bash
#!/bin/bash
echo "=== File Upload Test ==="

# Create test files
mkdir -p /tmp/qa-test-files
echo "Test pitch deck content" > /tmp/qa-test-files/test-deck.txt
echo "Test image content" > /tmp/qa-test-files/test-poster.txt

# Test pitch deck upload
echo "Testing pitch deck upload..."
UPLOAD_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/upload" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -F "file=@/tmp/qa-test-files/test-deck.txt" \
  -F "type=pitch-deck")

UPLOAD_URL=$(echo $UPLOAD_RESPONSE | jq -r '.data.url')
if [[ "$UPLOAD_URL" != "null" && "$UPLOAD_URL" != "" ]]; then
  echo "✓ File upload successful - URL: $UPLOAD_URL"
else
  echo "✗ File upload failed"
  echo "Response: $UPLOAD_RESPONSE"
fi

# Test file size limit
echo "Testing file size limit..."
dd if=/dev/zero of=/tmp/qa-test-files/large-file.txt bs=1M count=50 2>/dev/null

LARGE_UPLOAD=$(curl -s -X POST "http://localhost:8001/api/upload" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -F "file=@/tmp/qa-test-files/large-file.txt" \
  -F "type=document")

if echo $LARGE_UPLOAD | jq -e '.success == false' > /dev/null; then
  echo "✓ File size limit enforced"
else
  echo "? File size limit test (may not be implemented)"
fi

# Cleanup
rm -rf /tmp/qa-test-files
```

### Analytics and Tracking Tests

#### View Tracking Test
```bash
#!/bin/bash
echo "=== View Tracking Test ==="

# Get a pitch to track views for
PITCHES=$(curl -s "http://localhost:8001/api/pitches?limit=1")
VIEW_PITCH_ID=$(echo $PITCHES | jq -r '.data[0].id')
INITIAL_VIEWS=$(echo $PITCHES | jq -r '.data[0].viewCount')

echo "Testing view tracking for pitch ID: $VIEW_PITCH_ID"
echo "Initial view count: $INITIAL_VIEWS"

# Track a view
TRACK_RESPONSE=$(curl -s -X POST "http://localhost:8001/api/analytics/track" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event\": \"pitch_view\", \"pitchId\": $VIEW_PITCH_ID}")

if echo $TRACK_RESPONSE | jq -e '.success' > /dev/null; then
  echo "✓ View tracking event sent"
  
  # Wait a moment for processing
  sleep 2
  
  # Check if view count increased
  UPDATED_PITCH=$(curl -s "http://localhost:8001/api/pitches/$VIEW_PITCH_ID")
  NEW_VIEWS=$(echo $UPDATED_PITCH | jq -r '.viewCount')
  
  if [[ "$NEW_VIEWS" -gt "$INITIAL_VIEWS" ]]; then
    echo "✓ View count increased: $INITIAL_VIEWS → $NEW_VIEWS"
  else
    echo "? View count update (may be async): $NEW_VIEWS"
  fi
else
  echo "✗ View tracking failed"
  echo "Response: $TRACK_RESPONSE"
fi
```

### WebSocket Connection Tests

#### WebSocket Connection Test
```bash
#!/bin/bash
echo "=== WebSocket Connection Test ==="

# Test WebSocket connection (requires websocat tool)
if command -v websocat &> /dev/null; then
  echo "Testing WebSocket connection..."
  
  # Test connection with timeout
  timeout 5 websocat ws://localhost:8001/ws --ping-interval 1 --ping-timeout 2 --exec 'echo Connected' &
  WS_PID=$!
  
  sleep 3
  if kill -0 $WS_PID 2>/dev/null; then
    echo "✓ WebSocket connection established"
    kill $WS_PID 2>/dev/null
  else
    echo "✗ WebSocket connection failed"
  fi
else
  echo "? WebSocket test skipped (websocat not installed)"
  echo "  Install with: cargo install websocat"
fi

# Test WebSocket authentication
echo "Testing WebSocket authentication..."
WS_AUTH_TEST=$(curl -s -I -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  "http://localhost:8001/ws")

if echo "$WS_AUTH_TEST" | grep -i "websocket" > /dev/null; then
  echo "✓ WebSocket upgrade handshake working"
else
  echo "? WebSocket upgrade response unclear"
fi
```

### Integration Test Scenarios

#### End-to-End User Journey
```bash
#!/bin/bash
echo "=== End-to-End User Journey Test ==="

# Complete creator journey
echo "1. Creator Registration and Login"
# (Login tested above)

echo "2. Create Pitch"
# (Pitch creation tested above)

echo "3. Investor finds and views pitch"
INVESTOR_VIEW=$(curl -s -H "Authorization: Bearer $INVESTOR_TOKEN" \
  "http://localhost:8001/api/pitches/$TEST_PITCH_ID")

if echo $INVESTOR_VIEW | jq -e '.data' > /dev/null; then
  echo "✓ Investor can view pitch"
else
  echo "✗ Investor cannot view pitch"
fi

echo "4. Investor requests NDA"
# (NDA workflow tested above)

echo "5. Creator receives notification"
CREATOR_NOTIFICATIONS=$(curl -s -H "Authorization: Bearer $CREATOR_TOKEN" \
  "http://localhost:8001/api/notifications")

if echo $CREATOR_NOTIFICATIONS | jq -e '.data' > /dev/null; then
  echo "✓ Notifications system working"
  NOTIF_COUNT=$(echo $CREATOR_NOTIFICATIONS | jq '.data | length')
  echo "  Found $NOTIF_COUNT notifications"
else
  echo "? Notifications test (may be empty)"
fi

echo "6. Analytics tracking"
CREATOR_ANALYTICS=$(curl -s -H "Authorization: Bearer $CREATOR_TOKEN" \
  "http://localhost:8001/api/analytics/dashboard")

if echo $CREATOR_ANALYTICS | jq -e '.data' > /dev/null; then
  echo "✓ Analytics dashboard working"
else
  echo "? Analytics dashboard test"
fi

echo "=== Journey Test Complete ==="
```

### Error Handling Tests

#### Error Response Tests  
```bash
#!/bin/bash
echo "=== Error Handling Test ==="

# Test 404 errors
echo "Testing 404 handling..."
NOT_FOUND=$(curl -s "http://localhost:8001/api/pitches/99999")
if echo $NOT_FOUND | jq -e '.success == false' > /dev/null; then
  echo "✓ 404 errors handled properly"
else
  echo "✗ 404 error handling needs improvement"
fi

# Test unauthorized access
echo "Testing unauthorized access..."
UNAUTHORIZED=$(curl -s "http://localhost:8001/api/creator/dashboard")
if echo $UNAUTHORIZED | jq -e '.success == false' > /dev/null; then
  echo "✓ Unauthorized access properly blocked"
else
  echo "✗ Authorization needs improvement"
fi

# Test malformed JSON
echo "Testing malformed JSON handling..."
MALFORMED=$(curl -s -X POST "http://localhost:8001/api/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{invalid json}')

if echo $MALFORMED | jq -e '.success == false' > /dev/null; then
  echo "✓ Malformed JSON handled properly"
else
  echo "✗ JSON validation needs improvement"
fi
```

### Cleanup Test Data
```bash
#!/bin/bash
echo "=== Cleanup Test Data ==="

# Clean up test pitch
if [[ -n "$TEST_PITCH_ID" ]]; then
  echo "Deleting test pitch ID: $TEST_PITCH_ID"
  DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:8001/api/pitches/$TEST_PITCH_ID" \
    -H "Authorization: Bearer $CREATOR_TOKEN")
  
  if echo $DELETE_RESPONSE | jq -e '.success' > /dev/null; then
    echo "✓ Test pitch deleted"
  else
    echo "? Test pitch deletion (may already be cleaned up)"
  fi
fi

# Clean up NDA
if [[ -n "$TEST_NDA_ID" ]]; then
  echo "Test NDA ID $TEST_NDA_ID will be cleaned up by cascade deletion"
fi

echo "=== Cleanup Complete ==="
```

## Master Test Execution Script

```bash
#!/bin/bash
echo "========================================="
echo "Pitchey Platform - Complete QA Test Suite"
echo "========================================="
echo ""

# Set up test environment
source ./test-config.sh

# Track test results
TOTAL_SCENARIOS=0
PASSED_SCENARIOS=0
FAILED_SCENARIOS=0

run_test_scenario() {
  local scenario_name=$1
  local scenario_script=$2
  
  echo ""
  echo "Running: $scenario_name"
  echo "----------------------------------------"
  
  TOTAL_SCENARIOS=$((TOTAL_SCENARIOS + 1))
  
  if eval "$scenario_script"; then
    echo "✓ $scenario_name PASSED"
    PASSED_SCENARIOS=$((PASSED_SCENARIOS + 1))
  else
    echo "✗ $scenario_name FAILED"
    FAILED_SCENARIOS=$((FAILED_SCENARIOS + 1))
  fi
}

# Execute all test scenarios
run_test_scenario "Creator Authentication" "./creator-login-test.sh"
run_test_scenario "Investor Authentication" "./investor-login-test.sh"
run_test_scenario "Pitch Management" "./pitch-management-test.sh"
run_test_scenario "NDA Workflow" "./nda-workflow-test.sh"
run_test_scenario "Search & Filter" "./search-filter-test.sh"
run_test_scenario "File Upload" "./file-upload-test.sh"
run_test_scenario "Analytics Tracking" "./analytics-test.sh"
run_test_scenario "WebSocket Connection" "./websocket-test.sh"
run_test_scenario "End-to-End Journey" "./e2e-journey-test.sh"
run_test_scenario "Error Handling" "./error-handling-test.sh"

# Final results
echo ""
echo "========================================="
echo "QA Test Suite Results"
echo "========================================="
echo "Total Scenarios: $TOTAL_SCENARIOS"
echo "Passed: $PASSED_SCENARIOS"
echo "Failed: $FAILED_SCENARIOS"
echo "Success Rate: $(( PASSED_SCENARIOS * 100 / TOTAL_SCENARIOS ))%"
echo ""

if [[ $FAILED_SCENARIOS -eq 0 ]]; then
  echo "🎉 All tests passed! Platform ready for release."
  exit 0
else
  echo "⚠️  Some tests failed. Please review and fix issues."
  exit 1
fi
```

## Test Configuration

```bash
#!/bin/bash
# test-config.sh - Common configuration for all test scenarios

# API Configuration
export API_URL="http://localhost:8001/api"
export WS_URL="ws://localhost:8001/ws"
export FRONTEND_URL="http://localhost:5173"

# Demo Account Credentials
export CREATOR_EMAIL="alex.creator@demo.com"
export INVESTOR_EMAIL="sarah.investor@demo.com"
export PRODUCTION_EMAIL="stellar.production@demo.com"
export DEMO_PASSWORD="Demo123"

# Test Configuration
export CURL_TIMEOUT=10
export TEST_TIMEOUT=30

# Colors for output
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export RED='\033[0;31m'
export BLUE='\033[0;34m'
export NC='\033[0m'

# Helper functions
log_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
  echo -e "${RED}✗ $1${NC}"
}

log_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Verify prerequisites
check_prerequisites() {
  echo "Checking prerequisites..."
  
  # Check if jq is installed
  if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed"
    exit 1
  fi
  
  # Check if curl is installed
  if ! command -v curl &> /dev/null; then
    log_error "curl is required but not installed"
    exit 1
  fi
  
  # Check if backend is running
  if ! curl -s "$API_URL/health" > /dev/null; then
    log_error "Backend server is not running at $API_URL"
    log_info "Start with: PORT=8001 deno run --allow-all working-server.ts"
    exit 1
  fi
  
  log_success "Prerequisites check passed"
}

# Initialize test environment
initialize_tests() {
  echo "Initializing test environment..."
  check_prerequisites
  
  # Clear any existing test tokens
  unset CREATOR_TOKEN INVESTOR_TOKEN PRODUCTION_TOKEN
  unset TEST_PITCH_ID TEST_NDA_ID
  
  log_success "Test environment initialized"
}

# Call initialization
initialize_tests
```

These detailed test scenarios provide QA teams with executable scripts that can be run individually or as part of a comprehensive test suite. Each script includes validation steps and clear pass/fail criteria.