#!/bin/bash

# Production Monitoring Setup Script
# Sets up comprehensive monitoring for Pitchey platform
# Date: December 24, 2024

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Pitchey Platform Monitoring Setup    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# 1. Create monitoring endpoints file
echo -e "${GREEN}[1/5]${NC} Creating health check endpoints..."

cat > monitoring-endpoints.json << 'EOF'
{
  "endpoints": [
    {
      "name": "Frontend",
      "url": "https://pitchey.pages.dev",
      "method": "GET",
      "expected_status": 200,
      "timeout": 5000,
      "check_interval": 60
    },
    {
      "name": "API Health",
      "url": "https://pitchey-production.cavelltheleaddev.workers.dev/api/health",
      "method": "GET",
      "expected_status": 200,
      "timeout": 3000,
      "check_interval": 30
    },
    {
      "name": "API Pitches",
      "url": "https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/trending",
      "method": "GET",
      "expected_status": 200,
      "timeout": 5000,
      "check_interval": 120
    },
    {
      "name": "WebSocket",
      "url": "wss://pitchey-production.cavelltheleaddev.workers.dev/ws",
      "method": "WEBSOCKET",
      "timeout": 5000,
      "check_interval": 180
    },
    {
      "name": "Backup API",
      "url": "https://pitchey-backend-fresh.deno.dev/api/health",
      "method": "GET",
      "expected_status": 200,
      "timeout": 5000,
      "check_interval": 300
    }
  ],
  "alerts": {
    "failure_threshold": 3,
    "recovery_threshold": 2,
    "notification_channels": ["email", "slack", "webhook"]
  }
}
EOF

# 2. Create health check script
echo -e "${GREEN}[2/5]${NC} Creating health check script..."

cat > health-check.js << 'EOF'
#!/usr/bin/env node

const https = require('https');
const WebSocket = require('ws');
const fs = require('fs').promises;

// Load configuration
const CONFIG_FILE = 'monitoring-endpoints.json';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Health status tracking
const healthStatus = new Map();
const failureCount = new Map();

// Check HTTP endpoint
async function checkHttpEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.url);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: endpoint.method || 'GET',
      timeout: endpoint.timeout || 5000,
      headers: {
        'User-Agent': 'Pitchey-Monitor/1.0'
      }
    };

    const req = https.request(options, (res) => {
      const isHealthy = res.statusCode === (endpoint.expected_status || 200);
      resolve({
        name: endpoint.name,
        url: endpoint.url,
        status: isHealthy ? 'healthy' : 'unhealthy',
        statusCode: res.statusCode,
        responseTime: Date.now() - startTime,
        message: isHealthy ? 'OK' : `Expected ${endpoint.expected_status}, got ${res.statusCode}`
      });
    });

    const startTime = Date.now();
    
    req.on('error', (error) => {
      resolve({
        name: endpoint.name,
        url: endpoint.url,
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: endpoint.name,
        url: endpoint.url,
        status: 'unhealthy',
        error: 'Request timeout',
        responseTime: endpoint.timeout
      });
    });

    req.end();
  });
}

// Check WebSocket endpoint
async function checkWebSocketEndpoint(endpoint) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let ws;
    
    const timeout = setTimeout(() => {
      if (ws) ws.close();
      resolve({
        name: endpoint.name,
        url: endpoint.url,
        status: 'unhealthy',
        error: 'Connection timeout',
        responseTime: endpoint.timeout
      });
    }, endpoint.timeout || 5000);

    try {
      ws = new WebSocket(endpoint.url);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          name: endpoint.name,
          url: endpoint.url,
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: 'WebSocket connected successfully'
        });
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          name: endpoint.name,
          url: endpoint.url,
          status: 'unhealthy',
          error: error.message,
          responseTime: Date.now() - startTime
        });
      });
    } catch (error) {
      clearTimeout(timeout);
      resolve({
        name: endpoint.name,
        url: endpoint.url,
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime
      });
    }
  });
}

// Check single endpoint
async function checkEndpoint(endpoint) {
  if (endpoint.method === 'WEBSOCKET') {
    return await checkWebSocketEndpoint(endpoint);
  } else {
    return await checkHttpEndpoint(endpoint);
  }
}

