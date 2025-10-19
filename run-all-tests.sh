#!/bin/bash

# Master Test Runner for Pitchey Platform
# Runs the most important tests and provides a comprehensive summary
# Based on realistic test results (not wishful thinking)

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Test results storage
declare -a TEST_RESULTS=()

echo "========================================="
echo -e "${CYAN}🎬 PITCHEY PLATFORM MASTER TEST SUITE${NC}"
echo "========================================="
echo ""
echo -e "${BLUE}Starting comprehensive test execution...${NC}"
echo ""

# Function to run a test and capture results
run_test() {
    local test_script=$1
    local test_name=$2
    local priority=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ ! -f "$test_script" ]; then
        echo -e "${YELLOW}⚠️  SKIPPED: $test_name (script not found: $test_script)${NC}"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        TEST_RESULTS+=("SKIP|$test_name|Script not found")
        return
    fi
    
    if [ ! -x "$test_script" ]; then
        chmod +x "$test_script"
    fi
    
    echo -e "${BLUE}Running: $test_name${NC}"
    
    # Run the test and capture exit code
    if timeout 300 bash "$test_script" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("PASS|$test_name|$priority")
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("FAIL|$test_name|$priority")
    fi
}

echo "========================================="
echo -e "${PURPLE}CRITICAL TESTS (Must Pass)${NC}"
echo "========================================="

# Critical Tests - These must pass for basic functionality
run_test "./test-all-portals.sh" "Portal Authentication" "CRITICAL"
run_test "./test-demo-accounts.sh" "Demo Account Validation" "CRITICAL" 
run_test "./test-all-dashboards.sh" "Dashboard Functionality" "CRITICAL"

echo ""
echo "========================================="
echo -e "${PURPLE}HIGH PRIORITY TESTS${NC}"
echo "========================================="

# High Priority Tests - Core features
run_test "./test-pitch-display.sh" "Pitch Display" "HIGH"
run_test "./test-live-portfolio.sh" "Portfolio Management" "HIGH"
run_test "./test-nda-simple.sh" "Basic NDA Functionality" "HIGH"
run_test "./test-complete-integration.sh" "Integration Testing" "HIGH"

echo ""
echo "========================================="
echo -e "${PURPLE}MEDIUM PRIORITY TESTS${NC}"
echo "========================================="

# Medium Priority Tests - Important but not critical
run_test "./test-nda-workflow.sh" "Complete NDA Workflow" "MEDIUM"
run_test "./test-security-demo.sh" "Security Validation" "MEDIUM"
run_test "./test-frontend-workflows.sh" "Frontend Integration" "MEDIUM"
run_test "./test-cors-and-api.sh" "CORS & API Testing" "MEDIUM"

echo ""
echo "========================================="
echo -e "${PURPLE}OPTIONAL TESTS${NC}"
echo "========================================="

# Optional Tests - Nice to have working
run_test "./test-payment-workflows.sh" "Payment Processing" "OPTIONAL"
run_test "./test-messaging-workflows.sh" "Messaging System" "OPTIONAL"
run_test "./test-search-workflows.sh" "Search Functionality" "OPTIONAL"
run_test "./security-scan.sh" "Security Scan" "OPTIONAL"

echo ""
echo "========================================="
echo -e "${CYAN}TEST EXECUTION COMPLETE${NC}"
echo "========================================="

# Calculate percentages
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    FAIL_RATE=$((FAILED_TESTS * 100 / TOTAL_TESTS))
    SKIP_RATE=$((SKIPPED_TESTS * 100 / TOTAL_TESTS))
else
    PASS_RATE=0
    FAIL_RATE=0
    SKIP_RATE=0
fi

echo ""
echo -e "${BLUE}📊 SUMMARY STATISTICS${NC}"
echo "========================================="
echo -e "Total Tests:    ${CYAN}$TOTAL_TESTS${NC}"
echo -e "Passed:         ${GREEN}$PASSED_TESTS ($PASS_RATE%)${NC}"
echo -e "Failed:         ${RED}$FAILED_TESTS ($FAIL_RATE%)${NC}"
echo -e "Skipped:        ${YELLOW}$SKIPPED_TESTS ($SKIP_RATE%)${NC}"
echo ""

# Overall status determination
if [ $PASS_RATE -ge 95 ]; then
    OVERALL_STATUS="${GREEN}EXCELLENT${NC}"
    RECOMMENDATION="Platform ready for production deployment"
elif [ $PASS_RATE -ge 85 ]; then
    OVERALL_STATUS="${YELLOW}GOOD${NC}"
    RECOMMENDATION="Platform ready for staging/testing deployment"
