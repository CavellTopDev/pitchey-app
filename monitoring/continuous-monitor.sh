#!/bin/bash

# Continuous Monitoring Script
# Runs health checks every 5 minutes and sends alerts if issues detected

# Configuration
INTERVAL=300  # 5 minutes in seconds
HEALTH_CHECK_SCRIPT="./monitoring/health-check.sh"
WEBHOOK_URL=""  # Add Discord/Slack webhook URL here if desired

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "Starting Continuous Monitoring"
echo "Interval: Every 5 minutes"
echo "Press Ctrl+C to stop"
echo "================================================"

# Counter for statistics
TOTAL_CHECKS=0
SUCCESSFUL_CHECKS=0
FAILED_CHECKS=0

# Function to display statistics
show_stats() {
    echo ""
    echo "================================================"
    echo "Monitoring Statistics"
    echo "================================================"
    echo "Total Checks: $TOTAL_CHECKS"
    echo -e "${GREEN}Successful: $SUCCESSFUL_CHECKS${NC}"
    echo -e "${RED}Failed: $FAILED_CHECKS${NC}"
    if [ $TOTAL_CHECKS -gt 0 ]; then
        UPTIME=$(echo "scale=2; $SUCCESSFUL_CHECKS * 100 / $TOTAL_CHECKS" | bc 2>/dev/null || echo "N/A")
        echo "Uptime: ${UPTIME}%"
    fi
    echo "================================================"
}

# Trap Ctrl+C to show stats before exiting
trap 'show_stats; exit 0' INT

# Main monitoring loop
while true; do
    echo ""
    echo -e "${YELLOW}Running health check #$((TOTAL_CHECKS + 1))...${NC}"
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "--------------------------------"
    
    # Run health check
    if $HEALTH_CHECK_SCRIPT > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        ((SUCCESSFUL_CHECKS++))
    else
        echo -e "${RED}❌ Health check failed - Issues detected${NC}"
        ((FAILED_CHECKS++))
        
        # Get last alert
        LAST_ALERT=$(tail -n 1 monitoring/alerts.log 2>/dev/null)
        echo "Last Alert: $LAST_ALERT"
        
        # Send webhook notification if configured
        if [ ! -z "$WEBHOOK_URL" ]; then
            curl -X POST "$WEBHOOK_URL" \
                -H "Content-Type: application/json" \
                -d "{\"content\":\"⚠️ **Pitchey Alert**\n$LAST_ALERT\"}" \
                2>/dev/null
        fi
    fi
    
    ((TOTAL_CHECKS++))
    
    # Show mini stats
    echo ""
    echo "Stats: $SUCCESSFUL_CHECKS/$TOTAL_CHECKS successful ($(echo "scale=1; $SUCCESSFUL_CHECKS * 100 / $TOTAL_CHECKS" | bc 2>/dev/null || echo "N/A")% uptime)"
    
    # Wait for next interval
    echo ""
    echo "Next check in 5 minutes..."
    echo "Press Ctrl+C to stop monitoring"
    
    sleep $INTERVAL
done