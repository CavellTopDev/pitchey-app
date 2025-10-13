#!/bin/bash

echo "🔍 COMPREHENSIVE HARDCODED ELEMENTS TESTING"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📱 Testing All Portals for Hardcoded Elements${NC}"
echo "Backend: http://localhost:8001"
echo "Frontend: http://localhost:5173"
echo ""

# Test backend connectivity
echo -e "${YELLOW}🔌 Testing Backend Connectivity...${NC}"
if curl -s http://localhost:8001/api/config/genres >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API accessible${NC}"
else
    echo -e "${RED}❌ Backend API not accessible${NC}"
    echo "Please ensure backend is running on port 8001"
fi
echo ""

# Test demo accounts
echo -e "${YELLOW}👤 Testing Demo Account Credentials...${NC}"
echo "Testing Creator Login:"
CREATOR_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex.creator@demo.com","password":"Demo123"}')

if echo "$CREATOR_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Creator demo account works: alex.creator@demo.com / Demo123${NC}"
else
    echo -e "${RED}❌ Creator demo account failed${NC}"
fi

echo "Testing Investor Login:"
INVESTOR_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/investor/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sarah.investor@demo.com","password":"Demo123"}')

if echo "$INVESTOR_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Investor demo account works: sarah.investor@demo.com / Demo123${NC}"
else
    echo -e "${RED}❌ Investor demo account failed${NC}"
fi

