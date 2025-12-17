#!/bin/bash

# Test Database Pipeline Script
# This script verifies that all components are working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Database Pipeline Test Script${NC}"
echo "===================================="

# Function to check command exists
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅ $1 is installed${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 is not installed${NC}"
        return 1
    fi
}

# Function to check environment variable
check_env() {
    if [ -z "${!1}" ]; then
        echo -e "${RED}❌ $1 is not set${NC}"
        return 1
    else
        echo -e "${GREEN}✅ $1 is set (length: ${#1})${NC}"
        return 0
    fi
}

# Function to test endpoint
test_endpoint() {
    local url=$1
    local name=$2
    
    echo -e "${BLUE}Testing $name...${NC}"
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$response" == "200" ]; then
        echo -e "${GREEN}✅ $name returned 200 OK${NC}"
        return 0
    elif [ "$response" == "000" ]; then
        echo -e "${RED}❌ $name failed to connect${NC}"
        return 1
    else
        echo -e "${YELLOW}⚠️  $name returned $response${NC}"
        return 1
    fi
}

# 1. Check Prerequisites
echo -e "\n${BLUE}1. Checking Prerequisites${NC}"
echo "------------------------"

all_good=true

check_command "wrangler" || all_good=false
check_command "gh" || all_good=false
check_command "node" || all_good=false
check_command "openssl" || all_good=false
check_command "curl" || all_good=false
check_command "jq" || all_good=false

if [ "$all_good" = false ]; then
    echo -e "${RED}Please install missing prerequisites${NC}"
    exit 1
fi

# 2. Check Environment Variables
echo -e "\n${BLUE}2. Checking Environment Variables${NC}"
echo "--------------------------------"

env_good=true

check_env "DATABASE_URL" || env_good=false
check_env "CLOUDFLARE_API_TOKEN" || env_good=false
check_env "CLOUDFLARE_ACCOUNT_ID" || env_good=false

if [ "$env_good" = false ]; then
    echo -e "${YELLOW}Please set missing environment variables${NC}"
    echo "Example:"
    echo '  export DATABASE_URL="postgresql://..."'
    echo '  export CLOUDFLARE_API_TOKEN="..."'
    echo '  export CLOUDFLARE_ACCOUNT_ID="..."'
fi

# 3. Check GitHub Authentication
echo -e "\n${BLUE}3. Checking GitHub Authentication${NC}"
echo "---------------------------------"

if gh auth status &> /dev/null; then
    echo -e "${GREEN}✅ GitHub CLI is authenticated${NC}"
    gh auth status
else
    echo -e "${RED}❌ GitHub CLI is not authenticated${NC}"
    echo "Run: gh auth login"
fi

# 4. Check GitHub Secrets
echo -e "\n${BLUE}4. Checking GitHub Secrets${NC}"
echo "-------------------------"

if gh secret list &> /dev/null; then
    echo -e "${GREEN}✅ Can access GitHub secrets${NC}"
    echo "Configured secrets:"
    gh secret list | grep -E "NEON_DATABASE_URL|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|JWT_SECRET" || echo "No relevant secrets found"
else
    echo -e "${RED}❌ Cannot access GitHub secrets${NC}"
fi

# 5. Check Cloudflare Authentication
echo -e "\n${BLUE}5. Checking Cloudflare Authentication${NC}"
echo "------------------------------------"

if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    if wrangler whoami &> /dev/null; then
        echo -e "${GREEN}✅ Cloudflare authentication successful${NC}"
        wrangler whoami
    else
        echo -e "${RED}❌ Cloudflare authentication failed${NC}"
        echo "Check your CLOUDFLARE_API_TOKEN"
    fi
else
    echo -e "${YELLOW}⚠️  CLOUDFLARE_API_TOKEN not set, skipping${NC}"
fi

# 6. Test Database Connection
echo -e "\n${BLUE}6. Testing Database Connection${NC}"
echo "-----------------------------"

if [ -n "$DATABASE_URL" ]; then
    # Extract host from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:/]*\).*/\1/p')
    
    echo "Database host: $DB_HOST"
    
    if ping -c 1 -W 2 $DB_HOST &> /dev/null; then
        echo -e "${GREEN}✅ Database host is reachable${NC}"
    else
        echo -e "${YELLOW}⚠️  Cannot ping database host (this might be normal)${NC}"
    fi
    
    # Test with psql if available
    if command -v psql &> /dev/null; then
        if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
            echo -e "${GREEN}✅ Database connection successful${NC}"
        else
            echo -e "${RED}❌ Database connection failed${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  psql not installed, skipping direct test${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not set, skipping${NC}"
fi

# 7. Check Worker Status
echo -e "\n${BLUE}7. Checking Worker Status${NC}"
echo "------------------------"

# Check local worker directory
if [ -d "frontend/worker" ]; then
    echo -e "${GREEN}✅ Worker directory exists${NC}"
    
    if [ -f "frontend/worker/wrangler.toml" ]; then
        echo -e "${GREEN}✅ wrangler.toml exists${NC}"
    else
        echo -e "${RED}❌ wrangler.toml not found${NC}"
    fi
    
    if [ -f "frontend/worker/index.ts" ]; then
        echo -e "${GREEN}✅ index.ts exists${NC}"
    else
        echo -e "${RED}❌ index.ts not found${NC}"
    fi
else
    echo -e "${RED}❌ Worker directory not found${NC}"
fi

# 8. Test Production Endpoints
echo -e "\n${BLUE}8. Testing Production Endpoints${NC}"
echo "------------------------------"

WORKER_URL="https://pitchey-production.cavelltheleaddev.workers.dev"

test_endpoint "$WORKER_URL/api/test" "Health check"
test_endpoint "$WORKER_URL/api/test-db" "Database test"
test_endpoint "$WORKER_URL/api/pitches/browse" "Browse endpoint"

# 9. Check Hyperdrive Configuration
echo -e "\n${BLUE}9. Checking Hyperdrive Configuration${NC}"
echo "-----------------------------------"

if command -v wrangler &> /dev/null && [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    echo "Listing Hyperdrive configurations..."
    wrangler hyperdrive list 2>/dev/null | grep pitchey || echo "No Hyperdrive config found for pitchey"
else
    echo -e "${YELLOW}⚠️  Cannot check Hyperdrive (wrangler or API token missing)${NC}"
fi

# 10. Check Recent Deployments
echo -e "\n${BLUE}10. Checking Recent Deployments${NC}"
echo "------------------------------"

if command -v wrangler &> /dev/null && [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    echo "Recent deployments:"
    wrangler deployments list --name pitchey-production 2>/dev/null | head -5 || echo "No deployments found"
else
    echo -e "${YELLOW}⚠️  Cannot check deployments${NC}"
fi

# Summary
echo -e "\n${BLUE}========== TEST SUMMARY ==========${NC}"

if [ "$all_good" = true ] && [ "$env_good" = true ]; then
    echo -e "${GREEN}✅ All prerequisites and environment variables are set${NC}"
    echo -e "${GREEN}   You're ready to deploy!${NC}"
    echo
    echo "Next steps:"
    echo "1. Run: gh workflow run deploy-worker.yml"
    echo "2. Monitor: gh run watch"
    echo "3. Check logs: wrangler tail pitchey-production"
else
    echo -e "${YELLOW}⚠️  Some issues were found${NC}"
    echo "Please fix the issues above before deploying"
fi

echo -e "\n${BLUE}===================================${NC}"