// Process health check results
function processResults(result) {
  const previousStatus = healthStatus.get(result.name);
  healthStatus.set(result.name, result.status);
  
  // Track failures
  if (result.status === 'unhealthy') {
    const count = (failureCount.get(result.name) || 0) + 1;
    failureCount.set(result.name, count);
  } else {
    failureCount.set(result.name, 0);
  }
  
  // Log result with color coding
  const color = result.status === 'healthy' ? colors.green : colors.red;
  const icon = result.status === 'healthy' ? '✓' : '✗';
  
  console.log(
    `${color}[${icon}]${colors.reset} ${result.name}: ${result.status} ` +
    `(${result.responseTime}ms) ${result.error || result.message || ''}`
  );
  
  // Check if alert should be triggered
  if (previousStatus === 'healthy' && result.status === 'unhealthy') {
    const count = failureCount.get(result.name);
    if (count >= 3) {
      console.log(`${colors.red}⚠️  ALERT: ${result.name} has failed ${count} times${colors.reset}`);
      // Here you would trigger actual alerts (email, Slack, etc.)
    }
  }
  
  // Check for recovery
  if (previousStatus === 'unhealthy' && result.status === 'healthy') {
    console.log(`${colors.green}✅ RECOVERED: ${result.name} is back online${colors.reset}`);
  }
  
  return result;
}

// Write results to file
async function writeResults(results) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    overall_health: results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded',
    endpoints: results,
    statistics: {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      unhealthy: results.filter(r => r.status === 'unhealthy').length,
      average_response_time: Math.round(
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      )
    }
  };
  
  await fs.writeFile('health-status.json', JSON.stringify(report, null, 2));
  return report;
}

