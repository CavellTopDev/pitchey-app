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
