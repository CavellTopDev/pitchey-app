#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Dashboard Component Testing Tool${NC}"
echo -e "${YELLOW}This will help isolate which component is crashing the investor dashboard${NC}"
echo ""

# Build and deploy
echo -e "${BLUE}Building frontend with debug dashboard...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed! Check for syntax errors.${NC}"
    exit 1
fi

# Commit and push changes
echo -e "${BLUE}Deploying debug dashboard...${NC}"
git add -A
git commit -m "feat(debug): add investor dashboard component testing tool

- Created InvestorDashboardDebug for systematic component testing  
- Phase-by-phase testing to isolate crashing components
- Added debug route at /investor/dashboard/debug

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main

echo -e "${GREEN}✅ Debug dashboard deployed!${NC}"
echo ""
echo -e "${YELLOW}📋 Testing Instructions:${NC}"
echo "1. Wait 2-3 minutes for deployment to complete"
echo "2. Go to: https://pitchey-5o8.pages.dev/investor/dashboard/debug"
echo "3. Start with Phase 1 (basic layout)"
echo "4. Click 'Next Phase' to test each component incrementally"
echo "5. If a phase crashes, that component has the issue"
echo ""
echo -e "${BLUE}Component Test Order:${NC}"
echo "Phase 1: Basic layout (safe baseline)"
echo "Phase 2: + NotificationBell"
echo "Phase 3: + NotificationWidget" 
echo "Phase 4: + QuickNDAStatus"
echo "Phase 5: + InvestmentPortfolioCard"
echo "Phase 6: + InvestmentHistory"
echo "Phase 7: + InvestmentOpportunities"
echo "Phase 8: + EnhancedInvestorAnalytics"
echo ""
echo -e "${YELLOW}💡 When you find the crashing component:${NC}"
echo "- Note which phase causes the crash"
echo "- Check browser console (F12) for error details"
echo "- Report back which component is problematic"
echo ""
echo -e "${GREEN}🔗 Debug URL: https://pitchey-5o8.pages.dev/investor/dashboard/debug${NC}"