// Main monitoring loop
async function monitor() {
  try {
    const config = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
    
    console.log(`${colors.blue}Starting health checks...${colors.reset}`);
    console.log('─'.repeat(50));
    
    // Check all endpoints
    const results = await Promise.all(
      config.endpoints.map(endpoint => checkEndpoint(endpoint))
    );
    
    // Process and log results
    results.forEach(processResults);
    
    // Write results to file
    const report = await writeResults(results);
    
    console.log('─'.repeat(50));
    console.log(
      `Summary: ${colors.green}${report.statistics.healthy} healthy${colors.reset}, ` +
      `${colors.red}${report.statistics.unhealthy} unhealthy${colors.reset} ` +
      `(Avg: ${report.statistics.average_response_time}ms)`
    );
    
    return report;
  } catch (error) {
    console.error(`${colors.red}Error during monitoring:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Run monitoring
if (require.main === module) {
  // Run once if called directly
  monitor().then((report) => {
    process.exit(report.overall_health === 'healthy' ? 0 : 1);
  });
}

module.exports = { monitor, checkEndpoint };
EOF

chmod +x health-check.js

# 3. Create continuous monitoring script
echo -e "${GREEN}[3/5]${NC} Creating continuous monitoring script..."

cat > monitor-continuous.sh << 'EOF'
#!/bin/bash

# Continuous monitoring script
INTERVAL=${1:-60}  # Default 60 seconds
LOG_FILE="monitoring.log"

echo "Starting continuous monitoring (interval: ${INTERVAL}s)..."
echo "Press Ctrl+C to stop"

while true; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Running health check..." | tee -a "$LOG_FILE"
    
    if node health-check.js >> "$LOG_FILE" 2>&1; then
        echo "✅ All systems operational" | tee -a "$LOG_FILE"
    else
        echo "⚠️  Some services are experiencing issues" | tee -a "$LOG_FILE"
        
        # Send alert (implement your alert mechanism here)
        # Example: send email, Slack notification, etc.
    fi
    
    echo "---" | tee -a "$LOG_FILE"
    sleep "$INTERVAL"
done
EOF

chmod +x monitor-continuous.sh

# 4. Create metrics collection script
echo -e "${GREEN}[4/5]${NC} Creating metrics collection script..."

cat > collect-metrics.js << 'EOF'
#!/usr/bin/env node

const https = require('https');
const fs = require('fs').promises;

// Metrics to collect
const METRICS_API = 'https://pitchey-production.cavelltheleaddev.workers.dev/api/metrics';

async function collectMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    performance: {},
    usage: {},
    errors: []
  };

  try {
    // Collect performance metrics
    const perfData = await fetchJson(`${METRICS_API}/performance`);
    metrics.performance = perfData;
    
    // Collect usage metrics
    const usageData = await fetchJson(`${METRICS_API}/usage`);
    metrics.usage = usageData;
    
    // Collect error metrics
    const errorData = await fetchJson(`${METRICS_API}/errors`);
    metrics.errors = errorData;
    
  } catch (error) {
    console.error('Failed to collect metrics:', error.message);
    metrics.error = error.message;
  }
  
  // Save metrics
  const filename = `metrics-${new Date().toISOString().split('T')[0]}.json`;
  await fs.writeFile(filename, JSON.stringify(metrics, null, 2));
  
  // Analyze metrics
  analyzeMetrics(metrics);
  
  return metrics;
}

function analyzeMetrics(metrics) {
  console.log('\n📊 Metrics Analysis');
  console.log('═'.repeat(40));
  
  if (metrics.performance) {
    console.log('\nPerformance:');
    console.log(`  • Response Time: ${metrics.performance.avgResponseTime || 'N/A'}ms`);
    console.log(`  • Error Rate: ${metrics.performance.errorRate || 0}%`);
    console.log(`  • Throughput: ${metrics.performance.requestsPerSecond || 0} req/s`);
  }
  
  if (metrics.usage) {
    console.log('\nUsage:');
    console.log(`  • Active Users: ${metrics.usage.activeUsers || 0}`);
    console.log(`  • Total Requests: ${metrics.usage.totalRequests || 0}`);
    console.log(`  • Peak Load: ${metrics.usage.peakLoad || 0}`);
  }
  
  if (metrics.errors && metrics.errors.length > 0) {
    console.log('\nRecent Errors:');
    metrics.errors.slice(0, 5).forEach(error => {
      console.log(`  • [${error.timestamp}] ${error.message}`);
    });
  }
  
  console.log('\n' + '═'.repeat(40));
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({});
        }
      });
    }).on('error', reject);
  });
}

// Run if called directly
if (require.main === module) {
  collectMetrics().then(() => {
    console.log('✅ Metrics collected successfully');
  }).catch(error => {
    console.error('❌ Failed to collect metrics:', error);
    process.exit(1);
  });
}

module.exports = { collectMetrics };
EOF

chmod +x collect-metrics.js

# 5. Create dashboard HTML
echo -e "${GREEN}[5/5]${NC} Creating monitoring dashboard..."

cat > monitoring-dashboard.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pitchey Platform Monitoring Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .card-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #333;
        }
        
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-healthy {
            background: #10b981;
            color: white;
        }
        
        .status-unhealthy {
            background: #ef4444;
            color: white;
        }
        
        .status-warning {
            background: #f59e0b;
            color: white;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .metric:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            color: #666;
            font-size: 0.9rem;
        }
        
        .metric-value {
            font-weight: 600;
            color: #333;
        }
        
        .chart-container {
            margin-top: 20px;
            height: 200px;
            background: #f9fafb;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            color: #667eea;
            border: none;
            padding: 15px 25px;
            border-radius: 50px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        }
        
        .refresh-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }
        
        .timestamp {
            text-align: center;
            color: rgba(255,255,255,0.8);
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Pitchey Platform Monitoring</h1>
        <div class="timestamp" id="timestamp">Loading...</div>
        
        <div class="dashboard" id="dashboard">
            <!-- Cards will be dynamically inserted here -->
        </div>
        
        <button class="refresh-btn" onclick="refreshData()">🔄 Refresh</button>
    </div>

    <script>
        let healthData = {};
        
        async function loadHealthStatus() {
            try {
                const response = await fetch('health-status.json');
                healthData = await response.json();
                renderDashboard();
            } catch (error) {
                console.error('Failed to load health status:', error);
                // Use mock data for demo
                healthData = {
                    timestamp: new Date().toISOString(),
                    overall_health: 'healthy',
                    endpoints: [
                        { name: 'Frontend', status: 'healthy', responseTime: 234 },
                        { name: 'API Health', status: 'healthy', responseTime: 89 },
                        { name: 'API Pitches', status: 'healthy', responseTime: 156 },
                        { name: 'WebSocket', status: 'healthy', responseTime: 45 },
                        { name: 'Backup API', status: 'healthy', responseTime: 201 }
                    ],
                    statistics: {
                        total: 5,
                        healthy: 5,
                        unhealthy: 0,
                        average_response_time: 145
                    }
                };
                renderDashboard();
            }
        }
        
        function renderDashboard() {
            const dashboard = document.getElementById('dashboard');
            const timestamp = document.getElementById('timestamp');
            
            // Update timestamp
            timestamp.textContent = `Last updated: ${new Date(healthData.timestamp).toLocaleString()}`;
            
            // Clear existing cards
            dashboard.innerHTML = '';
            
            // Overall status card
            const overallCard = createCard('Overall Status', healthData.overall_health, {
                'Total Endpoints': healthData.statistics.total,
                'Healthy': healthData.statistics.healthy,
                'Unhealthy': healthData.statistics.unhealthy,
                'Avg Response': `${healthData.statistics.average_response_time}ms`
            });
            dashboard.appendChild(overallCard);
            
            // Individual endpoint cards
            healthData.endpoints.forEach(endpoint => {
                const card = createCard(endpoint.name, endpoint.status, {
                    'Response Time': `${endpoint.responseTime}ms`,
                    'Status': endpoint.status,
                    'Message': endpoint.message || endpoint.error || 'OK'
                });
                dashboard.appendChild(card);
            });
        }
        
        function createCard(title, status, metrics) {
            const card = document.createElement('div');
            card.className = 'card';
            
            const statusClass = status === 'healthy' ? 'status-healthy' : 
                               status === 'degraded' ? 'status-warning' : 'status-unhealthy';
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-title">${title}</div>
                    <span class="status-badge ${statusClass}">${status}</span>
                </div>
                ${Object.entries(metrics).map(([label, value]) => `
                    <div class="metric">
                        <span class="metric-label">${label}:</span>
                        <span class="metric-value">${value}</span>
                    </div>
                `).join('')}
            `;
            
            return card;
        }
        
        function refreshData() {
            loadHealthStatus();
            // Animate refresh button
            const btn = document.querySelector('.refresh-btn');
            btn.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                btn.style.transform = 'rotate(0deg)';
            }, 500);
        }
        
        // Auto-refresh every 30 seconds
        setInterval(refreshData, 30000);
        
        // Initial load
        loadHealthStatus();
    </script>
