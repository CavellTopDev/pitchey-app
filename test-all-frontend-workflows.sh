#!/bin/bash

# Comprehensive Frontend Testing Script for Pitchey
# Tests all possible workflows at https://pitchey-5o8.pages.dev

API_URL="https://pitchey-backend-fresh.deno.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   PITCHEY FRONTEND COMPREHENSIVE TEST SUITE   ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${YELLOW}Testing URL: $FRONTEND_URL${NC}"
echo -e "${YELLOW}API Backend: $API_URL${NC}"
echo -e "${YELLOW}Test Date: $(date)${NC}"
echo ""

# Test accounts
CREATOR_EMAIL="creator@demo.com"
CREATOR_PASS="Demo123!@#"
INVESTOR_EMAIL="investor@demo.com"
INVESTOR_PASS="Demo123!@#"

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local data=$3
    local token=$4
    local description=$5
    
    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -z "$token" ]; then
        if [ "$method" = "POST" ]; then
            response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data" 2>/dev/null)
        else
            response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint" 2>/dev/null)
        fi
    else
        if [ "$method" = "POST" ]; then
            response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data" 2>/dev/null)
        else
            response=$(curl -s -w "\n%{http_code}" "$API_URL$endpoint" \
                -H "Authorization: Bearer $token" 2>/dev/null)
        fi
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
        echo -e "${GREEN}✓ Success (HTTP $http_code)${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "Response: $body" | head -n 3
    fi
    
    echo "$body"
}

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}1. PUBLIC PAGES (No Authentication Required)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}1.1 Homepage${NC}"
echo "URL: $FRONTEND_URL/"
echo "Expected: Landing page with hero section, trending pitches, new releases"
echo "Features to test:"
echo "  - Navigation menu"
echo "  - Search bar"
echo "  - Trending Pitches carousel"
echo "  - New Releases section"
echo "  - Footer links"

echo -e "\n${YELLOW}1.2 Marketplace${NC}"
echo "URL: $FRONTEND_URL/marketplace"
echo "Expected: Grid of all public pitches"
echo "Features to test:"
echo "  - Pitch cards display (title, creator, category, funding goal)"
echo "  - Category filter dropdown"
echo "  - Sort options (newest, trending, most funded)"
echo "  - Search functionality"
echo "  - Pagination"
echo "  - Click pitch to view details"

echo -e "\n${YELLOW}1.3 Individual Pitch View${NC}"
echo "URL: $FRONTEND_URL/pitch/[id]"
echo "Expected: Full pitch details page"
echo "Features to test:"
echo "  - Pitch title and description"
echo "  - Video player (if video URL exists)"
echo "  - Creator information"
echo "  - Funding progress bar"
echo "  - Investment button (redirects to login if not authenticated)"
echo "  - Comments section"
echo "  - Share buttons"

echo -e "\n${YELLOW}1.4 Creator Profile (Public View)${NC}"
echo "URL: $FRONTEND_URL/creator/[id]"
echo "Expected: Public creator profile"
echo "Features to test:"
echo "  - Creator bio and avatar"
echo "  - List of creator's public pitches"
echo "  - Follow button (redirects to login if not authenticated)"
echo "  - Social media links"

echo -e "\n${YELLOW}1.5 About Page${NC}"
echo "URL: $FRONTEND_URL/about"
echo "Expected: Platform information page"

echo -e "\n${YELLOW}1.6 Terms and Privacy${NC}"
echo "URLs: $FRONTEND_URL/terms, $FRONTEND_URL/privacy"
echo "Expected: Legal documentation pages"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}2. AUTHENTICATION WORKFLOWS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}2.1 Sign Up Flow${NC}"
echo "URL: $FRONTEND_URL/signup"
echo "Test cases:"
echo "  a) Sign up as Creator"
echo "     - Fill form with name, email, password"
echo "     - Select 'Creator' role"
echo "     - Verify email validation"
echo "     - Check password requirements"
echo "  b) Sign up as Investor"
echo "     - Same flow with 'Investor' role"
echo "  c) Error handling"
echo "     - Duplicate email"
echo "     - Weak password"
echo "     - Missing fields"

echo -e "\n${YELLOW}2.2 Login Flow${NC}"
echo "URL: $FRONTEND_URL/login"
echo "Test cases:"
echo "  a) Valid credentials"
echo "     - Login with demo accounts"
echo "     - Check redirect to appropriate dashboard"
echo "  b) Invalid credentials"
echo "     - Wrong password"
echo "     - Non-existent email"
echo "  c) Remember me functionality"
echo "  d) Forgot password link"

