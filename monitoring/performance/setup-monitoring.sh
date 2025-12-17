#!/bin/bash

# Pitchey Performance Monitoring Setup Script
# Sets up comprehensive monitoring for Cloudflare Worker deployment

set -e  # Exit on any error

API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-5}"
DASHBOARD_REFRESH_INTERVAL="${DASHBOARD_REFRESH_INTERVAL:-1}"
WEBHOOK_URL="${WEBHOOK_URL:-}"

echo "🎬 Pitchey Performance Monitoring Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL: $API_URL"
echo "Health Check Interval: ${HEALTH_CHECK_INTERVAL} minutes"
echo "Dashboard Refresh: ${DASHBOARD_REFRESH_INTERVAL} minutes"
echo "Webhook URL: ${WEBHOOK_URL:-Not configured}"
echo ""

# Check dependencies
echo "🔍 Checking dependencies..."

# Check if Deno is available
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is required but not installed. Please install Deno first."
    echo "   Visit: https://deno.land/manual/getting_started/installation"
    exit 1
fi

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo "❌ curl is required but not installed."
    exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq is recommended for better output formatting."
    echo "   Install with: sudo apt-get install jq (Ubuntu) or brew install jq (macOS)"
fi

echo "✅ Dependencies check passed"

# Create necessary directories
echo ""
echo "📁 Creating monitoring directories..."
mkdir -p baseline-data
mkdir -p health-logs
mkdir -p dashboard-data
mkdir -p alerts
echo "✅ Directories created"

# Set permissions for scripts
echo ""
echo "🔧 Setting up script permissions..."
chmod +x comprehensive-baseline-monitor.ts
chmod +x health-check-daemon.ts
chmod +x real-time-dashboard.ts
chmod +x alert-manager.ts
echo "✅ Permissions set"

# Test API connectivity
echo ""
echo "🌐 Testing API connectivity..."
if curl -s --max-time 10 "$API_URL/api/health" > /dev/null; then
    echo "✅ API is reachable"
else
    echo "⚠️  API test failed - monitoring will still work but may show errors"
fi

# Run initial baseline test
echo ""
echo "📊 Running initial performance baseline..."
echo "This may take 1-2 minutes..."
if deno run --allow-net --allow-read --allow-write comprehensive-baseline-monitor.ts; then
    echo "✅ Initial baseline complete"
else
    echo "⚠️  Baseline test had issues - check API connectivity"
fi

# Generate initial dashboard
echo ""
echo "🎨 Generating initial dashboard..."
if deno run --allow-net --allow-read --allow-write real-time-dashboard.ts; then
    echo "✅ Dashboard generated: performance-dashboard.html"
else
    echo "⚠️  Dashboard generation failed - will work once health data is available"
fi

# Create systemd service files if running on Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo ""
    echo "🔧 Creating systemd service files..."
    
    # Health check daemon service
    cat > pitchey-health-monitor.service << EOF
[Unit]
Description=Pitchey Health Monitor Daemon
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=API_URL=$API_URL
Environment=HEALTH_CHECK_INTERVAL=$HEALTH_CHECK_INTERVAL
Environment=WEBHOOK_URL=$WEBHOOK_URL
ExecStart=/usr/bin/deno run --allow-net --allow-read --allow-write health-check-daemon.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Dashboard generator service
    cat > pitchey-dashboard-generator.service << EOF
[Unit]
Description=Pitchey Dashboard Generator
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=API_URL=$API_URL
Environment=DASHBOARD_REFRESH_INTERVAL=$DASHBOARD_REFRESH_INTERVAL
ExecStart=/usr/bin/deno run --allow-net --allow-read --allow-write real-time-dashboard.ts --continuous
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    echo "✅ Service files created"
    echo "   To install: sudo cp *.service /etc/systemd/system/"
    echo "   To start: sudo systemctl enable --now pitchey-health-monitor"
    echo "   To start: sudo systemctl enable --now pitchey-dashboard-generator"
fi

# Create cron job entries
echo ""
echo "⏰ Creating cron job suggestions..."
cat > crontab-entries.txt << EOF
# Pitchey Performance Monitoring Cron Jobs
# Add these to your crontab with 'crontab -e'

# Run performance baseline every hour
0 * * * * cd $(pwd) && /usr/bin/deno run --allow-net --allow-read --allow-write comprehensive-baseline-monitor.ts >> baseline-data/cron.log 2>&1

