#!/bin/bash

# Automated Alerts Setup Script
# Sets up monitoring and alerting for production

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================"
echo "Setting Up Automated Monitoring & Alerts"
echo "================================================"
echo ""

# Create monitoring directory structure
echo -e "${BLUE}Creating monitoring structure...${NC}"
mkdir -p monitoring/{logs,alerts,reports}
touch monitoring/alerts/.gitkeep
touch monitoring/logs/.gitkeep
touch monitoring/reports/.gitkeep

# Create crontab entry file
cat > monitoring/crontab-entries.txt << 'EOF'
# Pitchey Production Monitoring Schedule
# Add these to your crontab with: crontab -e

# Health check every 5 minutes
*/5 * * * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/health-check.sh > /dev/null 2>&1

# Daily summary report at 9 AM
0 9 * * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/daily-summary.sh

# Weekly performance report on Mondays
0 10 * * 1 /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/weekly-report.sh

# Clean up old logs weekly (keep last 30 days)
0 2 * * 0 find /home/supremeisbeing/pitcheymovie/pitchey_v0.2/monitoring/logs -name "*.log" -mtime +30 -delete
EOF

echo -e "${GREEN}✓ Crontab entries created${NC}"

# Create daily summary script
cat > monitoring/daily-summary.sh << 'EOF'
#!/bin/bash

# Daily Summary Report
REPORT_FILE="monitoring/reports/daily-$(date +%Y%m%d).txt"
ALERT_FILE="monitoring/alerts.log"
LOG_FILE="monitoring/health-check.log"

echo "==================================" > "$REPORT_FILE"
echo "Daily Summary - $(date +%Y-%m-%d)" >> "$REPORT_FILE"
echo "==================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Count alerts
TOTAL_ALERTS=$(grep "$(date +%Y-%m-%d)" "$ALERT_FILE" 2>/dev/null | wc -l)
echo "Total Alerts Today: $TOTAL_ALERTS" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# List unique alerts
echo "Alert Types:" >> "$REPORT_FILE"
grep "$(date +%Y-%m-%d)" "$ALERT_FILE" 2>/dev/null | cut -d'-' -f5- | sort | uniq -c >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Health check statistics
TOTAL_CHECKS=$(grep "$(date +%Y-%m-%d)" "$LOG_FILE" 2>/dev/null | wc -l)
SUCCESSFUL_CHECKS=$(grep "$(date +%Y-%m-%d)" "$LOG_FILE" 2>/dev/null | grep -c "passed")
echo "Health Checks: $SUCCESSFUL_CHECKS/$TOTAL_CHECKS successful" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Average response times
echo "Average Response Times:" >> "$REPORT_FILE"
grep "Response times" "$LOG_FILE" 2>/dev/null | tail -20 | awk '{print $5, $7}' | \
    awk '{b+=$1; f+=$2; n++} END {if(n>0) printf "Backend: %.0fms, Frontend: %.0fms\n", b/n, f/n}' >> "$REPORT_FILE"

# Email notification (if configured)
if [ -n "$ALERT_EMAIL" ]; then
    mail -s "Pitchey Daily Report - $(date +%Y-%m-%d)" "$ALERT_EMAIL" < "$REPORT_FILE"
fi

echo "Daily report saved to: $REPORT_FILE"
EOF

chmod +x monitoring/daily-summary.sh
echo -e "${GREEN}✓ Daily summary script created${NC}"

# Create webhook alerter
cat > monitoring/webhook-alert.sh << 'EOF'
#!/bin/bash

# Webhook Alert Script
# Sends alerts to Discord/Slack webhooks

send_discord_alert() {
    local message=$1
    local webhook_url=$DISCORD_WEBHOOK_URL
    
    if [ -n "$webhook_url" ]; then
        curl -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{
                \"content\": \"🚨 **Pitchey Alert**\",
                \"embeds\": [{
                    \"title\": \"System Alert\",
                    \"description\": \"$message\",
                    \"color\": 15158332,
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
                }]
            }"
    fi
}

send_slack_alert() {
    local message=$1
    local webhook_url=$SLACK_WEBHOOK_URL
    
    if [ -n "$webhook_url" ]; then
        curl -X POST "$webhook_url" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"🚨 Pitchey Alert\",
                \"attachments\": [{
                    \"color\": \"danger\",
                    \"text\": \"$message\",
                    \"footer\": \"Pitchey Monitoring\",
                    \"ts\": $(date +%s)
                }]
            }"
    fi
}

