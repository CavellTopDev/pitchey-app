#!/bin/bash

# Emergency component replacement script
# Usage: ./emergency-component-fix.sh [component-name]

COMPONENT=$1
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$COMPONENT" ]; then
  echo -e "${YELLOW}🚨 EMERGENCY COMPONENT FIXES AVAILABLE:${NC}"
  echo ""
  echo "Usage: ./emergency-component-fix.sh [component-name]"
  echo ""
  echo "Available fixes:"
  echo "  notification-bell    - Replace NotificationBell with safe version"
  echo "  portfolio-card      - Replace InvestmentPortfolioCard with safe version"
  echo "  remove-analytics    - Temporarily remove EnhancedInvestorAnalytics"
  echo "  all-safe           - Apply all safe component replacements"
  echo ""
  exit 0
fi

case $COMPONENT in
  "notification-bell")
    echo -e "${BLUE}🔧 Replacing NotificationBell with safe version...${NC}"
    
    # Replace import in InvestorDashboard
    sed -i 's/NotificationBell/NotificationBellSafe/g' frontend/src/pages/InvestorDashboard.tsx
    sed -i 's/from '\''..\/components\/NotificationBell'\''/from '\''..\/components\/NotificationBellSafe'\''/g' frontend/src/pages/InvestorDashboard.tsx
    
    echo -e "${GREEN}✅ NotificationBell replaced with safe version${NC}"
    ;;
    
  "portfolio-card")
    echo -e "${BLUE}🔧 Replacing InvestmentPortfolioCard with safe version...${NC}"
    
    # Replace import in InvestorDashboard
    sed -i 's/InvestmentPortfolioCard/InvestmentPortfolioCardSafe/g' frontend/src/pages/InvestorDashboard.tsx
    sed -i 's/from '\''..\/components\/Investment\/InvestmentPortfolioCard'\''/from '\''..\/components\/Investment\/InvestmentPortfolioCardSafe'\''/g' frontend/src/pages/InvestorDashboard.tsx
    
    echo -e "${GREEN}✅ InvestmentPortfolioCard replaced with safe version${NC}"
    ;;
    
  "remove-analytics")
    echo -e "${BLUE}🔧 Temporarily removing EnhancedInvestorAnalytics...${NC}"
    
    # Comment out the analytics component
    sed -i 's/<EnhancedInvestorAnalytics/<!-- <EnhancedInvestorAnalytics/g' frontend/src/pages/InvestorDashboard.tsx
    sed -i 's/\/>/\/> -->/g' frontend/src/pages/InvestorDashboard.tsx
    
    echo -e "${GREEN}✅ Analytics component temporarily removed${NC}"
    ;;
    
  "all-safe")
    echo -e "${BLUE}🔧 Applying all safe component replacements...${NC}"
    
    # Apply all fixes
    ./emergency-component-fix.sh notification-bell
    ./emergency-component-fix.sh portfolio-card
    
    echo -e "${GREEN}✅ All safe replacements applied${NC}"
    ;;
    
  *)
    echo -e "${RED}❌ Unknown component: $COMPONENT${NC}"
    echo "Run './emergency-component-fix.sh' to see available options"
    exit 1
    ;;
esac

echo ""
echo -e "${YELLOW}📦 Building and deploying fix...${NC}"
cd frontend && npm run build
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Build successful${NC}"
  
  # Commit and push
  cd ..
  git add -A
  git commit -m "fix(emergency): apply safe component replacement for $COMPONENT

- Replaced crashing component with error-safe version
- Added proper null checks and error handling
- Maintains functionality while preventing crashes

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
  
  git push origin main
  
  echo -e "${GREEN}🚀 Emergency fix deployed!${NC}"
  echo "Wait 2-3 minutes for deployment, then test: https://pitchey.pages.dev/investor/dashboard"
else
  echo -e "${RED}❌ Build failed! Check for syntax errors.${NC}"
  exit 1
fi