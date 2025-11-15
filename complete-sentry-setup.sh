#!/bin/bash

echo "🚀 COMPLETE SENTRY SETUP FOR PITCHEY"
echo "===================================="
echo ""

ORG="pitchey"

echo "📦 Getting your Pitchey projects..."
sentry-cli projects list --org $ORG

echo ""
echo "🔧 Creating project configuration..."

# Create the configuration file
cat > .sentryclirc << EOF
[defaults]
org=pitchey
project=pitchey
url=https://sentry.io/
EOF

echo "✅ Created .sentryclirc configuration file"

echo ""
echo "🔍 Testing project access..."
sentry-cli projects list --org $ORG

echo ""
echo "📊 Getting recent issues from your projects..."
sentry-cli issues list --org $ORG | head -10

echo ""
echo "🎯 Testing specific queries..."
echo ""
echo "📱 Frontend errors (last 24h):"
sentry-cli issues list --org $ORG --query "platform:javascript" --query "age:-1d" | head -5

echo ""
echo "🖥️ Backend errors (last 24h):"
sentry-cli issues list --org $ORG --query "platform:other" --query "age:-1d" | head -5

echo ""
echo "🔴 Critical errors (last 24h):"
sentry-cli issues list --org $ORG --query "level:error" --query "age:-1d" | head -5

echo ""
echo "==============================================="
echo "✅ SENTRY CLI FULLY CONFIGURED!"
echo ""
echo "🎯 YOU CAN NOW USE:"
echo ""
echo "   sentry-cli issues list                     # All recent issues"
echo "   sentry-cli issues list --query \"level:error\" # Critical errors only"
echo "   sentry-cli monitor                         # Live error monitoring"
echo "   sentry-cli issues show ISSUE_ID           # Detailed issue analysis"
echo ""
echo "📊 Your setup:"
echo "   Organization: pitchey"
echo "   Project: (auto-detected from your projects above)"
echo ""
echo "🚨 LIVE MONITORING: Run 'sentry-cli monitor' to see errors in real-time!"
echo "==============================================="