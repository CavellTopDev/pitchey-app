#!/bin/bash

# Generate performance report
WORKER_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
REPORT_FILE="monitoring/dashboards/reports/performance-$(date +%Y%m%d-%H%M%S).txt"

echo "PITCHEY PERFORMANCE REPORT" > "$REPORT_FILE"
echo "=========================" >> "$REPORT_FILE"
echo "Generated: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "ENDPOINT PERFORMANCE:" >> "$REPORT_FILE"
echo "--------------------" >> "$REPORT_FILE"

ENDPOINTS=(
    "/api/health"
    "/api/pitches/browse/enhanced"
    "/api/pitches/featured"
    "/api/auth/status"
)

for endpoint in "${ENDPOINTS[@]}"; do
    RESPONSE=$(curl -s -w ":%{http_code}:%{time_total}" -o /dev/null "$WORKER_URL$endpoint")
    CODE=$(echo $RESPONSE | cut -d':' -f2)
    TIME=$(echo $RESPONSE | cut -d':' -f3)
    
    echo "$endpoint: Status=$CODE, Time=${TIME}s" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "RECOMMENDATIONS:" >> "$REPORT_FILE"
echo "---------------" >> "$REPORT_FILE"

# Add recommendations based on performance
AVG_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$WORKER_URL/api/health")
if (( $(echo "$AVG_TIME > 0.2" | bc -l) )); then
    echo "• Consider implementing additional caching" >> "$REPORT_FILE"
    echo "• Check database query performance" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE"
cat "$REPORT_FILE"
