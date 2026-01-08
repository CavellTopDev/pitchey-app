#!/bin/bash

# Cloudflare Worker Log Analysis Tool
# Analyzes logs from pitchey-api-prod.ndlovucavelle.workers.dev

echo "🔍 Cloudflare Worker Log Analysis Tool"
echo "======================================"
echo "Analyzing: pitchey-api-prod.ndlovucavelle.workers.dev"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check if wrangler is logged in
if ! wrangler whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ Not logged in to Cloudflare${NC}"
    echo "Please run: wrangler login"
    exit 1
fi

# Function to fetch worker logs
fetch_worker_logs() {
    echo -e "${CYAN}📊 Fetching Worker Logs...${NC}"
    
    # Tail logs in real-time (last 100 entries)
    echo -e "\n${YELLOW}Real-time logs (last 100 entries):${NC}"
    wrangler tail pitchey-api-prod --format json | head -100 > worker-logs-raw.json
    
    # Process and analyze logs
    if [ -f worker-logs-raw.json ]; then
        echo -e "${GREEN}✅ Logs fetched successfully${NC}"
        
        # Parse and analyze
        echo -e "\n${BLUE}📈 Log Analysis:${NC}"
        
        # Count total requests
        TOTAL_REQUESTS=$(grep -c '"method"' worker-logs-raw.json 2>/dev/null || echo "0")
        echo "Total Requests: $TOTAL_REQUESTS"
        
        # Extract error patterns
        echo -e "\n${RED}❌ Errors Found:${NC}"
        grep -i "error\|exception\|failed" worker-logs-raw.json | head -20
        
        # Extract status codes
        echo -e "\n${YELLOW}📊 Status Code Distribution:${NC}"
        grep -o '"status":[0-9]*' worker-logs-raw.json | cut -d: -f2 | sort | uniq -c | sort -rn
        
        # Extract endpoints accessed
        echo -e "\n${MAGENTA}🔗 Top Endpoints:${NC}"
        grep -o '"pathname":"[^"]*"' worker-logs-raw.json | cut -d'"' -f4 | sort | uniq -c | sort -rn | head -20
        
        # Extract methods used
        echo -e "\n${CYAN}📝 HTTP Methods:${NC}"
        grep -o '"method":"[^"]*"' worker-logs-raw.json | cut -d'"' -f4 | sort | uniq -c | sort -rn
        
        # Save processed logs
        echo -e "\n${GREEN}💾 Saving processed logs...${NC}"
        mv worker-logs-raw.json worker-logs-$(date +%Y%m%d-%H%M%S).json
    else
        echo -e "${RED}❌ Failed to fetch logs${NC}"
    fi
}

# Function to analyze using Cloudflare Analytics API
fetch_analytics() {
    echo -e "\n${CYAN}📊 Fetching Cloudflare Analytics...${NC}"
    
    # Get account and zone info
    ACCOUNT_ID=$(wrangler whoami --json 2>/dev/null | jq -r '.account.id' || echo "")
    
    if [ -z "$ACCOUNT_ID" ]; then
        echo -e "${YELLOW}⚠️  Could not determine account ID${NC}"
        return
    fi
    
    echo "Account ID: $ACCOUNT_ID"
    
    # Fetch worker analytics (if available)
    echo -e "\n${BLUE}Worker Analytics:${NC}"
    
    # Get worker script analytics
    curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/analytics/stored" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" | jq '.' > worker-analytics.json
    
    if [ -s worker-analytics.json ]; then
        echo -e "${GREEN}✅ Analytics fetched${NC}"
        
        # Parse analytics
        echo -e "\n${YELLOW}Key Metrics:${NC}"
        jq '.result.data[0] | {requests: .requests, errors: .errors, subrequests: .subrequests}' worker-analytics.json 2>/dev/null || echo "No analytics data available"
    fi
}

