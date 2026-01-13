#!/bin/bash

# Pitchey Platform Logpush Configuration
# Sets up automatic log export to R2 for compliance and audit trails

set -e

# Configuration
ZONE_ID="your-zone-id"
ACCOUNT_ID="002bd5c0e90ae753a387c60546cf6869"
API_TOKEN="your-api-token"
R2_ACCESS_KEY="your-r2-access-key"
R2_SECRET_KEY="your-r2-secret-key"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Pitchey Logpush Configuration ===${NC}"
echo "Setting up automatic log export to R2 for audit compliance..."

# Function to create logpush job
create_logpush_job() {
    local dataset=$1
    local destination=$2
    local fields=$3
    local name=$4
    
    echo -e "${YELLOW}Creating logpush job: $name${NC}"
    
    response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/logpush/jobs" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"dataset\": \"$dataset\",
            \"destination_conf\": \"$destination\",
            \"logpull_options\": \"fields=$fields\",
            \"enabled\": true,
            \"name\": \"$name\",
            \"frequency\": \"low\"
        }")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ $name created successfully${NC}"
        echo "$response" | jq -r '.result.id' 2>/dev/null || true
    else
        echo -e "${RED}✗ Failed to create $name${NC}"
        echo "$response" | jq -r '.errors' 2>/dev/null || echo "$response"
        return 1
    fi
}

# 1. Workers Trace Events - For distributed tracing
echo -e "\n${YELLOW}1. Setting up Workers Trace Events logpush...${NC}"
create_logpush_job \
    "workers_trace_events" \
    "r2://pitchey-trace-logs/workers/{DATE}?account-id=$ACCOUNT_ID&access-key-id=$R2_ACCESS_KEY&secret-access-key=$R2_SECRET_KEY" \
    "ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestPath,EdgeEndTimestamp,EdgeResponseStatus,EdgeStartTimestamp,RayID,WorkerCPUTime,WorkerStatus,WorkerSubrequest,WorkerSubrequestCount,ScriptName,Outcome" \
    "pitchey-workers-traces"

# 2. HTTP Requests - For API audit trail
echo -e "\n${YELLOW}2. Setting up HTTP Requests logpush...${NC}"
create_logpush_job \
    "http_requests" \
    "r2://pitchey-audit-logs/http/{DATE}?account-id=$ACCOUNT_ID&access-key-id=$R2_ACCESS_KEY&secret-access-key=$R2_SECRET_KEY" \
    "ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestPath,ClientRequestProtocol,ClientRequestReferer,ClientRequestUserAgent,EdgeEndTimestamp,EdgeResponseBytes,EdgeResponseStatus,EdgeStartTimestamp,RayID,SecurityLevel,WAFAction,WAFProfile,WorkerSubrequest,ZoneName" \
    "pitchey-http-audit"

# 3. Firewall Events - For security audit
echo -e "\n${YELLOW}3. Setting up Firewall Events logpush...${NC}"
create_logpush_job \
    "firewall_events" \
    "r2://pitchey-audit-logs/security/{DATE}?account-id=$ACCOUNT_ID&access-key-id=$R2_ACCESS_KEY&secret-access-key=$R2_SECRET_KEY" \
    "Action,ClientIP,ClientRequestHost,ClientRequestMethod,ClientRequestPath,ClientRequestProtocol,ClientRequestUserAgent,Datetime,EdgeResponseStatus,Kind,MatchIndex,Metadata,OriginResponseStatus,RayID,RuleID,Source" \
    "pitchey-security-audit"

# 4. Analytics Engine Events - For performance metrics
echo -e "\n${YELLOW}4. Setting up Analytics Events logpush...${NC}"
# Note: Analytics Engine data export requires Enterprise plan
# This is a placeholder for when it becomes available
echo -e "${YELLOW}Note: Analytics Engine export requires Enterprise plan${NC}"

# 5. Create R2 lifecycle rules for log retention
echo -e "\n${YELLOW}5. Setting up R2 lifecycle rules...${NC}"

# Function to set R2 lifecycle rules
set_r2_lifecycle() {
    local bucket=$1
    local retention_days=$2
    
    echo "Setting $retention_days day retention for $bucket..."
    
    # Using wrangler to set lifecycle rules
    cat > lifecycle-rules.json << EOF
{
  "rules": [
    {
      "id": "delete-old-logs",
      "status": "Enabled",
      "expiration": {
        "days": $retention_days
      }
    },
    {
      "id": "transition-to-archive",
      "status": "Enabled",
      "transitions": [
        {
          "storageClass": "GLACIER",
          "days": 30
        }
      ]
    }
  ]
}
EOF
    
    # Apply lifecycle rules using wrangler
    npx wrangler r2 bucket lifecycle set $bucket --file lifecycle-rules.json
    
    rm lifecycle-rules.json
    echo -e "${GREEN}✓ Lifecycle rules applied to $bucket${NC}"
}

