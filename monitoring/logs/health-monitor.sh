#!/bin/bash
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Check API health
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health")
    
    if [ "$API_STATUS" = "200" ]; then
        echo "[$TIMESTAMP] ✅ API Health: OK ($API_STATUS)"
    else
        echo "[$TIMESTAMP] ❌ API Health: FAILED ($API_STATUS)"
        # Send alert (implement your alert mechanism here)
        # curl -X POST $ALERT_WEBHOOK -d "API Health Check Failed: $API_STATUS"
    fi
    
    # Sleep for 1 minute
    sleep 60
done
