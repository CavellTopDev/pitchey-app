#!/bin/bash

# Pitchey E2E Test Suite Runner
# Comprehensive test script for running Playwright end-to-end tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BROWSER="chromium"
UI_MODE=false
DEBUG=false
HEADED=false
PARALLEL=true
WORKERS=4
REPORT_OPEN=false
CLEAN_REPORTS=false

# Test suite options
RUN_AUTH=true
RUN_CREATOR=true
RUN_INVESTOR=true
RUN_PRODUCTION=true
RUN_CROSS_PORTAL=true
RUN_PUBLIC=true
RUN_ACCESSIBILITY=false
RUN_WEBSOCKET=false
RUN_PERFORMANCE=false

# Function to print colored output
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Legacy function names for backward compatibility
print_status() { log_info "$1"; }
print_success() { log_success "$1"; }
print_warning() { log_warning "$1"; }
print_error() { log_error "$1"; }

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

print_usage() {
    echo -e "${BLUE}Pitchey E2E Test Runner${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS] [TEST_SUITE]"
    echo ""
    echo "Test Suites:"
    echo "  auth                Run authentication tests only"
    echo "  creator             Run creator workflow tests only" 
    echo "  investor            Run investor workflow tests only"
    echo "  production          Run production workflow tests only"
    echo "  cross-portal        Run cross-portal interaction tests only"
    echo "  public              Run public browsing tests only"
    echo "  accessibility       Run accessibility tests only"
    echo "  websocket           Run WebSocket/real-time tests only"
    echo "  performance         Run performance tests only"
    echo "  core                Run core tests (auth + creator + investor + production)"
    echo "  full                Run all tests including optional suites"
    echo ""
    echo "Options:"
    echo "  -b, --browser BROWSER    Browser to use (chromium|firefox|webkit|all) [default: chromium]"
    echo "  -u, --ui                 Run tests in UI mode"
    echo "  -d, --debug              Run tests in debug mode"
    echo "  -h, --headed             Run tests in headed mode"
    echo "  -s, --serial             Run tests serially (not in parallel)"
    echo "  -w, --workers N          Number of workers for parallel execution [default: 4]"
    echo "  -r, --report             Open test report after completion"
    echo "  -c, --clean              Clean previous test reports"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                       # Run core test suites"
    echo "  $0 auth                  # Run only authentication tests"
    echo "  $0 full -b firefox       # Run all tests on Firefox"
    echo "  $0 creator -u            # Run creator tests in UI mode"
    echo "  $0 accessibility -h      # Run accessibility tests in headed mode"
    echo "  $0 -b all --clean        # Run core tests on all browsers, clean reports"
    echo ""
    echo "Prerequisites:"
    echo "  - Backend must be running on port 8001"
    echo "  - Start with: PORT=8001 deno run --allow-all working-server.ts"
}

# Legacy help function for backward compatibility
show_help() {
    print_usage
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if we're in the frontend directory
    if [ ! -f "package.json" ]; then
        log_error "package.json not found. Make sure you're in the frontend directory."
        exit 1
    fi
    
    # Check if Playwright is installed
    if ! npx playwright --version >/dev/null 2>&1; then
        log_error "Playwright not found. Installing..."
        npm install @playwright/test
    fi
    
    # Check if browsers are installed
    log_info "Checking Playwright browsers..."
    if ! npx playwright install --dry-run >/dev/null 2>&1; then
        log_warning "Playwright browsers not installed. Installing..."
        npx playwright install
    fi
    
    log_success "Prerequisites check completed"
}

check_services() {
    log_info "Checking required services..."
    
    # Check frontend (port 5173)
    if ! curl -s http://localhost:5173 >/dev/null; then
        log_warning "Frontend not running on port 5173"
        log_info "Start with: npm run dev"
    else
        log_success "Frontend service is running"
    fi
    
    # Check backend proxy (port 8001)
    if ! curl -s http://localhost:8001/api/health >/dev/null 2>&1; then
        log_warning "Backend proxy not running on port 8001"
        log_info "Start with: PORT=8001 deno run --allow-all ../working-server.ts"
    else
        log_success "Backend proxy service is running"
    fi
}

