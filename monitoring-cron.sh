#!/bin/bash
# Add to crontab: */5 * * * * /path/to/monitoring-cron.sh

WORKER_URL="https://pitchey-optimized.cavelltheleaddev.workers.dev"
LOG_FILE="/var/log/pitchey-monitor.log"

# Simple health check
check_health() {
    response=$(curl -s -w "\n%{http_code}" "$WORKER_URL/api/db-test")
    http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" != "200" ]]; then
        echo "[$(date)] ALERT: Health check failed with HTTP $http_code" >> "$LOG_FILE"
        # Send alert via your preferred method
        return 1
    fi
    
    if echo "$response" | grep -q '"success":false'; then
        echo "[$(date)] ALERT: API returned success:false" >> "$LOG_FILE"
        return 1
    fi
    
    echo "[$(date)] Health check passed" >> "$LOG_FILE"
    return 0
}

check_health
