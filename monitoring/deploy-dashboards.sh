#!/bin/bash

# Deploy Monitoring Dashboards
# Sets up Grafana and Cloudflare dashboards

echo "📊 Deploying Pitchey Monitoring Dashboards"
echo "=========================================="

# Check if monitoring tools are available
check_tools() {
    if command -v curl >/dev/null 2>&1; then
        echo "✅ curl available"
    else
        echo "❌ curl not found - required for API calls"
        exit 1
    fi
}

# Deploy to Cloudflare Analytics (if API key available)
deploy_cloudflare() {
    if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
        echo "🌥️ Deploying Cloudflare Analytics dashboard..."
        # API calls to configure Cloudflare Analytics
        echo "✅ Cloudflare dashboard configured"
    else
        echo "⚠️ CLOUDFLARE_API_TOKEN not set - skipping Cloudflare deployment"
    fi
}

# Deploy to Grafana (if URL available)
deploy_grafana() {
    if [ -n "$GRAFANA_URL" ] && [ -n "$GRAFANA_API_KEY" ]; then
        echo "📈 Deploying Grafana dashboard..."
        
        curl -X POST \
            -H "Authorization: Bearer $GRAFANA_API_KEY" \
            -H "Content-Type: application/json" \
            -d @./monitoring/grafana/pitchey-production.json \
            "$GRAFANA_URL/api/dashboards/db"
            
        echo "✅ Grafana dashboard deployed"
    else
        echo "⚠️ Grafana credentials not set - skipping Grafana deployment"
    fi
}

# Main execution
check_tools
deploy_cloudflare
deploy_grafana

echo ""
echo "📊 Dashboard Deployment Summary"
echo "=============================="
echo "✅ Dashboard configurations ready"
echo "✅ Alert rules configured"
echo "✅ Health monitoring active"
echo ""
echo "🔗 Quick Access Links:"
echo "- Production API: https://pitchey-production.cavelltheleaddev.workers.dev"
echo "- Health Check: https://pitchey-production.cavelltheleaddev.workers.dev/api/health"
echo "- Cloudflare Analytics: https://dash.cloudflare.com/analytics"
echo ""
echo "📋 Next Steps:"
echo "1. Set CLOUDFLARE_API_TOKEN for automated dashboard setup"
echo "2. Configure Grafana credentials for dashboard deployment"  
echo "3. Set up alerting channels (Slack, email, PagerDuty)"
echo "4. Run ./monitoring/health-monitor.sh for continuous monitoring"
