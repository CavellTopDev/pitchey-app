#!/bin/bash

# Deployment Script for Optimized Cloudflare Worker
# This script deploys all performance optimizations

set -e  # Exit on error

echo "🚀 Starting Optimized Deployment Process..."
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "\n${YELLOW}Step 1: Checking prerequisites...${NC}"

if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Wrangler CLI found${NC}"

# Step 2: Deploy the optimized worker
echo -e "\n${YELLOW}Step 2: Deploying optimized worker...${NC}"

echo "Building and deploying worker..."
wrangler deploy --compatibility-date 2024-11-01

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Worker deployed successfully${NC}"
else
    echo -e "${RED}❌ Worker deployment failed${NC}"
    exit 1
fi

echo -e "\n${GREEN}🎉 Deployment Complete!${NC}"
echo "Worker URL: https://pitchey-production.cavelltheleaddev.workers.dev"
