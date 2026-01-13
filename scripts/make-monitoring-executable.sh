#!/bin/bash

# Make Monitoring Scripts Executable
# Run this script to set proper permissions for monitoring setup

echo "🔧 Setting executable permissions for Pitchey monitoring scripts..."

# Make setup scripts executable
chmod +x scripts/setup-cloudflare-monitoring.sh
chmod +x scripts/setup-alerts.sh

# Make existing monitoring scripts executable if they exist
if [ -f "scripts/setup-monitoring.sh" ]; then
    chmod +x scripts/setup-monitoring.sh
fi

if [ -f "monitoring/automated-health-monitor.sh" ]; then
    chmod +x monitoring/automated-health-monitor.sh
fi

if [ -f "monitoring/continuous-monitor.sh" ]; then
    chmod +x monitoring/continuous-monitor.sh
fi

echo "✅ Executable permissions set for monitoring scripts"
echo ""
echo "📋 Quick Setup Guide:"
echo "1. Set environment variables:"
echo "   export CF_ACCOUNT_ID=\"your-cloudflare-account-id\""
echo "   export CF_API_TOKEN=\"your-cloudflare-api-token\""
echo ""
echo "2. Run Cloudflare monitoring setup:"
echo "   ./scripts/setup-cloudflare-monitoring.sh"
echo ""
echo "3. Run alert configuration:"
echo "   ./scripts/setup-alerts.sh"
echo ""
echo "4. Deploy synthetic monitoring Worker:"
echo "   cd monitoring && wrangler deploy"
echo ""
echo "5. Open health dashboard:"
echo "   open monitoring/health-dashboard.html"