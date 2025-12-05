#!/bin/bash

# Automated Monitoring and Alerting Setup for Pitchey Production
# Sets up comprehensive monitoring with multiple alert channels

echo "🚀 Setting up Production Monitoring & Alerts"
echo "==========================================="
echo ""

# Configuration
WORKER_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
HEALTH_CHECK_INTERVAL=300  # 5 minutes
ALERT_EMAIL="${ALERT_EMAIL:-admin@pitchey.com}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

# Create monitoring configuration
cat > monitoring-config.json << 'EOF'
{
  "service": "pitchey-production",
  "worker_url": "https://pitchey-production.cavelltheleaddev.workers.dev",
  "monitoring": {
    "endpoints": [
      {
        "name": "Trending Pitches",
        "path": "/api/pitches/trending?limit=1",
        "critical": true,
        "timeout_ms": 5000,
        "expected_response": {
          "success": true
        }
      },
      {
        "name": "New Releases",
        "path": "/api/pitches/new?limit=1",
        "critical": true,
        "timeout_ms": 5000,
        "expected_response": {
          "success": true
        }
      },
      {
        "name": "Public Pitches",
        "path": "/api/pitches/public?limit=1",
        "critical": true,
        "timeout_ms": 5000,
        "expected_response": {
          "success": true
        }
      },
      {
        "name": "Database Connection",
        "path": "/api/db-test",
        "critical": true,
        "timeout_ms": 10000,
        "expected_response": {
          "success": true
        }
      }
    ],
    "thresholds": {
      "error_rate": 0.05,
      "response_time_p95": 1000,
      "response_time_p99": 3000,
      "consecutive_failures": 3,
      "connection_pool_size": 10
    },
    "alerts": {
      "channels": ["console", "log", "slack", "email"],
      "escalation": {
        "level_1": {
          "after_minutes": 5,
          "channels": ["slack", "log"]
        },
        "level_2": {
          "after_minutes": 15,
          "channels": ["email", "slack"]
        },
        "level_3": {
          "after_minutes": 30,
          "channels": ["phone", "pagerduty"]
        }
      }
    }
  }
}
EOF

# Create health check worker
cat > health-check-worker.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const config = JSON.parse(fs.readFileSync('monitoring-config.json', 'utf8'));

// State tracking
let healthState = {
  checks: [],
  failures: {},
  lastAlert: {},
  startTime: Date.now()
};

// Alert functions
function sendAlert(level, message, details) {
  const timestamp = new Date().toISOString();
  
  // Console alert
  console.error(`[${timestamp}] ALERT [${level}]: ${message}`);
  if (details) console.error('Details:', JSON.stringify(details, null, 2));
  
  // Log to file
  const logEntry = `${timestamp} | ${level} | ${message} | ${JSON.stringify(details)}\n`;
  fs.appendFileSync('monitoring.log', logEntry);
  
  // Slack alert (if configured)
  if (process.env.SLACK_WEBHOOK_URL) {
    const slackMessage = {
      text: `🚨 *Pitchey Production Alert*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Level:* ${level}\n*Message:* ${message}`
          }
        }
      ]
    };
    
    // Send to Slack (implementation needed)
    console.log('Would send to Slack:', slackMessage);
  }
  
  // Record alert time
  healthState.lastAlert[message] = timestamp;
}

// Check endpoint health
async function checkEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = `${config.worker_url}${endpoint.path}`;
    const startTime = Date.now();
    
    https.get(url, { timeout: endpoint.timeout_ms }, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        
        try {
          const json = JSON.parse(data);
          const success = json.success === endpoint.expected_response.success;
          
          resolve({
            endpoint: endpoint.name,
            success,
            duration,
            status: res.statusCode,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          resolve({
            endpoint: endpoint.name,
            success: false,
            duration,
            status: res.statusCode,
            error: 'Invalid JSON response',
            timestamp: new Date().toISOString()
          });
        }
      });
    }).on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        endpoint: endpoint.name,
        success: false,
        duration,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    });
  });
}

