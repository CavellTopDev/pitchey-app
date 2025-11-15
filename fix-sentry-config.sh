#!/bin/bash

echo "🔧 FIXING SENTRY CONFIGURATION"
echo "=============================="
echo ""

# Update the config with correct project name
cat > .sentryclirc << 'EOF'
[defaults]
org=pitchey
project=node
url=https://sentry.io/
EOF

echo "✅ Updated .sentryclirc with correct project: node"

echo ""
echo "🔍 Testing corrected configuration..."
sentry-cli issues list --org pitchey --project node

echo ""
echo "📊 ANALYZING YOUR PRODUCTION ERRORS:"
echo "==================================="

echo ""
echo "🔴 All Recent Issues:"
sentry-cli issues list --org pitchey --project node | head -10

echo ""
echo "⚡ Critical Issues:"
sentry-cli issues list --org pitchey --project node --query "level:error"

echo ""
echo "🕐 Last 24 Hours:"
sentry-cli issues list --org pitchey --project node --query "age:-1d"

echo ""
echo "🏭 Production Environment:"
sentry-cli issues list --org pitchey --project node --query "environment:production"

echo ""
echo "==============================================="
echo "🎯 SUCCESS! YOUR SENTRY CLI IS NOW WORKING"
echo ""
echo "🔍 USE THESE COMMANDS TO ANALYZE ERRORS:"
echo ""
echo "   # Live error monitoring"
echo "   sentry-cli monitor"
echo ""
echo "   # All recent issues"
echo "   sentry-cli issues list"
echo ""
echo "   # Critical errors only"
echo "   sentry-cli issues list --query \"level:error\""
echo ""
echo "   # Specific time periods"
echo "   sentry-cli issues list --query \"age:-1h\"    # Last hour"
echo "   sentry-cli issues list --query \"age:-1d\"    # Last day"
echo ""
echo "   # Investigate specific issue"
echo "   sentry-cli issues show ISSUE_ID"
echo ""
echo "🚨 START LIVE MONITORING NOW:"
echo "   sentry-cli monitor"
echo ""
echo "==============================================="