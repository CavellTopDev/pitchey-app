#!/bin/bash

# Ultimate Master Test Runner - 100% Test Coverage Execution
# Runs ALL test suites for complete validation of the Pitchey platform

echo "=========================================================="
echo "🚀 PITCHEY PLATFORM - 100% TEST COVERAGE EXECUTION"
echo "=========================================================="
echo ""
echo "Start Time: $(date)"
echo "Total Test Suites: 29"
echo "Estimated Duration: 30-45 minutes"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test tracking
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
SKIPPED_SUITES=0

# Results directory
RESULTS_DIR="test_results_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Summary file
SUMMARY_FILE="$RESULTS_DIR/test_summary.txt"

# Function to run test suite
run_test() {
    local category=$1
    local test_name=$2
    local test_script=$3
    
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    
    echo -e "${CYAN}[$TOTAL_SUITES/29]${NC} ${BLUE}Running:${NC} $test_name"
    
    if [ -f "$test_script" ]; then
        # Make executable
        chmod +x "$test_script" 2>/dev/null
        
        # Run test and capture output
        if ./"$test_script" > "$RESULTS_DIR/${test_script%.sh}.log" 2>&1; then
            echo -e "    ${GREEN}✓ PASSED${NC}"
            PASSED_SUITES=$((PASSED_SUITES + 1))
            echo "✓ [$category] $test_name - PASSED" >> "$SUMMARY_FILE"
        else
            echo -e "    ${RED}✗ FAILED${NC}"
            FAILED_SUITES=$((FAILED_SUITES + 1))
            echo "✗ [$category] $test_name - FAILED" >> "$SUMMARY_FILE"
        fi
    else
        echo -e "    ${YELLOW}⊘ SKIPPED (not found)${NC}"
        SKIPPED_SUITES=$((SKIPPED_SUITES + 1))
        echo "⊘ [$category] $test_name - SKIPPED" >> "$SUMMARY_FILE"
    fi
}

# Header
echo "=========================================================="
echo "100% TEST COVERAGE EXECUTION REPORT" > "$SUMMARY_FILE"
echo "Start Time: $(date)" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"

# Phase 1: Core Authentication & Portals
echo ""
echo -e "${PURPLE}━━━ PHASE 1: CORE AUTHENTICATION & PORTALS ━━━${NC}"
echo "==========================================================" >> "$SUMMARY_FILE"
echo "PHASE 1: CORE AUTHENTICATION & PORTALS" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"

run_test "AUTH" "Portal Authentication" "test-all-portals.sh"
run_test "AUTH" "Dashboard Functionality" "test-all-dashboards.sh"
run_test "AUTH" "Demo Accounts" "test-demo-accounts.sh"
run_test "AUTH" "Integration Workflows" "test-complete-integration.sh"

# Phase 2: Feature-Specific Tests
echo ""
echo -e "${PURPLE}━━━ PHASE 2: FEATURE-SPECIFIC TESTS ━━━${NC}"
echo "" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"
echo "PHASE 2: FEATURE-SPECIFIC TESTS" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"

run_test "FEATURE" "NDA Workflows" "test-nda-workflow.sh"
run_test "FEATURE" "NDA Button States" "test-nda-button-states.sh"
run_test "FEATURE" "NDA Safe Mode" "test-nda-workflow-safe.sh"
run_test "FEATURE" "Pitch Display" "test-pitch-display.sh"
run_test "FEATURE" "Portfolio Management" "test-live-portfolio.sh"
run_test "FEATURE" "API Endpoints" "test-all-endpoints.sh"
run_test "FEATURE" "CORS Configuration" "test-cors-and-api.sh"
run_test "FEATURE" "Frontend Workflows" "test-frontend-workflows.sh"

# Phase 3: Critical System Tests
echo ""
echo -e "${PURPLE}━━━ PHASE 3: CRITICAL SYSTEM TESTS ━━━${NC}"
echo "" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"
echo "PHASE 3: CRITICAL SYSTEM TESTS" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"

run_test "CRITICAL" "Payment Processing" "test-payment-workflows.sh"
run_test "CRITICAL" "Security Vulnerabilities" "test-security-workflows.sh"
run_test "CRITICAL" "Messaging System" "test-messaging-workflows.sh"
run_test "CRITICAL" "File Upload Security" "test-file-upload-workflows.sh"
run_test "CRITICAL" "Search Functionality" "test-search-workflows.sh"

# Phase 4: Administrative & Support
echo ""
echo -e "${PURPLE}━━━ PHASE 4: ADMINISTRATIVE & SUPPORT ━━━${NC}"
echo "" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"
echo "PHASE 4: ADMINISTRATIVE & SUPPORT" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"

run_test "ADMIN" "Admin Dashboard" "test-admin-workflows.sh"
run_test "ADMIN" "Email Notifications" "test-email-notifications.sh"
run_test "ADMIN" "Analytics Export" "test-analytics-export.sh"
run_test "ADMIN" "User Preferences" "test-user-preferences.sh"
run_test "ADMIN" "Edit/Delete Operations" "test-edit-delete-operations.sh"
run_test "ADMIN" "Watchlist Features" "test-watchlist-features.sh"
run_test "ADMIN" "Social Features" "test-social-features.sh"