clean_reports() {
    if [ "$CLEAN_REPORTS" = true ]; then
        log_info "Cleaning previous test reports..."
        rm -rf test-results/ playwright-report/ test-results-*
        log_success "Reports cleaned"
    fi
}

build_test_command() {
    local cmd="npx playwright test"
    
    # Add browser selection
    if [ "$BROWSER" != "all" ]; then
        cmd="$cmd --project=$BROWSER"
    fi
    
    # Add UI mode
    if [ "$UI_MODE" = true ]; then
        cmd="$cmd --ui"
    fi
    
    # Add debug mode
    if [ "$DEBUG" = true ]; then
        cmd="$cmd --debug"
    fi
    
    # Add headed mode
    if [ "$HEADED" = true ]; then
        cmd="$cmd --headed"
    fi
    
    # Add parallel/serial execution
    if [ "$PARALLEL" = false ]; then
        cmd="$cmd --workers=1"
    else
        cmd="$cmd --workers=$WORKERS"
    fi
    
    # Add test file filters based on selected suites
    local test_files=()
    
    if [ "$RUN_AUTH" = true ]; then
        test_files+=("auth-workflows.spec.ts")
    fi
    
    if [ "$RUN_CREATOR" = true ]; then
        test_files+=("creator-workflows.spec.ts")
    fi
    
    if [ "$RUN_INVESTOR" = true ]; then
        test_files+=("investor-workflows.spec.ts")
    fi
    
    if [ "$RUN_PRODUCTION" = true ]; then
        test_files+=("production-workflows.spec.ts")
    fi
    
    if [ "$RUN_CROSS_PORTAL" = true ]; then
        test_files+=("cross-portal-interactions.spec.ts")
    fi
    
    if [ "$RUN_PUBLIC" = true ]; then
        test_files+=("public-browsing.spec.ts")
    fi
    
    if [ "$RUN_ACCESSIBILITY" = true ]; then
        test_files+=("accessibility.spec.ts")
    fi
    
    if [ "$RUN_WEBSOCKET" = true ]; then
        test_files+=("websocket-realtime.spec.ts")
    fi
    
    if [ "$RUN_PERFORMANCE" = true ]; then
        test_files+=("performance.spec.ts")
    fi
    
    # Add test files to command
    if [ ${#test_files[@]} -gt 0 ]; then
        for file in "${test_files[@]}"; do
            cmd="$cmd e2e/$file"
        done
    fi
    
    echo "$cmd"
}

run_tests() {
    local cmd=$(build_test_command)
    
    log_info "Running command: $cmd"
    echo ""
    
    # Run the tests
    if eval "$cmd"; then
        log_success "All tests passed!"
        return 0
    else
        log_error "Some tests failed"
        return 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -u|--ui)
            UI_MODE=true
            shift
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -h|--headed)
            HEADED=true
            shift
            ;;
        -s|--serial)
            PARALLEL=false
            shift
            ;;
        -w|--workers)
            WORKERS="$2"
            shift 2
            ;;
        -r|--report)
            REPORT_OPEN=true
            shift
            ;;
        -c|--clean)
            CLEAN_REPORTS=true
            shift
            ;;
        --help)
            print_usage
            exit 0
            ;;
        auth)
            RUN_AUTH=true
            RUN_CREATOR=false
            RUN_INVESTOR=false
            RUN_PRODUCTION=false
            RUN_CROSS_PORTAL=false
            RUN_PUBLIC=false
            shift
            ;;
        creator)
            RUN_AUTH=false
            RUN_CREATOR=true
            RUN_INVESTOR=false
            RUN_PRODUCTION=false
            RUN_CROSS_PORTAL=false
            RUN_PUBLIC=false
            shift
            ;;
        investor)
            RUN_AUTH=false
            RUN_CREATOR=false
            RUN_INVESTOR=true
            RUN_PRODUCTION=false
            RUN_CROSS_PORTAL=false
            RUN_PUBLIC=false
            shift
            ;;
        production)
            RUN_AUTH=false
            RUN_CREATOR=false
            RUN_INVESTOR=false
            RUN_PRODUCTION=true
            RUN_CROSS_PORTAL=false
            RUN_PUBLIC=false
            shift
            ;;
        cross-portal)
            RUN_AUTH=false
            RUN_CREATOR=false
            RUN_INVESTOR=false
            RUN_PRODUCTION=false
            RUN_CROSS_PORTAL=true
            RUN_PUBLIC=false
            shift
            ;;
        public)
            RUN_AUTH=false
            RUN_CREATOR=false
            RUN_INVESTOR=false
            RUN_PRODUCTION=false
            RUN_CROSS_PORTAL=false
            RUN_PUBLIC=true
            shift
            ;;
        accessibility)
            RUN_AUTH=false
            RUN_CREATOR=false
            RUN_INVESTOR=false
            RUN_PRODUCTION=false
            RUN_CROSS_PORTAL=false
            RUN_PUBLIC=false
            RUN_ACCESSIBILITY=true
            shift
            ;;
        websocket)
            RUN_AUTH=false
            RUN_CREATOR=false
            RUN_INVESTOR=false
            RUN_PRODUCTION=false
            RUN_CROSS_PORTAL=false
            RUN_PUBLIC=false
            RUN_WEBSOCKET=true
            shift
            ;;
        performance)
            RUN_AUTH=false
            RUN_CREATOR=false
            RUN_INVESTOR=false
            RUN_PRODUCTION=false
            RUN_CROSS_PORTAL=false
            RUN_PUBLIC=false
            RUN_PERFORMANCE=true
            shift
            ;;
        core)
            # Default values already set for core tests
            shift
            ;;
        full)
            RUN_AUTH=true
            RUN_CREATOR=true
            RUN_INVESTOR=true
            RUN_PRODUCTION=true
            RUN_CROSS_PORTAL=true
            RUN_PUBLIC=true
            RUN_ACCESSIBILITY=true
            RUN_WEBSOCKET=true
            RUN_PERFORMANCE=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Enhanced main function
