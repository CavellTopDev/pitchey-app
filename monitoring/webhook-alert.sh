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
