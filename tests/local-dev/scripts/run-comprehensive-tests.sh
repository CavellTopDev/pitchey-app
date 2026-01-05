#!/bin/bash

# Comprehensive Test Runner
# Executes all local development tests in sequence

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🧪 Pitchey Local Development - Comprehensive Test Suite${NC}"
echo "======================================================="
echo "Timestamp: $(date)"
echo "Test Environment: Local Development with Podman"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}📋 Test Plan:${NC}"
echo "============"
echo "1. 🩺 API Health Check"
echo "2. 🔐 Authentication Flow Test"  
echo "3. 📁 File Upload Test"
echo "4. 🧪 Deno Integration Tests (All Suites)"
echo "5. 📊 Performance Monitoring"
echo ""

# Initialize counters
total_test_suites=0
passed_test_suites=0
failed_tests=()

# Function to run a test and track results
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    local icon="$3"
    
    ((total_test_suites++))
    
    echo -e "${YELLOW}${icon} Running ${test_name}...${NC}"
    echo "$(printf '=%.0s' {1..50})"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ ${test_name}: PASSED${NC}"
        ((passed_test_suites++))
        echo ""
        return 0
    else
        echo -e "${RED}❌ ${test_name}: FAILED${NC}"
        failed_tests+=("$test_name")
        echo ""
        return 1
    fi
}

# Check prerequisites
echo -e "${BLUE}🔧 Checking Prerequisites...${NC}"
echo "=============================="

# Check if backend is running
if ! curl -s "http://localhost:8001/health" > /dev/null; then
    echo -e "${RED}❌ Backend server not running on port 8001${NC}"
    echo "Please start the backend server:"
    echo "  PORT=8001 deno run --allow-all working-server.ts"
    exit 1
fi
echo -e "${GREEN}✅ Backend server is running${NC}"

# Check if Podman services are available
if ! curl -s "http://localhost:9000/minio/health/live" > /dev/null; then
    echo -e "${RED}❌ MinIO not accessible on port 9000${NC}"
    echo "Please start Podman services:"
    echo "  ./podman-local.sh start"
    exit 1
fi
echo -e "${GREEN}✅ Podman services are running${NC}"

echo ""

# Run test suites
echo -e "${CYAN}🚀 Executing Test Suites...${NC}"
echo "============================"
echo ""

# 1. API Health Check
run_test_suite "API Health Check" "$SCRIPT_DIR/api-health-check.sh" "🩺"

# 2. Authentication Flow Test  
run_test_suite "Authentication Flow Test" "$SCRIPT_DIR/auth-flow-test.sh" "🔐"

# 3. File Upload Test
run_test_suite "File Upload Test" "$SCRIPT_DIR/file-upload-test.sh" "📁"

# 4. Deno Integration Tests
if command -v deno >/dev/null 2>&1; then
    echo -e "${YELLOW}🧪 Running Deno Integration Tests...${NC}"
    echo "$(printf '=%.0s' {1..50})"
    
    # Check if the main test runner exists
    if [ -f "$TEST_DIR/run-all-tests.ts" ]; then
        ((total_test_suites++))
        
        echo "Starting comprehensive Deno test suite..."
        echo ""
        
        if deno run --allow-all "$TEST_DIR/run-all-tests.ts"; then
            echo -e "${GREEN}✅ Deno Integration Tests: PASSED${NC}"
            ((passed_test_suites++))
        else
            echo -e "${RED}❌ Deno Integration Tests: FAILED${NC}"
            failed_tests+=("Deno Integration Tests")
        fi
    else
        echo -e "${YELLOW}⚠️  Deno test runner not found, skipping integration tests${NC}"
    fi
    
    echo ""
else
    echo -e "${YELLOW}⚠️  Deno not available, skipping integration tests${NC}"
    echo ""
fi

# 5. Performance Monitoring (optional)
echo -e "${YELLOW}📊 Performance Quick Check...${NC}"
echo "$(printf '=%.0s' {1..50})"

start_time=$(date +%s%N)

# Test a few endpoints for basic performance
api_response_time=$(curl -s -w "%{time_total}" -o /dev/null "http://localhost:8001/api/health" || echo "timeout")
browse_response_time=$(curl -s -w "%{time_total}" -o /dev/null "http://localhost:8001/api/pitches/browse" || echo "timeout")

end_time=$(date +%s%N)
total_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

echo "API health response time: ${api_response_time}s"
echo "Browse endpoint response time: ${browse_response_time}s"
echo "Quick performance check completed in: ${total_time}ms"

if [ "$api_response_time" != "timeout" ] && [ "$browse_response_time" != "timeout" ]; then
    echo -e "${GREEN}✅ Performance check: Basic endpoints responsive${NC}"
else
    echo -e "${RED}❌ Performance check: Some endpoints not responding${NC}"
fi

echo ""

# Generate summary report
echo -e "${CYAN}📋 TEST EXECUTION SUMMARY${NC}"
echo "=========================="
echo ""

echo "Test Suites Executed: $total_test_suites"
echo "Test Suites Passed: $passed_test_suites"
echo "Test Suites Failed: $((total_test_suites - passed_test_suites))"
echo ""

if [ ${#failed_tests[@]} -gt 0 ]; then
    echo -e "${RED}Failed Test Suites:${NC}"
    for failed_test in "${failed_tests[@]}"; do
        echo "  ❌ $failed_test"
    done
    echo ""
fi

# Calculate success rate
if [ $total_test_suites -gt 0 ]; then
    success_rate=$(( (passed_test_suites * 100) / total_test_suites ))
    echo "Success Rate: $success_rate%"
else
    success_rate=0
    echo "Success Rate: N/A"
fi

echo ""

# Final assessment
if [ $passed_test_suites -eq $total_test_suites ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    echo -e "${GREEN}=============================${NC}"
    echo -e "${GREEN}✅ Local development environment is fully functional${NC}"
    echo -e "${GREEN}✅ All Podman services are working correctly${NC}"
    echo -e "${GREEN}✅ Authentication system is operational${NC}"
    echo -e "${GREEN}✅ File upload and storage integration working${NC}"
    echo -e "${GREEN}✅ API endpoints are responsive and secure${NC}"
    echo ""
    echo -e "${CYAN}🚀 Ready for development! 🚀${NC}"
    
elif [ $success_rate -ge 80 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY SUCCESSFUL (${success_rate}%) ⚠️${NC}"
    echo -e "${YELLOW}================================${NC}"
    echo -e "${YELLOW}🔧 Local development environment is mostly functional${NC}"
    echo -e "${YELLOW}🔧 Some features may need attention${NC}"
    echo ""
    echo "Recommendations:"
    echo "- Review failed test details above"
    echo "- Check service logs: ./podman-local.sh logs"
    echo "- Restart services if needed: ./podman-local.sh stop && ./podman-local.sh start"
    
elif [ $success_rate -ge 50 ]; then
    echo -e "${RED}❌ SIGNIFICANT ISSUES (${success_rate}%) ❌${NC}"
    echo -e "${RED}=============================${NC}"
    echo -e "${RED}🚨 Local development environment has issues${NC}"
    echo -e "${RED}🚨 Multiple systems are not working correctly${NC}"
    echo ""
    echo "Required Actions:"
    echo "- Check all failed tests above"
    echo "- Verify all Podman services are running: ./podman-local.sh status"
    echo "- Check backend server logs"
    echo "- Verify database connection and seeding"
    
else
    echo -e "${RED}💥 CRITICAL FAILURES (${success_rate}%) 💥${NC}"
    echo -e "${RED}=========================${NC}"
    echo -e "${RED}🆘 Local development environment is not functional${NC}"
    echo -e "${RED}🆘 Major systems are failing${NC}"
    echo ""
    echo "Urgent Actions Required:"
    echo "- Stop and restart all services: ./podman-local.sh reset && ./podman-local.sh start"
    echo "- Check if all required ports are available"
    echo "- Verify backend server configuration"
    echo "- Check system resources and dependencies"
fi

echo ""
echo "Test completed at: $(date)"

# Create test report file
REPORT_FILE="$TEST_DIR/reports/comprehensive-test-report-$(date +%Y%m%d-%H%M%S).txt"
mkdir -p "$TEST_DIR/reports"

{
    echo "Pitchey Local Development - Comprehensive Test Report"
    echo "===================================================="
    echo "Timestamp: $(date)"
    echo "Environment: Local Development with Podman"
    echo ""
    echo "SUMMARY:"
    echo "--------"
    echo "Total Test Suites: $total_test_suites"
    echo "Passed: $passed_test_suites"
    echo "Failed: $((total_test_suites - passed_test_suites))"
    echo "Success Rate: $success_rate%"
    echo ""
    if [ ${#failed_tests[@]} -gt 0 ]; then
        echo "FAILED TESTS:"
        echo "------------"
        for failed_test in "${failed_tests[@]}"; do
            echo "- $failed_test"
        done
        echo ""
    fi
    echo "STATUS: $([ $success_rate -ge 80 ] && echo "FUNCTIONAL" || echo "NEEDS ATTENTION")"
} > "$REPORT_FILE"

echo "📄 Detailed report saved to: $REPORT_FILE"

# Exit with appropriate code
if [ $success_rate -ge 80 ]; then
    exit 0
else
    exit 1
fi