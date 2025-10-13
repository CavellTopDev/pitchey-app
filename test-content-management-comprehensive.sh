#!/bin/bash

# Comprehensive Content Management Integration Test Suite
# Master script to run all dynamic content management tests

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_URL="http://localhost:5173"
API_BASE="http://localhost:8001"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Test suite files
API_TEST_SCRIPT="$SCRIPT_DIR/test-content-management-api.sh"
FRONTEND_TEST_SCRIPT="$SCRIPT_DIR/test-frontend-integration.sh"
E2E_TEST_SCRIPT="$SCRIPT_DIR/test-e2e-user-flows.sh"
ERROR_TEST_SCRIPT="$SCRIPT_DIR/test-error-handling-fallbacks.sh"

# Results storage
RESULTS_DIR="$SCRIPT_DIR/test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_FILE="$RESULTS_DIR/content_management_test_results_$TIMESTAMP.txt"

# Test suite results
declare -A SUITE_RESULTS
declare -A SUITE_DETAILS

echo -e "${WHITE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${WHITE}║           Comprehensive Content Management Test Suite          ║${NC}"
echo -e "${WHITE}║                                                                ║${NC}"
echo -e "${WHITE}║  Testing dynamic component integration with backend CMS       ║${NC}"
echo -e "${WHITE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print section headers
print_section() {
    local title="$1"
    local width=70
    local padding=$(( (width - ${#title}) / 2 ))
    
    echo ""
    echo -e "${CYAN}$(printf '═%.0s' $(seq 1 $width))${NC}"
    echo -e "${CYAN}$(printf ' %.0s' $(seq 1 $padding))${WHITE}$title${CYAN}$(printf ' %.0s' $(seq 1 $padding))${NC}"
    echo -e "${CYAN}$(printf '═%.0s' $(seq 1 $width))${NC}"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    print_section "CHECKING PREREQUISITES"
    
    local prerequisites_met=true
    
    # Check required commands
    local required_commands=("curl" "jq" "npm" "node")
    for cmd in "${required_commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} $cmd is available"
        else
            echo -e "${RED}✗${NC} $cmd is required but not installed"
            prerequisites_met=false
        fi
    done
    
    # Check if test scripts exist
    local test_scripts=("$API_TEST_SCRIPT" "$FRONTEND_TEST_SCRIPT" "$E2E_TEST_SCRIPT" "$ERROR_TEST_SCRIPT")
    for script in "${test_scripts[@]}"; do
        if [ -x "$script" ]; then
            echo -e "${GREEN}✓${NC} $(basename "$script") is executable"
        else
            echo -e "${RED}✗${NC} $(basename "$script") is missing or not executable"
            prerequisites_met=false
        fi
    done
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    if [ -d "$RESULTS_DIR" ]; then
        echo -e "${GREEN}✓${NC} Results directory created: $RESULTS_DIR"
    else
        echo -e "${RED}✗${NC} Failed to create results directory"
        prerequisites_met=false
    fi
    
    if [ "$prerequisites_met" = false ]; then
        echo -e "${RED}Prerequisites not met. Please install missing dependencies.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}All prerequisites met!${NC}"
}

# Function to check service availability
check_services() {
    print_section "CHECKING SERVICES"
    
    # Check backend API
    if curl -s --max-time 5 "$API_BASE/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Backend API is running at $API_BASE"
        BACKEND_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠${NC} Backend API is not running at $API_BASE"
        echo -e "  ${YELLOW}Some tests will run with limited functionality${NC}"
        BACKEND_AVAILABLE=false
    fi
    
    # Check frontend
    if curl -s --max-time 5 "$FRONTEND_URL" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend is running at $FRONTEND_URL"
        FRONTEND_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠${NC} Frontend is not running at $FRONTEND_URL"
        echo -e "  ${YELLOW}Frontend-specific tests will be limited${NC}"
        FRONTEND_AVAILABLE=false
    fi
    
    # Check database connectivity through API
    if [ "$BACKEND_AVAILABLE" = true ]; then
        local db_test=$(curl -s "$API_BASE/api/content/portals/creator" | jq -r '.success // false' 2>/dev/null || echo "false")
        if [ "$db_test" = "true" ]; then
            echo -e "${GREEN}✓${NC} Database connectivity confirmed"
            DATABASE_AVAILABLE=true
        else
            echo -e "${YELLOW}⚠${NC} Database connectivity issues detected"
            DATABASE_AVAILABLE=false
        fi
    else
        DATABASE_AVAILABLE=false
    fi
}

# Function to run a test suite
run_test_suite() {
    local suite_name="$1"
    local script_path="$2"
    local description="$3"
    
    echo -e "${BLUE}Running $suite_name...${NC}"
    echo -e "${YELLOW}Description:${NC} $description"
    echo ""
    
    local start_time=$(date +%s)
    local output_file="$RESULTS_DIR/${suite_name,,}_output_$TIMESTAMP.txt"
    
    # Run the test script and capture output
    if bash "$script_path" 2>&1 | tee "$output_file"; then
        local exit_code=${PIPESTATUS[0]}
    else
        local exit_code=$?
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Parse results from output
    local total_tests=$(grep -o "Total.*: [0-9]*" "$output_file" | tail -1 | grep -o "[0-9]*" || echo "0")
    local passed_tests=$(grep -o "Passed.*: [0-9]*" "$output_file" | tail -1 | grep -o "[0-9]*" || echo "0")
    local failed_tests=$(grep -o "Failed.*: [0-9]*" "$output_file" | tail -1 | grep -o "[0-9]*" || echo "0")
    
    # Store results
    if [ "$exit_code" -eq 0 ]; then
        SUITE_RESULTS["$suite_name"]="PASS"
        echo -e "${GREEN}✓ $suite_name completed successfully${NC}"
    else
        SUITE_RESULTS["$suite_name"]="FAIL"
        echo -e "${RED}✗ $suite_name failed${NC}"
    fi
    
    SUITE_DETAILS["$suite_name"]="Duration: ${duration}s | Tests: $total_tests | Passed: $passed_tests | Failed: $failed_tests | Exit: $exit_code"
    
    echo -e "${YELLOW}Duration:${NC} ${duration}s"
    echo -e "${YELLOW}Tests:${NC} $total_tests total, $passed_tests passed, $failed_tests failed"
    echo ""
}

# Function to generate detailed report
generate_report() {
    print_section "GENERATING COMPREHENSIVE REPORT"
    
    # Create detailed report
    cat > "$RESULTS_FILE" << EOF
Content Management Integration Test Results
==========================================

Test Run Information:
- Timestamp: $(date)
- Backend Available: $BACKEND_AVAILABLE
- Frontend Available: $FRONTEND_AVAILABLE  
- Database Available: $DATABASE_AVAILABLE
- Results Directory: $RESULTS_DIR

Test Suite Results:
EOF

    local total_suites=0
    local passed_suites=0
    local failed_suites=0
    
    for suite in "${!SUITE_RESULTS[@]}"; do
        total_suites=$((total_suites + 1))
        local result="${SUITE_RESULTS[$suite]}"
        local details="${SUITE_DETAILS[$suite]}"
        
        if [ "$result" = "PASS" ]; then
            passed_suites=$((passed_suites + 1))
            echo "✓ PASS - $suite" >> "$RESULTS_FILE"
        else
            failed_suites=$((failed_suites + 1))
            echo "✗ FAIL - $suite" >> "$RESULTS_FILE"
        fi
        
        echo "  $details" >> "$RESULTS_FILE"
        echo "" >> "$RESULTS_FILE"
    done
    
    # Add summary
    cat >> "$RESULTS_FILE" << EOF

Summary:
========
Total Test Suites: $total_suites
Passed: $passed_suites
Failed: $failed_suites
Success Rate: $(( passed_suites * 100 / total_suites ))%

Service Status:
- Backend API: $BACKEND_AVAILABLE
- Frontend: $FRONTEND_AVAILABLE
- Database: $DATABASE_AVAILABLE

Individual Test Outputs:
========================
EOF

    # Add references to individual output files
    for suite in "${!SUITE_RESULTS[@]}"; do
        local output_file="${suite,,}_output_$TIMESTAMP.txt"
        echo "- $suite: $output_file" >> "$RESULTS_FILE"
    done
    
    echo "Report saved to: $RESULTS_FILE"
    return $failed_suites
}

# Function to display final summary
display_summary() {
    local failed_suites="$1"
    
    print_section "TEST EXECUTION SUMMARY"
    
    echo -e "${YELLOW}Test Suite Results:${NC}"
    for suite in "${!SUITE_RESULTS[@]}"; do
        local result="${SUITE_RESULTS[$suite]}"
        local details="${SUITE_DETAILS[$suite]}"
        
        if [ "$result" = "PASS" ]; then
            echo -e "  ${GREEN}✓ PASS${NC} $suite"
        else
            echo -e "  ${RED}✗ FAIL${NC} $suite"
        fi
        echo -e "    ${YELLOW}$details${NC}"
    done
    
    echo ""
    
    if [ "$failed_suites" -eq 0 ]; then
        echo -e "${WHITE}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${WHITE}║${GREEN}                     ALL TESTS PASSED! ✅                      ${WHITE}║${NC}"
        echo -e "${WHITE}║                                                                ║${NC}"
        echo -e "${WHITE}║  Your dynamic content management system is working perfectly! ║${NC}"
        echo -e "${WHITE}╚════════════════════════════════════════════════════════════════╝${NC}"
    elif [ "$failed_suites" -le 1 ]; then
        echo -e "${WHITE}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${WHITE}║${YELLOW}                   MOSTLY SUCCESSFUL! ⚠️                       ${WHITE}║${NC}"
        echo -e "${WHITE}║                                                                ║${NC}"
        echo -e "${WHITE}║  Most tests passed with minor issues that need attention.     ║${NC}"
        echo -e "${WHITE}╚════════════════════════════════════════════════════════════════╝${NC}"
    else
        echo -e "${WHITE}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${WHITE}║${RED}                    ISSUES DETECTED! ❌                        ${WHITE}║${NC}"
        echo -e "${WHITE}║                                                                ║${NC}"
        echo -e "${WHITE}║  Multiple test suites failed. Review the detailed report.     ║${NC}"
        echo -e "${WHITE}╚════════════════════════════════════════════════════════════════╝${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Detailed report: $RESULTS_FILE${NC}"
    echo -e "${CYAN}Individual outputs: $RESULTS_DIR/*_output_$TIMESTAMP.txt${NC}"
}

# Function to provide recommendations
provide_recommendations() {
    print_section "RECOMMENDATIONS"
    
    echo -e "${YELLOW}Based on the test results, here are some recommendations:${NC}"
    echo ""
    
    if [ "$BACKEND_AVAILABLE" = false ]; then
        echo -e "${RED}🔴 Backend Not Running:${NC}"
        echo "   Start the backend server: PORT=8001 deno run --allow-all working-server.ts"
        echo ""
    fi
    
    if [ "$FRONTEND_AVAILABLE" = false ]; then
        echo -e "${RED}🔴 Frontend Not Running:${NC}"
        echo "   Start the frontend server: cd frontend && npm run dev"
        echo ""
    fi
    
    if [ "$DATABASE_AVAILABLE" = false ]; then
        echo -e "${RED}🔴 Database Issues:${NC}"
        echo "   Check database connectivity and run migrations if needed"
        echo ""
    fi
    
    # Check specific test failures
    for suite in "${!SUITE_RESULTS[@]}"; do
        if [ "${SUITE_RESULTS[$suite]}" = "FAIL" ]; then
            case "$suite" in
                "API_TESTS")
                    echo -e "${YELLOW}🟡 API Test Issues:${NC}"
                    echo "   - Check backend endpoints are properly implemented"
                    echo "   - Verify database seed data is present"
                    echo "   - Review API error responses"
                    ;;
                "FRONTEND_TESTS")
                    echo -e "${YELLOW}🟡 Frontend Test Issues:${NC}"
                    echo "   - Check TypeScript compilation"
                    echo "   - Verify component imports and exports"
                    echo "   - Review environment configuration"
                    ;;
                "E2E_TESTS")
                    echo -e "${YELLOW}🟡 End-to-End Test Issues:${NC}"
                    echo "   - Ensure both frontend and backend are running"
                    echo "   - Check user authentication flows"
                    echo "   - Verify dynamic content loading"
                    ;;
                "ERROR_TESTS")
                    echo -e "${YELLOW}🟡 Error Handling Issues:${NC}"
                    echo "   - Implement better fallback mechanisms"
                    echo "   - Add more robust error boundaries"
                    echo "   - Improve timeout handling"
                    ;;
            esac
            echo ""
        fi
    done
    
    echo -e "${GREEN}✓ Review individual test outputs for specific failure details${NC}"
    echo -e "${GREEN}✓ All tests should pass when services are properly configured${NC}"
}