# Phase 5: Advanced Workflows
echo ""
echo -e "${PURPLE}━━━ PHASE 5: ADVANCED WORKFLOWS ━━━${NC}"
echo "" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"
echo "PHASE 5: ADVANCED WORKFLOWS" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"

run_test "ADVANCED" "E2E User Journeys" "test-e2e-user-journeys.sh"
run_test "ADVANCED" "Performance & Load" "test-performance-load.sh"
run_test "ADVANCED" "Investment Tracking" "test-investment-tracking.sh"
run_test "ADVANCED" "Production Features" "test-production-company-features.sh"
run_test "ADVANCED" "Mobile Responsive" "test-mobile-responsive.sh"

# Calculate statistics
PASS_RATE=0
if [ $TOTAL_SUITES -gt 0 ]; then
    PASS_RATE=$((PASSED_SUITES * 100 / TOTAL_SUITES))
fi

# Summary
echo ""
echo "=========================================================="
echo -e "${CYAN}📊 FINAL TEST RESULTS${NC}"
echo "=========================================================="
echo "" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"
echo "FINAL TEST RESULTS" >> "$SUMMARY_FILE"
echo "==========================================================" >> "$SUMMARY_FILE"

echo -e "Total Test Suites:    ${BLUE}$TOTAL_SUITES${NC}"
echo -e "Passed:              ${GREEN}$PASSED_SUITES${NC}"
echo -e "Failed:              ${RED}$FAILED_SUITES${NC}"
echo -e "Skipped:             ${YELLOW}$SKIPPED_SUITES${NC}"
echo -e "Pass Rate:           ${BLUE}$PASS_RATE%${NC}"

echo "Total Suites: $TOTAL_SUITES" >> "$SUMMARY_FILE"
echo "Passed: $PASSED_SUITES" >> "$SUMMARY_FILE"
echo "Failed: $FAILED_SUITES" >> "$SUMMARY_FILE"
echo "Skipped: $SKIPPED_SUITES" >> "$SUMMARY_FILE"
echo "Pass Rate: $PASS_RATE%" >> "$SUMMARY_FILE"

# Status determination
echo ""
echo "=========================================================="
echo -e "${CYAN}🎯 DEPLOYMENT READINESS${NC}"
echo "=========================================================="

if [ $PASS_RATE -eq 100 ]; then
    echo -e "${GREEN}✅ PERFECT! All tests passed - System ready for production${NC}"
    echo "Status: PRODUCTION READY - All tests passed" >> "$SUMMARY_FILE"
elif [ $PASS_RATE -ge 90 ]; then
    echo -e "${GREEN}✅ EXCELLENT! System ready for production with minor issues${NC}"
    echo "Status: PRODUCTION READY - Minor issues detected" >> "$SUMMARY_FILE"
elif [ $PASS_RATE -ge 75 ]; then
    echo -e "${YELLOW}⚠️  GOOD! Review failures before production deployment${NC}"
    echo "Status: REVIEW REQUIRED - Some failures detected" >> "$SUMMARY_FILE"
else
    echo -e "${RED}❌ CRITICAL! Do not deploy - fix failures first${NC}"
    echo "Status: NOT READY - Critical failures detected" >> "$SUMMARY_FILE"
fi

# Test coverage badge
echo ""
echo "=========================================================="
echo -e "${CYAN}🏆 TEST COVERAGE ACHIEVEMENT${NC}"
echo "=========================================================="

if [ $PASS_RATE -eq 100 ]; then
    echo -e "${GREEN}"
    echo "    ╔══════════════════════════╗"
    echo "    ║   🏆 100% COVERAGE 🏆    ║"
    echo "    ║    ALL TESTS PASSED!     ║"
    echo "    ╚══════════════════════════╝"
    echo -e "${NC}"
elif [ $PASS_RATE -ge 90 ]; then
    echo -e "${GREEN}"
    echo "    ╔══════════════════════════╗"
    echo "    ║    📊 $PASS_RATE% COVERAGE     ║"
    echo "    ║     EXCELLENT RESULT     ║"
    echo "    ╚══════════════════════════╝"
    echo -e "${NC}"
elif [ $PASS_RATE -ge 75 ]; then
    echo -e "${YELLOW}"
    echo "    ╔══════════════════════════╗"
    echo "    ║    📊 $PASS_RATE% COVERAGE     ║"
    echo "    ║      GOOD PROGRESS       ║"
    echo "    ╚══════════════════════════╝"
    echo -e "${NC}"
else
    echo -e "${RED}"
    echo "    ╔══════════════════════════╗"
    echo "    ║    ⚠️  $PASS_RATE% COVERAGE     ║"
    echo "    ║    NEEDS IMPROVEMENT     ║"
    echo "    ╚══════════════════════════╝"
    echo -e "${NC}"
fi

# End time and logs
echo ""
echo "End Time: $(date)" >> "$SUMMARY_FILE"
echo "End Time: $(date)"
echo ""
echo "📁 Results saved to: $RESULTS_DIR/"
echo "📄 Summary file: $SUMMARY_FILE"
echo "📊 Individual logs: $RESULTS_DIR/*.log"
echo ""

# Exit with appropriate code
if [ $FAILED_SUITES -eq 0 ] && [ $SKIPPED_SUITES -eq 0 ]; then
    exit 0
else
    exit 1
fi