#!/bin/bash

# Verify Analytics Engine Integration Deployment
# Tests all new analytics endpoints to ensure proper deployment

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "🧪 Testing Analytics Engine Integration Deployment"
echo "API Base URL: $API_URL"
echo

# Array of analytics endpoints to test
ENDPOINTS=(
  "/api/analytics/database/performance"
  "/api/analytics/database/queries" 
  "/api/analytics/database/health"
  "/api/analytics/database/slow-queries"
  "/api/analytics/database/errors"
  "/api/analytics/performance/endpoints"
  "/api/analytics/performance/overview"
  "/api/traces/search"
  "/api/traces/metrics/overview"
  "/api/traces/metrics/performance"
  "/api/traces/metrics/errors"
)

SUCCESS_COUNT=0
TOTAL_ENDPOINTS=${#ENDPOINTS[@]}

echo "Testing $TOTAL_ENDPOINTS Analytics Engine endpoints..."
echo

for endpoint in "${ENDPOINTS[@]}"; do
  echo "🔍 Testing: $endpoint"
  
  # Make request and capture response
  response=$(curl -s -w "%{http_code}" "$API_URL$endpoint")
  http_code=${response: -3}
  response_body=${response%???}
  
  if [ "$http_code" = "200" ]; then
    echo "   ✅ Status: $http_code"
    
    # Check if response contains expected structure
    if echo "$response_body" | jq -e '.success' > /dev/null 2>&1; then
      echo "   ✅ Structure: Valid JSON with success field"
      ((SUCCESS_COUNT++))
    else
      echo "   ⚠️  Structure: Missing success field"
    fi
    
    # Check for data field
    if echo "$response_body" | jq -e '.data' > /dev/null 2>&1; then
      echo "   ✅ Data: Present"
    else
      echo "   ⚠️  Data: Missing data field"
    fi
    
  else
    echo "   ❌ Status: $http_code"
    echo "   Response: $response_body"
  fi
  
  echo
done

echo "📊 DEPLOYMENT VERIFICATION RESULTS"
echo "=================================="
echo "✅ Successful endpoints: $SUCCESS_COUNT/$TOTAL_ENDPOINTS"
echo "📈 Success rate: $(( SUCCESS_COUNT * 100 / TOTAL_ENDPOINTS ))%"

if [ "$SUCCESS_COUNT" = "$TOTAL_ENDPOINTS" ]; then
  echo
  echo "🎉 DEPLOYMENT SUCCESSFUL!"
  echo "All Analytics Engine endpoints are responding correctly."
  echo
  echo "Next steps:"
  echo "1. Check Cloudflare Analytics Engine dashboard"
  echo "2. Verify data point ingestion"  
  echo "3. Set up monitoring alerts"
  echo "4. Configure custom analytics queries"
else
  echo
  echo "⚠️  PARTIAL DEPLOYMENT"
  echo "Some endpoints may need investigation."
  echo "Check Worker logs in Cloudflare Dashboard."
fi

echo
echo "🔗 Useful links:"
echo "   Analytics Dashboard: https://dash.cloudflare.com > Analytics > Analytics Engine"
echo "   Worker Logs: https://dash.cloudflare.com > Workers > pitchey-api-prod > Logs"
echo "   GraphQL API: https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql"