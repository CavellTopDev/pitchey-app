#!/bin/bash

# Verification script for codebase cleanup
# Ensures all critical components are in place after cleanup

set -e

echo "==========================================="
echo "    Codebase Cleanup Verification         "
echo "==========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0
WARNINGS=0

# Function to check if file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $description${NC}"
        echo "   Found: $file"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ $description${NC}"
        echo "   Missing: $file"
        FAILED=$((FAILED + 1))
    fi
}

# Function to check if directory exists
check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅ $description${NC}"
        echo "   Found: $dir"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ $description${NC}"
        echo "   Missing: $dir"
        FAILED=$((FAILED + 1))
    fi
}

# Function to check deprecated files moved
check_deprecated() {
    local pattern=$1
    local description=$2
    
    # Count files matching pattern in src/
    local src_count=$(find src/ -maxdepth 1 -name "$pattern" 2>/dev/null | wc -l)
    # Count files in deprecated/
    local dep_count=$(find deprecated/ -name "$pattern" 2>/dev/null | wc -l)
    
    if [ $src_count -eq 0 ] && [ $dep_count -gt 0 ]; then
        echo -e "${GREEN}✅ $description${NC}"
        echo "   Moved $dep_count files to deprecated/"
        PASSED=$((PASSED + 1))
    elif [ $src_count -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $description${NC}"
        echo "   Still $src_count files in src/ that should be moved"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✅ $description${NC}"
        echo "   No files to move"
        PASSED=$((PASSED + 1))
    fi
}

echo -e "${BLUE}1. Checking Core Better Auth Files...${NC}"
check_file "src/auth/better-auth-config.ts" "Better Auth configuration"
check_file "src/auth/auth-worker.ts" "Auth worker service"
check_file "src/auth/middleware/better-auth-middleware.ts" "Better Auth middleware"
check_dir "src/auth" "Auth directory structure"
echo ""

echo -e "${BLUE}2. Checking Main Worker Files...${NC}"
check_file "src/worker-better-auth-production.ts" "Production Better Auth worker"
check_file "wrangler.toml" "Wrangler configuration"

# Check wrangler.toml points to correct worker
if grep -q "worker-better-auth-production.ts" wrangler.toml 2>/dev/null; then
    echo -e "${GREEN}✅ Wrangler configured for Better Auth worker${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ Wrangler not configured for Better Auth worker${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

echo -e "${BLUE}3. Checking Deprecated Files Moved...${NC}"
check_deprecated "worker-*.ts" "Old worker files moved to deprecated"
check_dir "deprecated/worker-files" "Deprecated worker directory"
check_dir "deprecated/auth-legacy" "Legacy auth directory"
echo ""

echo -e "${BLUE}4. Checking Documentation...${NC}"
check_file "BETTER_AUTH_IMPLEMENTATION.md" "Better Auth implementation guide"
check_file "CODEBASE_CLEANUP_SUMMARY.md" "Cleanup summary"
check_file "MIGRATION_GUIDE.md" "Migration guide"
check_file "BETTER_AUTH_DEPLOYMENT_CHECKLIST.md" "Deployment checklist"
echo ""

echo -e "${BLUE}5. Checking Database Files...${NC}"
check_file "src/db/neon-connection.ts" "Neon database connection"
check_file "src/db/queries.ts" "Database queries"
check_file "scripts/setup-better-auth.ts" "Better Auth setup script"
echo ""

echo -e "${BLUE}6. Checking Test Scripts...${NC}"
check_file "test-better-auth.sh" "Better Auth test script"
check_file "monitoring-dashboard.sh" "Monitoring dashboard"
check_file "test-all-endpoints.sh" "Endpoint test script"
echo ""

echo -e "${BLUE}7. Checking Package Configuration...${NC}"
if [ -f "package.json" ]; then
    if grep -q "better-auth" package.json 2>/dev/null; then
        echo -e "${GREEN}✅ Better Auth in package.json${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}⚠️  Better Auth not in package.json (needs npm install)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

if [ -f "deno.json" ]; then
    if grep -q "@neondatabase/serverless" deno.json 2>/dev/null; then
        echo -e "${GREEN}✅ Neon serverless in deno.json${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}⚠️  Neon serverless not in deno.json (run deno add)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

echo "==========================================="
echo "              Verification Summary         "
echo "==========================================="
echo ""

echo -e "Checks Passed: ${GREEN}$PASSED${NC}"
echo -e "Checks Failed: ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ CLEANUP VERIFICATION PASSED${NC}"
    echo ""
    echo "The codebase has been successfully cleaned up and organized."
    echo "All critical files are in place for Better Auth deployment."
    
    if [ $WARNINGS -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}Note: There are $WARNINGS warnings that should be addressed.${NC}"
        echo "These are non-critical but recommended for full compliance."
    fi
else
    echo -e "${RED}❌ CLEANUP VERIFICATION FAILED${NC}"
    echo ""
    echo "Some critical files are missing. Please check the output above."
    echo "You may need to run the cleanup scripts or restore missing files."
fi

echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Install Better Auth dependencies: npm install better-auth"
echo "2. Set Cloudflare secrets: wrangler secret put BETTER_AUTH_SECRET"
echo "3. Deploy worker: wrangler deploy"
echo "4. Test authentication: ./test-better-auth.sh"
echo ""
echo "Verification completed at: $(date)"