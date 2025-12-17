#!/bin/bash

# Test Better Auth implementation on production API
# Better Auth uses session-based authentication with different endpoints

set -e

BASE_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
PASSWORD="Demo123"

echo "==========================================="
echo "    Testing Better Auth Implementation     "
echo "==========================================="
echo ""
echo "API: $BASE_URL"
echo "Password: $PASSWORD"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Test Better Auth endpoints
echo -e "${BLUE}1. Testing Better Auth Session Endpoint...${NC}"
SESSION_RESPONSE=$(curl -s "$BASE_URL/api/auth/session" \
  -H "Content-Type: application/json" 2>/dev/null)
echo "   Response: $SESSION_RESPONSE"
echo ""

# Test Better Auth sign-in (standard endpoint)
echo -e "${BLUE}2. Testing Better Auth Sign-In...${NC}"
echo "   Email: alex.creator@demo.com"
SIGNIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"alex.creator@demo.com\",\"password\":\"$PASSWORD\"}" \
  -c cookies.txt 2>/dev/null)

if echo "$SIGNIN_RESPONSE" | grep -q '"session"\|"user"\|success'; then
  echo -e "   ${GREEN}✅ Sign-in successful${NC}"
  echo "   Response: ${SIGNIN_RESPONSE:0:100}..."
else
  echo -e "   ${YELLOW}⚠️  Standard sign-in may not be configured${NC}"
  echo "   Response: $SIGNIN_RESPONSE"
fi
echo ""

# Test Better Auth portal-specific endpoints
echo -e "${BLUE}3. Testing Portal-Specific Sign-In...${NC}"

# Try Better Auth with portal prefix
for PORTAL in "creator" "investor" "production"; do
  echo -e "   ${BLUE}Testing $PORTAL portal...${NC}"
  
  # Map demo emails to portals
  case $PORTAL in
    "creator")
      EMAIL="alex.creator@demo.com"
      ;;
    "investor")
      EMAIL="sarah.investor@demo.com"
      ;;
    "production")
      EMAIL="stellar.production@demo.com"
      ;;
  esac
  
  # Try Better Auth endpoint pattern
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/$PORTAL/sign-in" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    -c cookies-$PORTAL.txt 2>/dev/null)
  
  if echo "$RESPONSE" | grep -q '"session"\|"user"\|"token"'; then
    echo -e "   ${GREEN}✅ $PORTAL sign-in working${NC}"
  else
    # Try legacy endpoint as fallback
    LEGACY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/$PORTAL/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" 2>/dev/null)
    
    if echo "$LEGACY_RESPONSE" | grep -q '"success":true\|"token"'; then
      echo -e "   ${YELLOW}⚠️  Using legacy endpoint for $PORTAL${NC}"
    else
      echo -e "   ${RED}❌ $PORTAL authentication not working${NC}"
    fi
  fi
done
echo ""

# Test Better Auth user endpoint
echo -e "${BLUE}4. Testing Better Auth User Endpoint...${NC}"
USER_RESPONSE=$(curl -s "$BASE_URL/api/auth/user" \
  -H "Content-Type: application/json" \
  -b cookies.txt 2>/dev/null)

if echo "$USER_RESPONSE" | grep -q '"email"\|"id"'; then
  echo -e "   ${GREEN}✅ User endpoint working${NC}"
  echo "   User data retrieved successfully"
else
  echo -e "   ${YELLOW}⚠️  User endpoint may require active session${NC}"
  echo "   Response: $USER_RESPONSE"
fi
echo ""

# Check Better Auth configuration
echo -e "${BLUE}5. Checking Better Auth Configuration...${NC}"

# Test if Better Auth middleware is active
CONFIG_RESPONSE=$(curl -s "$BASE_URL/api/auth/get-session" \
  -H "Content-Type: application/json" 2>/dev/null)

if echo "$CONFIG_RESPONSE" | grep -q "better-auth\|session"; then
  echo -e "   ${GREEN}✅ Better Auth middleware detected${NC}"
else
  echo -e "   ${YELLOW}⚠️  Better Auth may not be fully configured${NC}"
fi

# Clean up cookie files
rm -f cookies*.txt

echo ""
echo "==========================================="
echo "        Better Auth Implementation         "
echo "==========================================="
echo ""

echo -e "${BLUE}Expected Better Auth Endpoints:${NC}"
echo "  • POST   /api/auth/sign-in      - Standard sign-in"
echo "  • POST   /api/auth/sign-up      - User registration"
echo "  • POST   /api/auth/sign-out     - Sign out"
echo "  • GET    /api/auth/session      - Get current session"
echo "  • GET    /api/auth/user         - Get user data"
echo ""

echo -e "${BLUE}Portal-Specific Patterns:${NC}"
echo "  • /api/auth/creator/sign-in"
echo "  • /api/auth/investor/sign-in"
echo "  • /api/auth/production/sign-in"
echo ""

echo -e "${YELLOW}Note:${NC} Better Auth uses session-based authentication."
echo "Cookies are required for authenticated requests."
echo ""

echo "Test completed at: $(date)"