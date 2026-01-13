#!/bin/bash

# Pitchey Platform Alert Rules Setup Script
# Creates Cloudflare notification policies for critical platform alerts
#
# Usage:
#   1. Ensure monitoring/health-check-ids.env exists (from setup-cloudflare-monitoring.sh)
#   2. Set additional environment variables for notification channels
#   3. Run: chmod +x setup-alerts.sh && ./setup-alerts.sh
#
# Requirements:
#   - Health check IDs from Cloudflare monitoring setup
#   - Cloudflare API Token with Account:Edit permissions

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load health check IDs if available
if [[ -f "monitoring/health-check-ids.env" ]]; then
    source monitoring/health-check-ids.env
    echo -e "${GREEN}✓ Loaded health check IDs from monitoring/health-check-ids.env${NC}"
else
    echo -e "${RED}Error: monitoring/health-check-ids.env not found${NC}"
    echo "Please run setup-cloudflare-monitoring.sh first to create health checks"
    exit 1
fi

# Cloudflare API configuration
API_BASE="https://api.cloudflare.com/client/v4"
API_HEADERS="-H Authorization: Bearer $CF_API_TOKEN -H Content-Type: application/json"

echo -e "${BLUE}🚨 Setting up Pitchey Platform Alert Rules...${NC}\n"

# Function to create notification policy
create_alert_policy() {
    local name="$1"
    local description="$2"
    local alert_type="$3"
    local filters="$4"
    local mechanisms="$5"
    
    echo -e "${YELLOW}Creating alert policy: $name${NC}"
    
    response=$(curl -s -X POST "$API_BASE/accounts/$CF_ACCOUNT_ID/alerting/policies" \
        $API_HEADERS \
        -d "{
            \"name\": \"$name\",
            \"description\": \"$description\",
            \"enabled\": true,
            \"alert_type\": \"$alert_type\",
            \"mechanisms\": $mechanisms,
            \"filters\": $filters
        }")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        policy_id=$(echo "$response" | jq -r '.result.id')
        echo -e "${GREEN}✓ Alert policy created: $policy_id${NC}"
        echo "$policy_id"
    else
        echo -e "${RED}✗ Failed to create alert policy: $name${NC}"
        echo "$response" | jq '.errors' 2>/dev/null || echo "$response"
        return 1
    fi
}

# Configure notification mechanisms
echo -e "${BLUE}Configuring notification channels...${NC}"

# Email notifications
EMAIL_MECHANISMS='{"email": ["ops@pitchey.app", "devops@pitchey.app"]}'

# Webhook notifications (Slack, Discord, etc.)
if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    WEBHOOK_MECHANISMS="{\"webhooks\": [\"$SLACK_WEBHOOK_URL\"]}"
else
    WEBHOOK_MECHANISMS='{"webhooks": []}'
fi

# PagerDuty integration
if [[ -n "${PAGERDUTY_KEY:-}" ]]; then
    PAGERDUTY_MECHANISMS="{\"pagerduty\": [\"$PAGERDUTY_KEY\"]}"
else
    PAGERDUTY_MECHANISMS='{"pagerduty": []}'
fi

# Combined mechanisms for critical alerts
CRITICAL_MECHANISMS=$(echo "{}" | jq ". + $EMAIL_MECHANISMS + $WEBHOOK_MECHANISMS + $PAGERDUTY_MECHANISMS")
WARNING_MECHANISMS=$(echo "{}" | jq ". + $WEBHOOK_MECHANISMS")

# Create Alert Policies

echo -e "\n${BLUE}1. Database Health Alert${NC}"
DB_ALERT_ID=$(create_alert_policy \
    "Pitchey Database Health Critical" \
    "Alert when database health check fails - indicates PostgreSQL connectivity issues" \
    "health_check_status_notification" \
    "{\"health_check_id\": [\"$DB_HEALTH_ID\"], \"status\": [\"unhealthy\"]}" \
    "$CRITICAL_MECHANISMS")

echo -e "\n${BLUE}2. Authentication Service Alert${NC}"
AUTH_ALERT_ID=$(create_alert_policy \
    "Pitchey Auth Service Failure" \
    "Alert when Better Auth session validation fails" \
    "health_check_status_notification" \
    "{\"health_check_id\": [\"$AUTH_HEALTH_ID\"], \"status\": [\"unhealthy\"]}" \
    "$CRITICAL_MECHANISMS")

echo -e "\n${BLUE}3. Analytics Engine Alert${NC}"
ANALYTICS_ALERT_ID=$(create_alert_policy \
    "Pitchey Analytics Engine Warning" \
    "Alert when Analytics Engine data collection encounters issues" \
    "health_check_status_notification" \
    "{\"health_check_id\": [\"$ANALYTICS_HEALTH_ID\"], \"status\": [\"unhealthy\", \"degraded\"]}" \
    "$WARNING_MECHANISMS")

echo -e "\n${BLUE}4. Core API Alert${NC}"
API_ALERT_ID=$(create_alert_policy \
    "Pitchey Core API Critical" \
    "Alert when core platform API becomes unavailable" \
    "health_check_status_notification" \
    "{\"health_check_id\": [\"$API_HEALTH_ID\"], \"status\": [\"unhealthy\"]}" \
    "$CRITICAL_MECHANISMS")

echo -e "\n${BLUE}5. WebSocket Service Alert${NC}"
WS_ALERT_ID=$(create_alert_policy \
    "Pitchey WebSocket Service Warning" \
    "Alert when real-time WebSocket service has issues" \
    "health_check_status_notification" \
    "{\"health_check_id\": [\"$WS_HEALTH_ID\"], \"status\": [\"unhealthy\"]}" \
    "$WARNING_MECHANISMS")

