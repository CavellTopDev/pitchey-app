#!/bin/bash

# Master Test Runner for All Critical Test Suites
# Runs all high-priority tests and generates a comprehensive report

echo "================================================"
echo "🚀 Running All Critical Test Suites"
echo "================================================"
echo ""
echo "Start Time: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

# Results file
RESULTS_FILE="test_results_$(date +%Y%m%d_%H%M%S).txt"

# Function to run a test suite
run_test_suite() {
    local test_name=$1
    local test_script=$2
    
    echo -e "${BLUE}Running: $test_name${NC}"
    echo "----------------------------------------"
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    
    if [ -f "$test_script" ]; then
        # Run the test and capture output
        if ./"$test_script" > "${test_script%.sh}_output.log" 2>&1; then
            echo -e "${GREEN}✓ $test_name completed successfully${NC}"
            PASSED_SUITES=$((PASSED_SUITES + 1))
            echo "✓ $test_name - PASSED" >> "$RESULTS_FILE"
        else
            echo -e "${RED}✗ $test_name failed or had errors${NC}"
            FAILED_SUITES=$((FAILED_SUITES + 1))
            echo "✗ $test_name - FAILED" >> "$RESULTS_FILE"
        fi
    else
        echo -e "${YELLOW}⚠ $test_name script not found${NC}"
        echo "⚠ $test_name - NOT FOUND" >> "$RESULTS_FILE"
    fi
    echo ""
}

# Header for results file
echo "Critical Test Suite Results - $(date)" > "$RESULTS_FILE"
echo "================================================" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Run all critical test suites
echo -e "${YELLOW}Phase 1: Core Functionality Tests${NC}"
echo "================================================"
run_test_suite "Portal Authentication Tests" "test-all-portals.sh"
run_test_suite "Dashboard Tests" "test-all-dashboards.sh"
run_test_suite "Integration Tests" "test-complete-integration.sh"

echo -e "${YELLOW}Phase 2: Feature-Specific Tests${NC}"
echo "================================================"
run_test_suite "NDA Workflow Tests" "test-nda-workflow-safe.sh"
run_test_suite "Pitch Display Tests" "test-pitch-display.sh"
run_test_suite "Portfolio Tests" "test-live-portfolio.sh"

echo -e "${YELLOW}Phase 3: Critical Security & Payment Tests${NC}"
echo "================================================"
run_test_suite "Payment Processing Tests" "test-payment-workflows.sh"
run_test_suite "Security Tests" "test-security-workflows.sh"

echo -e "${YELLOW}Phase 4: Advanced Feature Tests${NC}"
echo "================================================"
run_test_suite "Messaging System Tests" "test-messaging-workflows.sh"
run_test_suite "File Upload Tests" "test-file-upload-workflows.sh"
run_test_suite "Search Functionality Tests" "test-search-workflows.sh"

# Summary
echo ""
echo "================================================"
echo -e "${BLUE}📊 Test Summary${NC}"
echo "================================================"
echo "Total Test Suites: $TOTAL_SUITES"
echo -e "${GREEN}Passed: $PASSED_SUITES${NC}"
echo -e "${RED}Failed: $FAILED_SUITES${NC}"

# Calculate pass rate
if [ $TOTAL_SUITES -gt 0 ]; then
    PASS_RATE=$((PASSED_SUITES * 100 / TOTAL_SUITES))
    echo "Pass Rate: $PASS_RATE%"
    
    if [ $PASS_RATE -eq 100 ]; then
        echo -e "${GREEN}🎉 All tests passed! System ready for production.${NC}"
    elif [ $PASS_RATE -ge 80 ]; then
        echo -e "${YELLOW}⚠️ Most tests passed. Review failures before deployment.${NC}"
    else
        echo -e "${RED}❌ Critical failures detected. Fix issues before deployment.${NC}"
    fi
fi

echo ""
echo "End Time: $(date)"
echo "Results saved to: $RESULTS_FILE"
echo "Individual test outputs saved to: *_output.log files"
echo ""

# Append summary to results file
echo "" >> "$RESULTS_FILE"
echo "Summary:" >> "$RESULTS_FILE"
echo "Total: $TOTAL_SUITES, Passed: $PASSED_SUITES, Failed: $FAILED_SUITES" >> "$RESULTS_FILE"

exit $FAILED_SUITES