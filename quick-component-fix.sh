#!/bin/bash

# Quick component analysis based on common React crash patterns

echo "🔍 ANALYZING COMMON DASHBOARD CRASH CAUSES:"
echo ""

echo "1. Missing API imports or undefined services:"
grep -r "import.*Service" frontend/src/pages/InvestorDashboard.tsx
echo ""

echo "2. Potential undefined hook contexts:"
grep -r "useNotifications\|useWebSocket" frontend/src/components/NotificationBell.tsx | head -5
echo ""

echo "3. Missing prop types or null handling:"
grep -r "props.*\." frontend/src/components/Investment/ | head -5
echo ""

echo "4. Analytics component potential issues:"
grep -r "EnhancedInvestorAnalytics" frontend/src/components/Analytics/ | head -3
echo ""

echo "💡 MOST LIKELY CULPRITS:"
echo "   → NotificationBell: WebSocket context dependency"  
echo "   → InvestmentPortfolioCard: API data mapping"
echo "   → EnhancedInvestorAnalytics: Chart library issues"
echo ""

echo "🧪 TO TEST:"
echo "   1. Go to: https://pitchey.pages.dev/investor/dashboard/debug"
echo "   2. Start Phase 1, then incrementally test each phase"
echo "   3. Note which phase crashes and report back"
echo ""

echo "⚡ QUICK FIX PREDICTIONS:"
echo "   If Phase 2 crashes: NotificationBell has WebSocket issue"
echo "   If Phase 5 crashes: InvestmentPortfolioCard has null data issue"  
echo "   If Phase 8 crashes: Analytics component has chart library issue"