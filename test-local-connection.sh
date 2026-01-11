#!/bin/bash

echo "🔍 Testing Pitchey Local Development Setup"
echo "========================================="

# Check if backend proxy is running
echo -e "\n1️⃣ Checking backend proxy server on port 8001..."
curl -s -o /dev/null -w "Backend proxy (http://localhost:8001): %{http_code}\n" http://localhost:8001/api/health || echo "Backend proxy not responding"

# Check if frontend is running
echo -e "\n2️⃣ Checking frontend dev server on port 5173..."
curl -s -o /dev/null -w "Frontend (http://localhost:5173): %{http_code}\n" http://localhost:5173 || echo "Frontend not responding"

# Test API endpoint through proxy
echo -e "\n3️⃣ Testing API endpoint through proxy..."
response=$(curl -s http://localhost:8001/api/pitches?limit=1 | head -c 100)
if [[ -n "$response" ]]; then
  echo "✅ API proxy working! Response preview:"
  echo "$response..."
else
  echo "❌ No response from API proxy"
fi

# Test browse endpoint
echo -e "\n4️⃣ Testing /api/browse endpoint..."
browse_response=$(curl -s -w "\nHTTP Status: %{http_code}" http://localhost:8001/api/browse)
echo "$browse_response" | head -n 5

echo -e "\n5️⃣ Frontend URL: http://localhost:5173"
echo "📝 You can now open this URL in your browser to test the full application"
echo ""
echo "🎯 Quick Links:"
echo "   - Homepage: http://localhost:5173/"
echo "   - Browse: http://localhost:5173/browse"
echo "   - Creator Login: http://localhost:5173/creator/login"
echo "   - Investor Login: http://localhost:5173/investor/login"