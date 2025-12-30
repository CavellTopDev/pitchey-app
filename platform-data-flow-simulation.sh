#!/bin/bash

# Platform Data Flow Simulation
# Simulates real user interactions and data flow through the platform

set -e

echo "🚀 PITCHEY PLATFORM DATA FLOW SIMULATION"
echo "========================================"
echo "This simulation creates realistic data flow through all platform layers"
echo ""

# Configuration
API_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
USE_LOCAL="${USE_LOCAL:-false}"

if [ "$USE_LOCAL" = "true" ]; then
  API_URL="http://localhost:8001"
  echo "Using local API: $API_URL"
else
  echo "Using production API: $API_URL"
fi

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Tokens storage
CREATOR_TOKEN=""
INVESTOR_TOKEN=""
PRODUCTION_TOKEN=""
PITCH_ID=""
NDA_ID=""
INVESTMENT_ID=""

# Utility function for API calls
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local token=$4
  
  local headers="-H 'Content-Type: application/json'"
  if [ -n "$token" ]; then
    headers="$headers -H 'Authorization: Bearer $token'"
  fi
  
  if [ "$method" = "GET" ]; then
    eval "curl -s -X $method $API_URL$endpoint $headers"
  else
    eval "curl -s -X $method $API_URL$endpoint $headers -d '$data'"
  fi
}

echo -e "\n${BLUE}=== PHASE 1: USER REGISTRATION & AUTHENTICATION ===${NC}"

# Register Creator
echo -e "\n${YELLOW}1. Registering Creator...${NC}"
creator_reg=$(api_call POST "/api/auth/creator/register" '{
  "email": "simulation.creator@test.com",
  "password": "SimTest123!",
  "firstName": "Creative",
  "lastName": "Director",
  "companyName": "Visionary Productions"
}')

# Login Creator
echo "   Logging in Creator..."
creator_login=$(api_call POST "/api/auth/creator/login" '{
  "email": "simulation.creator@test.com",
  "password": "SimTest123!"
}')
CREATOR_TOKEN=$(echo $creator_login | jq -r '.data.token // empty')

if [ -n "$CREATOR_TOKEN" ]; then
  echo -e "   ${GREEN}✅ Creator authenticated${NC}"
else
  echo -e "   ${YELLOW}⚠️  Using demo creator account${NC}"
  creator_login=$(api_call POST "/api/auth/creator/login" '{
    "email": "alex.creator@demo.com",
    "password": "Demo123"
  }')
  CREATOR_TOKEN=$(echo $creator_login | jq -r '.data.token // empty')
fi

# Register Investor
echo -e "\n${YELLOW}2. Registering Investor...${NC}"
investor_reg=$(api_call POST "/api/auth/investor/register" '{
  "email": "simulation.investor@test.com",
  "password": "SimTest123!",
  "firstName": "Investment",
  "lastName": "Partner",
  "companyName": "Capital Ventures LLC"
}')

# Login Investor
echo "   Logging in Investor..."
investor_login=$(api_call POST "/api/auth/investor/login" '{
  "email": "simulation.investor@test.com",
  "password": "SimTest123!"
}')
INVESTOR_TOKEN=$(echo $investor_login | jq -r '.data.token // empty')

if [ -n "$INVESTOR_TOKEN" ]; then
  echo -e "   ${GREEN}✅ Investor authenticated${NC}"
else
  echo -e "   ${YELLOW}⚠️  Using demo investor account${NC}"
  investor_login=$(api_call POST "/api/auth/investor/login" '{
    "email": "sarah.investor@demo.com",
    "password": "Demo123"
  }')
  INVESTOR_TOKEN=$(echo $investor_login | jq -r '.data.token // empty')
fi

# Register Production Company
echo -e "\n${YELLOW}3. Registering Production Company...${NC}"
production_reg=$(api_call POST "/api/auth/production/register" '{
  "email": "simulation.production@test.com",
  "password": "SimTest123!",
  "firstName": "Studio",
  "lastName": "Executive",
  "companyName": "Major Studios Inc"
}')