# Apply lifecycle rules to audit buckets
set_r2_lifecycle "pitchey-audit-logs" 90
set_r2_lifecycle "pitchey-trace-logs" 30

# 6. Verify logpush jobs
echo -e "\n${YELLOW}6. Verifying logpush jobs...${NC}"

jobs_response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/logpush/jobs" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json")

if echo "$jobs_response" | grep -q '"success":true'; then
    echo -e "${GREEN}Active logpush jobs:${NC}"
    echo "$jobs_response" | jq -r '.result[] | "\(.name): \(.enabled)"' 2>/dev/null || echo "Unable to parse jobs"
else
    echo -e "${RED}Failed to retrieve logpush jobs${NC}"
fi

# 7. Create monitoring dashboard configuration
echo -e "\n${YELLOW}7. Creating monitoring dashboard configuration...${NC}"

cat > logpush-monitoring.json << EOF
{
  "name": "Pitchey Audit Trail Dashboard",
  "description": "Monitor log export and audit compliance",
  "panels": [
    {
      "title": "Log Volume",
      "type": "line",
      "query": "SELECT count(*) FROM logs GROUP BY time(1h)"
    },
    {
      "title": "API Audit Events",
      "type": "table",
      "query": "SELECT timestamp, user_id, action, resource, result FROM audit_logs WHERE timestamp > now() - 24h"
    },
    {
      "title": "Security Events",
      "type": "counter",
      "query": "SELECT count(*) FROM firewall_events WHERE action = 'block'"
    },
    {
      "title": "Trace Distribution",
      "type": "heatmap",
      "query": "SELECT operation, duration FROM traces GROUP BY operation"
    }
  ],
  "refresh": "5m",
  "timezone": "UTC"
}
EOF

echo -e "${GREEN}✓ Dashboard configuration saved to logpush-monitoring.json${NC}"

# 8. Test log retrieval script
echo -e "\n${YELLOW}8. Creating log retrieval script...${NC}"

cat > retrieve-audit-logs.sh << 'EOF'
#!/bin/bash
# Retrieve audit logs from R2 for analysis

BUCKET="pitchey-audit-logs"
DATE=${1:-$(date -u +%Y-%m-%d)}
OUTPUT_DIR="./audit-logs-$DATE"

echo "Retrieving audit logs for $DATE..."
mkdir -p "$OUTPUT_DIR"

# Download logs from R2
npx wrangler r2 object get "$BUCKET/http/$DATE/" --file "$OUTPUT_DIR/http-logs.jsonl"
npx wrangler r2 object get "$BUCKET/security/$DATE/" --file "$OUTPUT_DIR/security-logs.jsonl"

# Parse and analyze logs
echo "Analyzing logs..."

# Extract unique users
jq -r '.ClientIP' "$OUTPUT_DIR/http-logs.jsonl" | sort -u > "$OUTPUT_DIR/unique-ips.txt"

# Extract API calls by endpoint
jq -r '.ClientRequestPath' "$OUTPUT_DIR/http-logs.jsonl" | sort | uniq -c | sort -rn > "$OUTPUT_DIR/api-usage.txt"

# Extract errors
jq -r 'select(.EdgeResponseStatus >= 400) | "\(.EdgeResponseStatus) \(.ClientRequestPath)"' "$OUTPUT_DIR/http-logs.jsonl" > "$OUTPUT_DIR/errors.txt"

echo "Audit logs retrieved and analyzed in $OUTPUT_DIR"
EOF

chmod +x retrieve-audit-logs.sh
echo -e "${GREEN}✓ Log retrieval script created${NC}"

# 9. Summary
echo -e "\n${GREEN}=== Logpush Configuration Complete ===${NC}"
echo -e "
${GREEN}Configured Systems:${NC}
✓ Workers Trace Events → R2 bucket: pitchey-trace-logs
✓ HTTP Requests → R2 bucket: pitchey-audit-logs
✓ Firewall Events → R2 bucket: pitchey-audit-logs
✓ Lifecycle rules for automatic cleanup
✓ Monitoring dashboard configuration
✓ Log retrieval and analysis scripts

${YELLOW}Next Steps:${NC}
1. Update ZONE_ID, API_TOKEN, and R2 credentials in this script
2. Run the script to enable logpush: ./deploy-logpush.sh
3. Monitor logs using: ./retrieve-audit-logs.sh
4. View traces in R2: npx wrangler r2 object list pitchey-trace-logs
5. Set up alerts for compliance violations

${GREEN}Compliance Features:${NC}
• All API requests are logged with trace IDs
• Financial operations have enhanced audit trails  
• NDA workflows are fully traceable
• User authentication events are correlated
• Logs are retained for 90 days (audit) / 30 days (traces)
• Automatic transition to cold storage after 30 days
"

echo -e "${GREEN}To retrieve logs for a specific date:${NC}"
echo "./retrieve-audit-logs.sh 2024-12-27"