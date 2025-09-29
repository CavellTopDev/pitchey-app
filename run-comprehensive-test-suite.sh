#!/bin/bash

# Comprehensive Test Suite Runner for Pitchey v0.2
# Executes all critical test suites for complete platform validation

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test results tracking
declare -A TEST_RESULTS
declare -A TEST_DURATIONS
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0

# Helper functions
log_header() {
    echo ""
    echo -e "${CYAN}================================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================================================${NC}"
    echo ""
}

log_section() {
    echo ""
    echo -e "${PURPLE}>>> $1${NC}"
    echo ""
}

log_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

log_running() {
    echo -e "${BLUE}🔄 $1${NC}"
}

# Function to run a test suite and capture results
run_test_suite() {
    local test_name="$1"
    local test_script="$2"
    local description="$3"
    
    ((TOTAL_SUITES++))
    
    log_section "Running: $test_name"
    log_info "Description: $description"
    log_info "Script: $test_script"
    
    if [[ ! -f "$test_script" ]]; then
        log_fail "Test script not found: $test_script"
        TEST_RESULTS["$test_name"]="MISSING"
        TEST_DURATIONS["$test_name"]="0"
        ((FAILED_SUITES++))
        return 1
    fi
    
    if [[ ! -x "$test_script" ]]; then
        log_fail "Test script not executable: $test_script"
        TEST_RESULTS["$test_name"]="NOT_EXECUTABLE"
        TEST_DURATIONS["$test_name"]="0"
        ((FAILED_SUITES++))
        return 1
    fi
    
    log_running "Executing $test_name..."
    
    local start_time=$(date +%s)
    local output_file="/tmp/pitchey_test_${test_name}_output.log"
    
    # Run the test and capture exit code
    if timeout 1800 "$test_script" > "$output_file" 2>&1; then
        local exit_code=0
    else
        local exit_code=$?
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    TEST_DURATIONS["$test_name"]="$duration"
    
    if [[ $exit_code -eq 0 ]]; then
        log_pass "$test_name completed successfully (${duration}s)"
        TEST_RESULTS["$test_name"]="PASSED"
        ((PASSED_SUITES++))
    else
        log_fail "$test_name failed with exit code $exit_code (${duration}s)"
        TEST_RESULTS["$test_name"]="FAILED"
        ((FAILED_SUITES++))
        
        # Show last few lines of output for debugging
        echo ""
        echo -e "${YELLOW}Last 10 lines of output:${NC}"
        tail -n 10 "$output_file" 2>/dev/null || echo "No output captured"
        echo ""
    fi
    
    # Keep output files for review
    mv "$output_file" "/tmp/pitchey_test_${test_name}_$(date +%Y%m%d_%H%M%S).log"
    
    return $exit_code
}