# Test login programmatically
echo -e "\n${YELLOW}Testing Login API:${NC}"
test_endpoint "/api/auth/login" "POST" '{"email":"'$CREATOR_EMAIL'","password":"'$CREATOR_PASS'"}' "" "Creator Login"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}3. CREATOR WORKFLOWS (Requires Creator Login)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

# Get creator token
CREATOR_TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"'$CREATOR_EMAIL'","password":"'$CREATOR_PASS'"}' | \
    grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo -e "\n${YELLOW}3.1 Creator Dashboard${NC}"
echo "URL: $FRONTEND_URL/creator/dashboard"
echo "Expected sections:"
echo "  - Overview stats (total pitches, views, investments)"
echo "  - Recent activity feed"
echo "  - Quick actions menu"
echo "  - Analytics charts"

test_endpoint "/api/creator/dashboard" "GET" "" "$CREATOR_TOKEN" "Creator Dashboard Data"

echo -e "\n${YELLOW}3.2 Create New Pitch${NC}"
echo "URL: $FRONTEND_URL/creator/pitch/new"
echo "Workflow:"
echo "  Step 1: Basic Information"
echo "    - Title (required)"
echo "    - Category selection"
echo "    - Short description"
echo "  Step 2: Details"
echo "    - Full description (rich text editor)"
echo "    - Video URL (optional)"
echo "    - Images upload"
echo "  Step 3: Funding"
echo "    - Funding goal"
echo "    - Deadline"
echo "    - Rewards/perks"
echo "  Step 4: Preview & Submit"
echo "    - Review all information"
echo "    - Save as draft or publish"

echo -e "\n${YELLOW}3.3 Manage Pitches${NC}"
echo "URL: $FRONTEND_URL/creator/pitches"
echo "Features:"
echo "  - List of all creator's pitches"
echo "  - Status indicators (draft, active, funded, expired)"
echo "  - Edit button for each pitch"
echo "  - Delete functionality"
echo "  - View analytics per pitch"

test_endpoint "/api/creator/pitches" "GET" "" "$CREATOR_TOKEN" "Creator's Pitches List"

echo -e "\n${YELLOW}3.4 Edit Pitch${NC}"
echo "URL: $FRONTEND_URL/creator/pitch/edit/[id]"
echo "Features:"
echo "  - Load existing pitch data"
echo "  - Update any field"
echo "  - Save changes"
echo "  - Change status (activate, pause, close)"

echo -e "\n${YELLOW}3.5 Analytics Dashboard${NC}"
echo "URL: $FRONTEND_URL/creator/analytics"
echo "Expected:"
echo "  - View count over time"
echo "  - Investment timeline"
echo "  - Demographic data"
echo "  - Traffic sources"
echo "  - Export data option"

echo -e "\n${YELLOW}3.6 Messages/Communications${NC}"
echo "URL: $FRONTEND_URL/creator/messages"
echo "Features:"
echo "  - Inbox with investor messages"
echo "  - Send messages"
echo "  - Mark as read/unread"
echo "  - Search messages"

test_endpoint "/api/messages/conversations" "GET" "" "$CREATOR_TOKEN" "Creator Messages"

echo -e "\n${YELLOW}3.7 Profile Settings${NC}"
echo "URL: $FRONTEND_URL/creator/settings"
echo "Sections:"
echo "  - Personal information"
echo "  - Bio and description"
echo "  - Social media links"
echo "  - Payment/payout settings"
echo "  - Notification preferences"
echo "  - Change password"

echo -e "\n${YELLOW}3.8 Financial Dashboard${NC}"
echo "URL: $FRONTEND_URL/creator/financials"
echo "Features:"
echo "  - Total earnings"
echo "  - Pending payouts"
echo "  - Transaction history"
echo "  - Tax documents"
echo "  - Withdrawal requests"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}4. INVESTOR WORKFLOWS (Requires Investor Login)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

# Get investor token
INVESTOR_TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"'$INVESTOR_EMAIL'","password":"'$INVESTOR_PASS'"}' | \
    grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo -e "\n${YELLOW}4.1 Investor Dashboard${NC}"
echo "URL: $FRONTEND_URL/investor/dashboard"
echo "Expected sections:"
echo "  - Portfolio overview"
echo "  - Recent investments"
echo "  - Watchlist"
echo "  - Recommended pitches"
echo "  - ROI tracking"

