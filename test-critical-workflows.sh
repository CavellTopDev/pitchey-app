#!/bin/bash

# Comprehensive Test Suite for Pitchey Platform
# Based on CLIENT_FEEDBACK_REQUIREMENTS.md

set -e

# Configuration
API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey.pages.dev}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test credentials
CREATOR_EMAIL="alex.creator@demo.com"
INVESTOR_EMAIL="sarah.investor@demo.com"
PRODUCTION_EMAIL="stellar.production@demo.com"
TEST_PASSWORD="Demo123"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
log_test() {
    echo -e "\n${YELLOW}Testing: $1${NC}"
    ((TOTAL_TESTS++))
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED_TESTS++))
}

# ===========================================
# PRIORITY 1: CRITICAL ISSUES
# ===========================================

echo "=========================================="
echo "PRIORITY 1: CRITICAL ISSUES TESTING"
echo "=========================================="

# Test 1: Investor Sign-Out Functionality
log_test "Investor Sign-Out Functionality"

# Login as investor
INVESTOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

INVESTOR_TOKEN=$(echo $INVESTOR_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$INVESTOR_TOKEN" ]; then
    log_success "Investor login successful"
    
    # Test logout endpoint
    LOGOUT_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/logout" \
      -H "Authorization: Bearer $INVESTOR_TOKEN" \
      -H "Content-Type: application/json")
    
    if echo "$LOGOUT_RESPONSE" | grep -q "success"; then
        log_success "Investor logout endpoint working"
        
        # Verify token is invalidated
        PROTECTED_TEST=$(curl -s -w "%{http_code}" -o /dev/null \
          "$API_URL/api/investor/dashboard" \
          -H "Authorization: Bearer $INVESTOR_TOKEN")
        
        if [ "$PROTECTED_TEST" = "401" ]; then
            log_success "Token properly invalidated after logout"
        else
            log_error "Token still valid after logout (HTTP $PROTECTED_TEST)"
        fi
    else
        log_error "Investor logout failed"
    fi
else
    log_error "Investor login failed - cannot test logout"
fi

# Test 2: Investor Dashboard Functionality
log_test "Investor Dashboard Functionality"

# Re-login for dashboard test
INVESTOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/investor/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$INVESTOR_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

INVESTOR_TOKEN=$(echo $INVESTOR_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$INVESTOR_TOKEN" ]; then
    # Test dashboard endpoint
    DASHBOARD_RESPONSE=$(curl -s "$API_URL/api/investor/dashboard" \
      -H "Authorization: Bearer $INVESTOR_TOKEN")
    
    # Check for required dashboard components
    if echo "$DASHBOARD_RESPONSE" | grep -q "portfolio\|savedPitches\|ndaStatus\|recentActivity"; then
        log_success "Investor dashboard returns expected data structure"
    else
        log_error "Investor dashboard missing required components"
    fi
    
    # Test specific dashboard features
    features=("portfolio" "saved-pitches" "ndas" "analytics" "info-requests")
    
    for feature in "${features[@]}"; do
        FEATURE_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
          "$API_URL/api/investor/$feature" \
          -H "Authorization: Bearer $INVESTOR_TOKEN")
        
        if [ "$FEATURE_RESPONSE" = "200" ]; then
            log_success "Investor $feature endpoint working"
        else
            log_error "Investor $feature endpoint failed (HTTP $FEATURE_RESPONSE)"
        fi
    done
fi

# ===========================================
# PRIORITY 2: BROWSE PITCHES SECTION
# ===========================================

echo -e "\n=========================================="
echo "PRIORITY 2: BROWSE PITCHES SECTION TESTING"
echo "=========================================="

# Test 3: Tab Content Separation
log_test "Browse Tab Content Separation"

# Test Trending Tab
TRENDING_RESPONSE=$(curl -s "$API_URL/api/pitches/trending?limit=5")
TRENDING_COUNT=$(echo "$TRENDING_RESPONSE" | grep -o '"id"' | wc -l)

if [ "$TRENDING_COUNT" -gt 0 ]; then
    log_success "Trending tab returns pitches"
    
    # Verify trending criteria (should have views > 0)
    if echo "$TRENDING_RESPONSE" | grep -q '"viewCount":[1-9]'; then
        log_success "Trending pitches have view counts"
    else
        log_error "Trending pitches missing view count data"
    fi
else
    log_error "Trending tab returns no pitches"
fi

# Test New Tab
NEW_RESPONSE=$(curl -s "$API_URL/api/pitches/new?limit=5")
NEW_COUNT=$(echo "$NEW_RESPONSE" | grep -o '"id"' | wc -l)

if [ "$NEW_COUNT" -gt 0 ]; then
    log_success "New tab returns pitches"
    
    # Extract and verify dates are recent (within 30 days)
    # This is simplified - in production would do proper date comparison
    if echo "$NEW_RESPONSE" | grep -q '"createdAt":"2025'; then
        log_success "New pitches are recent"
    else
        log_error "New pitches may not be recent"
    fi
else
    log_error "New tab returns no pitches"
fi

# Verify Top Rated tab is removed
TOP_RATED_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/pitches/top-rated")

if [ "$TOP_RATED_RESPONSE" = "404" ]; then
    log_success "Top Rated endpoint properly removed"
else
    log_error "Top Rated endpoint still exists (HTTP $TOP_RATED_RESPONSE)"
fi

# Test 4: Genre & Format Filtering
log_test "Genre & Format Filtering"

GENRES=("action" "comedy" "drama" "horror" "scifi" "thriller")
FORMATS=("feature" "series" "limited-series" "short")

# Test genre filtering
for genre in "${GENRES[@]}"; do
    GENRE_RESPONSE=$(curl -s "$API_URL/api/pitches/browse?genre=$genre&limit=2")
    
    if echo "$GENRE_RESPONSE" | grep -q "\"genre\":\"$genre\""; then
        log_success "Genre filter working for: $genre"
    else
        log_error "Genre filter not working for: $genre"
    fi
done

# Test format filtering
for format in "${FORMATS[@]}"; do
    FORMAT_RESPONSE=$(curl -s "$API_URL/api/pitches/browse?format=$format&limit=2")
    
    if echo "$FORMAT_RESPONSE" | grep -q "\"format\":\"$format\""; then
        log_success "Format filter working for: $format"
    else
        log_error "Format filter not working for: $format"
    fi
done

# Test 5: Sorting Options
log_test "Browse Sorting Options"

SORT_OPTIONS=("alphabetical_asc" "alphabetical_desc" "date_newest" "date_oldest" "budget_high" "budget_low" "views_most" "views_least")

for sort in "${SORT_OPTIONS[@]}"; do
    SORT_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/pitches/browse?sort=$sort&limit=5")
    
    if [ "$SORT_RESPONSE" = "200" ]; then
        log_success "Sort option working: $sort"
    else
        log_error "Sort option failed: $sort (HTTP $SORT_RESPONSE)"
    fi
done

# Test 6: Access Control for Pitch Creation
log_test "Access Control for Pitch Creation"

# Test Creator can create pitch
CREATOR_LOGIN=$(curl -s -X POST "$API_URL/api/auth/creator/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CREATOR_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

CREATOR_TOKEN=$(echo $CREATOR_LOGIN | grep -o '"token":"[^"]*' | cut -d'"' -f4)

CREATOR_CREATE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Pitch","logline":"Test logline"}')

if [ "$CREATOR_CREATE" = "200" ] || [ "$CREATOR_CREATE" = "201" ]; then
    log_success "Creator can create pitches"
else
    log_error "Creator cannot create pitches (HTTP $CREATOR_CREATE)"
fi

# Test Investor cannot create pitch
INVESTOR_CREATE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_URL/api/pitches" \
  -H "Authorization: Bearer $INVESTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Pitch","logline":"Test logline"}')

if [ "$INVESTOR_CREATE" = "403" ] || [ "$INVESTOR_CREATE" = "401" ]; then
    log_success "Investor correctly blocked from creating pitches"
else
    log_error "Investor can create pitches (HTTP $INVESTOR_CREATE) - SECURITY ISSUE"
fi

# ===========================================
# PRIORITY 3: NDA WORKFLOW
# ===========================================

echo -e "\n=========================================="
echo "PRIORITY 3: NDA WORKFLOW TESTING"
echo "=========================================="

log_test "NDA Request and Approval Workflow"

# Get a pitch to request NDA for
PITCH_ID=$(curl -s "$API_URL/api/pitches/public?limit=1" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -n "$PITCH_ID" ]; then
    # Request NDA as investor
    NDA_REQUEST=$(curl -s -X POST "$API_URL/api/ndas/request" \
      -H "Authorization: Bearer $INVESTOR_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"pitchId\":$PITCH_ID}")
    
    if echo "$NDA_REQUEST" | grep -q "success"; then
        log_success "NDA request created"
        
        # Check NDA status
        NDA_STATUS=$(curl -s "$API_URL/api/ndas/status/$PITCH_ID" \
          -H "Authorization: Bearer $INVESTOR_TOKEN")
        
        if echo "$NDA_STATUS" | grep -q "pending\|approved\|rejected"; then
            log_success "NDA status endpoint working"
        else
            log_error "NDA status endpoint not returning expected data"
        fi
    else
        log_error "NDA request failed"
    fi
else
    log_error "No pitch found for NDA testing"
fi

# ===========================================
# PRIORITY 4: PITCH CREATION ENHANCEMENTS
# ===========================================

echo -e "\n=========================================="
echo "PRIORITY 4: PITCH CREATION TESTING"
echo "=========================================="

log_test "Character Management Features"

# Test character editing capability
PITCH_WITH_CHARS=$(curl -s -X POST "$API_URL/api/pitches/draft" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Test Movie",
    "characters":[
      {"name":"Hero","description":"Main protagonist"},
      {"name":"Villain","description":"Antagonist"}
    ]
  }')

if echo "$PITCH_WITH_CHARS" | grep -q "id"; then
    log_success "Pitch with characters created"
    
    DRAFT_ID=$(echo "$PITCH_WITH_CHARS" | grep -o '"id":[0-9]*' | cut -d: -f2)
    
    # Test character update
    CHAR_UPDATE=$(curl -s -X PUT "$API_URL/api/pitches/$DRAFT_ID/characters" \
      -H "Authorization: Bearer $CREATOR_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "characters":[
          {"name":"Hero Updated","description":"Main protagonist updated"},
          {"name":"Villain","description":"Antagonist"}
        ]
      }')
    
    if echo "$CHAR_UPDATE" | grep -q "success\|Hero Updated"; then
        log_success "Character editing working"
    else
        log_error "Character editing not working"
    fi
else
    log_error "Cannot create pitch with characters"
fi

# Test themes field as free text
log_test "Themes Field as Free Text"

THEMES_TEST=$(curl -s -X POST "$API_URL/api/pitches/draft" \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Themes Test",
    "themes":"Love, betrayal, redemption, and the human condition explored through..."
  }')

if echo "$THEMES_TEST" | grep -q "themes"; then
    log_success "Free-text themes field working"
else
    log_error "Free-text themes field not working"
fi

# ===========================================
# SUMMARY
# ===========================================

echo -e "\n=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️ Some tests failed. Please review the output above.${NC}"
    exit 1
fi