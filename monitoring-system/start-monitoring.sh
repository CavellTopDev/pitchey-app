#!/bin/bash

# Quick start for monitoring system
echo "🚀 STARTING PITCHEY MONITORING SYSTEM"
echo "===================================="

echo ""
echo "Available monitoring options:"
echo ""
echo "1. 🔴 Live Dashboard (interactive)"
echo "   ./monitoring-system/scripts/monitoring-dashboard.sh"
echo ""
echo "2. 🔄 Background Health Monitor"
echo "   nohup ./monitoring-system/scripts/health-monitor.sh > monitoring-system/logs/monitor.log 2>&1 &"
echo ""
echo "3. 📊 Performance Analytics (daily)"
echo "   ./monitoring-system/scripts/performance-analytics.sh"
echo ""
echo "4. 🧪 Quick Health Check"
echo "   ./verify-phase1-deployment.sh"
echo ""

read -p "Choose option (1-4): " choice

case $choice in
    1)
        echo "Starting live dashboard..."
        ./monitoring-system/scripts/monitoring-dashboard.sh
        ;;
    2)
        echo "Starting background monitor..."
        nohup ./monitoring-system/scripts/health-monitor.sh > monitoring-system/logs/monitor.log 2>&1 &
        echo "Monitor started in background. Check logs: tail -f monitoring-system/logs/monitor.log"
        ;;
    3)
        echo "Running performance analytics..."
        ./monitoring-system/scripts/performance-analytics.sh
        ;;
    4)
        echo "Running quick health check..."
        ./verify-phase1-deployment.sh
        ;;
    *)
        echo "Invalid option. Run again with 1-4."
        ;;
esac