elif [ $PASS_RATE -ge 70 ]; then
    OVERALL_STATUS="${YELLOW}FAIR${NC}"
    RECOMMENDATION="Address failing tests before deployment"
else
    OVERALL_STATUS="${RED}POOR${NC}"
    RECOMMENDATION="DO NOT DEPLOY - Critical issues need resolution"
fi

echo -e "${BLUE}🎯 OVERALL STATUS${NC}"
echo "========================================="
echo -e "Platform Status: $OVERALL_STATUS"
echo -e "Recommendation:  ${CYAN}$RECOMMENDATION${NC}"
echo ""

# Detailed results by priority
echo -e "${BLUE}📋 DETAILED RESULTS BY PRIORITY${NC}"
echo "========================================="

# Critical results
echo -e "${RED}CRITICAL TESTS:${NC}"
for result in "${TEST_RESULTS[@]}"; do
    IFS='|' read -r status name priority <<< "$result"
    if [ "$priority" = "CRITICAL" ]; then
        if [ "$status" = "PASS" ]; then
            echo -e "  ${GREEN}✅ $name${NC}"
        elif [ "$status" = "FAIL" ]; then
            echo -e "  ${RED}❌ $name${NC}"
        else
            echo -e "  ${YELLOW}⚠️  $name${NC}"
        fi
    fi
done

echo ""
echo -e "${YELLOW}HIGH PRIORITY TESTS:${NC}"
for result in "${TEST_RESULTS[@]}"; do
    IFS='|' read -r status name priority <<< "$result"
    if [ "$priority" = "HIGH" ]; then
        if [ "$status" = "PASS" ]; then
            echo -e "  ${GREEN}✅ $name${NC}"
        elif [ "$status" = "FAIL" ]; then
            echo -e "  ${RED}❌ $name${NC}"
        else
            echo -e "  ${YELLOW}⚠️  $name${NC}"
        fi
    fi
done

echo ""
echo -e "${BLUE}📋 FAILED TEST ANALYSIS${NC}"
echo "========================================="

has_failures=false
for result in "${TEST_RESULTS[@]}"; do
    IFS='|' read -r status name priority <<< "$result"
    if [ "$status" = "FAIL" ]; then
        has_failures=true
        echo -e "${RED}❌ $name ($priority priority)${NC}"
        
        # Provide specific guidance for known issues
        case "$name" in
            "Complete NDA Workflow")
                echo "   → Known issue: NDA endpoints may have response structure problems"
                echo "   → Try: Check database schema and API response format"
                ;;
            "Payment Processing")
                echo "   → Known issue: Stripe integration may not be configured"
                echo "   → Try: Verify Stripe API keys and webhook endpoints"
                ;;
            "Messaging System")
                echo "   → Known issue: WebSocket authentication and contact retrieval"
                echo "   → Try: Check WebSocket configuration and message endpoints"
                ;;
            "Frontend Integration")
                echo "   → Known issue: API endpoint mismatches or CORS problems"
                echo "   → Try: Verify frontend API calls match backend endpoints"
                ;;
        esac
        echo ""
    fi
done

if [ "$has_failures" = false ]; then
    echo -e "${GREEN}🎉 No test failures! All executed tests passed.${NC}"
fi

echo ""
echo -e "${BLUE}🚀 NEXT STEPS${NC}"
echo "========================================="

if [ $FAIL_RATE -eq 0 ] && [ $SKIP_RATE -eq 0 ]; then
    echo -e "${GREEN}✨ Perfect test run! Platform is ready for deployment.${NC}"
elif [ $PASS_RATE -ge 90 ]; then
    echo "1. Review failed tests and fix if necessary"
    echo "2. Run individual failed tests for debugging"
    echo "3. Consider deployment with monitoring"
elif [ $PASS_RATE -ge 80 ]; then
    echo "1. Fix failed high-priority tests before deployment"
    echo "2. Investigate skipped tests"
    echo "3. Run comprehensive test suite after fixes"
else
    echo "1. DO NOT DEPLOY until critical issues are resolved"
    echo "2. Focus on CRITICAL and HIGH priority test failures"
    echo "3. Check server logs for detailed error information"
    echo "4. Verify environment setup and dependencies"
fi

echo ""
echo -e "${BLUE}📚 FOR MORE DETAILS${NC}"
echo "========================================="
echo "• Full test documentation: TEST_SUITE.md"
echo "• Individual test scripts: ./test-*.sh"
echo "• Security scan: ./security-scan.sh"
echo "• Environment check: ./test-environment-variables.sh"
echo ""

# Exit with appropriate code
if [ $PASS_RATE -ge 85 ]; then
    echo -e "${GREEN}🎬 Test execution completed successfully!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Test execution completed with issues.${NC}"
    exit 1
fi