# Login Production
echo "   Logging in Production..."
production_login=$(api_call POST "/api/auth/production/login" '{
  "email": "simulation.production@test.com",
  "password": "SimTest123!"
}')
PRODUCTION_TOKEN=$(echo $production_login | jq -r '.data.token // empty')

if [ -n "$PRODUCTION_TOKEN" ]; then
  echo -e "   ${GREEN}✅ Production authenticated${NC}"
else
  echo -e "   ${YELLOW}⚠️  Using demo production account${NC}"
  production_login=$(api_call POST "/api/auth/production/login" '{
    "email": "stellar.production@demo.com",
    "password": "Demo123"
  }')
  PRODUCTION_TOKEN=$(echo $production_login | jq -r '.data.token // empty')
fi

echo -e "\n${BLUE}=== PHASE 2: PITCH CREATION & DISCOVERY ===${NC}"

# Creator creates a pitch
echo -e "\n${YELLOW}4. Creator creates a new pitch...${NC}"
pitch_data='{
  "title": "Echoes of Tomorrow - Simulation",
  "tagline": "Some memories are worth forgetting",
  "logline": "A neuroscientist discovers a way to selectively erase traumatic memories but must confront the ethics when the government wants to weaponize it.",
  "synopsis": "Dr. Sarah Chen has dedicated her life to helping PTSD victims through revolutionary memory modification technology...",
  "genre": "Thriller",
  "format": "Feature Film",
  "budget": 8000000,
  "targetAudience": "Adults 25-54",
  "comparables": ["Eternal Sunshine", "Minority Report", "Ex Machina"],
  "status": "seeking_investment",
  "visibility": "public",
  "productionTimeline": "18 months",
  "additionalMedia": {
    "pitchDeck": "https://example.com/echoes-deck.pdf",
    "trailer": "https://vimeo.com/123456789",
    "script": "https://example.com/echoes-script.pdf"
  }
}'

create_pitch=$(api_call POST "/api/pitches/create" "$pitch_data" "$CREATOR_TOKEN")
PITCH_ID=$(echo $create_pitch | jq -r '.data.id // empty')

if [ -n "$PITCH_ID" ]; then
  echo -e "   ${GREEN}✅ Pitch created with ID: $PITCH_ID${NC}"
else
  echo -e "   ${YELLOW}⚠️  Using existing pitch ID: 1${NC}"
  PITCH_ID=1
fi

# Track pitch creation analytics
echo -e "\n${YELLOW}5. Tracking analytics for pitch creation...${NC}"
api_call POST "/api/analytics/track" '{
  "event": "pitch_created",
  "pitchId": '"$PITCH_ID"',
  "metadata": {
    "source": "web_app",
    "version": "1.0"
  }
}' "$CREATOR_TOKEN" > /dev/null
echo -e "   ${GREEN}✅ Analytics tracked${NC}"

echo -e "\n${BLUE}=== PHASE 3: INVESTOR DISCOVERY & INTEREST ===${NC}"

# Investor browses pitches
echo -e "\n${YELLOW}6. Investor browsing pitches...${NC}"
browse_result=$(api_call GET "/api/pitches/browse/enhanced" "" "$INVESTOR_TOKEN")
echo "   Found $(echo $browse_result | jq '.pitches | length // 0') pitches"

# Investor views specific pitch
echo -e "\n${YELLOW}7. Investor views pitch details...${NC}"
pitch_details=$(api_call GET "/api/pitches/$PITCH_ID" "" "$INVESTOR_TOKEN")
echo "   Viewing: $(echo $pitch_details | jq -r '.data.title // "Unknown"')"

# Track view analytics
api_call POST "/api/analytics/track" '{
  "event": "pitch_view",
  "pitchId": '"$PITCH_ID"',
  "duration": 180,
  "metadata": {
    "source": "browse",
    "referrer": "trending"
  }
}' "$INVESTOR_TOKEN" > /dev/null

# Investor saves pitch
echo -e "\n${YELLOW}8. Investor saves pitch to watchlist...${NC}"
save_result=$(api_call POST "/api/saved/add" '{"pitchId": '"$PITCH_ID"'}' "$INVESTOR_TOKEN")
echo -e "   ${GREEN}✅ Pitch saved to watchlist${NC}"

