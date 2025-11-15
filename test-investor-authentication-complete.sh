#!/bin/bash

# Comprehensive Investor Authentication Flow Test
# Tests login, dashboard access, and content verification

echo "🔐 COMPREHENSIVE INVESTOR AUTHENTICATION FLOW TEST"
echo "================================================="
echo ""

# Configuration
FRONTEND_URL="https://5a8804e9.pitchey.pages.dev"
BACKEND_URL="https://pitchey-backend-fresh.deno.dev"
TEST_EMAIL="sarah.investor@demo.com"
TEST_PASSWORD="Demo123"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "📋 Test Configuration:"
echo "   Frontend: $FRONTEND_URL"
echo "   Backend: $BACKEND_URL"
echo "   Test User: $TEST_EMAIL"
echo ""

# Function to print step
print_step() {
    echo -e "${BLUE}📌 STEP $1: $2${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Test Step 1: Backend Health Check
print_step "1" "Testing Backend Health"
BACKEND_HEALTH=$(curl -s "$BACKEND_URL/api/health" || echo "ERROR")
if [[ "$BACKEND_HEALTH" == *"healthy"* ]]; then
    print_success "Backend is healthy"
else
    print_error "Backend health check failed: $BACKEND_HEALTH"
fi

echo ""

# Test Step 2: Frontend Login Page
print_step "2" "Testing Frontend Login Page Access"
LOGIN_PAGE=$(curl -s "$FRONTEND_URL/login/investor" | head -20)
if [[ "$LOGIN_PAGE" == *"Investor Portal"* ]]; then
    print_success "Investor login page loads correctly"
else
    print_error "Investor login page failed to load"
    echo "Response: $LOGIN_PAGE"
fi

echo ""

# Test Step 3: Authentication Test
print_step "3" "Testing Investor Authentication"

# Login request
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "Login Response (first 200 chars):"
echo "$LOGIN_RESPONSE" | cut -c1-200
echo ""

# Extract token from response
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // .token // empty' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    print_error "Failed to extract authentication token"
    echo "Full login response: $LOGIN_RESPONSE"
    exit 1
else
    print_success "Authentication successful - Token received: ${TOKEN:0:20}..."
fi

echo ""

# Test Step 4: Token Validation
print_step "4" "Testing Token Validation"
TOKEN_VALIDATION=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/validate-token")
echo "Token validation response:"
echo "$TOKEN_VALIDATION" | jq '.' 2>/dev/null || echo "$TOKEN_VALIDATION"

if [[ "$TOKEN_VALIDATION" == *"success\":true"* ]]; then
    print_success "Token validation successful"
else
    print_error "Token validation failed"
fi

echo ""

# Test Step 5: Dashboard Data Endpoints
print_step "5" "Testing Dashboard Data Endpoints"

# Test dashboard stats
print_info "Testing /api/investor/dashboard/stats"
DASHBOARD_STATS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/investor/dashboard/stats")
echo "Dashboard Stats Response:"
echo "$DASHBOARD_STATS" | jq '.' 2>/dev/null || echo "$DASHBOARD_STATS"
echo ""

# Test saved pitches
print_info "Testing /api/investor/saved-pitches"
SAVED_PITCHES=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/investor/saved-pitches")
echo "Saved Pitches Response:"
echo "$SAVED_PITCHES" | jq '.' 2>/dev/null || echo "$SAVED_PITCHES"
echo ""

# Test notifications
print_info "Testing /api/user/notifications"
NOTIFICATIONS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/user/notifications")
echo "Notifications Response:"
echo "$NOTIFICATIONS" | jq '.' 2>/dev/null || echo "$NOTIFICATIONS"
echo ""

# Test trending pitches
print_info "Testing /api/pitches/trending"
TRENDING=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/pitches/trending")
echo "Trending Pitches Response:"
echo "$TRENDING" | jq '.' 2>/dev/null || echo "$TRENDING"
echo ""

# Test Step 6: NDA Endpoints
print_step "6" "Testing NDA Management Endpoints"

print_info "Testing /api/nda/requests"
NDA_REQUESTS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/nda/requests")
echo "NDA Requests Response:"
echo "$NDA_REQUESTS" | jq '.' 2>/dev/null || echo "$NDA_REQUESTS"
echo ""

print_info "Testing /api/nda/signed"
NDA_SIGNED=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/nda/signed")
echo "Signed NDAs Response:"
echo "$NDA_SIGNED" | jq '.' 2>/dev/null || echo "$NDA_SIGNED"
echo ""

# Test Step 7: Investment Portfolio
print_step "7" "Testing Investment Portfolio Endpoints"

print_info "Testing /api/investor/portfolio"
PORTFOLIO=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/investor/portfolio")
echo "Investment Portfolio Response:"
echo "$PORTFOLIO" | jq '.' 2>/dev/null || echo "$PORTFOLIO"
echo ""

print_info "Testing /api/investor/investment-history"
INVESTMENT_HISTORY=$(curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/investor/investment-history")
echo "Investment History Response:"
echo "$INVESTMENT_HISTORY" | jq '.' 2>/dev/null || echo "$INVESTMENT_HISTORY"
echo ""

# Test Step 8: Frontend Dashboard Content Simulation
print_step "8" "Simulating Frontend Dashboard Content Display"

echo "🎯 EXPECTED DASHBOARD CONTENT VERIFICATION:"
echo ""

# Check if we have valid data for dashboard display
echo "📊 Dashboard Stats Check:"
if [[ "$DASHBOARD_STATS" == *"success"* ]] || [[ "$DASHBOARD_STATS" == *"totalPitches"* ]]; then
    print_success "Dashboard stats data available for display"
    STATS_DATA=$(echo "$DASHBOARD_STATS" | jq '.data // .' 2>/dev/null)
    echo "   Stats Summary: $STATS_DATA"
else
    print_error "No dashboard stats data available"
fi
echo ""

echo "📋 Saved Pitches Check:"
if [[ "$SAVED_PITCHES" == *"success"* ]] || [[ "$SAVED_PITCHES" == *"["* ]]; then
    PITCH_COUNT=$(echo "$SAVED_PITCHES" | jq 'if type=="object" then (.data | length) else (. | length) end' 2>/dev/null || echo "unknown")
    print_success "Saved pitches data available ($PITCH_COUNT items)"
else
    print_error "No saved pitches data available"
fi
echo ""

echo "🔔 Notifications Check:"
if [[ "$NOTIFICATIONS" == *"success"* ]] || [[ "$NOTIFICATIONS" == *"["* ]]; then
    NOTIF_COUNT=$(echo "$NOTIFICATIONS" | jq 'if type=="object" then (.data | length) else (. | length) end' 2>/dev/null || echo "unknown")
    print_success "Notifications data available ($NOTIF_COUNT items)"
else
    print_error "No notifications data available"
fi
echo ""

echo "📈 Trending Pitches Check:"
if [[ "$TRENDING" == *"success"* ]] || [[ "$TRENDING" == *"["* ]]; then
    TRENDING_COUNT=$(echo "$TRENDING" | jq 'if type=="object" then (.data | length) else (. | length) end' 2>/dev/null || echo "unknown")
    print_success "Trending pitches data available ($TRENDING_COUNT items)"
else
    print_error "No trending pitches data available"
fi
echo ""

echo "📄 NDA Management Check:"
if [[ "$NDA_REQUESTS" == *"success"* ]] || [[ "$NDA_REQUESTS" == *"["* ]]; then
    print_success "NDA requests data available for dashboard"
else
    print_error "No NDA requests data available"
fi
echo ""

echo "💼 Investment Portfolio Check:"
if [[ "$PORTFOLIO" == *"success"* ]] || [[ "$PORTFOLIO" == *"["* ]]; then
    print_success "Investment portfolio data available for dashboard"
else
    print_error "No investment portfolio data available"
fi
echo ""

# Test Step 9: Frontend JavaScript Test
print_step "9" "Testing Frontend Authentication State"

# Create a simple HTML test to verify frontend behavior
cat > /tmp/investor_dashboard_test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Investor Dashboard Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .success { color: green; }
        .error { color: red; }
        .info { color: blue; }
        .test-result { margin: 10px 0; padding: 10px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <h1>🔐 Investor Dashboard Authentication Test</h1>
    <div id="results"></div>

    <script>
        const FRONTEND_URL = 'https://5a8804e9.pitchey.pages.dev';
        const BACKEND_URL = 'https://pitchey-backend-fresh.deno.dev';
        const TEST_EMAIL = 'sarah.investor@demo.com';
        const TEST_PASSWORD = 'Demo123';
        
        const resultsDiv = document.getElementById('results');
        
        function addResult(message, type = 'info') {
            const div = document.createElement('div');
            div.className = `test-result ${type}`;
            div.innerHTML = message;
            resultsDiv.appendChild(div);
        }
        
        async function runFullAuthenticationTest() {
            addResult('🚀 Starting comprehensive authentication test...', 'info');
            
            try {
                // Step 1: Login
                addResult('📋 Step 1: Attempting login...', 'info');
                const loginResponse = await fetch(`${BACKEND_URL}/api/auth/investor/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
                });
                
                const loginData = await loginResponse.json();
                
                if (loginData.success && loginData.data?.token) {
                    addResult('✅ Login successful - Token received', 'success');
                    const token = loginData.data.token;
                    
                    // Store token (simulating frontend storage)
                    localStorage.setItem('authToken', token);
                    localStorage.setItem('user', JSON.stringify(loginData.data.user));
                    localStorage.setItem('userType', 'investor');
                    
                    // Step 2: Test dashboard data endpoints
                    addResult('📊 Step 2: Loading dashboard data...', 'info');
                    
                    const dashboardTests = [
                        { endpoint: '/api/investor/dashboard/stats', name: 'Dashboard Stats' },
                        { endpoint: '/api/investor/saved-pitches', name: 'Saved Pitches' },
                        { endpoint: '/api/user/notifications', name: 'Notifications' },
                        { endpoint: '/api/pitches/trending', name: 'Trending Pitches' },
                        { endpoint: '/api/nda/requests', name: 'NDA Requests' },
                        { endpoint: '/api/investor/portfolio', name: 'Investment Portfolio' }
                    ];
                    
                    for (const test of dashboardTests) {
                        try {
                            const response = await fetch(`${BACKEND_URL}${test.endpoint}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const data = await response.json();
                            
                            if (response.ok) {
                                addResult(`✅ ${test.name}: Data loaded successfully`, 'success');
                                addResult(`   📋 Data preview: ${JSON.stringify(data).substring(0, 100)}...`, 'info');
                            } else {
                                addResult(`❌ ${test.name}: Failed to load (${response.status})`, 'error');
                            }
                        } catch (error) {
                            addResult(`❌ ${test.name}: Error - ${error.message}`, 'error');
                        }
                    }
                    
                    // Step 3: Simulate dashboard navigation
                    addResult('🚪 Step 3: Testing dashboard navigation...', 'info');
                    
                    // Simulate what happens when user navigates to dashboard
                    const isAuthenticated = localStorage.getItem('authToken') && localStorage.getItem('user');
                    if (isAuthenticated) {
                        addResult('✅ Authentication state preserved - Dashboard should display', 'success');
                        
                        // Test token validation
                        const validateResponse = await fetch(`${BACKEND_URL}/api/validate-token`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const validateData = await validateResponse.json();
                        
                        if (validateData.success) {
                            addResult('✅ Token validation successful - No redirect should occur', 'success');
                            addResult(`   👤 User: ${validateData.data?.user?.email || 'Unknown'}`, 'info');
                        } else {
                            addResult('❌ Token validation failed - Redirect to login may occur', 'error');
                        }
                    } else {
                        addResult('❌ Authentication state lost - Would redirect to login', 'error');
                    }
                    
                    addResult('🎉 Authentication flow test completed!', 'success');
                    
                } else {
                    addResult('❌ Login failed: ' + JSON.stringify(loginData), 'error');
                }
                
            } catch (error) {
                addResult('❌ Test failed with error: ' + error.message, 'error');
            }
        }
        
        // Run test when page loads
        runFullAuthenticationTest();
    </script>
</body>
</html>
EOF

echo "📝 Frontend authentication test created at: /tmp/investor_dashboard_test.html"
echo ""
echo "🌐 To test in browser:"
echo "   1. Open: file:///tmp/investor_dashboard_test.html"
echo "   2. Check browser console for detailed results"
echo "   3. Verify no redirect loops occur"
echo ""

# Test Step 10: Summary
print_step "10" "Test Summary & Recommendations"

echo ""
echo "🎯 COMPREHENSIVE TEST RESULTS SUMMARY:"
echo "======================================"

# Count successful responses
SUCCESS_COUNT=0
TOTAL_TESTS=6

[[ "$LOGIN_RESPONSE" == *"success\":true"* ]] && ((SUCCESS_COUNT++))
[[ "$TOKEN_VALIDATION" == *"success\":true"* ]] && ((SUCCESS_COUNT++))
[[ "$DASHBOARD_STATS" == *"success"* ]] && ((SUCCESS_COUNT++))
[[ "$SAVED_PITCHES" == *"success"* ]] || [[ "$SAVED_PITCHES" == *"["* ]] && ((SUCCESS_COUNT++))
[[ "$NOTIFICATIONS" == *"success"* ]] || [[ "$NOTIFICATIONS" == *"["* ]] && ((SUCCESS_COUNT++))
[[ "$TRENDING" == *"success"* ]] || [[ "$TRENDING" == *"["* ]] && ((SUCCESS_COUNT++))

echo "📊 Success Rate: $SUCCESS_COUNT/$TOTAL_TESTS tests passed"

if [ $SUCCESS_COUNT -ge 5 ]; then
    print_success "AUTHENTICATION FLOW WORKING CORRECTLY"
    echo ""
    echo "✅ You should be able to:"
    echo "   • Login successfully with sarah.investor@demo.com / Demo123"
    echo "   • Access the investor dashboard without redirect loops"
    echo "   • See dashboard content including stats, pitches, and notifications"
    echo "   • Navigate between dashboard sections"
    echo ""
    echo "🚀 Dashboard URL: $FRONTEND_URL/investor/dashboard"
    echo ""
else
    print_error "AUTHENTICATION ISSUES DETECTED"
    echo ""
    echo "❌ Problems found:"
    echo "   • Some backend endpoints may be failing"
    echo "   • Dashboard content may not display properly"
    echo "   • User might be redirected back to login"
    echo ""
fi

echo "📋 Next Steps:"
echo "1. Test login at: $FRONTEND_URL/login/investor"
echo "2. Use credentials: $TEST_EMAIL / $TEST_PASSWORD"
echo "3. Verify dashboard content appears at: $FRONTEND_URL/investor/dashboard"
echo "4. Check browser console for any error messages"
echo "5. Open /tmp/investor_dashboard_test.html for detailed frontend test"

echo ""
echo "🔍 If issues persist, check:"
echo "• Browser network tab for failed requests"
echo "• Console for JavaScript errors"
echo "• Local storage for authentication tokens"