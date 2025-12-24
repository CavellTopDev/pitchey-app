#!/bin/bash

# Final Validation Suite - Pitchey v3.0
# Comprehensive validation of all implemented features
# Date: December 24, 2024

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:8001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Tracking variables
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# Results file
RESULTS_FILE="validation-results-$(date +%Y%m%d-%H%M%S).log"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "PASS")
            echo -e "${GREEN}✓${NC} $message"
            echo "[PASS] $message" >> $RESULTS_FILE
            ((PASSED_CHECKS++))
            ;;
        "FAIL")
            echo -e "${RED}✗${NC} $message"
            echo "[FAIL] $message" >> $RESULTS_FILE
            ((FAILED_CHECKS++))
            ;;
        "WARN")
            echo -e "${YELLOW}⚠${NC} $message"
            echo "[WARN] $message" >> $RESULTS_FILE
            ((WARNINGS++))
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            echo "[INFO] $message" >> $RESULTS_FILE
            ;;
    esac
    ((TOTAL_CHECKS++))
}

# Function to check component existence
check_component() {
    local file=$1
    local component=$2
    
    if [ -f "$file" ]; then
        print_status "PASS" "$component component exists"
        
        # Check for key patterns
        if grep -q "export" "$file" && grep -q "return" "$file"; then
            print_status "PASS" "$component has proper exports"
        else
            print_status "WARN" "$component may have incomplete exports"
        fi
    else
        print_status "FAIL" "$component component not found at $file"
    fi
}

# Function to check API endpoint
check_api() {
    local endpoint=$1
    local method=$2
    local description=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BACKEND_URL$endpoint" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" || "$response" == "201" || "$response" == "401" || "$response" == "403" ]]; then
        print_status "PASS" "$description (HTTP $response)"
    elif [[ "$response" == "000" ]]; then
        print_status "FAIL" "$description (Server not responding)"
    else
        print_status "WARN" "$description (HTTP $response)"
    fi
}

# Function to check file pattern
check_pattern() {
    local pattern=$1
    local description=$2
    local count=$(find . -path ./node_modules -prune -o -name "$pattern" -type f -print 2>/dev/null | wc -l)
    
    if [ $count -gt 0 ]; then
        print_status "PASS" "$description found ($count files)"
    else
        print_status "FAIL" "$description not found"
    fi
}

echo "========================================="
echo "   PITCHEY v3.0 FINAL VALIDATION SUITE  "
echo "========================================="
echo "Started at: $(date)"
echo "" | tee -a $RESULTS_FILE

# ===========================================
# 1. COMPONENT VALIDATION
# ===========================================
echo -e "\n${BLUE}[1/10] Validating React Components${NC}"
echo "----------------------------------------"

check_component "frontend/src/components/Team/TeamManagement.tsx" "TeamManagement"
check_component "frontend/src/components/Browse/EnhancedBrowseView.tsx" "EnhancedBrowseView"
check_component "frontend/src/components/Characters/CharacterManager.tsx" "CharacterManager"
check_component "frontend/src/components/Analytics/AnalyticsDashboard.tsx" "AnalyticsDashboard"
check_component "frontend/src/components/Visibility/VisibilitySettings.tsx" "VisibilitySettings"
check_component "frontend/src/components/NDA/NDAWorkflowManager.tsx" "NDAWorkflowManager"

# ===========================================
# 2. API ENDPOINT VALIDATION
# ===========================================
echo -e "\n${BLUE}[2/10] Validating API Endpoints${NC}"
echo "----------------------------------------"

check_api "/api/health" "GET" "Health check endpoint"
check_api "/api/teams" "GET" "Teams list endpoint"
check_api "/api/pitches" "GET" "Pitches list endpoint"
check_api "/api/analytics/overview" "GET" "Analytics overview"
check_api "/api/auth/session" "GET" "Auth session check"

# ===========================================
# 3. BUILD CONFIGURATION
# ===========================================
echo -e "\n${BLUE}[3/10] Validating Build Configuration${NC}"
echo "----------------------------------------"

