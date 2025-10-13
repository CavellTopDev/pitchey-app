#!/bin/bash

# Master Comprehensive Validation Test Suite
# Orchestrates all validation tests for NDA business rules and frontend workflows
# Consolidates results and provides comprehensive platform validation
# Server: localhost:8001

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
API_BASE="http://localhost:8001"
VERBOSE=${VERBOSE:-false}
PARALLEL=${PARALLEL:-false}

# Test suite paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUSINESS_RULES_TEST="$SCRIPT_DIR/comprehensive-nda-business-rules-test.sh"
PORTAL_WORKFLOW_TEST="$SCRIPT_DIR/comprehensive-portal-workflow-validation.sh"
NEGATIVE_SCENARIOS_TEST="$SCRIPT_DIR/comprehensive-negative-test-scenarios.sh"
FRONTEND_INTEGRATION_TEST="$SCRIPT_DIR/comprehensive-frontend-api-integration-test.sh"
ERROR_HANDLING_TEST="$SCRIPT_DIR/comprehensive-error-handling-graceful-degradation-test.sh"

# Results tracking
TOTAL_TEST_SUITES=0
PASSED_TEST_SUITES=0
FAILED_TEST_SUITES=0
SUITE_RESULTS=()
DETAILED_RESULTS=()

# Utility functions
log_suite_start() {
    echo -e "\n${BOLD}${CYAN}🎯 Running Test Suite: $1${NC}"
    ((TOTAL_TEST_SUITES++))
}

log_suite_success() {
    echo -e "${BOLD}${GREEN}✅ Suite Passed: $1${NC}"
    ((PASSED_TEST_SUITES++))
    SUITE_RESULTS+=("PASS: $1")
}