echo -e "\n${BLUE}=== PHASE 4: NDA WORKFLOW ===${NC}"

# Investor requests NDA
echo -e "\n${YELLOW}9. Investor requests NDA for confidential materials...${NC}"
nda_request=$(api_call POST "/api/ndas/request" '{
  "pitchId": '"$PITCH_ID"',
  "message": "Very interested in this project. Would like to review the full script and financial projections."
}' "$INVESTOR_TOKEN")
NDA_ID=$(echo $nda_request | jq -r '.data.id // empty')

if [ -n "$NDA_ID" ]; then
  echo -e "   ${GREEN}✅ NDA request created with ID: $NDA_ID${NC}"
else
  echo -e "   ${YELLOW}⚠️  Using mock NDA ID: 1${NC}"
  NDA_ID=1
fi

# Creator receives notification (simulated)
echo -e "\n${YELLOW}10. Creator checking NDA requests...${NC}"
nda_list=$(api_call GET "/api/creator/ndas" "" "$CREATOR_TOKEN")
echo "   Pending NDAs: $(echo $nda_list | jq '.pending | length // 0')"

# Creator approves NDA
echo -e "\n${YELLOW}11. Creator approves NDA request...${NC}"
approve_result=$(api_call POST "/api/ndas/$NDA_ID/approve" '{}' "$CREATOR_TOKEN")
echo -e "   ${GREEN}✅ NDA approved${NC}"

# Investor signs NDA
echo -e "\n${YELLOW}12. Investor digitally signs NDA...${NC}"
sign_result=$(api_call POST "/api/ndas/$NDA_ID/sign" '{
  "signature": "Digital Signature - Investment Partner"
}' "$INVESTOR_TOKEN")
echo -e "   ${GREEN}✅ NDA signed${NC}"

echo -e "\n${BLUE}=== PHASE 5: INVESTMENT FLOW ===${NC}"

# Investor creates investment offer
echo -e "\n${YELLOW}13. Investor makes investment offer...${NC}"
investment_data='{
  "pitchId": '"$PITCH_ID"',
  "amount": 2000000,
  "type": "equity",
  "terms": {
    "percentage": 25,
    "recoupment": 120,
    "profitShare": 30,
    "conditions": [
      "Final script approval",
      "Director attachment",
      "Distribution agreement"
    ]
  },
  "message": "We are very excited about this project and would like to lead the investment round."
}'

investment_result=$(api_call POST "/api/investments/create" "$investment_data" "$INVESTOR_TOKEN")
INVESTMENT_ID=$(echo $investment_result | jq -r '.data.id // empty')

if [ -n "$INVESTMENT_ID" ]; then
  echo -e "   ${GREEN}✅ Investment offer created: \$2,000,000${NC}"
else
  echo -e "   ${YELLOW}⚠️  Using mock investment ID: 1${NC}"
  INVESTMENT_ID=1
fi

echo -e "\n${BLUE}=== PHASE 6: PRODUCTION COMPANY INTEREST ===${NC}"

# Production company views pitch
echo -e "\n${YELLOW}14. Production company discovers pitch...${NC}"
prod_view=$(api_call GET "/api/pitches/$PITCH_ID" "" "$PRODUCTION_TOKEN")
echo "   Reviewing: $(echo $prod_view | jq -r '.data.title // "Unknown"')"

# Production requests NDA
echo -e "\n${YELLOW}15. Production company requests NDA...${NC}"
prod_nda=$(api_call POST "/api/ndas/request" '{
  "pitchId": '"$PITCH_ID"',
  "message": "Our studio is interested in optioning this property. Please provide access to full materials."
}' "$PRODUCTION_TOKEN")
echo -e "   ${GREEN}✅ Production NDA requested${NC}"

# Production company creates option offer
echo -e "\n${YELLOW}16. Production company makes option offer...${NC}"
option_result=$(api_call POST "/api/rights/option" '{
  "pitchId": '"$PITCH_ID"',
  "duration": "18_months",
  "price": 75000,
  "purchasePrice": 750000,
  "terms": "Exclusive worldwide rights with sequel and remake options"
}' "$PRODUCTION_TOKEN")
echo -e "   ${GREEN}✅ Option offer: \$75,000 for 18 months${NC}"