# Run alert manager every 5 minutes (if not using daemon)
*/5 * * * * cd $(pwd) && /usr/bin/deno run --allow-net --allow-read --allow-write --allow-env alert-manager.ts >> alerts/cron.log 2>&1

# Generate dashboard every minute (if not using daemon)  
* * * * * cd $(pwd) && /usr/bin/deno run --allow-net --allow-read --allow-write real-time-dashboard.ts >> dashboard-data/cron.log 2>&1

# Clean up old logs weekly
0 0 * * 0 find $(pwd)/health-logs -name "*.jsonl" -mtime +7 -delete
0 0 * * 0 find $(pwd)/baseline-data -name "*.json" -mtime +30 -delete
EOF

echo "✅ Cron suggestions saved to crontab-entries.txt"

# Create monitoring runner script
cat > start-monitoring.sh << EOF
#!/bin/bash
# Start all monitoring components

echo "🚀 Starting Pitchey Performance Monitoring"
echo "Press Ctrl+C to stop all processes"

# Function to cleanup background processes
cleanup() {
    echo "🛑 Stopping monitoring processes..."
    kill \$(jobs -p) 2>/dev/null || true
    wait
    echo "✅ All monitoring stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

cd "\$(dirname "\$0")"

# Start health monitor daemon
echo "📊 Starting health monitor daemon..."
API_URL="$API_URL" HEALTH_CHECK_INTERVAL="$HEALTH_CHECK_INTERVAL" WEBHOOK_URL="$WEBHOOK_URL" \
    deno run --allow-net --allow-read --allow-write health-check-daemon.ts &

# Start dashboard generator
echo "🎨 Starting dashboard generator..."
API_URL="$API_URL" DASHBOARD_REFRESH_INTERVAL="$DASHBOARD_REFRESH_INTERVAL" \
    deno run --allow-net --allow-read --allow-write real-time-dashboard.ts --continuous &

# Start alert manager loop
echo "🚨 Starting alert manager..."
while true; do
    API_URL="$API_URL" WEBHOOK_URL="$WEBHOOK_URL" \
        deno run --allow-net --allow-read --allow-write --allow-env alert-manager.ts
    sleep 300  # Run every 5 minutes
done &

# Wait for all background processes
wait
EOF

chmod +x start-monitoring.sh

echo ""
echo "✅ Monitoring setup complete!"
echo ""
echo "🚀 Quick Start Options:"
echo ""
echo "1. Start all monitoring (foreground):"
echo "   ./start-monitoring.sh"
echo ""
echo "2. Run individual components:"
echo "   # Health checks every 5 minutes (daemon):"
echo "   deno run --allow-net --allow-read --allow-write health-check-daemon.ts"
echo ""
echo "   # Performance baseline (one-time):"
echo "   deno run --allow-net --allow-read --allow-write comprehensive-baseline-monitor.ts"
echo ""
echo "   # Generate dashboard (one-time):"
echo "   deno run --allow-net --allow-read --allow-write real-time-dashboard.ts"
echo ""
echo "   # Generate dashboard (continuous):"
echo "   deno run --allow-net --allow-read --allow-write real-time-dashboard.ts --continuous"
echo ""
echo "   # Check for alerts:"
echo "   deno run --allow-net --allow-read --allow-write --allow-env alert-manager.ts"
echo ""
echo "3. One-time health check:"
echo "   deno run --allow-net --allow-read --allow-write health-check-daemon.ts --once"
echo ""
echo "📊 Dashboard:"
echo "   View results: open performance-dashboard.html in browser"
echo "   Auto-refreshes every 30 seconds when monitoring is running"
echo ""
echo "⚠️  Configuration:"
echo "   • Edit alerting-config.json to customize alert thresholds"
echo "   • Set WEBHOOK_URL environment variable for alert notifications"
echo "   • Monitor logs in health-logs/ and baseline-data/ directories"
echo ""
echo "🔗 Monitoring URLs:"
echo "   Dashboard: file://$(pwd)/performance-dashboard.html"
echo "   Health logs: $(pwd)/health-logs/"
echo "   Baseline data: $(pwd)/baseline-data/"
echo ""
if [[ -n "$WEBHOOK_URL" ]]; then
    echo "✅ Webhook alerts configured: $WEBHOOK_URL"
else
    echo "⚠️  To enable webhook alerts: export WEBHOOK_URL=your_webhook_url"
fi
echo ""
echo "📚 For detailed information, see the monitoring/performance/README.md"