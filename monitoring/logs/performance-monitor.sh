#!/bin/bash
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Measure response time
    START=$(date +%s%N)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/pitches?limit=1")
    END=$(date +%s%N)
    RESPONSE_TIME=$(( (END - START) / 1000000 ))
    
    echo "[$TIMESTAMP] Response Time: ${RESPONSE_TIME}ms (HTTP $HTTP_CODE)"
    
    # Alert if response time > 1000ms
    if [ $RESPONSE_TIME -gt 1000 ]; then
        echo "[$TIMESTAMP] ⚠️  SLOW RESPONSE: ${RESPONSE_TIME}ms"
    fi
    
    # Sleep for 5 minutes
    sleep 300
done
