#!/bin/bash

echo "🚀 SENTRY CLI AUTOMATIC SETUP"
echo "============================="
echo ""

# Step 1: Get organization and project info
echo "📋 Finding your Sentry organizations and projects..."
echo ""

echo "🏢 Your Organizations:"
sentry-cli organizations list

echo ""
echo "📦 Your Projects:"
sentry-cli projects list

echo ""
echo "🔍 Let's find your Pitchey project..."

# Try to find pitchey project automatically
PITCHEY_PROJECT=$(sentry-cli projects list | grep -i pitchey | head -1)

if [ -n "$PITCHEY_PROJECT" ]; then
    echo "✅ Found Pitchey project: $PITCHEY_PROJECT"
else
    echo "❓ Pitchey project not found in list above"
    echo "   Please look for your project in the list above"
fi

echo ""
echo "📊 Testing error access..."

# Try to get recent issues
echo "🔍 Recent issues across all projects:"
sentry-cli issues list | head -10

echo ""
echo "==============================================="
echo "🎯 NEXT STEPS:"
echo ""
echo "1. Look at the organizations list above"
echo "2. Look at the projects list above" 
echo "3. Find your Pitchey project"
echo "4. Tell Claude the organization and project names"
echo ""
echo "Example format:"
echo "   Organization: my-company"
echo "   Project: pitchey-frontend"
echo ""
echo "Then Claude will configure everything for you!"
echo "==============================================="