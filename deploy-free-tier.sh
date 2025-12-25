#!/bin/bash

# Deploy Script for Cloudflare Free Tier
# Optimized for free tier limitations:
# - 100,000 requests/day
# - 10ms CPU time per request  
# - 1GB KV storage
# - No Durable Objects or WebSockets

echo "🚀 Deploying Pitchey to Cloudflare Free Tier"
echo "============================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Step 1: Create KV namespace if it doesn't exist
echo ""
echo "📦 Step 1: Setting up KV namespace..."
KV_ID=$(wrangler kv:namespace list | grep -o '"id": "[^"]*"' | grep -o '[^"]*$' | head -1)

if [ -z "$KV_ID" ]; then
    echo "Creating new KV namespace..."
    wrangler kv:namespace create "KV"
    echo "✅ KV namespace created. Update the ID in wrangler.toml"
else
    echo "✅ KV namespace exists: $KV_ID"
fi

# Step 2: Set required secrets
echo ""
echo "🔐 Step 2: Setting secrets..."
echo "The following secrets are required:"
echo "  - DATABASE_URL (PostgreSQL connection string)"
echo "  - JWT_SECRET (for authentication)"

read -p "Do you want to set secrets now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enter DATABASE_URL:"
    read -s DATABASE_URL
    wrangler secret put DATABASE_URL <<< "$DATABASE_URL"
    
    echo "Enter JWT_SECRET:"
    read -s JWT_SECRET
    wrangler secret put JWT_SECRET <<< "$JWT_SECRET"
    
    echo "✅ Secrets configured"
else
    echo "⚠️  Remember to set secrets before testing:"
    echo "wrangler secret put DATABASE_URL"
    echo "wrangler secret put JWT_SECRET"
fi

# Step 3: Build the project
echo ""
echo "🔨 Step 3: Building the project..."
npm run build:worker

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors and try again."
    exit 1
fi
echo "✅ Build successful"

# Step 4: Deploy to Cloudflare
echo ""
echo "🚀 Step 4: Deploying to Cloudflare..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📊 Free Tier Limits:"
    echo "  • 100,000 requests per day"
    echo "  • 10ms CPU time per request"
    echo "  • 1GB KV storage"
    echo "  • 100,000 KV reads per day"
    echo ""
    echo "🔄 Features Enabled:"
    echo "  • Polling (replaces WebSocket)"
    echo "  • Aggressive KV caching"
    echo "  • Rate limiting"
    echo "  • Optimized database queries"
    echo ""
    echo "⚠️  Features Disabled (Free Tier):"
    echo "  • WebSocket real-time updates"
    echo "  • Durable Objects"
    echo "  • R2 storage"
    echo "  • Analytics Engine"
    echo "  • Queues"
    echo ""
    echo "🌐 Your API is available at:"
    wrangler whoami | grep -oP 'https://[^"]*\.workers\.dev'
    echo ""
    echo "📝 Next Steps:"
    echo "1. Update frontend .env with the Worker URL"
    echo "2. Test the polling endpoints:"
    echo "   - GET /api/poll/notifications"
    echo "   - GET /api/poll/dashboard"
    echo "3. Monitor usage in Cloudflare dashboard"
else
    echo "❌ Deployment failed. Check the errors above."
    exit 1
fi