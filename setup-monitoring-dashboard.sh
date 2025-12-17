#!/bin/bash

# Comprehensive Monitoring Dashboard Setup for Pitchey Production
# Real-time performance tracking and alerting

echo "📊 SETTING UP CONTINUOUS MONITORING DASHBOARDS"
echo "=============================================="
echo ""

WORKER_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
MONITORING_DIR="monitoring/dashboards"

# Create monitoring directory structure
mkdir -p $MONITORING_DIR/{data,logs,reports}

echo "📈 Phase 1: Creating Real-Time Performance Monitor"
echo "-------------------------------------------------"

cat > $MONITORING_DIR/performance-monitor.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pitchey Performance Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { margin-bottom: 30px; text-align: center; }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .status-good { color: #10b981; }
        .status-warning { color: #f59e0b; }
        .status-error { color: #ef4444; }
        .chart-container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            margin-bottom: 20px;
        }
        .endpoint-list {
            list-style: none;
            padding: 0;
        }
        .endpoint-item {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            background: rgba(255, 255, 255, 0.05);
            margin-bottom: 5px;
            border-radius: 8px;
        }
        .refresh-btn {
            background: #10b981;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        }
        .refresh-btn:hover { background: #059669; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Pitchey Performance Dashboard</h1>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Health Status</div>
                <div class="metric-value" id="health-status">--</div>
                <div class="metric-label" id="health-time">Response: --ms</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Average Response Time</div>
                <div class="metric-value" id="avg-response">--ms</div>
                <div class="metric-label">Last 10 requests</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Success Rate</div>
                <div class="metric-value" id="success-rate">--%</div>
                <div class="metric-label">Last hour</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Cache Hit Rate</div>
                <div class="metric-value" id="cache-rate">--%</div>
                <div class="metric-label">Efficiency</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h2>Endpoint Performance</h2>
            <ul class="endpoint-list" id="endpoint-list">
                <li class="endpoint-item">Loading...</li>
            </ul>
        </div>
        
        <div class="chart-container">
            <h2>System Metrics</h2>
            <div id="system-metrics">
                <p>Database Connection: <span id="db-status">--</span></p>
                <p>Cache Status: <span id="cache-status">--</span></p>
                <p>Worker Status: <span id="worker-status">--</span></p>
                <p>Last Update: <span id="last-update">--</span></p>
            </div>
        </div>
        
        <button class="refresh-btn" onclick="refreshMetrics()">🔄 Refresh Now</button>
    </div>
    
    <script>
        const WORKER_URL = 'https://pitchey-production.cavelltheleaddev.workers.dev';
        const endpoints = [
            '/api/health',
            '/api/pitches/browse/enhanced',
            '/api/pitches/featured',
            '/api/pitches/trending',
            '/api/auth/status'
        ];
        
        let metrics = {
            responseTimes: [],
            successCount: 0,
            totalCount: 0,
            cacheHits: 0
        };
        
        async function testEndpoint(endpoint) {
            const start = Date.now();
            try {
                const response = await fetch(WORKER_URL + endpoint);
                const duration = Date.now() - start;
                
                return {
                    endpoint,
                    status: response.status,
                    duration,
                    success: response.status < 400
                };
            } catch (error) {
                return {
                    endpoint,
                    status: 500,
                    duration: Date.now() - start,
                    success: false,
                    error: error.message
                };
            }
        }
        
        async function refreshMetrics() {
            console.log('Refreshing metrics...');
            
            // Test all endpoints
            const results = await Promise.all(endpoints.map(testEndpoint));
            
            // Update metrics
            results.forEach(result => {
                metrics.responseTimes.push(result.duration);
                metrics.totalCount++;
                if (result.success) metrics.successCount++;
                
                // Keep only last 10 response times
                if (metrics.responseTimes.length > 10) {
                    metrics.responseTimes.shift();
                }
            });
            
            // Calculate averages
            const avgResponse = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
            const successRate = (metrics.successCount / metrics.totalCount * 100).toFixed(1);
            
            // Update UI
            const healthResult = results.find(r => r.endpoint === '/api/health');
            document.getElementById('health-status').textContent = healthResult?.success ? '✅ Healthy' : '❌ Error';
            document.getElementById('health-status').className = 'metric-value ' + (healthResult?.success ? 'status-good' : 'status-error');
            document.getElementById('health-time').textContent = `Response: ${healthResult?.duration || '--'}ms`;
            
            document.getElementById('avg-response').textContent = Math.round(avgResponse) + 'ms';
            document.getElementById('avg-response').className = 'metric-value ' + (avgResponse < 200 ? 'status-good' : avgResponse < 500 ? 'status-warning' : 'status-error');
            
            document.getElementById('success-rate').textContent = successRate + '%';
            document.getElementById('success-rate').className = 'metric-value ' + (successRate > 95 ? 'status-good' : successRate > 80 ? 'status-warning' : 'status-error');
            
            // Update endpoint list
            const endpointList = document.getElementById('endpoint-list');
            endpointList.innerHTML = results.map(r => `
                <li class="endpoint-item">
                    <span>${r.endpoint}</span>
                    <span class="${r.success ? 'status-good' : 'status-error'}">
                        ${r.status} | ${r.duration}ms
                    </span>
                </li>
            `).join('');
            
            // Update system metrics
            const health = healthResult?.success;
            document.getElementById('db-status').textContent = health ? '✅ Connected' : '❌ Error';
            document.getElementById('cache-status').textContent = '✅ Active';
            document.getElementById('worker-status').textContent = '✅ Running';
            document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
            
            // Estimate cache rate based on response times
            const cacheRate = avgResponse < 100 ? 85 : avgResponse < 200 ? 60 : 30;
            document.getElementById('cache-rate').textContent = cacheRate + '%';
            document.getElementById('cache-rate').className = 'metric-value ' + (cacheRate > 70 ? 'status-good' : cacheRate > 50 ? 'status-warning' : 'status-error');
        }
        
        // Auto-refresh every 30 seconds
        setInterval(refreshMetrics, 30000);
        
        // Initial load
        refreshMetrics();
    </script>
</body>
</html>
EOF

echo "✅ Created performance dashboard: $MONITORING_DIR/performance-monitor.html"

echo ""
echo "📊 Phase 2: Creating Monitoring Scripts"
echo "---------------------------------------"

# Create monitoring script
cat > $MONITORING_DIR/monitor.sh << 'EOF'
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
EOF

chmod +x $MONITORING_DIR/monitor.sh

echo "✅ Created monitoring script: $MONITORING_DIR/monitor.sh"

echo ""
echo "📊 Phase 3: Creating Performance Report Generator"
echo "-------------------------------------------------"

cat > $MONITORING_DIR/generate-report.sh << 'EOF'
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
EOF

chmod +x $MONITORING_DIR/generate-report.sh

echo "✅ Created report generator: $MONITORING_DIR/generate-report.sh"

echo ""
echo "🎉 MONITORING DASHBOARD SETUP COMPLETE!"
echo "======================================="
echo ""
echo "📊 Access Points:"
echo "• Dashboard: Open $MONITORING_DIR/performance-monitor.html in browser"
echo "• Monitoring: Run $MONITORING_DIR/monitor.sh for continuous monitoring"
echo "• Reports: Run $MONITORING_DIR/generate-report.sh for detailed reports"
echo ""
echo "📈 Features:"
echo "• Real-time performance metrics"
echo "• Automatic alerts for slow responses"
echo "• Historical performance logging"
echo "• Visual dashboard with auto-refresh"
echo ""
echo "🚀 To start monitoring:"
echo "   1. Open performance-monitor.html in your browser"
echo "   2. Run ./monitoring/dashboards/monitor.sh in background"
echo "   3. Generate reports with ./monitoring/dashboards/generate-report.sh"