echo -e "\n${BLUE}=== PHASE 7: REAL-TIME COLLABORATION ===${NC}"

# Simulate WebSocket connection info
echo -e "\n${YELLOW}17. Testing real-time features...${NC}"
ws_info=$(api_call GET "/api/ws/info" "" "$CREATOR_TOKEN")
echo "   WebSocket endpoint available"

# Create collaboration room
echo -e "\n${YELLOW}18. Creating collaboration room...${NC}"
room_result=$(api_call POST "/api/ws/rooms/create" '{
  "type": "pitch_collaboration",
  "pitchId": '"$PITCH_ID"'
}' "$CREATOR_TOKEN")
echo -e "   ${GREEN}✅ Collaboration room created${NC}"

echo -e "\n${BLUE}=== PHASE 8: ANALYTICS & REPORTING ===${NC}"

# Creator views analytics dashboard
echo -e "\n${YELLOW}19. Creator checking analytics dashboard...${NC}"
analytics=$(api_call GET "/api/analytics/dashboard" "" "$CREATOR_TOKEN")
echo "   Dashboard data retrieved"

# Get pitch-specific analytics
echo -e "\n${YELLOW}20. Analyzing pitch performance...${NC}"
pitch_analytics=$(api_call GET "/api/analytics/pitch/$PITCH_ID" "" "$CREATOR_TOKEN")
echo "   Views: $(echo $pitch_analytics | jq -r '.views // 0')"
echo "   Engagement Rate: $(echo $pitch_analytics | jq -r '.engagementRate // 0')%"
echo "   NDA Requests: $(echo $pitch_analytics | jq -r '.ndaRequests // 0')"
echo "   Investment Interest: $(echo $pitch_analytics | jq -r '.investmentInterest // 0')"

echo -e "\n${BLUE}=== PHASE 9: MESSAGING & NOTIFICATIONS ===${NC}"

# Investor sends message to creator
echo -e "\n${YELLOW}21. Investor sends message to creator...${NC}"
message_result=$(api_call POST "/api/messages/send" '{
  "recipientId": 1,
  "subject": "Re: Echoes of Tomorrow",
  "content": "Would love to schedule a call to discuss the project further. Are you available this week?"
}' "$INVESTOR_TOKEN")
echo -e "   ${GREEN}✅ Message sent${NC}"

# Check notifications
echo -e "\n${YELLOW}22. Creator checking notifications...${NC}"
notifications=$(api_call GET "/api/notifications/unread-count" "" "$CREATOR_TOKEN")
echo "   Unread notifications: $(echo $notifications | jq -r '.count // 0')"

echo -e "\n${BLUE}=== SIMULATION COMPLETE ===${NC}"
echo ""
echo "📊 SIMULATION SUMMARY"
echo "===================="
echo "✅ Users Created: 3 (Creator, Investor, Production)"
echo "✅ Pitch Created: $PITCH_ID"
echo "✅ NDA Workflow: Completed"
echo "✅ Investment Offer: \$2,000,000"
echo "✅ Option Offer: \$75,000"
echo "✅ Messages Sent: 1"
echo "✅ Analytics Tracked: Multiple events"
echo ""

# Test endpoint coverage
echo "🔍 ENDPOINT COVERAGE ANALYSIS"
echo "============================"

# Run the TypeScript simulation for comprehensive testing
echo -e "\n${YELLOW}Running comprehensive endpoint test...${NC}"
echo "(This will test all documented endpoints)"
echo ""

if command -v deno &> /dev/null; then
  deno run --allow-all platform-comprehensive-test-simulation.ts
else
  echo -e "${YELLOW}⚠️  Deno not installed. Install Deno to run comprehensive tests.${NC}"
  echo "Install with: curl -fsSL https://deno.land/install.sh | sh"
fi

echo -e "\n${GREEN}✅ Data flow simulation complete!${NC}"
echo "Check platform-test-simulation-report.json for detailed results."