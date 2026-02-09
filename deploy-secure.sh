#!/bin/bash
# DEPRECATED: This script was written for Deno Deploy. The project now uses Cloudflare Workers (wrangler deploy).

# Secure Deployment Script
# Uses local token file that is NEVER committed to git

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "Secure Pitchey Backend Deployment"
echo "================================================"

# Check if secrets file exists
if [ ! -f ".env.local.secrets" ]; then
    echo -e "${RED}❌ Error: .env.local.secrets not found${NC}"
    echo ""
    echo "Please create .env.local.secrets with:"
    echo "  DENO_DEPLOY_TOKEN=your_actual_token_here"
    echo ""
    echo "Get your token from: https://dash.deno.com/account#access-tokens"
    exit 1
fi

# Load the token from local secrets file
source .env.local.secrets

# Check if token is set
if [ -z "$DENO_DEPLOY_TOKEN" ] || [ "$DENO_DEPLOY_TOKEN" = "your_actual_token_here" ]; then
    echo -e "${RED}❌ Error: DENO_DEPLOY_TOKEN not configured${NC}"
    echo ""
    echo "Please update .env.local.secrets with your actual token"
    echo "Get token from: https://dash.deno.com/account#access-tokens"
    exit 1
fi

echo -e "${GREEN}✓ Token loaded from .env.local.secrets${NC}"
echo ""

# Deployment steps
echo -e "${YELLOW}Starting deployment...${NC}"
echo ""

# Step 1: Temporarily move .env.example
echo "1. Preparing environment..."
if [ -f ".env.example" ]; then
    mv .env.example .env.example.backup
    echo -e "${GREEN}✓ Moved .env.example${NC}"
fi

# Step 2: Deploy
echo ""
echo "2. Deploying to Deno Deploy..."
echo "   Project: pitchey-backend-fresh"
echo ""

deployctl deploy \
    --project="pitchey-backend-fresh" \
    --entrypoint="working-server.ts" \
    --env-file=".env.deploy" \
    --token="$DENO_DEPLOY_TOKEN"

DEPLOY_EXIT_CODE=$?

# Step 3: Restore .env.example
echo ""
echo "3. Cleaning up..."
if [ -f ".env.example.backup" ]; then
    mv .env.example.backup .env.example
    echo -e "${GREEN}✓ Restored .env.example${NC}"
fi

# Check deployment result
echo ""
echo "================================================"
if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Backend URL: https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev"
    echo ""
    echo "Test with:"
    echo "  curl https://pitchey-backend-fresh-23jvxyy3bspp.deno.dev/api/health"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    echo ""
    echo "Check the error messages above"
    echo "If token error, regenerate at: https://dash.deno.com/account#access-tokens"
    exit 1
fi

echo "================================================"