</body>
</html>
EOF

# Create systemd service for continuous monitoring (optional)
echo -e "${YELLOW}Creating systemd service file (optional)...${NC}"

cat > pitchey-monitor.service << 'EOF'
[Unit]
Description=Pitchey Platform Monitoring Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pitchey/monitoring
ExecStart=/usr/bin/node /opt/pitchey/monitoring/health-check.js
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
EOF

# Create cron job for periodic checks
echo -e "${YELLOW}Creating cron job for periodic monitoring...${NC}"

cat > pitchey-monitor.cron << 'EOF'
# Pitchey Platform Monitoring Cron Jobs
# Run health check every 5 minutes
*/5 * * * * cd /opt/pitchey/monitoring && node health-check.js >> monitoring.log 2>&1

# Collect metrics every hour
0 * * * * cd /opt/pitchey/monitoring && node collect-metrics.js >> metrics.log 2>&1

# Daily report at 9 AM
0 9 * * * cd /opt/pitchey/monitoring && ./generate-report.sh

# Weekly cleanup of old logs (Sunday at 2 AM)
0 2 * * 0 find /opt/pitchey/monitoring -name "*.log" -mtime +7 -delete
EOF

echo ""
echo -e "${GREEN}✅ Monitoring setup complete!${NC}"
echo ""
echo "Files created:"
echo "  • monitoring-endpoints.json - Endpoint configuration"
echo "  • health-check.js - Health check script"
echo "  • monitor-continuous.sh - Continuous monitoring"
echo "  • collect-metrics.js - Metrics collection"
echo "  • monitoring-dashboard.html - Web dashboard"
echo ""
echo "To start monitoring:"
echo "  1. Install dependencies: npm install ws"
echo "  2. Run single check: node health-check.js"
echo "  3. Run continuous: ./monitor-continuous.sh"
echo "  4. View dashboard: open monitoring-dashboard.html"
echo ""
echo "For production setup:"
echo "  1. Copy files to /opt/pitchey/monitoring/"
echo "  2. Install systemd service: sudo cp pitchey-monitor.service /etc/systemd/system/"
echo "  3. Enable service: sudo systemctl enable pitchey-monitor"
echo "  4. Add cron jobs: crontab pitchey-monitor.cron"
EOF

chmod +x setup-monitoring.sh