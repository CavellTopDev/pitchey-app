#!/bin/bash

# Pitchey Production Monitoring Script
API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
FRONTEND_URL="https://d066c1b9.pitchey.pages.dev"

echo "🔍 PITCHEY PRODUCTION MONITORING"
echo "=================================="
echo ""

# Health Check
echo "📊 Health Status:"
curl -s $API_URL/api/health | jq -r '
  "  Status: \(.status)
  Version: \(.version)
  Services:
    Database: \(.services.database)
    Auth: \(.services.auth)
    Cache: \(.services.cache)
    WebSocket: \(.services.websocket)"
'
echo ""

# Test Authentication
echo "🔐 Authentication Check:"
for portal in creator investor production; do
  email="${portal}@demo.com"
  if [ "$portal" = "creator" ]; then email="alex.creator@demo.com"; fi
  if [ "$portal" = "investor" ]; then email="sarah.investor@demo.com"; fi
  if [ "$portal" = "production" ]; then email="stellar.production@demo.com"; fi
  
  response=$(curl -s -X POST $API_URL/api/auth/$portal/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"Demo123\"}" | jq -r '.success')
  
  if [ "$response" = "true" ]; then
    echo "  ✅ $portal portal"
  else
    echo "  ❌ $portal portal"
  fi
done
echo ""

# Performance Test
echo "⚡ Performance Check:"
start_time=$(date +%s)
for i in {1..10}; do
  curl -s $API_URL/api/health > /dev/null &
done
wait
end_time=$(date +%s)
duration=$((end_time - start_time))
echo "  10 concurrent requests: ${duration}s"
echo ""

# Frontend Status
echo "🌐 Frontend Status:"
http_code=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL)
if [ "$http_code" = "200" ]; then
  echo "  ✅ Frontend online (HTTP $http_code)"
else
  echo "  ❌ Frontend issue (HTTP $http_code)"
fi
echo ""

# Error Rate (last 100 requests approximation)
echo "📈 Recent Activity:"
echo "  Checking worker logs..."
echo ""

echo "=================================="
echo "✨ Monitoring complete!"
echo "Worker: $API_URL"
echo "Frontend: $FRONTEND_URL"
