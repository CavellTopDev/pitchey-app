#!/bin/bash

# Monitoring Status Overview Script
# Shows current status of all monitoring components

API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"

echo "🎬 Pitchey Performance Monitoring Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API URL: $API_URL"
echo "Timestamp: $(date)"
echo ""

# Check API connectivity
echo "🌐 API Connectivity:"
if curl -s --max-time 5 "$API_URL/api/health" > /dev/null; then
    echo "   ✅ API is reachable"
else
    echo "   ❌ API is unreachable or slow"
fi
echo ""

# Check for monitoring files
echo "📁 Monitoring Files:"
files=(
    "comprehensive-baseline-monitor.ts:📊 Baseline Monitor"
    "health-check-daemon.ts:🏥 Health Daemon" 
    "real-time-dashboard.ts:🎨 Dashboard Generator"
    "alert-manager.ts:🚨 Alert Manager"
    "alerting-config.json:⚙️ Alert Config"
    "setup-monitoring.sh:🔧 Setup Script"
)

for file_info in "${files[@]}"; do
    file="${file_info%%:*}"
    desc="${file_info##*:}"
    if [[ -f "$file" ]]; then
        echo "   ✅ $desc"
    else
        echo "   ❌ $desc (missing: $file)"
    fi
done
echo ""

# Check for data directories
echo "📂 Data Directories:"
dirs=(
    "baseline-data:📊 Baseline Data"
    "health-logs:🏥 Health Logs"
    "dashboard-data:🎨 Dashboard Data"
)

for dir_info in "${dirs[@]}"; do
    dir="${dir_info%%:*}"
    desc="${dir_info##*:}"
    if [[ -d "$dir" ]]; then
        file_count=$(find "$dir" -type f | wc -l)
        echo "   ✅ $desc ($file_count files)"
    else
        echo "   ❌ $desc (missing directory)"
    fi
done
echo ""

# Check for latest data
echo "📈 Latest Monitoring Data:"

# Latest baseline
if [[ -d "baseline-data" ]]; then
    latest_baseline=$(ls -t baseline-data/baseline-*.json 2>/dev/null | head -1)
    if [[ -n "$latest_baseline" ]]; then
        baseline_time=$(stat -c %y "$latest_baseline" 2>/dev/null | cut -d' ' -f1-2)
        echo "   📊 Latest baseline: $baseline_time"
    else
        echo "   ❌ No baseline data found"
    fi
fi

# Latest health check
if [[ -d "health-logs" ]]; then
    latest_health=$(ls -t health-logs/health-*.jsonl 2>/dev/null | head -1)
    if [[ -n "$latest_health" ]]; then
        health_lines=$(wc -l < "$latest_health" 2>/dev/null || echo "0")
        health_time=$(stat -c %y "$latest_health" 2>/dev/null | cut -d' ' -f1-2)
        echo "   🏥 Latest health log: $health_time ($health_lines entries)"
    else
        echo "   ❌ No health check data found"
    fi
fi

# Latest dashboard
if [[ -f "performance-dashboard.html" ]]; then
    dashboard_time=$(stat -c %y "performance-dashboard.html" 2>/dev/null | cut -d' ' -f1-2)
    echo "   🎨 Dashboard updated: $dashboard_time"
else
    echo "   ❌ Dashboard not generated"
fi

# Latest metrics
if [[ -f "dashboard-data/latest-metrics.json" ]]; then
    metrics_time=$(stat -c %y "dashboard-data/latest-metrics.json" 2>/dev/null | cut -d' ' -f1-2)
    echo "   📈 Metrics updated: $metrics_time"
else
    echo "   ❌ No metrics data available"
fi
echo ""

# Current alerts
echo "🚨 Alert Status:"
if [[ -f "alerts-state.json" ]]; then
    if command -v jq &> /dev/null; then
        active_alerts=$(jq '.activeAlerts | length' alerts-state.json 2>/dev/null || echo "0")
        total_history=$(jq '.alertHistory | length' alerts-state.json 2>/dev/null || echo "0")
        echo "   📊 Active alerts: $active_alerts"
        echo "   📜 Alert history: $total_history"
        
        if [[ "$active_alerts" -gt 0 ]]; then
            echo ""
            echo "   🚨 Active Alerts:"
            jq -r '.activeAlerts | to_entries[] | "      " + .value.severity + ": " + .value.message' alerts-state.json 2>/dev/null | head -5
        fi
    else
        echo "   ⚠️  Alert data exists but jq not available for parsing"
    fi
else
    echo "   📭 No alert data available"
fi
echo ""

# Running processes
echo "🔄 Running Processes:"
health_pids=$(pgrep -f "health-check-daemon.ts" || true)
dashboard_pids=$(pgrep -f "real-time-dashboard.ts" || true)
monitoring_pids=$(pgrep -f "start-monitoring.sh" || true)

if [[ -n "$health_pids" ]]; then
    echo "   ✅ Health daemon running (PID: $health_pids)"
else
    echo "   ❌ Health daemon not running"
fi

if [[ -n "$dashboard_pids" ]]; then
    echo "   ✅ Dashboard generator running (PID: $dashboard_pids)"
else
    echo "   ❌ Dashboard generator not running"
fi

if [[ -n "$monitoring_pids" ]]; then
    echo "   ✅ Monitoring suite running (PID: $monitoring_pids)"
else
    echo "   ❌ Monitoring suite not running"
fi
echo ""

# System requirements
echo "🔧 System Requirements:"
deps=(
    "deno:Deno runtime"
    "curl:HTTP client"
    "jq:JSON processor"
    "bc:Calculator"
)

for dep_info in "${deps[@]}"; do
    cmd="${dep_info%%:*}"
    desc="${dep_info##*:}"
    if command -v "$cmd" &> /dev/null; then
        version=$(eval "$cmd --version" 2>/dev/null | head -1 | cut -d' ' -f1-2 || echo "installed")
        echo "   ✅ $desc ($version)"
    else
        echo "   ❌ $desc (not installed)"
    fi
done
echo ""

# Quick recommendations
echo "💡 Recommendations:"
if [[ ! -f "alerts-state.json" ]]; then
    echo "   🚨 Run alert manager: deno run --allow-net --allow-read --allow-write --allow-env alert-manager.ts"
fi

if [[ ! -f "performance-dashboard.html" ]]; then
    echo "   🎨 Generate dashboard: deno run --allow-net --allow-read --allow-write real-time-dashboard.ts"
fi

if [[ -z "$health_pids" && -z "$dashboard_pids" && -z "$monitoring_pids" ]]; then
    echo "   🚀 Start monitoring: ./start-monitoring.sh"
fi

if [[ ! -d "baseline-data" || ! -f "baseline-data/baseline-"*.json ]]; then
    echo "   📊 Run baseline test: deno run --allow-net --allow-read --allow-write comprehensive-baseline-monitor.ts"
fi

echo ""
echo "🌐 View Dashboard: open performance-dashboard.html"
echo "📖 Full Documentation: cat README.md"