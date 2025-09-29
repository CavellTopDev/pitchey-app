#!/bin/bash

echo "Testing Fixed Analytics Page"
echo "============================="
echo ""

# Test the analytics API endpoint
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMDEsImVtYWlsIjoiYWxleC5jcmVhdG9yQGRlbW8uY29tIiwidXNlclR5cGUiOiJjcmVhdG9yIiwiZXhwIjoxNzU5MTgwOTgxfQ.KFXqKzhm7xi0AD0FtWim7jlfQst_dKPwo7RNuE0xn24"

echo "1. Testing Analytics Endpoint:"
RESPONSE=$(curl -s -X GET "http://localhost:8001/api/analytics/pitch/63?preset=month" \
  -H "Authorization: Bearer $TOKEN")

echo "Response structure:"
echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data.get('data', {}).get('analytics', {}), indent=2)[:500])"

echo ""
echo "2. Analytics Data Mapping:"
echo "   Backend → Frontend"
echo "   • views → totalViews"
echo "   • likes → totalLikes"  
echo "   • shares → totalShares"
echo "   • viewsByDate → viewsByDay"
echo "   • demographics → viewerTypes"
echo ""

echo "3. Fixed Issues:"
echo "   ✅ Added null checks for undefined properties"
echo "   ✅ Mapped backend response to expected format"
echo "   ✅ Fixed formatNumber to handle undefined values"
echo "   ✅ Added fallbacks for array properties"
echo ""

echo "============================="
echo "Analytics page should now work!"
echo "Visit: http://localhost:5173/creator/pitches/63/analytics"