echo -e "\n${BLUE}6. Worker Error Rate Alert${NC}"
ERROR_RATE_ALERT_ID=$(create_alert_policy \
    "Pitchey Worker High Error Rate" \
    "Alert when Worker error rate exceeds 5% over 5 minutes" \
    "worker_alert" \
    "{\"error_rate\": 0.05, \"sample_interval\": 300}" \
    "$CRITICAL_MECHANISMS")

echo -e "\n${BLUE}7. Worker Performance Alert${NC}"
PERFORMANCE_ALERT_ID=$(create_alert_policy \
    "Pitchey Worker High Latency" \
    "Alert when Worker response time P95 exceeds 2000ms" \
    "worker_alert" \
    "{\"latency_p95\": 2000, \"sample_interval\": 300}" \
    "$WARNING_MECHANISMS")

# Save alert policy IDs
cat >> monitoring/health-check-ids.env << EOF

# Alert Policy IDs
DB_ALERT_ID=$DB_ALERT_ID
AUTH_ALERT_ID=$AUTH_ALERT_ID
ANALYTICS_ALERT_ID=$ANALYTICS_ALERT_ID
API_ALERT_ID=$API_ALERT_ID
WS_ALERT_ID=$WS_ALERT_ID
ERROR_RATE_ALERT_ID=$ERROR_RATE_ALERT_ID
PERFORMANCE_ALERT_ID=$PERFORMANCE_ALERT_ID
EOF

# Create alert runbooks directory
mkdir -p monitoring/runbooks

# Create runbook for database issues
cat > monitoring/runbooks/database-health-failure.md << 'EOF'
# Database Health Failure Runbook

## Alert: Pitchey Database Health Critical

### Immediate Actions
1. Check database connectivity: `curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/database`
2. Verify Neon PostgreSQL status: https://status.neon.tech/
3. Check Worker logs in Cloudflare Dashboard
4. Test direct database connection from local environment

### Investigation Steps
1. **Check Database Metrics**
   - Connection pool status
   - Query latency and errors
   - Resource utilization (CPU, memory, connections)

2. **Verify Network Connectivity**
   - DNS resolution for Neon endpoint
   - SSL certificate validity
   - Firewall/security group rules

3. **Review Recent Changes**
   - Recent deployments
   - Configuration changes
   - Database schema migrations

### Escalation
- **Priority**: Critical
- **Response Time**: 5 minutes
- **Escalate To**: Database team, Platform team
- **Contact**: ops@pitchey.app, db-admin@pitchey.app

### Resolution Steps
1. **Temporary Fix**: Switch to read-only mode if possible
2. **Permanent Fix**: Address root cause (connection limits, query optimization, etc.)
3. **Verification**: Monitor database health endpoint for 10 minutes
4. **Documentation**: Update incident log with cause and resolution

### Prevention
- Monitor connection pool utilization
- Set up query performance alerts
- Regular database maintenance windows
- Automated failover testing
EOF

# Create runbook for authentication failures
cat > monitoring/runbooks/auth-service-failure.md << 'EOF'
# Authentication Service Failure Runbook

## Alert: Pitchey Auth Service Failure

### Immediate Actions
1. Check auth endpoint: `curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/auth/session`
2. Verify Better Auth configuration in Worker environment
3. Check for recent Better Auth library updates
4. Test with known good session cookie

### Investigation Steps
1. **Check Auth Service Status**
   - Better Auth library initialization
   - Database connection for session storage
   - Cookie configuration and domain settings

2. **Verify Session Management**
   - Session storage (database/Redis)
   - Cookie security settings
   - Cross-origin request handling

3. **Review Authentication Flow**
   - Login endpoint functionality
   - Session creation and validation
   - Token refresh mechanism

### Escalation
- **Priority**: Critical (affects all user access)
- **Response Time**: 2 minutes
- **Escalate To**: Security team, Backend team
- **Contact**: security@pitchey.app, backend-team@pitchey.app

### Resolution Steps
1. **Immediate**: Check for environment variable issues
2. **Short-term**: Restart Worker if configuration issue
3. **Long-term**: Fix root cause in auth configuration
4. **Verification**: Test login flow with demo accounts

### Prevention
- Monitor session creation/validation rates
- Regular testing of authentication flows
- Automated session storage health checks
- Better Auth configuration validation
EOF

echo -e "\n${GREEN}🎉 Alert Rules Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Alert Policy IDs saved to: ${BLUE}monitoring/health-check-ids.env${NC}"
echo -e "Runbooks created in: ${BLUE}monitoring/runbooks/${NC}"
echo -e ""
echo -e "${YELLOW}Configured Alerts:${NC}"
echo -e "• Database Health (Critical) → Email + Slack + PagerDuty"
echo -e "• Authentication Service (Critical) → Email + Slack + PagerDuty"
echo -e "• Analytics Engine (Warning) → Slack"
echo -e "• Core API (Critical) → Email + Slack + PagerDuty"
echo -e "• WebSocket Service (Warning) → Slack"
echo -e "• Worker Error Rate >5% (Critical) → Email + Slack + PagerDuty"
echo -e "• Worker Latency >2s (Warning) → Slack"
echo -e ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Test alerts by temporarily breaking a service"
echo -e "2. Configure notification channels (Slack, PagerDuty)"
echo -e "3. Review and customize alert thresholds"
echo -e "4. Set up escalation policies for business hours"
echo -e ""
echo -e "${BLUE}View Alerts in Cloudflare Dashboard:${NC}"
echo -e "https://dash.cloudflare.com/$CF_ACCOUNT_ID/notifications"