# Function to display final summary
show_final_summary() {
    log_header "COMPREHENSIVE TEST SUITE RESULTS"
    
    echo -e "${BLUE}Test Suite Summary:${NC}"
    echo -e "${GREEN}✅ Passed: $PASSED_SUITES${NC}"
    echo -e "${RED}❌ Failed: $FAILED_SUITES${NC}"
    echo -e "${YELLOW}📊 Total: $TOTAL_SUITES${NC}"
    
    if [[ $TOTAL_SUITES -gt 0 ]]; then
        local success_rate=$(( (PASSED_SUITES * 100) / TOTAL_SUITES ))
        echo -e "${BLUE}🎯 Success Rate: ${success_rate}%${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Detailed Results:${NC}"
    echo "----------------------------------------"
    
    local total_duration=0
    
    for test_name in "${!TEST_RESULTS[@]}"; do
        local result="${TEST_RESULTS[$test_name]}"
        local duration="${TEST_DURATIONS[$test_name]}"
        total_duration=$((total_duration + duration))
        
        case "$result" in
            "PASSED")
                echo -e "${GREEN}✅ $test_name${NC} (${duration}s)"
                ;;
            "FAILED")
                echo -e "${RED}❌ $test_name${NC} (${duration}s)"
                ;;
            "MISSING")
                echo -e "${RED}🚫 $test_name${NC} (script not found)"
                ;;
            "NOT_EXECUTABLE")
                echo -e "${RED}🔒 $test_name${NC} (not executable)"
                ;;
        esac
    done
    
    echo "----------------------------------------"
    echo -e "${BLUE}Total Execution Time: ${total_duration}s ($(( total_duration / 60 ))m $(( total_duration % 60 ))s)${NC}"
    
    echo ""
    echo -e "${BLUE}Test Coverage Analysis:${NC}"
    echo -e "  • End-to-End User Journeys: Complete user workflows tested"
    echo -e "  • Performance & Load Testing: System performance under stress"
    echo -e "  • Investment & Financial Tracking: Financial calculations and tracking"
    echo -e "  • Production Company Features: Production workflow management"
    echo -e "  • Mobile & Responsive Testing: Cross-device compatibility"
    
    echo ""
    if [[ $FAILED_SUITES -eq 0 ]]; then
        echo -e "${GREEN}🌟 EXCELLENT: All comprehensive test suites passed!${NC}"
        echo -e "${GREEN}   The Pitchey platform is ready for production deployment.${NC}"
    elif [[ $PASSED_SUITES -gt $FAILED_SUITES ]]; then
        echo -e "${YELLOW}⚠️  GOOD: Most test suites passed, but some issues detected.${NC}"
        echo -e "${YELLOW}   Review failed tests before production deployment.${NC}"
    else
        echo -e "${RED}🚨 CRITICAL: Multiple test suites failed!${NC}"
        echo -e "${RED}   Significant issues detected - do not deploy to production.${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    if [[ $FAILED_SUITES -gt 0 ]]; then
        echo -e "  1. Review failed test logs in /tmp/pitchey_test_*.log"
        echo -e "  2. Fix identified issues"
        echo -e "  3. Re-run specific failed test suites"
        echo -e "  4. Run complete suite again before deployment"
    else
        echo -e "  1. Platform is ready for production deployment"
        echo -e "  2. Consider setting up automated testing in CI/CD"
        echo -e "  3. Monitor production metrics post-deployment"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    local prereq_failed=0
    
    # Check API server
    if curl -s "http://localhost:8001/api/health" > /dev/null 2>&1; then
        log_pass "API server is running on port 8001"
    else
        log_fail "API server is not accessible on port 8001"
        ((prereq_failed++))
    fi
    
    # Check frontend server
    if curl -s "http://localhost:5173" > /dev/null 2>&1; then
        log_pass "Frontend server is running on port 5173"
    else
        log_info "Frontend server not detected on port 5173 (some tests may be skipped)"
    fi
    
    # Check database connectivity
    if PGPASSWORD=password psql -h localhost -U postgres -d pitchey -c "SELECT 1;" > /dev/null 2>&1; then
        log_pass "Database connection successful"
    else
        log_fail "Database connection failed"
        ((prereq_failed++))
    fi
    
    # Check required utilities
    for util in curl jq bc; do
        if command -v "$util" > /dev/null 2>&1; then
            log_pass "$util is available"
        else
            log_fail "$util is not available"
            ((prereq_failed++))
        fi
    done
    
    if [[ $prereq_failed -gt 0 ]]; then
        log_fail "$prereq_failed prerequisite checks failed"
        echo ""
        echo -e "${RED}Please resolve the above issues before running the test suite.${NC}"
        echo ""
        echo -e "${YELLOW}Common solutions:${NC}"
        echo -e "  • Start the API server: ./start-dev.sh"
        echo -e "  • Start the frontend: cd frontend && npm run dev"
        echo -e "  • Check database: docker-compose up -d postgres"
        echo -e "  • Install utilities: sudo apt-get install curl jq bc"
        return 1
    fi
    
    log_pass "All prerequisites satisfied"
    return 0
}

# Main execution
main() {
    log_header "PITCHEY V0.2 COMPREHENSIVE TEST SUITE"
    
    echo -e "${BLUE}This suite will run all critical test suites to validate the complete platform.${NC}"
    echo -e "${BLUE}Expected runtime: 15-30 minutes depending on system performance.${NC}"
    echo ""
    
    # Check prerequisites first
    if ! check_prerequisites; then
        exit 1
    fi
    
    echo ""
    log_info "Starting comprehensive test execution..."
    echo ""
    
    # Run all test suites
    run_test_suite "E2E_User_Journeys" \
                   "./test-e2e-user-journeys.sh" \
                   "Complete end-to-end user workflows for creators, investors, and production companies"
    
    run_test_suite "Performance_Load_Testing" \
                   "./test-performance-load.sh" \
                   "API performance, database queries, concurrent users, and stress testing"
    
    run_test_suite "Investment_Tracking" \
                   "./test-investment-tracking.sh" \
                   "ROI calculations, portfolio management, returns tracking, and financial reporting"
    
    run_test_suite "Production_Company_Features" \
                   "./test-production-company-features.sh" \
                   "Project creation, deal management, talent scouting, and production workflows"
    
    run_test_suite "Mobile_Responsive_Testing" \
                   "./test-mobile-responsive.sh" \
                   "Viewport testing, touch interactions, mobile performance, and cross-device compatibility"
    
    # Show final results
    show_final_summary
    
    # Exit with appropriate code
    if [[ $FAILED_SUITES -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Handle script interruption
trap 'echo -e "\n${RED}Test suite interrupted by user${NC}"; exit 130' INT TERM

# Show usage if requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Pitchey v0.2 Comprehensive Test Suite Runner"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "This script runs all critical test suites:"
    echo "  • E2E User Journeys"
    echo "  • Performance & Load Testing"
    echo "  • Investment & Financial Tracking"
    echo "  • Production Company Features"
    echo "  • Mobile & Responsive Testing"
    echo ""
    echo "Prerequisites:"
    echo "  • API server running on port 8001"
    echo "  • Frontend server running on port 5173 (optional)"
    echo "  • PostgreSQL database accessible"
    echo "  • Required utilities: curl, jq, bc"
    echo ""
    echo "Expected runtime: 15-30 minutes"
    echo ""
    exit 0
fi

# Run main function
main "$@"