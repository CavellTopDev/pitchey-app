#!/bin/bash

# Deploy to Deno Deploy Script
echo "🚀 Deploying Pitchey Backend to Deno Deploy..."

# Check if deployctl is installed
if ! command -v deployctl &> /dev/null; then
    echo "📦 Installing deployctl..."
    deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts
fi

# Deploy using GitHub integration approach
echo "📝 Creating deployment configuration..."

# Use the GitHub integration method instead of direct upload
echo "🔗 Connecting to GitHub repository..."

# Deploy with explicit entry point and project
deployctl deploy \
  --project=pitchey-backend \
  --entrypoint=working-server.ts \
  --include=working-server.ts,deno.json,src/**/*.ts,init-neon-db.ts \
  --env-file=.env.production \
  --prod

echo "✅ Deployment initiated!"