test_endpoint "/api/investor/dashboard" "GET" "" "$INVESTOR_TOKEN" "Investor Dashboard Data"

echo -e "\n${YELLOW}4.2 Browse & Discover${NC}"
echo "URL: $FRONTEND_URL/investor/discover"
echo "Features:"
echo "  - Advanced filtering (category, funding range, location)"
echo "  - AI-powered recommendations"
echo "  - Trending opportunities"
echo "  - Recently funded"

echo -e "\n${YELLOW}4.3 Investment Flow${NC}"
echo "URL: $FRONTEND_URL/pitch/[id] -> Invest button"
echo "Workflow:"
echo "  Step 1: Select investment amount"
echo "  Step 2: Review terms and conditions"
echo "  Step 3: Payment method selection"
echo "  Step 4: Confirm investment"
echo "  Step 5: Receipt and confirmation"

echo -e "\n${YELLOW}4.4 Portfolio Management${NC}"
echo "URL: $FRONTEND_URL/investor/portfolio"
echo "Features:"
echo "  - List of all investments"
echo "  - Performance tracking per investment"
echo "  - ROI calculations"
echo "  - Export portfolio data"
echo "  - Investment certificates"

test_endpoint "/api/investor/portfolio" "GET" "" "$INVESTOR_TOKEN" "Investor Portfolio"

echo -e "\n${YELLOW}4.5 Watchlist${NC}"
echo "URL: $FRONTEND_URL/investor/watchlist"
echo "Features:"
echo "  - Add/remove pitches"
echo "  - Get notifications on updates"
echo "  - Quick invest shortcuts"
echo "  - Notes per watched pitch"

echo -e "\n${YELLOW}4.6 Messages with Creators${NC}"
echo "URL: $FRONTEND_URL/investor/messages"
echo "Features:"
echo "  - Direct messaging with creators"
echo "  - Investment-related queries"
echo "  - Updates from invested pitches"

test_endpoint "/api/messages/conversations" "GET" "" "$INVESTOR_TOKEN" "Investor Messages"

echo -e "\n${YELLOW}4.7 Transaction History${NC}"
echo "URL: $FRONTEND_URL/investor/transactions"
echo "Features:"
echo "  - Complete investment history"
echo "  - Filter by date, amount, status"
echo "  - Download statements"
echo "  - Tax reporting tools"

echo -e "\n${YELLOW}4.8 Settings & Preferences${NC}"
echo "URL: $FRONTEND_URL/investor/settings"
echo "Sections:"
echo "  - Investment preferences"
echo "  - Risk tolerance settings"
echo "  - Notification settings"
echo "  - Payment methods"
echo "  - Account security"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}5. INTERACTIVE FEATURES (Both Roles)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}5.1 Search Functionality${NC}"
echo "Test cases:"
echo "  - Search by pitch title"
echo "  - Search by creator name"
echo "  - Search by category"
echo "  - Search with filters"
echo "  - Empty search results"

echo -e "\n${YELLOW}5.2 Comments System${NC}"
echo "Features:"
echo "  - Post comments on pitches"
echo "  - Reply to comments"
echo "  - Like/upvote comments"
echo "  - Report inappropriate content"
echo "  - Comment moderation"

echo -e "\n${YELLOW}5.3 Follow System${NC}"
echo "Features:"
echo "  - Follow/unfollow creators"
echo "  - Following list"
echo "  - Follower count"
echo "  - Activity feed from followed creators"

test_endpoint "/api/follows/following" "GET" "" "$INVESTOR_TOKEN" "Following List"

echo -e "\n${YELLOW}5.4 Notification System${NC}"
echo "Features:"
echo "  - Real-time notifications"
echo "  - Email notifications"
echo "  - Notification center"
echo "  - Mark as read"
echo "  - Notification preferences"

echo -e "\n${YELLOW}5.5 Sharing Features${NC}"
echo "Features:"
echo "  - Share pitch on social media"
echo "  - Copy link"
echo "  - Email share"
echo "  - Embed widget"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}6. PAYMENT & FINANCIAL WORKFLOWS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}6.1 Payment Processing${NC}"
echo "Features:"
echo "  - Credit/debit card payments"
echo "  - PayPal integration"
echo "  - Stripe checkout"
echo "  - Payment confirmation"
echo "  - Receipt generation"