enhanced_main() {
    echo -e "${BLUE}"
    echo "=============================================="
    echo "         Pitchey E2E Test Runner"
    echo "=============================================="
    echo -e "${NC}"
    
    check_prerequisites
    check_services
    clean_reports
    
    echo ""
    log_info "Test Configuration:"
    log_info "  Browser: $BROWSER"
    log_info "  UI Mode: $UI_MODE"
    log_info "  Debug Mode: $DEBUG"
    log_info "  Headed Mode: $HEADED"
    log_info "  Parallel: $PARALLEL"
    log_info "  Workers: $WORKERS"
    echo ""
    
    log_info "Selected Test Suites:"
    [ "$RUN_AUTH" = true ] && log_info "  ✓ Authentication"
    [ "$RUN_CREATOR" = true ] && log_info "  ✓ Creator Workflows"
    [ "$RUN_INVESTOR" = true ] && log_info "  ✓ Investor Workflows"
    [ "$RUN_PRODUCTION" = true ] && log_info "  ✓ Production Workflows"
    [ "$RUN_CROSS_PORTAL" = true ] && log_info "  ✓ Cross-Portal Interactions"
    [ "$RUN_PUBLIC" = true ] && log_info "  ✓ Public Browsing"
    [ "$RUN_ACCESSIBILITY" = true ] && log_info "  ✓ Accessibility"
    [ "$RUN_WEBSOCKET" = true ] && log_info "  ✓ WebSocket/Real-time"
    [ "$RUN_PERFORMANCE" = true ] && log_info "  ✓ Performance"
    echo ""
    
    if run_tests; then
        echo ""
        log_success "🎉 Test execution completed successfully!"
        
        if [ "$REPORT_OPEN" = true ]; then
            log_info "Opening test report..."
            npx playwright show-report
        fi
        exit 0
    else
        echo ""
        log_error "❌ Test execution failed"
        log_info "View test report for details: npx playwright show-report"
        exit 1
    fi
}

# Check for help flag
if [ "$1" = "--help" ] || [ "$1" = "help" ]; then
    print_usage
    exit 0
fi

# Check if we should run enhanced or legacy mode
if [[ "$*" =~ (-b|--browser|-u|--ui|-d|--debug|-h|--headed|-s|--serial|-w|--workers|-r|--report|-c|--clean|auth|creator|investor|production|cross-portal|public|accessibility|websocket|performance|core|full) ]]; then
    enhanced_main
else
    main "$@"
fi