#!/bin/bash

# Test Deployment Readiness Script
# Checks if everything is ready for GitHub Actions deployment

echo "🔍 Pitchey Deployment Readiness Check"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

READY=true

# Check if GitHub CLI is installed
echo "1. Checking GitHub CLI..."
if command -v gh &> /dev/null; then
    echo -e "${GREEN}✅ GitHub CLI installed${NC}"
else
    echo -e "${RED}❌ GitHub CLI not installed${NC}"
    echo "   Install from: https://cli.github.com/"
    READY=false
fi

# Check GitHub authentication
echo ""
echo "2. Checking GitHub authentication..."
if gh auth status &> /dev/null; then
    echo -e "${GREEN}✅ GitHub authenticated${NC}"
else
    echo -e "${YELLOW}⚠️  Not authenticated with GitHub${NC}"
    echo "   Run: gh auth login"
    READY=false
fi

# Check if secrets are configured
echo ""
echo "3. Checking GitHub secrets..."
if gh auth status &> /dev/null; then
    SECRETS=$(gh secret list 2>/dev/null | wc -l)
    if [ "$SECRETS" -gt 0 ]; then
        echo -e "${GREEN}✅ $SECRETS secrets configured${NC}"
        
        # Check for required secrets
        if gh secret list | grep -q "CLOUDFLARE_API_TOKEN"; then
            echo -e "   ${GREEN}✓ CLOUDFLARE_API_TOKEN${NC}"
        else
            echo -e "   ${RED}✗ CLOUDFLARE_API_TOKEN missing${NC}"
            READY=false
        fi
        
        if gh secret list | grep -q "CLOUDFLARE_ACCOUNT_ID"; then
            echo -e "   ${GREEN}✓ CLOUDFLARE_ACCOUNT_ID${NC}"
        else
            echo -e "   ${RED}✗ CLOUDFLARE_ACCOUNT_ID missing${NC}"
            READY=false
        fi
    else
        echo -e "${RED}❌ No secrets configured${NC}"
        echo "   Run: ./setup-github-secrets.sh"
        READY=false
    fi
fi

# Check if frontend builds
echo ""
echo "4. Testing frontend build..."
cd frontend
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend builds successfully${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    READY=false
fi
cd ..

# Check workflow files
echo ""
echo "5. Checking workflow files..."
if [ -f ".github/workflows/deploy-frontend.yml" ]; then
    echo -e "${GREEN}✅ deploy-frontend.yml exists${NC}"
else
    echo -e "${RED}❌ deploy-frontend.yml missing${NC}"
    READY=false
fi

# Summary
echo ""
echo "======================================"
if [ "$READY" = true ]; then
    echo -e "${GREEN}✅ DEPLOYMENT READY!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Push to GitHub: git push origin main"
    echo "2. Monitor deployment: https://github.com/YOUR_REPO/actions"
    echo "3. View your site: https://pitchey.pages.dev"
else
    echo -e "${RED}❌ NOT READY FOR DEPLOYMENT${NC}"
    echo ""
    echo "Fix the issues above, then run this script again."
fi

echo ""
echo "Quick setup commands:"
echo "---------------------"
echo "# Configure secrets (if not done):"
echo "./setup-github-secrets.sh"
echo ""
echo "# Push to trigger deployment:"
echo "git push origin main"
echo ""
echo "# Manual deployment trigger:"
echo "gh workflow run deploy-frontend.yml"
