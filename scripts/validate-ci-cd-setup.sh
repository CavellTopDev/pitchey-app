#!/bin/bash

# 🔍 CI/CD Pipeline Validation Script
# Validates that all necessary components are in place

set -e

echo "🔍 Validating CI/CD Pipeline Setup"
echo "=================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

VALIDATION_ERRORS=0

# Function to check file exists
check_file() {
    local file_path="$1"
    local description="$2"
    
    if [ -f "$file_path" ]; then
        echo -e "${GREEN}✅${NC} $description: $file_path"
        return 0
    else
        echo -e "${RED}❌${NC} $description: $file_path (MISSING)"
        ((VALIDATION_ERRORS++))
        return 1
    fi
}

# Function to check directory exists
check_directory() {
    local dir_path="$1"
    local description="$2"
    
    if [ -d "$dir_path" ]; then
        echo -e "${GREEN}✅${NC} $description: $dir_path"
        return 0
    else
        echo -e "${RED}❌${NC} $description: $dir_path (MISSING)"
        ((VALIDATION_ERRORS++))
        return 1
    fi
}

# Function to validate package.json script
validate_npm_script() {
    local script_name="$1"
    local package_json="./frontend/package.json"
    
    if [ -f "$package_json" ] && grep -q "\"$script_name\":" "$package_json"; then
        echo -e "${GREEN}✅${NC} NPM Script: $script_name"
        return 0
    else
        echo -e "${RED}❌${NC} NPM Script: $script_name (MISSING)"
        ((VALIDATION_ERRORS++))
        return 1
    fi
}

echo ""
echo "📁 Checking Core Files..."
echo "------------------------"

check_file ".github/workflows/ci-cd.yml" "GitHub Actions Workflow"
check_file "scripts/run-all-tests.sh" "Test Runner Script"
check_file "frontend/package.json" "Frontend Package Config"
check_file "wrangler.toml" "Cloudflare Worker Config"
check_file "src/worker-integrated.ts" "Worker Source"

echo ""
echo "📂 Checking Directories..."
echo "--------------------------"

check_directory ".github/workflows" "GitHub Workflows Directory"
check_directory "frontend" "Frontend Directory"
check_directory "scripts" "Scripts Directory"
check_directory "src" "Source Directory"

echo ""
echo "🔧 Checking NPM Scripts..."
echo "--------------------------"

validate_npm_script "build"
validate_npm_script "test:ci"
validate_npm_script "test:e2e"
validate_npm_script "lint"
validate_npm_script "type-check"

echo ""
echo "🧪 Checking Test Infrastructure..."
echo "----------------------------------"

# Check for test files
if [ -d "frontend/src" ]; then
    TEST_COUNT=$(find frontend/src -name "*.test.*" -o -name "*.spec.*" | wc -l)
    if [ "$TEST_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅${NC} Test Files Found: $TEST_COUNT"
    else
        echo -e "${YELLOW}⚠️${NC} No test files found in frontend/src"
    fi
fi

# Check for Playwright config
if [ -f "frontend/playwright.config.ts" ]; then
    echo -e "${GREEN}✅${NC} Playwright E2E Configuration"
else
    echo -e "${YELLOW}⚠️${NC} Playwright E2E Configuration (Optional)"
fi

echo ""
echo "⚙️ Checking Environment Variables..."
echo "-----------------------------------"

# Check if GitHub secrets are mentioned in workflow
if grep -q "CLOUDFLARE_API_TOKEN" .github/workflows/ci-cd.yml; then
    echo -e "${GREEN}✅${NC} Cloudflare API Token secret configured"
else
    echo -e "${RED}❌${NC} Cloudflare API Token secret not found in workflow"
    ((VALIDATION_ERRORS++))
fi

echo ""
echo "🔗 Validating API Endpoints..."
echo "------------------------------"

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "Testing: $API_URL/api/health"

if timeout 10s curl -f -s "$API_URL/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} API Health Check: ONLINE"
else
    echo -e "${YELLOW}⚠️${NC} API Health Check: Could not reach (may be temporary)"
fi

echo ""
echo "=================================="
echo "📊 VALIDATION SUMMARY"
echo "=================================="

if [ $VALIDATION_ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCESS!${NC} CI/CD Pipeline is properly configured."
    echo ""
    echo "✅ GitHub Actions workflow is in place"
    echo "✅ Test infrastructure is configured"
    echo "✅ Frontend build system is ready"
    echo "✅ Worker deployment is configured"
    echo ""
    echo "🚀 Ready for automated deployments!"
    exit 0
else
    echo -e "${RED}❌ ISSUES FOUND:${NC} $VALIDATION_ERRORS validation errors"
    echo ""
    echo "🔧 Please fix the issues above before enabling automated deployments."
    echo ""
    echo "💡 Common fixes:"
    echo "   - Add missing GitHub secrets in repository settings"
    echo "   - Create missing configuration files"
    echo "   - Install missing dependencies"
    exit 1
fi