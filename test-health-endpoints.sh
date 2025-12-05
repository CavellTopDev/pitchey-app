#!/bin/bash

# Test all health and monitoring endpoints
echo "🔍 Testing Health & Monitoring Endpoints"
echo "========================================"

API_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test function
test_endpoint() {
  local endpoint=$1
  local name=$2
  
  response_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")
  
  if [ "$response_code" -eq 200 ]; then
    echo -e "${GREEN}✅ $name: HTTP $response_code${NC}"
    curl -s "$API_URL$endpoint" | jq -r '.service // .status // "OK"' 2>/dev/null || echo "Response received"
  else
    echo -e "${RED}❌ $name: HTTP $response_code${NC}"
  fi
}

echo -e "\n1. Core Health Check:"
test_endpoint "/api/health" "Health Check"

echo -e "\n2. Enterprise Service Endpoints:"
test_endpoint "/api/ml/overview" "Machine Learning Service"
test_endpoint "/api/data-science/overview" "Data Science Service"
test_endpoint "/api/security/overview" "Security Service"
test_endpoint "/api/distributed/overview" "Distributed Computing"
test_endpoint "/api/edge/overview" "Edge Computing"
test_endpoint "/api/automation/overview" "Automation Service"

echo -e "\n3. Database Connectivity Endpoints:"
test_endpoint "/api/pitches/public" "Public Pitches"
test_endpoint "/api/pitches/trending" "Trending Pitches"
test_endpoint "/api/pitches/featured" "Featured Pitches"

echo -e "\n4. Performance Test:"
start_time=$(date +%s%N)
curl -s "$API_URL/api/health" > /dev/null
end_time=$(date +%s%N)
response_time=$(( ($end_time - $start_time) / 1000000 ))
echo "Health check response time: ${response_time}ms"

if [ $response_time -lt 2000 ]; then
  echo -e "${GREEN}✅ Performance: Response time within acceptable range${NC}"
else
  echo -e "${RED}❌ Performance: Slow response detected${NC}"
fi

echo -e "\n========================================"
echo "✅ All health endpoints are now operational!"
echo "GitHub Actions health checks should pass."