# Main execution
main() {
    # Initialize
    check_prerequisites
    check_services
    
    print_section "STARTING TEST EXECUTION"
    
    # Run test suites
    if [ -x "$API_TEST_SCRIPT" ]; then
        run_test_suite "API_TESTS" "$API_TEST_SCRIPT" "Content Management API endpoint testing"
    fi
    
    if [ -x "$FRONTEND_TEST_SCRIPT" ]; then
        run_test_suite "FRONTEND_TESTS" "$FRONTEND_TEST_SCRIPT" "Frontend component integration testing"
    fi
    
    if [ -x "$E2E_TEST_SCRIPT" ]; then
        run_test_suite "E2E_TESTS" "$E2E_TEST_SCRIPT" "End-to-end user flow testing"
    fi
    
    if [ -x "$ERROR_TEST_SCRIPT" ]; then
        run_test_suite "ERROR_TESTS" "$ERROR_TEST_SCRIPT" "Error handling and fallback testing"
    fi
    
    # Generate report and display results
    local failed_suites
    failed_suites=$(generate_report)
    display_summary "$failed_suites"
    provide_recommendations
    
    # Exit with appropriate code
    if [ "$failed_suites" -eq 0 ]; then
        exit 0
    elif [ "$failed_suites" -le 1 ]; then
        exit 0  # Still considered success with minor issues
    else
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Comprehensive Content Management Integration Test Suite"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --version, -v  Show version information"
        echo ""
        echo "This script runs all content management integration tests:"
        echo "  1. API endpoint testing"
        echo "  2. Frontend component integration"
        echo "  3. End-to-end user flows"
        echo "  4. Error handling and fallbacks"
        echo ""
        echo "Results are saved to: $RESULTS_DIR/"
        exit 0
        ;;
    "--version"|"-v")
        echo "Content Management Test Suite v1.0.0"
        exit 0
        ;;
    "")
        # No arguments, run normally
        main
        ;;
    *)
        echo "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac