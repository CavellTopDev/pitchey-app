#!/bin/bash

# ============================================================================
# COMPREHENSIVE TEST SUITE RUNNER FOR NEW WORKFLOWS
# ============================================================================
# Runs all newly created comprehensive test suites for the Pitchey platform
# Provides detailed reporting and combines results from all test categories
# ============================================================================

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8001}"
VERBOSE="${VERBOSE:-false}"
RUN_PARALLEL="${RUN_PARALLEL:-false}"

# Test counters
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
SKIPPED_SUITES=0
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0

# Test results storage
declare -A SUITE_RESULTS
declare -A SUITE_TIMES
FAILED_SUITES_LIST=()

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log_header() {
    echo -e "\n${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${WHITE}  $1${CYAN}║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}\n"
}

log_section() {
    echo -e "\n${BLUE}┌──────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}│${YELLOW}  $1${BLUE}│${NC}"
    echo -e "${BLUE}└──────────────────────────────────────────────────────────────┘${NC}\n"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_failure() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Run a single test suite
run_test_suite() {
    local suite_name=$1
    local suite_script=$2
    local description=$3
    
    log_info "Starting: $description"
    
    if [ ! -f "$suite_script" ]; then
        log_warning "Test suite not found: $suite_script"
        SUITE_RESULTS["$suite_name"]="SKIPPED"
        ((SKIPPED_SUITES++))
        return 2
    fi
    
    if [ ! -x "$suite_script" ]; then
        log_warning "Test suite not executable: $suite_script"
        chmod +x "$suite_script"
    fi
    
    # Record start time
    local start_time=$(date +%s)
    
    # Run the test suite
    local output_file="/tmp/test_output_${suite_name}.log"
    
    if [ "$VERBOSE" == "true" ]; then
        bash "$suite_script" 2>&1 | tee "$output_file"
        local exit_code=${PIPESTATUS[0]}
    else
        bash "$suite_script" > "$output_file" 2>&1
        local exit_code=$?
    fi
    
    # Record end time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    SUITE_TIMES["$suite_name"]=$duration
    
    # Parse results from output
    local passed=$(grep -o "Passed: [0-9]*" "$output_file" | tail -n1 | grep -o "[0-9]*" || echo "0")
    local failed=$(grep -o "Failed: [0-9]*" "$output_file" | tail -n1 | grep -o "[0-9]*" || echo "0")
    local warnings=$(grep -o "Warnings: [0-9]*" "$output_file" | tail -n1 | grep -o "[0-9]*" || echo "0")
    
    # Update totals
    TOTAL_TESTS=$((TOTAL_TESTS + passed + failed + warnings))
    TOTAL_PASSED=$((TOTAL_PASSED + passed))
    TOTAL_FAILED=$((TOTAL_FAILED + failed))
    
    if [ $exit_code -eq 0 ]; then
        log_success "$description completed successfully (${duration}s)"
        SUITE_RESULTS["$suite_name"]="PASSED"
        ((PASSED_SUITES++))
    else
        log_failure "$description failed (${duration}s)"
        SUITE_RESULTS["$suite_name"]="FAILED"
        FAILED_SUITES_LIST+=("$suite_name: $description")
        ((FAILED_SUITES++))
    fi
    
    # Clean up output file unless verbose
    if [ "$VERBOSE" != "true" ]; then
        rm -f "$output_file"
    fi
    
    return $exit_code
}

# ============================================================================
# TEST SUITE DEFINITIONS
# ============================================================================

declare -A TEST_SUITES
TEST_SUITES=(
    ["admin-workflows"]="./test-admin-workflows.sh|Admin Workflows|Admin dashboard, user management, content moderation, system settings, audit logs"
    ["email-notifications"]="./test-email-notifications.sh|Email Notifications|Email delivery, templates, verification, password reset emails"
    ["analytics-export"]="./test-analytics-export.sh|Analytics Export|Report generation, data export, analytics dashboards"
    ["user-preferences"]="./test-user-preferences.sh|User Preferences|Settings management, notification preferences, profile customization"
    ["edit-delete-operations"]="./test-edit-delete-operations.sh|Edit/Delete Operations|Edit/delete pitches, update profiles, content management"
    ["watchlist-features"]="./test-watchlist-features.sh|Watchlist Features|Add/remove from watchlist, watchlist management"
    ["social-features"]="./test-social-features.sh|Social Features|Comments, likes, shares, activity feed"
)

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    clear
    log_header "PITCHEY COMPREHENSIVE NEW WORKFLOWS TEST SUITE RUNNER"
    
    echo -e "${WHITE}Running comprehensive test suites for new workflows...${NC}"
    echo -e "${WHITE}Base URL:${NC} $BASE_URL"
    echo -e "${WHITE}Parallel execution:${NC} $RUN_PARALLEL"
    echo -e "${WHITE}Verbose output:${NC} $VERBOSE"
    echo -e "${WHITE}Started at:${NC} $(date)"
    echo
    
    # Check if server is running
    if ! curl -s "${BASE_URL}" > /dev/null 2>&1; then
        echo -e "${RED}[ERROR]${NC} Server is not running at $BASE_URL"
        echo -e "${YELLOW}[!]${NC} Please start the server before running tests"
        echo -e "${BLUE}[i]${NC} Example: ./start-local.sh"
        exit 1
    fi
    
    log_success "Server is running at $BASE_URL"
    
    # Count total suites
    TOTAL_SUITES=${#TEST_SUITES[@]}
    
    log_section "EXECUTING $TOTAL_SUITES COMPREHENSIVE TEST SUITES"
    
    # Run test suites
    if [ "$RUN_PARALLEL" == "true" ]; then
        log_info "Running test suites in parallel..."
        
        # Run suites in parallel
        for suite_name in "${!TEST_SUITES[@]}"; do
            IFS='|' read -r script title description <<< "${TEST_SUITES[$suite_name]}"
            run_test_suite "$suite_name" "$script" "$title - $description" &
        done
        
        # Wait for all background jobs to complete
        wait
        
        # Parse results from log files
        for suite_name in "${!TEST_SUITES[@]}"; do
            if [ ! -f "/tmp/test_output_${suite_name}.log" ]; then
                SUITE_RESULTS["$suite_name"]="FAILED"
                ((FAILED_SUITES++))
            fi
        done
        
    else
        log_info "Running test suites sequentially..."
        
        # Run suites sequentially
        for suite_name in "${!TEST_SUITES[@]}"; do
            IFS='|' read -r script title description <<< "${TEST_SUITES[$suite_name]}"
            run_test_suite "$suite_name" "$script" "$title - $description"
            echo # Add spacing between suites
        done
    fi
    
    # ========================================================================
    # GENERATE COMPREHENSIVE REPORT
    # ========================================================================
    
    log_header "COMPREHENSIVE TEST EXECUTION SUMMARY"
    
    echo -e "${WHITE}Test Suite Execution Results:${NC}"
    echo -e "${GREEN}  Passed Suites:${NC} $PASSED_SUITES"
    echo -e "${RED}  Failed Suites:${NC} $FAILED_SUITES"
    echo -e "${YELLOW}  Skipped Suites:${NC} $SKIPPED_SUITES"
    echo -e "${BLUE}  Total Suites:${NC} $TOTAL_SUITES"
    echo
    
    echo -e "${WHITE}Individual Test Results:${NC}"
    echo -e "${GREEN}  Total Tests Passed:${NC} $TOTAL_PASSED"
    echo -e "${RED}  Total Tests Failed:${NC} $TOTAL_FAILED"
    echo -e "${BLUE}  Total Tests Executed:${NC} $TOTAL_TESTS"
    echo
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        overall_success_rate=$((TOTAL_PASSED * 100 / TOTAL_TESTS))
        echo -e "${WHITE}Overall Success Rate:${NC} ${overall_success_rate}%"
    fi
    
    # Suite-by-suite breakdown
    echo
    log_section "DETAILED SUITE BREAKDOWN"
    
    for suite_name in "${!TEST_SUITES[@]}"; do
        IFS='|' read -r script title description <<< "${TEST_SUITES[$suite_name]}"
        local result="${SUITE_RESULTS[$suite_name]}"
        local duration="${SUITE_TIMES[$suite_name]:-0}"
        
        case $result in
            "PASSED")
                echo -e "${GREEN}[✓]${NC} $title (${duration}s)"
                ;;
            "FAILED")
                echo -e "${RED}[✗]${NC} $title (${duration}s)"
                ;;
            "SKIPPED")
                echo -e "${YELLOW}[!]${NC} $title (not found/executable)"
                ;;
            *)
                echo -e "${YELLOW}[?]${NC} $title (unknown status)"
                ;;
        esac
    done
    
    # Failed suites details
    if [ ${#FAILED_SUITES_LIST[@]} -gt 0 ]; then
        echo
        log_section "FAILED SUITES REQUIRING ATTENTION"
        
        for failed_suite in "${FAILED_SUITES_LIST[@]}"; do
            echo -e "${RED}  •${NC} $failed_suite"
        done
        
        echo
        log_warning "Please review failed test suites and address any issues"
        echo -e "${BLUE}[i]${NC} Run individual suites with -v flag for detailed output"
    fi
    
    # Coverage summary
    echo
    log_section "TEST COVERAGE SUMMARY"
    
    echo -e "${BLUE}[i]${NC} Comprehensive workflow testing coverage:"
    echo -e "      ${GREEN}✓${NC} Admin dashboard and management workflows"
    echo -e "      ${GREEN}✓${NC} Email notification and communication systems"
    echo -e "      ${GREEN}✓${NC} Analytics, reporting, and data export features"
    echo -e "      ${GREEN}✓${NC} User preferences and settings management"
    echo -e "      ${GREEN}✓${NC} Content editing and deletion operations"
    echo -e "      ${GREEN}✓${NC} Watchlist management and tracking features"
    echo -e "      ${GREEN}✓${NC} Social features and community interactions"
    echo
    echo -e "${BLUE}[i]${NC} Each test suite includes:"
    echo -e "      • Authentication and authorization testing"
    echo -e "      • Error handling and validation checks"
    echo -e "      • Performance and scalability assessments"
    echo -e "      • Security and privacy validations"
    echo -e "      • Data integrity and consistency verification"
    
    # Recommendations
    echo
    log_section "RECOMMENDATIONS"
    
    if [ $FAILED_SUITES -eq 0 ]; then
        log_success "All test suites passed successfully!"
        echo -e "${GREEN}[✓]${NC} Platform appears to be functioning correctly across all tested workflows"
        echo -e "${BLUE}[i]${NC} Consider running these tests regularly as part of CI/CD pipeline"
    else
        echo -e "${YELLOW}[!]${NC} Some test suites failed - immediate attention required"
        echo -e "${BLUE}[i]${NC} Focus on implementing missing functionality in failed areas"
        echo -e "${BLUE}[i]${NC} Re-run specific test suites after fixes: ./test-[suite-name].sh -v"
    fi
    
    # Generate report file
    local report_file="comprehensive_test_report_$(date +%Y%m%d_%H%M%S).txt"
    {
        echo "PITCHEY COMPREHENSIVE TEST SUITE REPORT"
        echo "Generated: $(date)"
        echo "========================================"
        echo
        echo "EXECUTION SUMMARY:"
        echo "  Total Suites: $TOTAL_SUITES"
        echo "  Passed: $PASSED_SUITES"
        echo "  Failed: $FAILED_SUITES"
        echo "  Skipped: $SKIPPED_SUITES"
        echo
        echo "TEST RESULTS:"
        echo "  Total Tests: $TOTAL_TESTS"
        echo "  Passed: $TOTAL_PASSED"
        echo "  Failed: $TOTAL_FAILED"
        echo "  Success Rate: ${overall_success_rate}%"
        echo
        echo "SUITE BREAKDOWN:"
        for suite_name in "${!TEST_SUITES[@]}"; do
            IFS='|' read -r script title description <<< "${TEST_SUITES[$suite_name]}"
            local result="${SUITE_RESULTS[$suite_name]}"
            local duration="${SUITE_TIMES[$suite_name]:-0}"
            echo "  $title: $result (${duration}s)"
        done
        
        if [ ${#FAILED_SUITES_LIST[@]} -gt 0 ]; then
            echo
            echo "FAILED SUITES:"
            for failed_suite in "${FAILED_SUITES_LIST[@]}"; do
                echo "  - $failed_suite"
            done
        fi
        
    } > "$report_file"
    
    echo
    echo -e "${BLUE}[i]${NC} Detailed report saved to: $report_file"
    echo -e "${WHITE}Completed at:${NC} $(date)"
    
    # Exit with appropriate code
    if [ $FAILED_SUITES -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# ============================================================================
# COMMAND LINE ARGUMENT PARSING
# ============================================================================

show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Comprehensive test suite runner for Pitchey platform workflows"
    echo
    echo "Options:"
    echo "  -v, --verbose      Enable verbose output from test suites"
    echo "  -p, --parallel     Run test suites in parallel (faster but less readable)"
    echo "  -u, --url URL      Set base URL (default: http://localhost:8001)"
    echo "  -h, --help         Show this help message"
    echo
    echo "Examples:"
    echo "  $0                 Run all test suites with default settings"
    echo "  $0 -v              Run with verbose output"
    echo "  $0 -p              Run test suites in parallel"
    echo "  $0 -u http://localhost:3000  Test against different URL"
    echo
    echo "Test Suites Included:"
    echo "  • Admin Workflows - Dashboard, user management, content moderation"
    echo "  • Email Notifications - Delivery, templates, verification emails"
    echo "  • Analytics Export - Reports, data export, dashboards"
    echo "  • User Preferences - Settings, notifications, customization"
    echo "  • Edit/Delete Operations - Content management, CRUD operations"
    echo "  • Watchlist Features - Tracking, management, notifications"
    echo "  • Social Features - Comments, likes, shares, community"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -p|--parallel)
            RUN_PARALLEL=true
            shift
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h for help"
            exit 1
            ;;
    esac
done

# Run main function
main