log_suite_failure() {
    echo -e "${BOLD}${RED}❌ Suite Failed: $1${NC}"
    ((FAILED_TEST_SUITES++))
    SUITE_RESULTS+=("FAIL: $1")
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_section() {
    echo -e "\n${BOLD}${PURPLE}$1${NC}"
    echo -e "${PURPLE}$(printf '=%.0s' {1..70})${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking test suite prerequisites..."
    
    # Check if server is running
    if ! curl -s "$API_BASE/api/health" >/dev/null 2>&1; then
        echo -e "${RED}❌ Server not responding at $API_BASE${NC}"
        echo "Please ensure the server is running before executing tests."
        exit 1
    fi
    
    # Check if test scripts exist and are executable
    local test_scripts=(
        "$BUSINESS_RULES_TEST"
        "$PORTAL_WORKFLOW_TEST"
        "$NEGATIVE_SCENARIOS_TEST"
        "$FRONTEND_INTEGRATION_TEST"
        "$ERROR_HANDLING_TEST"
    )
    
    for script in "${test_scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            echo -e "${RED}❌ Test script not found: $script${NC}"
            exit 1
        fi
        
        if [[ ! -x "$script" ]]; then
            echo -e "${YELLOW}⚠️  Making script executable: $script${NC}"
            chmod +x "$script"
        fi
    done
    
    # Check required tools
    local required_tools=(curl jq grep sed)
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            echo -e "${RED}❌ Required tool not found: $tool${NC}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}✅ All prerequisites satisfied${NC}"
}

# Run individual test suite
run_test_suite() {
    local suite_name="$1"
    local suite_script="$2"
    local suite_description="$3"
    
    log_suite_start "$suite_name"
    log_info "$suite_description"
    
    local start_time=$(date +%s)
    local output_file="/tmp/test_suite_${suite_name//[^a-zA-Z0-9]/_}_output.log"
    
    local verbose_flag=""
    if [[ "$VERBOSE" == "true" ]]; then
        verbose_flag="--verbose"
    fi
    
    # Run the test suite and capture output
    if "$suite_script" $verbose_flag >"$output_file" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_suite_success "$suite_name (${duration}s)"
        
        # Extract key metrics from output
        local metrics=$(grep -E "(PASSED|FAILED|SUCCESS|VIOLATION)" "$output_file" | tail -5 | tr '\n' ' ' || echo "No metrics found")
        DETAILED_RESULTS+=("✅ $suite_name: $metrics")
        
        # Show summary if verbose
        if [[ "$VERBOSE" == "true" ]]; then
            echo -e "${CYAN}📊 $suite_name Summary:${NC}"
            grep -E "(Total|Passed|Failed|Success Rate)" "$output_file" | head -10 || echo "No summary available"
        fi
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_suite_failure "$suite_name (${duration}s)"
        
        # Extract error information
        local errors=$(grep -E "(ERROR|VIOLATION|FAILED)" "$output_file" | head -3 | tr '\n' ' ' || echo "Unknown errors")
        DETAILED_RESULTS+=("❌ $suite_name: $errors")
        
        # Show errors
        echo -e "${RED}🚨 $suite_name Errors:${NC}"
        tail -10 "$output_file" | grep -E "(ERROR|FAIL|VIOLATION)" || echo "No specific errors found"
    fi
    
    # Clean up
    if [[ "$VERBOSE" != "true" ]]; then
        rm -f "$output_file"
    else
        echo -e "${BLUE}📄 Full output available at: $output_file${NC}"
    fi
}

# Run parallel test suites
run_parallel_test_suites() {
    log_section "Running Test Suites in Parallel Mode"
    
    # Run all test suites in parallel
    (run_test_suite "Business Rules" "$BUSINESS_RULES_TEST" "Validating NDA business rules and access controls") &
    local pid1=$!
    
    (run_test_suite "Portal Workflows" "$PORTAL_WORKFLOW_TEST" "Testing complete user workflows across all portals") &
    local pid2=$!
    
    (run_test_suite "Negative Scenarios" "$NEGATIVE_SCENARIOS_TEST" "Security and edge case validation") &
    local pid3=$!
    
    (run_test_suite "Frontend Integration" "$FRONTEND_INTEGRATION_TEST" "API-Frontend integration validation") &
    local pid4=$!
    
    (run_test_suite "Error Handling" "$ERROR_HANDLING_TEST" "Error scenarios and graceful degradation") &
    local pid5=$!
    
    # Wait for all processes to complete
    wait $pid1 $pid2 $pid3 $pid4 $pid5
    
    log_info "All parallel test suites completed"
}

# Run sequential test suites
run_sequential_test_suites() {
    log_section "Running Test Suites Sequentially"
    
    run_test_suite "Business Rules" "$BUSINESS_RULES_TEST" \
        "Validating NDA business rules and access controls"
    
    run_test_suite "Portal Workflows" "$PORTAL_WORKFLOW_TEST" \
        "Testing complete user workflows across all portals"
    
    run_test_suite "Negative Scenarios" "$NEGATIVE_SCENARIOS_TEST" \
        "Security and edge case validation"
    
    run_test_suite "Frontend Integration" "$FRONTEND_INTEGRATION_TEST" \
        "API-Frontend integration validation"
    
    run_test_suite "Error Handling" "$ERROR_HANDLING_TEST" \
        "Error scenarios and graceful degradation"
}

# Quick health check
run_quick_health_check() {
    log_info "Performing quick health check before main tests..."
    
    # Test basic connectivity
    if ! response=$(curl -s "$API_BASE/api/health"); then
        echo -e "${RED}❌ Health check failed - server not responding${NC}"
        return 1
    fi
    
    # Test basic authentication
    local test_auth='{"email":"alex.creator@demo.com","password":"Demo123"}'
    if ! curl -s -X POST "$API_BASE/api/auth/creator/login" \
        -H "Content-Type: application/json" \
        -d "$test_auth" >/dev/null; then
        echo -e "${YELLOW}⚠️  Authentication test failed - may affect some tests${NC}"
    fi
    
    echo -e "${GREEN}✅ Quick health check passed${NC}"
    return 0
}

# Generate comprehensive final report
generate_master_report() {
    local overall_success_rate=0
    if [[ $TOTAL_TEST_SUITES -gt 0 ]]; then
        overall_success_rate=$(( PASSED_TEST_SUITES * 100 / TOTAL_TEST_SUITES ))
    fi
    
    echo ""
    echo "=================================================================="
    echo "🎯 MASTER COMPREHENSIVE VALIDATION REPORT"
    echo "=================================================================="
    echo "Test Environment: $API_BASE"
    echo "Execution Mode: $([ "$PARALLEL" = "true" ] && echo "Parallel" || echo "Sequential")"
    echo "Total Test Suites: $TOTAL_TEST_SUITES"
    echo -e "${GREEN}✅ Passed Test Suites: $PASSED_TEST_SUITES${NC}"
    echo -e "${RED}❌ Failed Test Suites: $FAILED_TEST_SUITES${NC}"
    echo ""
    
    # Overall platform status
    if [[ $FAILED_TEST_SUITES -eq 0 ]]; then
        echo -e "${BOLD}${GREEN}🎉 PLATFORM STATUS: FULLY VALIDATED${NC}"
        echo "All business rules and workflows are properly implemented!"
        echo "The platform is ready for production use."
    elif [[ $overall_success_rate -gt 80 ]]; then
        echo -e "${BOLD}${YELLOW}⚠️ PLATFORM STATUS: MOSTLY VALIDATED${NC}"
        echo "Most functionality is working correctly, some issues need attention."
        echo "Platform is suitable for beta testing with known limitations."
    elif [[ $overall_success_rate -gt 60 ]]; then
        echo -e "${BOLD}${YELLOW}⚠️ PLATFORM STATUS: PARTIALLY VALIDATED${NC}"
        echo "Core functionality working but significant issues exist."
        echo "Additional development work required before production."
    else
        echo -e "${BOLD}${RED}❌ PLATFORM STATUS: MAJOR ISSUES DETECTED${NC}"
        echo "Critical problems found across multiple areas."
        echo "Extensive fixes required before platform can be used."
    fi
    
    echo ""
    echo "=================================================================="
    echo "📊 TEST SUITE RESULTS SUMMARY"
    echo "=================================================================="
    
    for result in "${SUITE_RESULTS[@]}"; do
        if [[ $result == PASS:* ]]; then
            echo -e "${GREEN}✅ ${result#PASS: }${NC}"
        else
            echo -e "${RED}❌ ${result#FAIL: }${NC}"
        fi
    done
    
    echo ""
    echo "=================================================================="
    echo "📋 DETAILED RESULTS BREAKDOWN"
    echo "=================================================================="
    
    for detail in "${DETAILED_RESULTS[@]}"; do
        echo -e "$detail"
    done
    
    # Platform readiness assessment
    echo ""
    echo "=================================================================="
    echo "🚀 PLATFORM READINESS ASSESSMENT"
    echo "=================================================================="
    
    local business_rules_pass=$(printf '%s\n' "${SUITE_RESULTS[@]}" | grep -c "PASS.*Business Rules" || echo "0")
    local security_pass=$(printf '%s\n' "${SUITE_RESULTS[@]}" | grep -c "PASS.*Negative Scenarios" || echo "0")
    local workflow_pass=$(printf '%s\n' "${SUITE_RESULTS[@]}" | grep -c "PASS.*Portal Workflows" || echo "0")
    local integration_pass=$(printf '%s\n' "${SUITE_RESULTS[@]}" | grep -c "PASS.*Frontend Integration" || echo "0")
    local reliability_pass=$(printf '%s\n' "${SUITE_RESULTS[@]}" | grep -c "PASS.*Error Handling" || echo "0")
    
    echo "🔐 Security & Business Rules: $([[ $business_rules_pass -gt 0 && $security_pass -gt 0 ]] && echo "✅ READY" || echo "❌ NEEDS WORK")"
    echo "👥 User Workflows: $([[ $workflow_pass -gt 0 ]] && echo "✅ READY" || echo "❌ NEEDS WORK")"
    echo "🔗 Frontend Integration: $([[ $integration_pass -gt 0 ]] && echo "✅ READY" || echo "❌ NEEDS WORK")"
    echo "🛠️ Error Handling: $([[ $reliability_pass -gt 0 ]] && echo "✅ READY" || echo "❌ NEEDS WORK")"
    
    # Recommendations
    if [[ $FAILED_TEST_SUITES -gt 0 ]]; then
        echo ""
        echo "=================================================================="
        echo "🔧 CRITICAL RECOMMENDATIONS"
        echo "=================================================================="
        echo "1. Address all failed test suites before production deployment"
        echo "2. Focus on business rules validation if NDA workflows failed"
        echo "3. Fix security issues if negative scenarios failed"
        echo "4. Improve user experience if workflow tests failed"
        echo "5. Enhance frontend integration if API tests failed"
        echo "6. Strengthen error handling if reliability tests failed"
        echo "7. Re-run this comprehensive test suite after fixes"
        echo "8. Consider staged rollout with limited user groups"
    fi
    
    echo ""
    echo "=================================================================="
    echo "📈 OVERALL SUCCESS RATE: $overall_success_rate%"
    echo "=================================================================="
    
    if [[ $overall_success_rate -ge 100 ]]; then
        echo "🏆 RATING: PRODUCTION READY - EXCELLENT IMPLEMENTATION"
    elif [[ $overall_success_rate -ge 90 ]]; then
        echo "🥇 RATING: PRODUCTION READY - MINOR OPTIMIZATIONS POSSIBLE"
    elif [[ $overall_success_rate -ge 80 ]]; then
        echo "🥈 RATING: BETA READY - GOOD IMPLEMENTATION WITH MINOR ISSUES"
    elif [[ $overall_success_rate -ge 60 ]]; then
        echo "🥉 RATING: ALPHA READY - CORE FUNCTIONALITY WORKING"
    else
        echo "⚠️ RATING: DEVELOPMENT STAGE - MAJOR WORK NEEDED"
    fi
}

# Main execution function
main() {
    echo "=================================================================="
    echo "🎯 MASTER COMPREHENSIVE VALIDATION TEST SUITE"
    echo "=================================================================="
    echo "Platform: Pitchey Movie Platform"
    echo "Environment: $API_BASE"
    echo "Mode: $([ "$PARALLEL" = "true" ] && echo "Parallel" || echo "Sequential")"
    echo "Verbose: $VERBOSE"
    echo "=================================================================="
    echo ""
    echo "This master suite validates:"
    echo "• NDA business rules and access controls"
    echo "• Complete user workflows across all portals"
    echo "• Security and negative test scenarios"
    echo "• Frontend-backend integration"
    echo "• Error handling and graceful degradation"
    echo ""
    
    # Run prerequisite checks
    check_prerequisites
    
    # Quick health check
    if ! run_quick_health_check; then
        echo -e "${RED}❌ Health check failed - aborting tests${NC}"
        exit 1
    fi
    
    # Record start time
    local start_time=$(date +%s)
    local start_timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${BOLD}${BLUE}🚀 Starting comprehensive validation at $start_timestamp${NC}"
    
    # Run test suites based on mode
    if [[ "$PARALLEL" == "true" ]]; then
        run_parallel_test_suites
    else
        run_sequential_test_suites
    fi
    
    # Calculate total execution time
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    local end_timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo ""
    echo "=================================================================="
    echo "⏱️  EXECUTION COMPLETED"
    echo "=================================================================="
    echo "Start Time: $start_timestamp"
    echo "End Time: $end_timestamp"
    echo "Total Duration: ${total_duration}s"
    echo "=================================================================="
    
    # Generate comprehensive report
    generate_master_report
    
    # Exit with appropriate code
    if [[ $FAILED_TEST_SUITES -eq 0 ]]; then
        echo -e "\n${BOLD}${GREEN}🎉 ALL TEST SUITES PASSED - PLATFORM VALIDATION SUCCESSFUL!${NC}"
        exit 0
    else
        echo -e "\n${BOLD}${RED}⚠️  SOME TEST SUITES FAILED - PLATFORM NEEDS ATTENTION${NC}"
        exit 1
    fi
}

# Handle command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        --api-base)
            API_BASE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Master Comprehensive Validation Test Suite"
            echo "Orchestrates all validation tests for the Pitchey platform"
            echo ""
            echo "Options:"
            echo "  -v, --verbose     Enable verbose output with detailed results"
            echo "  -p, --parallel    Run test suites in parallel for faster execution"
            echo "  --api-base URL    Override API base URL (default: $API_BASE)"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Test Suites Included:"
            echo "  • Business Rules Validation"
            echo "  • Portal Workflow Testing"
            echo "  • Negative Scenario Testing"
            echo "  • Frontend Integration Testing"
            echo "  • Error Handling Testing"
            echo ""
            echo "Examples:"
            echo "  $0                          # Run all tests sequentially"
            echo "  $0 --verbose --parallel     # Run all tests in parallel with verbose output"
            echo "  $0 --api-base http://localhost:3000  # Test different server"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run the master comprehensive validation test suite
main "$@"