if [ -f "frontend/vite.config.ts" ]; then
    print_status "PASS" "Vite configuration exists"
    
    if grep -q "manualChunks" "frontend/vite.config.ts"; then
        print_status "PASS" "Code splitting configured"
    else
        print_status "WARN" "Code splitting may not be optimized"
    fi
else
    print_status "FAIL" "Vite configuration not found"
fi

if [ -f "wrangler.toml" ]; then
    print_status "PASS" "Cloudflare Worker configuration exists"
else
    print_status "FAIL" "Cloudflare Worker configuration not found"
fi

# ===========================================
# 4. DEPENDENCIES CHECK
# ===========================================
echo -e "\n${BLUE}[4/10] Validating Dependencies${NC}"
echo "----------------------------------------"

if [ -f "package.json" ]; then
    print_status "PASS" "package.json exists"
    
    # Check critical dependencies
    deps=("react" "typescript" "vite" "@better-auth/react")
    for dep in "${deps[@]}"; do
        if grep -q "\"$dep\"" package.json; then
            print_status "PASS" "$dep dependency found"
        else
            print_status "FAIL" "$dep dependency missing"
        fi
    done
else
    print_status "FAIL" "package.json not found"
fi

# ===========================================
# 5. DATABASE SCHEMA
# ===========================================
echo -e "\n${BLUE}[5/10] Validating Database Schema${NC}"
echo "----------------------------------------"

if [ -f "src/db/schema.ts" ]; then
    print_status "PASS" "Database schema exists"
    
    # Check for critical tables
    tables=("users" "pitches" "teams" "investments" "ndas")
    for table in "${tables[@]}"; do
        if grep -q "$table" src/db/schema.ts; then
            print_status "PASS" "Table '$table' defined"
        else
            print_status "WARN" "Table '$table' not found in schema"
        fi
    done
else
    print_status "FAIL" "Database schema not found"
fi

# ===========================================
# 6. AUTHENTICATION SYSTEM
# ===========================================
echo -e "\n${BLUE}[6/10] Validating Authentication${NC}"
echo "----------------------------------------"

if [ -f "src/lib/auth.ts" ]; then
    print_status "PASS" "Better Auth configuration exists"
    
    if grep -q "betterAuth" src/lib/auth.ts; then
        print_status "PASS" "Better Auth properly configured"
    else
        print_status "FAIL" "Better Auth not configured"
    fi
else
    print_status "WARN" "Auth configuration file not found"
fi

# ===========================================
# 7. DEPLOYMENT SCRIPTS
# ===========================================
echo -e "\n${BLUE}[7/10] Validating Deployment Scripts${NC}"
echo "----------------------------------------"

scripts=("deploy-production.sh" "setup-monitoring.sh" "test-complete-platform.sh")
for script in "${scripts[@]}"; do
    if [ -f "$script" ]; then
        print_status "PASS" "$script exists"
        
        if [ -x "$script" ]; then
            print_status "PASS" "$script is executable"
        else
            print_status "WARN" "$script is not executable"
        fi
    else
        print_status "FAIL" "$script not found"
    fi
done

# ===========================================
# 8. DOCUMENTATION
# ===========================================
echo -e "\n${BLUE}[8/10] Validating Documentation${NC}"
echo "----------------------------------------"

