#!/bin/bash

echo "=== Fixing Deno Deploy Issues in GitHub Workflows ==="
echo ""

# List of workflows to fix
WORKFLOWS=(
    ".github/workflows/deploy.yml"
    ".github/workflows/deploy-production.yml"
    ".github/workflows/ci-cd.yml"
    ".github/workflows/deploy-full-stack.yml"
    ".github/workflows/cloudflare-deploy.yml"
    ".github/workflows/test-deploy.yml"
)

for workflow in "${WORKFLOWS[@]}"; do
    if [ -f "$workflow" ]; then
        echo "Checking $workflow..."
        
        # Check if it has Deno Deploy steps
        if grep -q "deployctl deploy" "$workflow"; then
            echo "  Found Deno Deploy step - commenting it out..."
            
            # Create a backup
            cp "$workflow" "$workflow.backup"
            
            # Comment out Deno Deploy sections
            # This is complex, so we'll add a skip condition instead
            sed -i 's/name: Deploy to Deno Deploy/name: Deploy to Deno Deploy (DISABLED - Migrated to Cloudflare)/' "$workflow"
            sed -i '/deployctl deploy/i\          echo "⚠️ Deno Deploy disabled - using Cloudflare Workers instead"' "$workflow"
            sed -i '/deployctl deploy/i\          echo "To deploy: wrangler deploy"' "$workflow"
            sed -i '/deployctl deploy/i\          exit 0  # Skip Deno deployment' "$workflow"
            
            echo "  ✓ Fixed $workflow"
        fi
    fi
done

echo ""
echo "=== Creating Cloudflare Deployment Workflow ==="

# Create a proper Cloudflare Workers deployment workflow
cat > .github/workflows/deploy-cloudflare-worker.yml << 'WORKFLOW'
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '18'

jobs:
  deploy:
    name: Deploy Worker
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
      
      - name: Install dependencies
        run: npm install -g wrangler
      
      - name: Deploy Worker
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          echo "🚀 Deploying to Cloudflare Workers..."
          
          # Deploy the worker
          wrangler deploy
          
          echo "✅ Worker deployed successfully!"
      
      - name: Test Deployment
        run: |
          echo "🧪 Testing deployed worker..."
          
          # Test the health endpoint
          response=\$(curl -s -o /dev/null -w "%{http_code}" https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health)
          
          if [ "\$response" = "200" ]; then
            echo "✅ Health check passed!"
          else
            echo "❌ Health check failed with status: \$response"
            exit 1
          fi
WORKFLOW

echo "✓ Created deploy-cloudflare-worker.yml"
echo ""
echo "=== Summary ==="
echo "1. Disabled Deno Deploy in existing workflows"
echo "2. Created dedicated Cloudflare Workers workflow"
echo "3. Workflows will now skip Deno deployments"
echo ""
echo "Next steps:"
echo "1. Update CLOUDFLARE_API_TOKEN in GitHub secrets"
echo "2. Commit and push these changes"
echo "3. Monitor the new deployment workflow"

