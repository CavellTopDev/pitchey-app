#!/bin/bash

# Performance Monitoring Demo Script
# Demonstrates all monitoring capabilities for Pitchey

set -e

API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
DEMO_DURATION="${DEMO_DURATION:-300}"  # 5 minutes

echo "🎬 Pitchey Performance Monitoring Demo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL: $API_URL"
echo "Demo Duration: ${DEMO_DURATION} seconds"
echo ""

# Function to print step headers
print_step() {
    echo ""
    echo "┌─────────────────────────────────────────────┐"
    echo "│ $1"
    echo "└─────────────────────────────────────────────┘"
    echo ""
}

# Check if monitoring directory exists
if [[ ! -f "comprehensive-baseline-monitor.ts" ]]; then
    echo "❌ Please run this script from the monitoring/performance directory"
    exit 1
fi

print_step "Step 1: Initial Performance Baseline"
echo "🔍 Running comprehensive baseline test..."
deno run --allow-net --allow-read --allow-write comprehensive-baseline-monitor.ts
echo ""
echo "✅ Baseline complete! Check baseline-data/ directory for detailed results"

print_step "Step 2: Single Health Check"
echo "🏥 Running single health check to test all endpoints..."
deno run --allow-net --allow-read --allow-write health-check-daemon.ts --once
echo ""
echo "✅ Health check complete! Check health-logs/ directory for results"

print_step "Step 3: Generate Real-Time Dashboard"
echo "🎨 Generating interactive dashboard..."
deno run --allow-net --allow-read --allow-write real-time-dashboard.ts
echo ""
echo "✅ Dashboard generated! Open performance-dashboard.html to view"

print_step "Step 4: Alert Manager Test"
echo "🚨 Testing alert manager with current metrics..."
# Create environment for alert manager
export WEBHOOK_URL="${WEBHOOK_URL:-https://httpbin.org/post}"
deno run --allow-net --allow-read --allow-write --allow-env alert-manager.ts
echo ""
echo "✅ Alert evaluation complete! Check alerts-state.json for results"

print_step "Step 5: Continuous Monitoring Demo"
echo "🔄 Starting ${DEMO_DURATION}-second continuous monitoring demo..."
echo "   This will run health checks and update dashboard in real-time"
echo "   Press Ctrl+C to stop early"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping demo processes..."
    kill $(jobs -p) 2>/dev/null || true
    wait
    echo "✅ Demo stopped"
    exit 0
}

# Set up signal handler
trap cleanup SIGINT SIGTERM

# Start health monitoring in background
echo "📊 Starting health monitor..."
HEALTH_CHECK_INTERVAL=1 deno run --allow-net --allow-read --allow-write health-check-daemon.ts &
HEALTH_PID=$!

# Start dashboard generation in background
echo "🎨 Starting dashboard generator..."
DASHBOARD_REFRESH_INTERVAL=0.5 deno run --allow-net --allow-read --allow-write real-time-dashboard.ts --continuous &
DASHBOARD_PID=$!

# Start alert manager in background
echo "🚨 Starting alert manager..."
(
    while true; do
        WEBHOOK_URL="${WEBHOOK_URL:-https://httpbin.org/post}" \
            deno run --allow-net --allow-read --allow-write --allow-env alert-manager.ts >/dev/null 2>&1
        sleep 30
    done
) &
ALERT_PID=$!

echo ""
echo "🚀 Monitoring is now running!"
echo ""
echo "📊 What's happening:"
echo "   • Health checks every 1 minute"
echo "   • Dashboard updates every 30 seconds"
echo "   • Alert evaluation every 30 seconds"
echo ""
echo "🌐 View dashboard: open performance-dashboard.html in your browser"
echo "📁 Monitor logs:"
echo "   • Health: tail -f health-logs/health-$(date +%Y-%m-%d).jsonl"
echo "   • Metrics: tail -f dashboard-data/latest-metrics.json"
echo ""

# Progress indicator
for ((i=1; i<=DEMO_DURATION; i++)); do
    printf "\r⏱️  Demo running... %d/%d seconds (%.1f%% complete)" $i $DEMO_DURATION $(echo "scale=1; $i*100/$DEMO_DURATION" | bc -l)
    sleep 1
done

echo ""
echo ""
print_step "Demo Complete!"
echo "🎉 Monitoring demo finished successfully!"
echo ""
echo "📊 Generated files:"
echo "   • performance-dashboard.html - Interactive dashboard"
echo "   • health-logs/health-$(date +%Y-%m-%d).jsonl - Health check log"
echo "   • baseline-data/baseline-*.json - Performance baseline"
echo "   • dashboard-data/latest-metrics.json - Latest metrics"
echo "   • alerts-state.json - Alert state"
echo ""
echo "🔍 To analyze the data:"
echo "   • Open performance-dashboard.html in your browser"
echo "   • Review JSON files with: jq . filename.json"
echo "   • Check for alerts: cat alerts-state.json | jq '.activeAlerts'"
echo ""
echo "🚀 To run monitoring in production:"
echo "   ./setup-monitoring.sh     # One-time setup"
echo "   ./start-monitoring.sh     # Start all monitoring"
echo ""

# Cleanup
cleanup