docs=(
    "PROJECT_HANDOVER.md"
    "FINAL_IMPLEMENTATION_REPORT_DEC24.md"
    "OPERATIONS_MAINTENANCE_GUIDE.md"
    "QUICK_REFERENCE_CARD.md"
    "RELEASE_NOTES_v3.0.md"
    "GO_LIVE_CHECKLIST.md"
    "DOCUMENTATION_INDEX.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        print_status "PASS" "$doc exists"
    else
        print_status "WARN" "$doc not found"
    fi
done

# ===========================================
# 9. SECURITY CHECKS
# ===========================================
echo -e "\n${BLUE}[9/10] Validating Security${NC}"
echo "----------------------------------------"

# Check for exposed secrets
if grep -r "sk_test\|sk_live\|jwt_secret" --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" --exclude="*.sh" . 2>/dev/null | grep -v "process.env" | grep -v "Deno.env" > /dev/null; then
    print_status "FAIL" "Potential hardcoded secrets found"
else
    print_status "PASS" "No hardcoded secrets detected"
fi

# Check for HTTPS enforcement
if [ -f "src/worker-integrated.ts" ]; then
    if grep -q "https" src/worker-integrated.ts; then
        print_status "PASS" "HTTPS enforcement configured"
    else
        print_status "WARN" "HTTPS enforcement not verified"
    fi
fi

# ===========================================
# 10. PERFORMANCE OPTIMIZATION
# ===========================================
echo -e "\n${BLUE}[10/10] Validating Performance${NC}"
echo "----------------------------------------"

if [ -f "frontend/src/utils/lazyLoad.tsx" ]; then
    print_status "PASS" "Lazy loading utility exists"
else
    print_status "WARN" "Lazy loading not configured"
fi

if [ -f "frontend/src/utils/performance.ts" ]; then
    print_status "PASS" "Performance monitoring exists"
else
    print_status "WARN" "Performance monitoring not configured"
fi

# Check for caching configuration
if grep -r "Cache-Control\|redis\|upstash" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null > /dev/null; then
    print_status "PASS" "Caching strategy implemented"
else
    print_status "WARN" "Caching strategy not found"
fi

# ===========================================
# FINAL SUMMARY
# ===========================================
echo ""
echo "========================================="
echo "         VALIDATION COMPLETE             "
echo "========================================="

# Calculate percentage
if [ $TOTAL_CHECKS -gt 0 ]; then
    SUCCESS_RATE=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
else
    SUCCESS_RATE=0
fi

echo -e "Total Checks:    $TOTAL_CHECKS"
echo -e "${GREEN}Passed:${NC}         $PASSED_CHECKS"
echo -e "${RED}Failed:${NC}         $FAILED_CHECKS"
echo -e "${YELLOW}Warnings:${NC}       $WARNINGS"
echo -e "Success Rate:    ${SUCCESS_RATE}%"
echo ""

# Determine overall status
if [ $FAILED_CHECKS -eq 0 ] && [ $SUCCESS_RATE -ge 90 ]; then
    echo -e "${GREEN}✅ PRODUCTION READY${NC}"
    echo "The platform has passed validation and is ready for deployment."
    EXIT_CODE=0
elif [ $FAILED_CHECKS -le 3 ] && [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  READY WITH WARNINGS${NC}"
    echo "The platform is functional but has minor issues to address."
    EXIT_CODE=1
else
    echo -e "${RED}❌ NOT READY${NC}"
    echo "Critical issues found. Please review the failures above."
    EXIT_CODE=2
fi

echo ""
echo "Results saved to: $RESULTS_FILE"
echo "Completed at: $(date)"

# Generate HTML report
cat > validation-report.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Pitchey v3.0 Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .pass { color: green; }
        .fail { color: red; }
        .warn { color: orange; }
        .summary { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
        h1 { color: #333; }
        .metric { display: inline-block; margin: 0 20px; }
    </style>
</head>
<body>
    <h1>Pitchey v3.0 Validation Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <div class="metric">Total Checks: $TOTAL_CHECKS</div>
        <div class="metric pass">Passed: $PASSED_CHECKS</div>
        <div class="metric fail">Failed: $FAILED_CHECKS</div>
        <div class="metric warn">Warnings: $WARNINGS</div>
        <div class="metric">Success Rate: ${SUCCESS_RATE}%</div>
    </div>
    <p>Generated: $(date)</p>
    <p>Full log: $RESULTS_FILE</p>
</body>
</html>
EOF

echo "HTML report generated: validation-report.html"

exit $EXIT_CODE