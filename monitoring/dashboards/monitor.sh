#!/bin/bash

# Continuous monitoring script
WORKER_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
LOG_FILE="monitoring/dashboards/logs/performance.log"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s -w ":%{http_code}:%{time_total}" -o /dev/null "$WORKER_URL/api/health")
    HEALTH_CODE=$(echo $HEALTH_RESPONSE | cut -d':' -f2)
    HEALTH_TIME=$(echo $HEALTH_RESPONSE | cut -d':' -f3)
    
    # Log results
    echo "$TIMESTAMP | Health: $HEALTH_CODE | Response: ${HEALTH_TIME}s" >> "$LOG_FILE"
    
    # Alert if slow or failed
    if [[ "$HEALTH_CODE" != "200" ]]; then
        echo "⚠️  ALERT: Health check failed at $TIMESTAMP (Status: $HEALTH_CODE)"
    elif (( $(echo "$HEALTH_TIME > 0.5" | bc -l) )); then
        echo "⚠️  ALERT: Slow response at $TIMESTAMP (${HEALTH_TIME}s)"
    fi
    
    sleep 60
done
