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
