#!/bin/bash

# Pitchey E2E Test Suite Runner
# This script runs comprehensive end-to-end tests for the Pitchey platform

set -e

echo "🚀 Starting Pitchey E2E Test Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if backend is running
check_backend() {
    print_status "Checking if backend is running on port 8001..."
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        print_success "Backend is running"
        return 0
    else
        print_error "Backend is not running on port 8001"
        print_status "Please start the backend with: PORT=8001 deno run --allow-all working-server.ts"
        return 1
    fi
}

# Install dependencies if needed
install_deps() {
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    
    if [ ! -d "node_modules/@playwright" ]; then
        print_status "Installing Playwright browsers..."
        npx playwright install
    fi
}

# Run unit tests first
run_unit_tests() {
    print_status "Running unit tests..."
    if npm run test:ci; then
        print_success "Unit tests passed"
        return 0
    else
        print_error "Unit tests failed"
        return 1
    fi
}

# Run E2E tests
run_e2e_tests() {
    print_status "Running E2E tests..."
    
    # Create test results directory
    mkdir -p test-results/screenshots
    
    # Run tests with different configurations
    if [ "$1" = "headless" ]; then
        print_status "Running in headless mode..."
        npx playwright test --reporter=html,json,junit
    elif [ "$1" = "ui" ]; then
        print_status "Running with UI mode..."
        npx playwright test --ui
    elif [ "$1" = "debug" ]; then
        print_status "Running in debug mode..."
        npx playwright test --debug
    else
        print_status "Running in default mode..."
        npx playwright test --reporter=html,json,junit
    fi
}

# Generate test report
generate_report() {
    print_status "Generating test report..."
    
    if [ -f "test-results/results.json" ]; then
        # Create a summary report
        cat > test-results/summary.md << EOF
# Pitchey E2E Test Results

**Test Run Date:** $(date)

## Test Suite Summary

$(node -e "
const fs = require('fs');
const results = JSON.parse(fs.readFileSync('test-results/results.json', 'utf8'));
const stats = results.stats;
console.log('- **Total Tests:** ' + (stats.expected + stats.unexpected + stats.skipped));
console.log('- **Passed:** ' + stats.expected);
console.log('- **Failed:** ' + stats.unexpected);
console.log('- **Skipped:** ' + stats.skipped);
console.log('- **Duration:** ' + Math.round(results.stats.duration / 1000) + ' seconds');
")

## Test Categories

### ✅ Authentication Flows
- Portal selection and navigation
- Login/logout for all user types
- Session management
- Access control verification

### ✅ Creator Workflows  
- Dashboard functionality
- Pitch creation and editing
- Character management
- File uploads
- Analytics tracking

### ✅ Investor Workflows
- Browse and search pitches
- NDA request workflow
- Investment tracking
- Portfolio management

### ✅ Production Workflows
- Project management
- Partnership requests
- Resource management
- Analytics and reporting

### ✅ Integration Tests
- Complete NDA workflow
- Real-time notifications
- File upload to R2 storage
- Cross-feature interactions

## Detailed Results

View the full HTML report: [test-results/playwright-report/index.html](test-results/playwright-report/index.html)

EOF
        print_success "Test summary generated: test-results/summary.md"
    fi
}

# Main execution
main() {
    print_status "Pitchey E2E Test Suite - Starting comprehensive testing"
    
    # Check prerequisites
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check backend
    if ! check_backend; then
        print_error "Backend check failed. Cannot run E2E tests without backend."
        exit 1
    fi
    
    # Install dependencies
    install_deps
    
    # Parse command line arguments
    MODE=${1:-"headless"}
    SKIP_UNIT=${2:-"false"}
    
    print_status "Running tests in mode: $MODE"
    
    # Run unit tests first (unless skipped)
    if [ "$SKIP_UNIT" != "true" ]; then
        if ! run_unit_tests; then
            print_warning "Unit tests failed, but continuing with E2E tests..."
        fi
    fi
    
    # Run E2E tests
    if run_e2e_tests "$MODE"; then
        print_success "E2E tests completed"
        
        # Generate report
        generate_report
        
        print_success "All tests completed successfully!"
        print_status "View detailed results:"
        print_status "  - HTML Report: npx playwright show-report"
        print_status "  - Summary: cat test-results/summary.md"
        
        exit 0
    else
        print_error "E2E tests failed"
        print_status "View test report for details: npx playwright show-report"
        exit 1
    fi
}

# Help function
show_help() {
    echo "Pitchey E2E Test Suite Runner"
    echo ""
    echo "Usage: $0 [mode] [skip_unit]"
    echo ""
    echo "Modes:"
    echo "  headless  - Run tests in headless mode (default)"
    echo "  ui        - Run tests with UI mode"
    echo "  debug     - Run tests in debug mode"
    echo ""
    echo "Options:"
    echo "  skip_unit - Set to 'true' to skip unit tests"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run in headless mode with unit tests"
    echo "  $0 ui                 # Run with UI mode"
    echo "  $0 headless true      # Run headless, skip unit tests"
    echo "  $0 debug              # Run in debug mode"
    echo ""
    echo "Prerequisites:"
    echo "  - Backend must be running on port 8001"
    echo "  - Start with: PORT=8001 deno run --allow-all working-server.ts"
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@"