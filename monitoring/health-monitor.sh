#!/bin/bash

# Pitchey Health Check Monitor
# Continuously monitors production health endpoints

PRODUCTION_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
LOG_FILE="./monitoring/logs/health-monitor.log"
ALERT_THRESHOLD=3  # Failed checks before alert

# Create log directory
mkdir -p ./monitoring/logs

# Function to check endpoint health
check_health() {
    local endpoint=$1
    local expected_status=$2
    
    response=$(curl -s -w "%{http_code},%{time_total}" "$PRODUCTION_URL$endpoint" 2>/dev/null || echo "ERROR,999")
    status_code=$(echo "$response" | cut -d',' -f1)
    response_time=$(echo "$response" | cut -d',' -f2)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo "$(date): ✅ $endpoint - OK (${response_time}s)" >> "$LOG_FILE"
        return 0
    else
        echo "$(date): ❌ $endpoint - FAILED (Status: $status_code)" >> "$LOG_FILE"
        return 1
    fi
}

# Function to send alert
send_alert() {
    local message=$1
    echo "$(date): 🚨 ALERT: $message" >> "$LOG_FILE"
    # In production, this would send to Slack/email/PagerDuty
    echo "ALERT: $message"
}

# Main monitoring loop
echo "$(date): 🚀 Starting Pitchey health monitoring..." >> "$LOG_FILE"

failed_checks=0

while true; do
    # Check health endpoint
    if check_health "/api/health" "200"; then
        failed_checks=0
    else
        ((failed_checks++))
        
        if [ $failed_checks -ge $ALERT_THRESHOLD ]; then
            send_alert "Health endpoint failed $failed_checks consecutive times"
            failed_checks=0
        fi
    fi
    
    # Check authentication endpoint
    check_health "/api/auth/creator/login" "400"  # Expected without credentials
    
    # Wait 30 seconds before next check
    sleep 30
done
