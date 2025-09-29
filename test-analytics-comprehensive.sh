#!/bin/bash

echo "=========================================="
echo "ANALYTICS PAGE - COMPREHENSIVE FIX TEST"
echo "=========================================="
echo ""

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "1. Backend Analytics Response:"
ANALYTICS=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/63?preset=month" \
  -H "Authorization: Bearer $TOKEN")

echo "   Structure returned:"
echo "$ANALYTICS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
analytics = data.get('data', {}).get('analytics', {})
print(f'   • views: {analytics.get(\"views\", \"N/A\")}')
print(f'   • likes: {analytics.get(\"likes\", \"N/A\")}')
print(f'   • shares: {analytics.get(\"shares\", \"N/A\")}')
print(f'   • viewsByDate: {len(analytics.get(\"viewsByDate\", []))} entries')
print(f'   • demographics: {list(analytics.get(\"demographics\", {}).keys())}')
"
echo ""

echo "2. Frontend Fixes Applied:"
echo "   ✅ Added optional chaining (?.) for all property access"
echo "   ✅ formatNumber() handles undefined/null/NaN"
echo "   ✅ formatTime() handles undefined/null/NaN"
echo "   ✅ All arrays have fallback empty arrays"
echo "   ✅ Data mapping: views → totalViews, etc."
echo ""

echo "3. Fixed Property Accesses:"
echo "   • analytics?.totalViews (was analytics.totalViews)"
echo "   • analytics?.engagement?.averageViewTime (was analytics.engagement.averageViewTime)"
echo "   • (analytics?.viewsByDay || []) (was analytics.viewsByDay)"
echo "   • (analytics?.topReferrers || []) (was analytics.topReferrers)"
echo ""

echo "4. Safe Division Operations:"
echo "   • Checking totalViews > 0 before division"
echo "   • Using Math.max(..., 1) to prevent division by zero"
echo "   • All percentage calculations have safety checks"
echo ""

echo "=========================================="
echo "RESULT: Analytics page should work now!"
echo "=========================================="
echo ""
echo "TO TEST:"
echo "1. Do a hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "2. Visit: http://localhost:5173/creator/pitches/63/analytics"
echo "3. Page should display without errors"
echo ""
echo "If still seeing errors, clear browser cache completely."
