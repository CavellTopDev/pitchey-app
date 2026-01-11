#!/bin/bash

# Deploy Worker to Cloudflare
echo "🚀 Deploying Worker to Cloudflare..."

# Navigate to project root
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# Build and deploy the Worker
echo "📦 Building and deploying Worker..."
wrangler deploy

echo "✅ Worker deployment complete!"
echo "🔗 Worker URL: https://pitchey-api-prod.ndlovucavelle.workers.dev"