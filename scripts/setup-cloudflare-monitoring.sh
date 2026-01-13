#!/bin/bash

# Pitchey Platform Cloudflare Monitoring Setup Script
# Creates Cloudflare Health Checks for critical platform services
# 
# Usage:
#   1. Set CF_ACCOUNT_ID and CF_API_TOKEN environment variables
#   2. Run: chmod +x setup-cloudflare-monitoring.sh && ./setup-cloudflare-monitoring.sh
#
# Requirements:
#   - Cloudflare API Token with Zone:Read, Health Checks:Edit permissions
#   - Account ID from Cloudflare Dashboard > Right Sidebar

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check required environment variables
if [[ -z "$CF_ACCOUNT_ID" ]]; then
    echo -e "${RED}Error: CF_ACCOUNT_ID environment variable is required${NC}"
    echo "Get your Account ID from Cloudflare Dashboard > Right Sidebar"
    exit 1
fi

if [[ -z "$CF_API_TOKEN" ]]; then
    echo -e "${RED}Error: CF_API_TOKEN environment variable is required${NC}"
    echo "Create an API token with Zone:Read and Health Checks:Edit permissions"
    exit 1
fi

# Cloudflare API configuration
API_BASE="https://api.cloudflare.com/client/v4"
API_HEADERS="-H Authorization: Bearer $CF_API_TOKEN -H Content-Type: application/json"

echo -e "${BLUE}🔧 Setting up Pitchey Platform Cloudflare Monitoring...${NC}\n"

# Function to create health check
create_health_check() {
    local name="$1"
    local description="$2"
    local path="$3"
    local interval="$4"
    local timeout="$5"
    local expected_body="$6"
    
    echo -e "${YELLOW}Creating health check: $name${NC}"
    
    response=$(curl -s -X POST "$API_BASE/accounts/$CF_ACCOUNT_ID/health_checks" \
        $API_HEADERS \
        -d "{
            \"name\": \"$name\",
            \"description\": \"$description\",
            \"type\": \"HTTPS\",
            \"address\": \"pitchey-api-prod.ndlovucavelle.workers.dev\",
            \"path\": \"$path\",
            \"port\": 443,
            \"method\": \"GET\",
            \"timeout\": $timeout,
            \"retries\": 2,
            \"interval\": $interval,
            \"consecutive_successes\": 1,
            \"consecutive_fails\": 2,
            \"expected_codes\": \"200\",
            \"follow_redirects\": true,
            \"expected_body\": \"$expected_body\"
        }")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        health_check_id=$(echo "$response" | jq -r '.result.id')
        echo -e "${GREEN}✓ Health check created: $health_check_id${NC}"
        echo "$health_check_id"
    else
        echo -e "${RED}✗ Failed to create health check: $name${NC}"
        echo "$response" | jq '.errors' 2>/dev/null || echo "$response"
        return 1
    fi
}

# Create Health Checks

echo -e "${BLUE}1. Database Health Monitor${NC}"
DB_HEALTH_ID=$(create_health_check \
    "Pitchey Database Health" \
    "Monitor PostgreSQL connectivity and performance via Neon" \
    "/api/health/database" \
    60 \
    10 \
    "\"status\":\"healthy\"")

echo -e "\n${BLUE}2. Authentication Service Monitor${NC}"
AUTH_HEALTH_ID=$(create_health_check \
    "Pitchey Auth Service" \
    "Monitor Better Auth session validation and cookie handling" \
    "/api/auth/session" \
    300 \
    5 \
    "")

echo -e "\n${BLUE}3. Analytics Engine Monitor${NC}"
ANALYTICS_HEALTH_ID=$(create_health_check \
    "Pitchey Analytics Engine" \
    "Monitor Analytics Engine data collection and processing" \
    "/api/analytics/system/performance" \
    300 \
    10 \
    "")

echo -e "\n${BLUE}4. Core API Endpoints Monitor${NC}"
API_HEALTH_ID=$(create_health_check \
    "Pitchey Core API" \
    "Monitor core platform API functionality" \
    "/api/health" \
    60 \
    5 \
    "\"status\":\"ok\"")

echo -e "\n${BLUE}5. Real-time WebSocket Monitor${NC}"
WS_HEALTH_ID=$(create_health_check \
    "Pitchey WebSocket Service" \
    "Monitor WebSocket upgrade capability for real-time features" \
    "/api/ws/health" \
    300 \
    8 \
    "")

# Save health check IDs for alert setup
cat > monitoring/health-check-ids.env << EOF
# Cloudflare Health Check IDs for Pitchey Platform
# Generated on $(date)

DB_HEALTH_ID=$DB_HEALTH_ID
AUTH_HEALTH_ID=$AUTH_HEALTH_ID
ANALYTICS_HEALTH_ID=$ANALYTICS_HEALTH_ID
API_HEALTH_ID=$API_HEALTH_ID
WS_HEALTH_ID=$WS_HEALTH_ID

# Configuration
CF_ACCOUNT_ID=$CF_ACCOUNT_ID
CF_API_TOKEN=$CF_API_TOKEN
EOF

echo -e "\n${GREEN}🎉 Cloudflare Monitoring Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Health Check IDs saved to: ${BLUE}monitoring/health-check-ids.env${NC}"
echo -e ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Run ./scripts/setup-alerts.sh to configure alerting"
echo -e "2. Deploy synthetic monitoring Worker"
echo -e "3. Access dashboard at /api/monitoring/dashboard"
echo -e ""
echo -e "${YELLOW}Monitor URLs:${NC}"
echo -e "• Database Health: https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/database"
echo -e "• Auth Service: https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/session"
echo -e "• Analytics Engine: https://pitchey-api-prod.ndlovucavelle.workers.dev/api/analytics/system/performance"
echo -e "• Core API: https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health"
echo -e ""
echo -e "${BLUE}View in Cloudflare Dashboard:${NC}"
echo -e "https://dash.cloudflare.com/$CF_ACCOUNT_ID/health"