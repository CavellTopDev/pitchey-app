#!/bin/bash

# Master Test Runner for Pitchey Production Deployment
# Runs all production tests and provides comprehensive reporting
#
# Usage: ./run-all-production-tests.sh [--quick] [--nda-only] [--no-color]

set -e

# Configuration
BACKEND_URL="https://pitchey-backend.deno.dev"
FRONTEND_URL="https://pitchey-frontend.deno.dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse command line arguments
QUICK_MODE=false
NDA_ONLY=false
NO_COLOR=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --nda-only)
            NDA_ONLY=true
            shift
            ;;
        --no-color)
            NO_COLOR=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--quick] [--nda-only] [--no-color]"
            echo "  --quick     Run only essential tests (faster execution)"
            echo "  --nda-only  Run only NDA workflow tests"  
            echo "  --no-color  Disable colored output"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Color setup
if [ "$NO_COLOR" = "false" ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    MAGENTA=''
    CYAN=''
    BOLD=''
    NC=''
fi

# Logging functions
log() {
    echo -e "${2:-$NC}$1${NC}"
}

log_header() {
    echo
    log "$(printf '=%.0s' {1..60})" "$CYAN"
    log "$1" "${BOLD}${CYAN}"
    log "$(printf '=%.0s' {1..60})" "$CYAN"
    echo
}

log_section() {
    echo
    log "$(printf '-%.0s' {1..40})" "$BLUE"
    log "$1" "${BOLD}${BLUE}"
    log "$(printf '-%.0s' {1..40})" "$BLUE"
}

# Test tracking
declare -A test_results
test_suite_count=0
passed_suites=0
failed_suites=0

run_test_suite() {
    local name="$1"
    local command="$2"
    local description="$3"
    
    ((test_suite_count++))
    
    log_section "Running: $name"
    log "$description" "$CYAN"
    echo
    
    local start_time=$(date +%s)
    local exit_code=0
    
    # Run the test and capture output
    if eval "$command"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        test_results["$name"]="${GREEN}✅ PASSED${NC} (${duration}s)"
        ((passed_suites++))
        log "${GREEN}✅ $name completed successfully in ${duration}s${NC}"
    else
        exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        test_results["$name"]="${RED}❌ FAILED${NC} (${duration}s, exit code: $exit_code)"
        ((failed_suites++))
        log "${RED}❌ $name failed after ${duration}s (exit code: $exit_code)${NC}"
    fi
    
    echo
    log "$(printf '-%.0s' {1..40})" "$BLUE"
}

# Pre-flight checks
preflight_checks() {
    log_header "🚀 PRE-FLIGHT CHECKS"
    
    log "Checking dependencies..."
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log "${RED}❌ curl is required but not installed${NC}"
        exit 1
    else
        log "${GREEN}✓ curl available${NC}"
    fi
    
    # Check if python3 is available (for JSON parsing)
    if ! command -v python3 &> /dev/null; then
        log "${YELLOW}⚠️  python3 not available - JSON parsing will be limited${NC}"
    else
        log "${GREEN}✓ python3 available${NC}"
    fi
    
    # Check if jq is available (alternative JSON processor)
    if ! command -v jq &> /dev/null; then
        log "${YELLOW}⚠️  jq not available - using python3 for JSON parsing${NC}"
    else
        log "${GREEN}✓ jq available${NC}"
    fi
    
    # Check internet connectivity
    log "Checking connectivity to production servers..."
    
    if curl -s --connect-timeout 10 --head "$FRONTEND_URL" > /dev/null; then
        log "${GREEN}✓ Frontend accessible: $FRONTEND_URL${NC}"
    else
        log "${RED}❌ Frontend not accessible: $FRONTEND_URL${NC}"
        log "${RED}Cannot proceed without frontend connectivity${NC}"
        exit 1
    fi
    
    if curl -s --connect-timeout 10 --head "$BACKEND_URL/api/pitches" > /dev/null; then
        log "${GREEN}✓ Backend API accessible: $BACKEND_URL${NC}"
    else
        log "${RED}❌ Backend API not accessible: $BACKEND_URL${NC}"
        log "${RED}Cannot proceed without backend connectivity${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ All pre-flight checks passed!${NC}"
}

# Main test execution
main() {
    local start_time=$(date +%s)
    
    log "${BOLD}${MAGENTA}"
    cat << "EOF"
 ______ _____ _______ _____ _    _ _______ __   __
 |     \|     |       |       |  |  |______   \_/  
 |_____/|_____|_______|_____ |_____|______     |   
                                                   
 PRODUCTION TEST SUITE
EOF
    log "${NC}"
    
    log "${CYAN}Testing production deployment at:${NC}"
    log "  Frontend: ${BOLD}$FRONTEND_URL${NC}"
    log "  Backend:  ${BOLD}$BACKEND_URL${NC}"
    
    if [ "$QUICK_MODE" = "true" ]; then
        log "${YELLOW}⚡ Running in QUICK MODE (essential tests only)${NC}"
    fi
    
    if [ "$NDA_ONLY" = "true" ]; then
        log "${YELLOW}🔍 Running NDA WORKFLOW TESTS ONLY${NC}"
    fi
    
    echo
    
    # Pre-flight checks
    preflight_checks
    
    # Run test suites based on mode
    if [ "$NDA_ONLY" = "true" ]; then
        # Only run NDA tests
        run_test_suite \
            "NDA Workflow Tests" \
            "$SCRIPT_DIR/test-nda-workflow-production.sh" \
            "Comprehensive testing of the recently fixed NDA request functionality"
            
    elif [ "$QUICK_MODE" = "true" ]; then
        # Quick mode - essential tests only
        run_test_suite \
            "Authentication & Core API" \
            "$SCRIPT_DIR/production-test-curl.sh" \
            "Essential authentication and API functionality tests"
            
        run_test_suite \
            "NDA Workflow (Recent Fix)" \
            "$SCRIPT_DIR/test-nda-workflow-production.sh" \
            "Testing the recently fixed NDA request workflow"
            
    else
        # Full test suite
        run_test_suite \
            "Complete Production Tests (cURL)" \
            "$SCRIPT_DIR/production-test-curl.sh" \
            "Comprehensive curl-based testing of all production workflows"
        
        # Only run Node.js tests if Node.js is available
        if command -v node &> /dev/null; then
            run_test_suite \
                "Complete Production Tests (Node.js)" \
                "cd '$SCRIPT_DIR' && npm install --silent node-fetch 2>/dev/null || true && node production-test-suite.js" \
                "Advanced Node.js-based testing with detailed analysis"
        else
            log "${YELLOW}⚠️  Skipping Node.js tests (Node.js not available)${NC}"
        fi
        
        run_test_suite \
            "NDA Workflow Deep Dive" \
            "$SCRIPT_DIR/test-nda-workflow-production.sh" \
            "Specialized testing of the recently fixed NDA request functionality"
    fi
    
    # Final summary and recommendations
    show_final_summary "$start_time"
}

show_final_summary() {
    local start_time="$1"
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    local hours=$((total_duration / 3600))
    local minutes=$(((total_duration % 3600) / 60))
    local seconds=$((total_duration % 60))
    
    log_header "📊 FINAL TEST SUMMARY"
    
    # Duration formatting
    local duration_str=""
    if [ $hours -gt 0 ]; then
        duration_str="${hours}h ${minutes}m ${seconds}s"
    elif [ $minutes -gt 0 ]; then
        duration_str="${minutes}m ${seconds}s"  
    else
        duration_str="${seconds}s"
    fi
    
    log "${BOLD}Test Execution Summary:${NC}"
    log "  Total Test Suites: $test_suite_count"
    log "  Passed: ${GREEN}$passed_suites${NC}"
    log "  Failed: ${RED}$failed_suites${NC}"
    log "  Duration: $duration_str"
    echo
    
    # Individual results
    log "${BOLD}Individual Test Results:${NC}"
    for suite_name in "${!test_results[@]}"; do
        log "  $suite_name: ${test_results[$suite_name]}"
    done
    echo
    
    # Overall assessment
    local success_rate=0
    if [ $test_suite_count -gt 0 ]; then
        success_rate=$((passed_suites * 100 / test_suite_count))
    fi
    
    log "${BOLD}Overall Assessment:${NC}"
    log "  Success Rate: $success_rate%"
    
    if [ $failed_suites -eq 0 ]; then
        log "  Status: ${GREEN}${BOLD}🎉 ALL TESTS PASSED!${NC}"
        log "  ${GREEN}Production deployment is working perfectly.${NC}"
        log "  ${GREEN}All critical workflows are functional.${NC}"
    elif [ $success_rate -ge 80 ]; then
        log "  Status: ${YELLOW}${BOLD}⚠️  MOSTLY SUCCESSFUL${NC}"
        log "  ${YELLOW}Production deployment is largely working.${NC}"
        log "  ${YELLOW}Minor issues detected - consider investigating failed tests.${NC}"
    elif [ $success_rate -ge 50 ]; then
        log "  Status: ${YELLOW}${BOLD}⚠️  PARTIAL SUCCESS${NC}"
        log "  ${YELLOW}Some core functionality is working.${NC}"
        log "  ${YELLOW}Moderate issues detected - review and fix failed tests.${NC}"
    else
        log "  Status: ${RED}${BOLD}🚨 CRITICAL ISSUES${NC}"
        log "  ${RED}Significant problems with production deployment.${NC}"
        log "  ${RED}Immediate attention required for failed test suites.${NC}"
    fi
    
    echo
    log "${BOLD}Recommendations:${NC}"
    
    if [ $failed_suites -eq 0 ]; then
        log "  ${GREEN}✅ Production deployment verified and ready for use${NC}"
        log "  ${GREEN}✅ All user workflows are functional${NC}"
        log "  ${GREEN}✅ NDA request fix has been verified as working${NC}"
    else
        log "  ${RED}🔍 Investigate failed test suites above${NC}"
        log "  ${YELLOW}📝 Check server logs for detailed error information${NC}"
        log "  ${YELLOW}🔄 Consider re-running failed tests individually${NC}"
        
        if [[ "${!test_results[*]}" =~ "NDA Workflow" ]]; then
            if [[ "${test_results["NDA Workflow Tests"]}" =~ "FAILED" ]] || [[ "${test_results["NDA Workflow Deep Dive"]}" =~ "FAILED" ]]; then
                log "  ${RED}❗ NDA workflow issues detected - the recent fix may need attention${NC}"
            else
                log "  ${GREEN}✅ NDA workflow fix verified as working correctly${NC}"
            fi
        fi
    fi
    
    echo
    log "${CYAN}For detailed logs, check individual test outputs above.${NC}"
    log "${CYAN}To run specific tests: ${BOLD}./run-all-production-tests.sh --nda-only${NC}"
    log "${CYAN}To run quick tests: ${BOLD}./run-all-production-tests.sh --quick${NC}"
    
    # Return appropriate exit code
    exit $([ $failed_suites -eq 0 ] && echo 0 || echo 1)
}

# Handle interruption gracefully
cleanup() {
    echo
    log "${YELLOW}Test execution interrupted by user${NC}"
    log "${CYAN}Partial results may be available above${NC}"
    exit 130
}

trap cleanup INT TERM

# Run main function
main "$@"