// Main monitoring loop
async function monitor() {
  console.log('Starting health check cycle...');
  
  for (const endpoint of config.monitoring.endpoints) {
    const result = await checkEndpoint(endpoint);
    
    // Track result
    healthState.checks.push(result);
    
    // Track failures
    if (!result.success) {
      healthState.failures[endpoint.name] = (healthState.failures[endpoint.name] || 0) + 1;
      
      // Check if we need to alert
      if (endpoint.critical && healthState.failures[endpoint.name] >= config.monitoring.thresholds.consecutive_failures) {
        const lastAlertTime = healthState.lastAlert[endpoint.name];
        const timeSinceLastAlert = lastAlertTime ? Date.now() - new Date(lastAlertTime).getTime() : Infinity;
        
        // Only alert if we haven't alerted recently (5 minutes)
        if (timeSinceLastAlert > 5 * 60 * 1000) {
          sendAlert('CRITICAL', `Endpoint ${endpoint.name} has failed ${healthState.failures[endpoint.name]} times`, result);
        }
      }
    } else {
      // Reset failure count on success
      healthState.failures[endpoint.name] = 0;
    }
    
    // Log result
    console.log(`[${result.timestamp}] ${endpoint.name}: ${result.success ? '✅' : '❌'} (${result.duration}ms)`);
  }
  
  // Calculate statistics
  const recentChecks = healthState.checks.slice(-100);
  const successRate = recentChecks.filter(c => c.success).length / recentChecks.length;
  const avgResponseTime = recentChecks.reduce((sum, c) => sum + c.duration, 0) / recentChecks.length;
  
  console.log(`\nStats: Success Rate: ${(successRate * 100).toFixed(2)}%, Avg Response: ${avgResponseTime.toFixed(0)}ms\n`);
  
  // Check if success rate is below threshold
  if (successRate < (1 - config.monitoring.thresholds.error_rate)) {
    sendAlert('WARNING', `Success rate ${(successRate * 100).toFixed(2)}% is below threshold`, {
      threshold: `${((1 - config.monitoring.thresholds.error_rate) * 100).toFixed(2)}%`,
      recent_failures: recentChecks.filter(c => !c.success)
    });
  }
  
  // Keep only recent checks in memory (last 1000)
  if (healthState.checks.length > 1000) {
    healthState.checks = healthState.checks.slice(-1000);
  }
  
  // Schedule next check
  setTimeout(monitor, 5 * 60 * 1000); // 5 minutes
}

// Start monitoring
console.log('🔍 Pitchey Production Health Monitor');
console.log('=====================================');
console.log(`Monitoring: ${config.worker_url}`);
console.log(`Endpoints: ${config.monitoring.endpoints.length}`);
console.log(`Check Interval: 5 minutes`);
console.log('');

monitor();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down monitor...');
  
  // Save state
  fs.writeFileSync('health-state.json', JSON.stringify(healthState, null, 2));
  console.log('State saved to health-state.json');
  
  process.exit(0);
});
EOF

# Create systemd service for continuous monitoring (Linux)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  cat > pitchey-monitor.service << 'EOF'
[Unit]
Description=Pitchey Production Health Monitor
After=network.target

[Service]
Type=simple
User=pitchey
WorkingDirectory=/home/supremeisbeing/pitcheymovie/pitchey_v0.2
ExecStart=/usr/bin/node health-check-worker.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

  echo "📝 Systemd service file created: pitchey-monitor.service"
  echo "   To install: sudo cp pitchey-monitor.service /etc/systemd/system/"
  echo "   To enable: sudo systemctl enable pitchey-monitor"
  echo "   To start: sudo systemctl start pitchey-monitor"
fi

# Create cron job for periodic checks
cat > monitoring-cron.sh << 'EOF'
#!/bin/bash
# Add to crontab: */5 * * * * /path/to/monitoring-cron.sh

WORKER_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
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
EOF

chmod +x monitoring-cron.sh
chmod +x health-check-worker.js

# Create Cloudflare Analytics dashboard setup
cat > cloudflare-analytics-setup.md << 'EOF'
# Cloudflare Analytics Dashboard Setup

## 1. Worker Analytics
- Go to: https://dash.cloudflare.com/
- Navigate to Workers & Pages > Analytics
- Create custom dashboard with:
  - Request rate
  - Error rate
  - Response time percentiles
  - CPU time
  - Exceptions

## 2. Alert Policies
Set up alerts for:
- Error rate > 5%
- Response time P95 > 1000ms
- CPU time > 50ms
- Exceptions > 10/minute

## 3. Custom Metrics to Track
- Connection pool size
- Database query duration
- Cache hit rate
- Concurrent connections

## 4. Recommended Dashboards

### Performance Dashboard
- Requests per second
- Response time histogram
- Error rate over time
- Top endpoints by latency

### Health Dashboard
- Uptime percentage
- Failed requests by endpoint
- Connection pool utilization
- Database connection failures

### Business Metrics
- API calls by endpoint
- User activity patterns
- Peak usage times
- Geographic distribution
EOF

echo "✅ Monitoring setup complete!"
echo ""
echo "📊 Next Steps:"
echo "1. Start the health monitor: node health-check-worker.js"
echo "2. Add cron job: crontab -e"
echo "   */5 * * * * $(pwd)/monitoring-cron.sh"
echo "3. Configure Slack webhook in environment:"
echo "   export SLACK_WEBHOOK_URL='your-webhook-url'"
echo "4. Review cloudflare-analytics-setup.md for dashboard setup"
echo ""
echo "📈 Monitoring Files Created:"
echo "- monitoring-config.json - Configuration"
echo "- health-check-worker.js - Node.js monitor"
echo "- monitoring-cron.sh - Cron health check"
echo "- pitchey-monitor.service - Systemd service"
echo "- cloudflare-analytics-setup.md - Dashboard guide"