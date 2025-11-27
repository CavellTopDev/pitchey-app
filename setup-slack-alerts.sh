#!/bin/bash

# Slack Webhook Configuration Script
# Sets up real-time alerting via Slack

echo "🔔 Slack Alerting Setup"
echo "======================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# Check if webhook URL is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}To set up Slack alerts, you need a webhook URL${NC}"
    echo ""
    echo "Steps to get a Slack webhook URL:"
    echo "1. Go to https://api.slack.com/apps"
    echo "2. Create a new app or select existing one"
    echo "3. Go to 'Incoming Webhooks' in the features"
    echo "4. Activate Incoming Webhooks"
    echo "5. Add New Webhook to Workspace"
    echo "6. Select the channel for alerts"
    echo "7. Copy the Webhook URL"
    echo ""
    echo "Usage: ./setup-slack-alerts.sh YOUR_WEBHOOK_URL"
    echo ""
    read -p "Enter your Slack webhook URL (or press Enter to skip): " WEBHOOK_URL
    
    if [ -z "$WEBHOOK_URL" ]; then
        echo "Skipping Slack setup..."
        exit 0
    fi
else
    WEBHOOK_URL=$1
fi

echo -e "${CYAN}Testing Slack webhook...${NC}"

# Test the webhook
TEST_RESPONSE=$(curl -s -X POST -H 'Content-type: application/json' \
    --data '{"text":"🎉 Pitchey monitoring alerts configured successfully!"}' \
    "$WEBHOOK_URL")

if [ "$TEST_RESPONSE" = "ok" ]; then
    echo -e "${GREEN}✅ Webhook test successful!${NC}"
else
    echo -e "${RED}❌ Webhook test failed. Please check your URL.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Configuring alert types...${NC}"

# Create Slack alert configuration
cat << EOF > slack-alerts-config.json
{
  "webhook_url": "$WEBHOOK_URL",
  "enabled": true,
  "alert_types": {
    "critical": {
      "enabled": true,
      "emoji": "🚨",
      "color": "danger",
      "mention": "<!channel>",
      "conditions": [
        "database_connection_failed",
        "error_rate_above_5_percent",
        "response_time_p95_above_3s",
        "cache_hit_rate_below_50_percent"
      ]
    },
    "warning": {
      "enabled": true,
      "emoji": "⚠️",
      "color": "warning",
      "mention": "",
      "conditions": [
        "error_rate_above_1_percent",
        "response_time_p95_above_2s",
        "cache_hit_rate_below_70_percent",
        "connection_pool_above_80_percent"
      ]
    },
    "info": {
      "enabled": true,
      "emoji": "ℹ️",
      "color": "good",
      "mention": "",
      "conditions": [
        "deployment_started",
        "deployment_completed",
        "cache_warming_completed",
        "daily_metrics_summary"
      ]
    },
    "recovery": {
      "enabled": true,
      "emoji": "✅",
      "color": "good",
      "mention": "",
      "conditions": [
        "service_recovered",
        "performance_normalized",
        "error_rate_normalized"
      ]
    }
  },
  "rate_limiting": {
    "max_alerts_per_hour": 20,
    "cooldown_minutes": 5,
    "aggregate_similar": true
  },
  "channels": {
    "default": "#alerts",
    "critical": "#incidents",
    "performance": "#performance",
    "deployments": "#deployments"
  },
  "templates": {
    "database_error": {
      "title": "Database Connection Error",
      "text": "Unable to connect to database",
      "fields": [
        {"title": "Environment", "value": "production", "short": true},
        {"title": "Time", "value": "{{timestamp}}", "short": true},
        {"title": "Error", "value": "{{error_message}}", "short": false}
      ]
    },
    "high_error_rate": {
      "title": "High Error Rate Detected",
      "text": "Error rate has exceeded threshold",
      "fields": [
        {"title": "Current Rate", "value": "{{error_rate}}%", "short": true},
        {"title": "Threshold", "value": "{{threshold}}%", "short": true},
        {"title": "Endpoint", "value": "{{endpoint}}", "short": false}
      ]
    },
    "slow_response": {
      "title": "Slow Response Time",
      "text": "Response time exceeding SLA",
      "fields": [
        {"title": "P95 Time", "value": "{{p95_time}}ms", "short": true},
        {"title": "Threshold", "value": "{{threshold}}ms", "short": true},
        {"title": "Endpoint", "value": "{{endpoint}}", "short": false}
      ]
    }
  }
}
EOF

echo -e "${GREEN}✅ Created slack-alerts-config.json${NC}"

# Create Slack alert sender script
cat << 'EOF' > send-slack-alert.js
#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

// Load configuration
const config = JSON.parse(fs.readFileSync('slack-alerts-config.json', 'utf8'));

class SlackAlerter {
  constructor(config) {
    this.config = config;
    this.recentAlerts = new Map();
  }

