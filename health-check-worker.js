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