# Function to set up real-time monitoring
setup_monitoring() {
    echo -e "\n${CYAN}🔄 Setting up Real-time Monitoring...${NC}"
    
    cat > monitor-worker.sh << 'EOF'
#!/bin/bash
# Real-time Worker Monitor

echo "Starting real-time monitoring of pitchey-api-prod..."
echo "Press Ctrl+C to stop"
echo ""

# Create log file
LOG_FILE="worker-monitor-$(date +%Y%m%d-%H%M%S).log"

# Monitor in real-time
wrangler tail pitchey-api-prod --format json | while read -r line; do
    echo "$line" >> "$LOG_FILE"
    
    # Parse and display key info
    if echo "$line" | grep -q '"status":5[0-9][0-9]'; then
        echo -e "\033[0;31m[ERROR]\033[0m $line"
    elif echo "$line" | grep -q '"status":4[0-9][0-9]'; then
        echo -e "\033[1;33m[CLIENT_ERROR]\033[0m $line"
    elif echo "$line" | grep -q '"status":2[0-9][0-9]'; then
        echo -e "\033[0;32m[SUCCESS]\033[0m $(echo "$line" | jq -r '.method + " " + .pathname + " " + .status' 2>/dev/null)"
    fi
done
EOF
    
    chmod +x monitor-worker.sh
    echo -e "${GREEN}✅ Monitor script created: ./monitor-worker.sh${NC}"
}

# Function to analyze error patterns
analyze_errors() {
    echo -e "\n${RED}🔍 Analyzing Error Patterns...${NC}"
    
    # Common error patterns to look for
    ERROR_PATTERNS=(
        "TypeError"
        "ReferenceError"
        "SyntaxError"
        "RangeError"
        "undefined"
        "null"
        "failed"
        "error"
        "exception"
        "timeout"
        "CORS"
        "unauthorized"
        "forbidden"
        "not found"
    )
    
    for pattern in "${ERROR_PATTERNS[@]}"; do
        COUNT=$(grep -i "$pattern" worker-logs-*.json 2>/dev/null | wc -l)
        if [ $COUNT -gt 0 ]; then
            echo -e "${YELLOW}$pattern${NC}: $COUNT occurrences"
        fi
    done
}

# Function to generate report
generate_report() {
    echo -e "\n${CYAN}📄 Generating Report...${NC}"
    
    REPORT_FILE="worker-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$REPORT_FILE" << EOF
# Cloudflare Worker Log Analysis Report
**Worker**: pitchey-api-prod.ndlovucavelle.workers.dev
**Date**: $(date)

## Summary
- Total Requests Analyzed: $TOTAL_REQUESTS
- Time Period: Last 100 requests

## Error Analysis
$(analyze_errors)

## Recommendations
1. Monitor 5xx errors closely - these indicate server-side issues
2. Review 4xx errors for potential client-side problems
3. Check for any CORS-related errors
4. Monitor response times for performance issues

## Next Steps
- Set up Sentry integration for better error tracking
- Implement custom logging for critical paths
- Add performance monitoring metrics
- Set up alerts for error thresholds

EOF
    
    echo -e "${GREEN}✅ Report saved to: $REPORT_FILE${NC}"
}

# Main execution
echo -e "${YELLOW}Select operation:${NC}"
echo "1. Fetch and analyze recent logs"
echo "2. Set up real-time monitoring"
echo "3. Fetch analytics data"
echo "4. Generate full report"
echo "5. All of the above"

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        fetch_worker_logs
        analyze_errors
        ;;
    2)
        setup_monitoring
        ;;
    3)
        fetch_analytics
        ;;
    4)
        fetch_worker_logs
        analyze_errors
        generate_report
        ;;
    5)
        fetch_worker_logs
        analyze_errors
        fetch_analytics
        setup_monitoring
        generate_report
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}✅ Analysis complete!${NC}"
echo -e "${CYAN}📁 Log files saved in current directory${NC}"