  async sendAlert(type, title, message, fields = [], channel = null) {
    if (!this.config.enabled) {
      console.log('Slack alerts disabled');
      return;
    }

    // Check rate limiting
    if (!this.checkRateLimit(title)) {
      console.log('Rate limit exceeded, alert suppressed');
      return;
    }

    const alertConfig = this.config.alert_types[type] || this.config.alert_types.info;
    
    const payload = {
      channel: channel || this.config.channels.default,
      username: 'Pitchey Monitor',
      icon_emoji: alertConfig.emoji,
      attachments: [{
        color: alertConfig.color,
        title: title,
        text: message,
        fields: fields,
        footer: 'Pitchey Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    // Add mention if configured
    if (alertConfig.mention) {
      payload.text = alertConfig.mention;
    }

    return this.send(payload);
  }

  async sendMetricsSummary(metrics) {
    const fields = [
      {
        title: 'Uptime',
        value: `${metrics.uptime}%`,
        short: true
      },
      {
        title: 'Avg Response Time',
        value: `${metrics.avgResponseTime}ms`,
        short: true
      },
      {
        title: 'Error Rate',
        value: `${metrics.errorRate}%`,
        short: true
      },
      {
        title: 'Cache Hit Rate',
        value: `${metrics.cacheHitRate}%`,
        short: true
      },
      {
        title: 'Total Requests',
        value: metrics.totalRequests.toLocaleString(),
        short: true
      },
      {
        title: 'Active Users',
        value: metrics.activeUsers.toLocaleString(),
        short: true
      }
    ];

    return this.sendAlert(
      'info',
      '📊 Daily Metrics Summary',
      `Performance metrics for ${new Date().toLocaleDateString()}`,
      fields,
      this.config.channels.performance
    );
  }

  checkRateLimit(alertKey) {
    const now = Date.now();
    const recentCount = Array.from(this.recentAlerts.values())
      .filter(time => now - time < 3600000).length; // Last hour

    if (recentCount >= this.config.rate_limiting.max_alerts_per_hour) {
      return false;
    }

    const lastAlert = this.recentAlerts.get(alertKey);
    const cooldown = this.config.rate_limiting.cooldown_minutes * 60000;

    if (lastAlert && now - lastAlert < cooldown) {
      return false;
    }

    this.recentAlerts.set(alertKey, now);
    return true;
  }

  send(payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const url = new URL(this.config.webhook_url);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(body);
          } else {
            reject(new Error(`Slack API error: ${res.statusCode} - ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}

// Command line usage
if (require.main === module) {
  const alerter = new SlackAlerter(config);
  
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'test':
      alerter.sendAlert(
        'info',
        '🧪 Test Alert',
        'This is a test alert from Pitchey monitoring',
        [
          { title: 'Status', value: 'Working', short: true },
          { title: 'Time', value: new Date().toISOString(), short: true }
        ]
      ).then(() => console.log('Test alert sent'))
        .catch(err => console.error('Failed to send alert:', err));
      break;

    case 'critical':
      alerter.sendAlert(
        'critical',
        args[1] || 'Critical Alert',
        args[2] || 'A critical issue has been detected',
        []
      ).then(() => console.log('Critical alert sent'))
        .catch(err => console.error('Failed to send alert:', err));
      break;

    case 'metrics':
      alerter.sendMetricsSummary({
        uptime: 99.95,
        avgResponseTime: 245,
        errorRate: 0.12,
        cacheHitRate: 87.5,
        totalRequests: 1245000,
        activeUsers: 3421
      }).then(() => console.log('Metrics summary sent'))
        .catch(err => console.error('Failed to send metrics:', err));
      break;

    default:
      console.log('Usage: node send-slack-alert.js [test|critical|metrics] [title] [message]');
  }
}

module.exports = { SlackAlerter };
EOF

chmod +x send-slack-alert.js

echo -e "${GREEN}✅ Created send-slack-alert.js${NC}"

# Store webhook URL securely in Cloudflare
echo ""
echo -e "${YELLOW}Storing webhook URL in Cloudflare Workers...${NC}"

# Set the secret using wrangler
wrangler secret put SLACK_WEBHOOK_URL <<< "$WEBHOOK_URL" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Webhook URL stored securely${NC}"
else
    echo -e "${YELLOW}⚠️  Please run manually: wrangler secret put SLACK_WEBHOOK_URL${NC}"
fi

# Test the alert system
echo ""
echo -e "${CYAN}Testing alert system...${NC}"

node send-slack-alert.js test

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Alert system working!${NC}"
else
    echo -e "${RED}❌ Alert test failed${NC}"
fi

# Create integration script for monitoring
cat << 'EOF' > integrate-slack-monitoring.sh
#!/bin/bash

# Integrate Slack alerts with existing monitoring

# Update health check worker to send Slack alerts
sed -i '/sendAlert(/i \
    // Send Slack alert\
    if (process.env.SLACK_WEBHOOK_URL) {\
      const { SlackAlerter } = require("./send-slack-alert.js");\
      const alerter = new SlackAlerter(require("./slack-alerts-config.json"));\
      await alerter.sendAlert(level, message, details.message || message, [\
        { title: "Environment", value: "production", short: true },\
        { title: "Time", value: new Date().toISOString(), short: true }\
      ]);\
    }' health-check-worker.js

echo "✅ Slack alerts integrated with health monitoring"
EOF

chmod +x integrate-slack-monitoring.sh

echo ""
echo -e "${GREEN}✅ Slack alerting setup complete!${NC}"
echo ""
echo "📋 Configuration Summary:"
echo "  - Webhook URL: Configured and tested"
echo "  - Alert types: Critical, Warning, Info, Recovery"
echo "  - Rate limiting: Max 20 alerts/hour, 5 min cooldown"
echo "  - Config file: slack-alerts-config.json"
echo "  - Alert sender: send-slack-alert.js"
echo ""
echo "🚀 Next Steps:"
echo "  1. Run ./integrate-slack-monitoring.sh to integrate with existing monitoring"
echo "  2. Test different alert types:"
echo "     - node send-slack-alert.js test"
echo "     - node send-slack-alert.js critical 'Test Critical' 'Testing critical alerts'"
echo "     - node send-slack-alert.js metrics"
echo "  3. Customize alert templates in slack-alerts-config.json"
echo "  4. Set up channel-specific routing if needed"
echo ""
echo "📊 Alert Channels:"
echo "  - #alerts - Default channel for all alerts"
echo "  - #incidents - Critical alerts only"
echo "  - #performance - Performance metrics"
echo "  - #deployments - Deployment notifications"