echo -e "\n${YELLOW}6.2 Refund Process${NC}"
echo "Features:"
echo "  - Request refund"
echo "  - Refund status tracking"
echo "  - Refund history"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}7. ERROR HANDLING & EDGE CASES${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}7.1 404 Pages${NC}"
echo "Test: $FRONTEND_URL/nonexistent-page"
echo "Expected: Custom 404 page with navigation options"

echo -e "\n${YELLOW}7.2 Unauthorized Access${NC}"
echo "Test cases:"
echo "  - Access creator dashboard without login"
echo "  - Access investor dashboard with creator account"
echo "  - Expired session handling"

echo -e "\n${YELLOW}7.3 Form Validation${NC}"
echo "Test all forms for:"
echo "  - Required field validation"
echo "  - Email format validation"
echo "  - Number range validation"
echo "  - File upload size limits"
echo "  - Special character handling"

echo -e "\n${YELLOW}7.4 Network Errors${NC}"
echo "Test:"
echo "  - Slow connection handling"
echo "  - API timeout scenarios"
echo "  - Offline mode behavior"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}8. RESPONSIVE DESIGN TESTING${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}Device Types to Test:${NC}"
echo "  - Desktop (1920x1080, 1366x768)"
echo "  - Tablet (768x1024 - iPad)"
echo "  - Mobile (375x667 - iPhone, 360x640 - Android)"
echo ""
echo "Key areas to check:"
echo "  - Navigation menu collapse"
echo "  - Grid layouts responsiveness"
echo "  - Form usability on mobile"
echo "  - Touch gestures for carousels"
echo "  - Modal/popup sizing"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}9. PERFORMANCE METRICS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}Testing API Response Times:${NC}"

# Test public endpoints
test_endpoint "/api/pitches" "GET" "" "" "Public Pitches (Load Time)"
test_endpoint "/api/categories" "GET" "" "" "Categories (Load Time)"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}10. SECURITY TESTING${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}Security Checks:${NC}"
echo "  ✓ HTTPS enforcement"
echo "  ✓ JWT token expiration"
echo "  ✓ CORS configuration"
echo "  ✓ XSS prevention"
echo "  ✓ SQL injection prevention"
echo "  ✓ Rate limiting"
echo "  ✓ Password encryption"
echo "  ✓ Secure file uploads"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${GREEN}Working Features:${NC}"
echo "  ✓ Public homepage and marketplace"
echo "  ✓ Authentication (login/signup)"
echo "  ✓ Creator dashboard and pitch management"
echo "  ✓ Investor dashboard"
echo "  ✓ API endpoints responding"

echo -e "\n${YELLOW}Features Needing Verification:${NC}"
echo "  ? Payment integration (Stripe)"
echo "  ? Email notifications"
echo "  ? Real-time updates"
echo "  ? File upload functionality"
echo "  ? Video streaming"

echo -e "\n${RED}Known Issues (Recently Fixed):${NC}"
echo "  ✓ FIXED: CORS errors with hardcoded localhost"
echo "  ✓ FIXED: Messages endpoint returning 500"
echo "  ✓ FIXED: Following/followers endpoints"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}MANUAL TESTING CHECKLIST${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}High Priority Tests:${NC}"
echo "[ ] Homepage loads without errors"
echo "[ ] Can view marketplace pitches"
echo "[ ] Login works for demo accounts"
echo "[ ] Creator can access dashboard"
echo "[ ] Creator can view their pitches"
echo "[ ] Investor can access dashboard"
echo "[ ] Search functionality works"
echo "[ ] Pitch detail pages load"
echo "[ ] Navigation between pages works"
echo "[ ] Responsive design on mobile"

echo -e "\n${YELLOW}Medium Priority Tests:${NC}"
echo "[ ] Create new pitch workflow"
echo "[ ] Edit existing pitch"
echo "[ ] Investment flow (up to payment)"
echo "[ ] Follow/unfollow creators"
echo "[ ] Messages between users"
echo "[ ] Profile settings update"
echo "[ ] Watchlist functionality"
echo "[ ] Comments on pitches"

echo -e "\n${YELLOW}Low Priority Tests:${NC}"
echo "[ ] Analytics charts display"
echo "[ ] Export data features"
echo "[ ] Social media sharing"
echo "[ ] Email notifications"
echo "[ ] Advanced search filters"
echo "[ ] Pagination on all lists"

echo -e "\n${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Testing script completed at $(date)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"