echo "Testing Production Login:"
PRODUCTION_RESPONSE=$(curl -s -X POST http://localhost:8001/api/auth/production/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stellar.production@demo.com","password":"Demo123"}')

if echo "$PRODUCTION_RESPONSE" | grep -q "token"; then
    echo -e "${GREEN}✅ Production demo account works: stellar.production@demo.com / Demo123${NC}"
else
    echo -e "${RED}❌ Production demo account failed${NC}"
fi
echo ""

# Test API endpoints
echo -e "${YELLOW}🛠️ Testing Hardcoded API Endpoints...${NC}"
endpoints=(
    "/api/config/genres"
    "/api/config/formats"
    "/api/config/budget-ranges"
    "/api/config/stages"
    "/api/pitches/public"
    "/api/pitches/trending"
    "/api/pitches/new"
)

for endpoint in "${endpoints[@]}"; do
    if curl -s "http://localhost:8001$endpoint" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $endpoint accessible${NC}"
    else
        echo -e "${RED}❌ $endpoint failed${NC}"
    fi
done
echo ""

echo -e "${BLUE}📋 MANUAL TESTING CHECKLIST${NC}"
echo "========================================="
echo ""

echo -e "${YELLOW}🏠 1. PORTAL SELECTION PAGE${NC}"
echo "URL: http://localhost:5173/portals"
echo "✓ Check hardcoded portal descriptions"
echo "✓ Verify portal feature lists"
echo "✓ Test portal navigation buttons"
echo ""

echo -e "${YELLOW}🎬 2. CREATOR PORTAL${NC}"
echo "Login: http://localhost:5173/login/creator"
echo "Demo: alex.creator@demo.com / Demo123"
echo ""
echo "HARDCODED ELEMENTS TO VERIFY:"
echo "✓ Login page title: 'Creator Portal'"
echo "✓ Subtitle: 'Share your creative vision with the world'"
echo "✓ Logo: /pitcheylogo.png"
echo "✓ Email placeholder: 'creator@example.com'"
echo "✓ Demo credentials button functionality"
echo ""
echo "Dashboard: http://localhost:5173/creator/dashboard"
echo "✓ Header: 'Creator Dashboard', 'Welcome back, {username}'"
echo "✓ Stats cards with exact text"
echo "✓ Milestone cards and thresholds"
echo "✓ Quick actions menu items"
echo ""
echo "Create Pitch: http://localhost:5173/creator/pitch/new"
echo "✓ Genre dropdown (61 comprehensive genres)"
echo "✓ Format categories and subtypes"
echo "✓ Form labels and placeholders"
echo "✓ File upload instructions"
echo ""

echo -e "${YELLOW}💰 3. INVESTOR PORTAL${NC}"
echo "Login: http://localhost:5173/login/investor"
echo "Demo: sarah.investor@demo.com / Demo123"
echo ""
echo "HARDCODED ELEMENTS TO VERIFY:"
echo "✓ Login page title: 'Investor Portal'"
echo "✓ Subtitle: 'Discover and invest in tomorrow's blockbusters'"
echo "✓ Email placeholder: 'investor@example.com'"
echo ""
echo "Dashboard: http://localhost:5173/investor/dashboard"
echo "✓ Portfolio stats labels"
echo "✓ Investment pipeline sections"
echo "✓ AI recommendations area"
echo ""

echo -e "${YELLOW}🏭 4. PRODUCTION PORTAL${NC}"
echo "Login: http://localhost:5173/login/production"
echo "Demo: stellar.production@demo.com / Demo123"
echo ""
echo "HARDCODED ELEMENTS TO VERIFY:"
echo "✓ Login page title: 'Production Portal'"
echo "✓ Subtitle: 'Transform creative visions into reality'"
echo "✓ Email label: 'Company Email'"
echo "✓ Email placeholder: 'production@company.com'"
echo ""
echo "Dashboard: http://localhost:5173/production/dashboard"
echo "✓ Tab labels: 'overview', 'my-pitches', 'following', 'ndas'"
echo "✓ 'Coming Soon' alert messages"
echo "✓ NDA request messaging"
echo ""

echo -e "${YELLOW}📝 5. FORMS AND REGISTRATION${NC}"
echo "Production Registration:"
echo "✓ Company Name placeholder: 'Warner Bros. Pictures'"
echo "✓ Tax ID placeholder: '123456789'"
echo "✓ Website placeholder: 'https://www.yourcompany.com'"
echo "✓ Email placeholder: 'info@yourcompany.com'"
echo "✓ Phone placeholder: '+1 (555) 123-4567'"
echo ""

echo -e "${YELLOW}🎯 6. CONFIGURATION VALUES${NC}"
echo "✓ Genre options (62 total from Abstract to Western)"
echo "✓ Budget ranges (7 tiers: Under \$1M to Over \$100M)"
echo "✓ Formats: Feature Film, Short Film, TV Series, Web Series"
echo "✓ Stages: Development → Distribution (5 stages)"
echo ""

echo -e "${YELLOW}🔗 7. NAVIGATION AND UI${NC}"
echo "✓ Logo text: 'Pitchey'"
echo "✓ Search placeholder: 'Search...'"
echo "✓ Navigation items per portal type"
echo "✓ User type badges and indicators"
echo ""

echo -e "${YELLOW}💳 8. EXTERNAL LINKS${NC}"
echo "✓ Stripe billing portal: https://billing.stripe.com"
echo "✓ Stripe dashboard: https://dashboard.stripe.com/payments/"
echo "✓ Social media placeholders (LinkedIn, Twitter)"
echo ""

echo -e "${GREEN}🎯 TESTING COMPLETE${NC}"
echo "Follow the manual checklist above to verify all hardcoded elements"
echo "across all portals and components."
echo ""
echo -e "${BLUE}📊 KEY FINDINGS:${NC}"
echo "• 4 portal types with distinct branding"
echo "• 3 demo accounts with shared password 'Demo123'"
echo "• 62+ genre options (comprehensive film genres)"
echo "• Portal-specific navigation and dashboard layouts"
echo "• Extensive form placeholders and validation messages"
echo "• Environment-based configuration with hardcoded fallbacks"
echo ""
echo -e "${YELLOW}⚠️  RECOMMENDATIONS:${NC}"
echo "• Consider content management system for text externalization"
echo "• Implement internationalization (i18n) support"
echo "• Add feature flags for 'Coming Soon' functionality"
echo "• Externalize form validation messages"
echo "• Consider theme customization per portal"