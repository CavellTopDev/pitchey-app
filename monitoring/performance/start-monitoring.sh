#!/bin/bash
# Start all monitoring components

echo "🚀 Starting Pitchey Performance Monitoring"
echo "Press Ctrl+C to stop all processes"

# Function to cleanup background processes
cleanup() {
    echo "🛑 Stopping monitoring processes..."
    kill $(jobs -p) 2>/dev/null || true
    wait
    echo "✅ All monitoring stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

cd "$(dirname "$0")"

# Start health monitor daemon
echo "📊 Starting health monitor daemon..."
API_URL="https://pitchey-production.cavelltheleaddev.workers.dev" HEALTH_CHECK_INTERVAL="5" WEBHOOK_URL=""     deno run --allow-net --allow-read --allow-write health-check-daemon.ts &

# Start dashboard generator
echo "🎨 Starting dashboard generator..."
API_URL="https://pitchey-production.cavelltheleaddev.workers.dev" DASHBOARD_REFRESH_INTERVAL="1"     deno run --allow-net --allow-read --allow-write real-time-dashboard.ts --continuous &

# Start alert manager loop
echo "🚨 Starting alert manager..."
while true; do
    API_URL="https://pitchey-production.cavelltheleaddev.workers.dev" WEBHOOK_URL=""         deno run --allow-net --allow-read --allow-write --allow-env alert-manager.ts
    sleep 300  # Run every 5 minutes
done &

# Wait for all background processes
wait