# Read alert from stdin or argument
ALERT_MESSAGE="${1:-$(cat)}"

# Send to configured services
send_discord_alert "$ALERT_MESSAGE"
send_slack_alert "$ALERT_MESSAGE"

# Log the alert
echo "$(date '+%Y-%m-%d %H:%M:%S') - WEBHOOK: $ALERT_MESSAGE" >> monitoring/alerts.log
EOF

chmod +x monitoring/webhook-alert.sh
echo -e "${GREEN}✓ Webhook alerter created${NC}"

# Create environment template for alerts
cat > monitoring/.env.alerts.template << 'EOF'
# Alert Configuration
# Copy to .env.alerts and fill in your values

# Email notifications
ALERT_EMAIL=your-email@example.com

# Discord webhook (optional)
# Get from: Server Settings > Integrations > Webhooks
DISCORD_WEBHOOK_URL=

# Slack webhook (optional)
# Get from: https://api.slack.com/messaging/webhooks
SLACK_WEBHOOK_URL=

# PagerDuty integration key (optional)
PAGERDUTY_KEY=

# Alert thresholds
MAX_RESPONSE_TIME_MS=2000
MAX_ERROR_RATE_PERCENT=5
MIN_UPTIME_PERCENT=99
EOF

echo -e "${GREEN}✓ Alert environment template created${NC}"

# Create uptime monitor
cat > monitoring/uptime-monitor.sh << 'EOF'
#!/bin/bash

# Continuous uptime monitoring with immediate alerts
source monitoring/.env.alerts 2>/dev/null || true

BACKEND_URL="https://pitchey-backend-fresh.deno.dev"
FRONTEND_URL="https://pitchey-5o8.pages.dev"
CHECK_INTERVAL=60  # seconds
ALERT_COOLDOWN=3600  # 1 hour between same alerts

# Track last alert times
declare -A LAST_ALERT_TIME

check_and_alert() {
    local service=$1
    local url=$2
    local alert_key="${service}_down"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10)
    
    if [ "$response" != "200" ]; then
        current_time=$(date +%s)
        last_alert=${LAST_ALERT_TIME[$alert_key]:-0}
        time_since_alert=$((current_time - last_alert))
        
        if [ $time_since_alert -gt $ALERT_COOLDOWN ]; then
            echo "CRITICAL: $service is down! Status: $response" | ./monitoring/webhook-alert.sh
            LAST_ALERT_TIME[$alert_key]=$current_time
            echo "$(date '+%Y-%m-%d %H:%M:%S') - CRITICAL: $service down (Status: $response)" >> monitoring/alerts.log
        fi
        return 1
    fi
    return 0
}

echo "Starting continuous uptime monitoring..."
echo "Checking every $CHECK_INTERVAL seconds"
echo "Press Ctrl+C to stop"

while true; do
    check_and_alert "Backend" "$BACKEND_URL/api/health"
    check_and_alert "Frontend" "$FRONTEND_URL"
    sleep $CHECK_INTERVAL
done
EOF

chmod +x monitoring/uptime-monitor.sh
echo -e "${GREEN}✓ Uptime monitor created${NC}"

echo ""
echo -e "${YELLOW}Setup Instructions:${NC}"
echo ""
echo "1. Configure alerts (required for notifications):"
echo "   cp monitoring/.env.alerts.template monitoring/.env.alerts"
echo "   nano monitoring/.env.alerts"
echo ""
echo "2. Add cron jobs for automated monitoring:"
echo "   crontab -e"
echo "   # Then paste contents from monitoring/crontab-entries.txt"
echo ""
echo "3. Start continuous monitoring (optional):"
echo "   nohup ./monitoring/uptime-monitor.sh > monitoring/logs/uptime.log 2>&1 &"
echo ""
echo "4. Test health check:"
echo "   ./monitoring/health-check.sh"
echo ""
echo "5. View performance dashboard:"
echo "   open monitoring/performance-dashboard.html"
echo ""
echo -e "${GREEN}✅ Alert system setup complete!${NC}"
echo ""
echo "Monitor locations:"
echo "  • Logs: monitoring/logs/"
echo "  • Alerts: monitoring/alerts.log"
echo "  • Reports: monitoring/reports/"
echo "  • Dashboard: monitoring/performance-dashboard.html"
echo ""
echo "================================================"