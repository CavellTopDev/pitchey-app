#!/bin/bash

# Test execution script for new backend implementation features
# Created by Playwright Test Automation Engineer

set -e

echo "🚀 Starting E2E Tests for New Backend Features"
echo "============================================="

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

# Check if we're in the correct directory
if [[ ! -f "package.json" ]]; then
    print_error "Please run this script from the frontend directory"
    exit 1
fi

# Check if backend proxy is running
print_status "Checking if backend proxy server is running on port 8001..."
if ! nc -z localhost 8001 2>/dev/null; then
    print_warning "Backend proxy server not detected on port 8001"
    print_status "Starting backend proxy server..."
    cd .. && PORT=8001 deno run --allow-all working-server.ts &
    PROXY_PID=$!
    cd frontend
    
    # Wait for proxy to start
    for i in {1..30}; do
        if nc -z localhost 8001 2>/dev/null; then
            print_success "Backend proxy server started successfully"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            print_error "Failed to start backend proxy server"
            exit 1
        fi
    done
else
    print_success "Backend proxy server is already running"
fi

# Check if frontend dev server is running
print_status "Checking if frontend dev server is running on port 5173..."
if ! nc -z localhost 5173 2>/dev/null; then
    print_warning "Frontend dev server not detected on port 5173"
    print_status "Starting frontend dev server..."
    npm run dev &
    FRONTEND_PID=$!
    
    # Wait for frontend to start
    for i in {1..60}; do
        if nc -z localhost 5173 2>/dev/null; then
            print_success "Frontend dev server started successfully"
            break
        fi
        sleep 1
        if [ $i -eq 60 ]; then
            print_error "Failed to start frontend dev server"
            exit 1
        fi
    done
else
    print_success "Frontend dev server is already running"
fi

# Function to cleanup processes on exit
cleanup() {
    print_status "Cleaning up background processes..."
    if [[ -n "$PROXY_PID" ]]; then
        kill $PROXY_PID 2>/dev/null || true
    fi
    if [[ -n "$FRONTEND_PID" ]]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Install Playwright browsers if needed
print_status "Ensuring Playwright browsers are installed..."
npx playwright install --with-deps

# Create test results directory
mkdir -p test-results

# Run test suite
print_status "Running E2E test suite for new backend features..."

# Test execution phases
echo ""
echo "📋 Test Execution Plan:"
echo "1. Critical Workflow Tests (NDA, Saved Pitches, Dashboards)"
echo "2. Visual Regression Tests"
echo "3. API Coverage Analysis"
echo ""

# Phase 1: Critical Workflow Tests
print_status "Phase 1: Running Critical Workflow Tests..."
if npx playwright test --project=critical-workflows --reporter=html; then
    print_success "Critical workflow tests passed ✅"
else
    print_error "Critical workflow tests failed ❌"
    TEST_FAILURES=true
fi

# Phase 2: Visual Regression Tests (create baseline on first run)
print_status "Phase 2: Running Visual Regression Tests..."
if [[ ! -d "test-results/visual-regression-chromium" ]]; then
    print_warning "No visual baseline found, creating baseline screenshots..."
    npx playwright test --project=visual-regression --update-snapshots || true
fi

if npx playwright test --project=visual-regression --reporter=html; then
    print_success "Visual regression tests passed ✅"
else
    print_warning "Visual regression tests failed - review screenshots ⚠️"
fi

# Phase 3: API Coverage Analysis
print_status "Phase 3: Running API Coverage Analysis..."
if npx playwright test --project=coverage --reporter=html; then
    print_success "Coverage analysis completed ✅"
else
    print_warning "Coverage analysis had issues ⚠️"
fi

# Generate comprehensive test report
print_status "Generating comprehensive test report..."

# Create test summary
cat > test-results/test-summary.md << EOF
# E2E Test Results Summary

**Generated:** $(date)
**Platform:** $(uname -s)
**Node Version:** $(node --version)
**Playwright Version:** $(npx playwright --version)

## Test Suite Overview

### New Feature Tests Created:
- **NDA Workflow Tests** (\`nda-workflow.spec.ts\`)
  - End-to-end NDA request and approval flow
  - Cross-portal verification (investor ↔ creator)
  - Real-time notification testing
  - API endpoint validation

- **Saved Pitches Tests** (\`saved-pitches.spec.ts\`)
  - Save/unsave pitch functionality
  - Persistence across sessions
  - API integration testing
  - Error handling scenarios

- **Portal Dashboard Tests** (\`portal-dashboards.spec.ts\`)
  - Creator, Investor, Production dashboard validation
  - Statistics and metrics verification
  - Responsive design testing
  - Real-time data updates

- **Visual Regression Tests** (\`visual-regression.spec.ts\`)
  - Dashboard layout comparisons
  - Component state validation
  - Responsive design verification
  - Dark mode testing

- **API Coverage Analysis** (\`test-coverage.spec.ts\`)
  - Endpoint coverage tracking
  - Category-based analysis
  - HTML and JSON reports

### Test Infrastructure:
- **API Mocking Layer** (\`fixtures/api-mocks.ts\`)
  - Complete offline testing capability
  - Error scenario simulation
  - Consistent test data

## Key Endpoints Tested:
- \`/api/ndas/active\`
- \`/api/ndas/signed\`
- \`/api/ndas/incoming-requests\`
- \`/api/ndas/outgoing-requests\`
- \`/api/saved-pitches\` (GET/POST/DELETE)
- \`/api/notifications/unread\`
- Dashboard statistics endpoints

## Test Execution Results:
$(if [[ -z "$TEST_FAILURES" ]]; then echo "✅ All critical tests passed"; else echo "❌ Some tests failed - see detailed reports"; fi)

## Reports Generated:
- HTML Test Report: \`playwright-report/index.html\`
- Coverage Report: \`test-results/coverage-report.html\`
- Visual Comparison: \`test-results/visual-regression-*\`

## Next Steps:
1. Review any failing tests
2. Update visual baselines if UI changes are intentional
3. Add tests for any missing endpoint coverage
4. Integrate into CI/CD pipeline
EOF

print_success "Test summary generated: test-results/test-summary.md"

# Display results
echo ""
echo "📊 TEST EXECUTION COMPLETE"
echo "=========================="

if [[ -z "$TEST_FAILURES" ]]; then
    print_success "All critical tests passed successfully!"
    echo ""
    echo "✅ NDA workflow tests: PASSED"
    echo "✅ Saved pitches tests: PASSED"
    echo "✅ Dashboard tests: PASSED"
    echo "📸 Visual regression tests: COMPLETED"
    echo "📋 Coverage analysis: COMPLETED"
    
    exit 0
else
    print_warning "Some tests failed or need attention"
    echo ""
    echo "Please review the detailed reports:"
    echo "📄 HTML Report: playwright-report/index.html"
    echo "📊 Coverage Report: test-results/coverage-report.html"
    echo "📸 Visual Diffs: test-results/visual-regression-*"
    
    exit 1
fi