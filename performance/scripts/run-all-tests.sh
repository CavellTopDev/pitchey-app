#!/bin/bash

# Comprehensive Performance Test Runner for Pitchey Platform
# Runs all performance tests in sequence and generates consolidated report

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PERF_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORTS_DIR="$PERF_DIR/reports"
LOG_FILE="$REPORTS_DIR/test-execution.log"

# Environment variables
API_URL="${API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
WS_URL="${WS_URL:-wss://pitchey-production.cavelltheleaddev.workers.dev/ws}"
FRONTEND_URL="${FRONTEND_URL:-https://pitchey.pages.dev}"
INTENSITY="${INTENSITY:-medium}"

# Test configuration based on intensity
case "$INTENSITY" in
  "light")
    K6_VUS=10
    K6_DURATION="2m"
    LIGHTHOUSE_THROTTLE="none"
    ;;
  "medium")
    K6_VUS=50
    K6_DURATION="5m"
    LIGHTHOUSE_THROTTLE="fast3g"
    ;;
  "heavy")
    K6_VUS=100
    K6_DURATION="10m"
    LIGHTHOUSE_THROTTLE="slow3g"
    ;;
  *)
    echo "Invalid intensity level: $INTENSITY"
    echo "Valid options: light, medium, heavy"
    exit 1
    ;;
esac

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
  echo -e "${RED}ERROR: $1${NC}" >&2
  log "ERROR: $1"
  exit 1
}

# Success logging
success() {
  echo -e "${GREEN}✓ $1${NC}"
  log "SUCCESS: $1"
}

# Warning logging
warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
  log "WARNING: $1"
}

# Info logging
info() {
  echo -e "${BLUE}ℹ $1${NC}"
  log "INFO: $1"
}

# Check prerequisites
check_prerequisites() {
  info "Checking prerequisites..."
  
  # Check if k6 is installed
  if ! command -v k6 &> /dev/null; then
    error_exit "k6 is not installed. Please install k6 first."
  fi
  
  # Check if node is installed
  if ! command -v node &> /dev/null; then
    error_exit "Node.js is not installed. Please install Node.js first."
  fi
  
  # Check API availability
  info "Checking API availability..."
  if ! curl -s --fail "$API_URL/api/health" > /dev/null; then
    error_exit "API is not available at $API_URL"
  fi
  
  success "Prerequisites check passed"
}

# Setup test environment
setup_environment() {
  info "Setting up test environment..."
  
  # Create reports directory
  mkdir -p "$REPORTS_DIR"
  
  # Clear old log file
  echo "Performance Test Execution Log - $(date)" > "$LOG_FILE"
  
  # Install Lighthouse dependencies if needed
  if [ -f "$PERF_DIR/lighthouse/package.json" ]; then
    cd "$PERF_DIR/lighthouse"
    if [ ! -d "node_modules" ]; then
      info "Installing Lighthouse dependencies..."
      npm install --silent || error_exit "Failed to install Lighthouse dependencies"
    fi
    cd "$PERF_DIR"
  fi
  
  success "Environment setup complete"
}

# Run K6 API Load Tests
run_k6_api_tests() {
  info "Running K6 API Load Tests (Intensity: $INTENSITY)..."
  
  cd "$PERF_DIR"
  
  # Set environment variables for K6
  export BASE_URL="$API_URL"
  export K6_VUS="$K6_VUS"
  export K6_DURATION="$K6_DURATION"
  
  # Run the test
  if k6 run \
    --env BASE_URL="$API_URL" \
    --env SCENARIO="normal_load" \
    --quiet \
    --no-usage-report \
    k6/api-load-test.js; then
    success "K6 API Load Tests completed"
  else
    warn "K6 API Load Tests completed with issues"
  fi
}

# Run K6 WebSocket Tests
run_k6_websocket_tests() {
  info "Running K6 WebSocket Tests..."
  
  cd "$PERF_DIR"
  
  if k6 run \
    --env WS_URL="$WS_URL" \
    --env API_URL="$API_URL" \
    --env SCENARIO="messaging_load" \
    --quiet \
    --no-usage-report \
    k6/websocket-load-test.js; then
    success "K6 WebSocket Tests completed"
  else
    warn "K6 WebSocket Tests completed with issues"
  fi
}

# Run K6 Database Stress Tests
run_k6_database_tests() {
  info "Running K6 Database Stress Tests..."
  
  cd "$PERF_DIR"
  
  if k6 run \
    --env API_URL="$API_URL" \
    --env SCENARIO="heavy_queries" \
    --quiet \
    --no-usage-report \
    k6/database-stress-test.js; then
    success "K6 Database Stress Tests completed"
  else
    warn "K6 Database Stress Tests completed with issues"
  fi
}

# Run Lighthouse Core Web Vitals Tests
run_lighthouse_tests() {
  info "Running Lighthouse Core Web Vitals Tests..."
  
  cd "$PERF_DIR/lighthouse"
  
  # Set environment variables
  export FRONTEND_URL="$FRONTEND_URL"
  export LIGHTHOUSE_THROTTLE="$LIGHTHOUSE_THROTTLE"
  
  if timeout 30m node core-web-vitals.js; then
    success "Lighthouse Tests completed"
  else
    warn "Lighthouse Tests completed with issues or timeout"
  fi
  
  cd "$PERF_DIR"
}

# Generate analysis report
generate_analysis_report() {
  info "Generating performance analysis report..."
  
  cd "$PERF_DIR"
  
  if node analysis/performance-analyzer.js "$REPORTS_DIR"; then
    success "Performance analysis report generated"
  else
    warn "Performance analysis completed with issues"
  fi
}

# Upload results (placeholder for CI/CD integration)
upload_results() {
  info "Preparing results for upload..."
  
  # Create summary file
  cat << EOF > "$REPORTS_DIR/test-summary.json"
{
  "timestamp": "$(date -Iseconds)",
  "intensity": "$INTENSITY",
  "environment": {
    "api_url": "$API_URL",
    "ws_url": "$WS_URL", 
    "frontend_url": "$FRONTEND_URL"
  },
  "configuration": {
    "k6_vus": $K6_VUS,
    "k6_duration": "$K6_DURATION",
    "lighthouse_throttle": "$LIGHTHOUSE_THROTTLE"
  },
  "reports_directory": "$REPORTS_DIR"
}
EOF
  
  # Count generated reports
  REPORT_COUNT=$(find "$REPORTS_DIR" -name "*.json" -o -name "*.html" | wc -l)
  
  success "Test summary created - $REPORT_COUNT reports generated"
}

# Print summary
print_summary() {
  echo ""
  echo "=========================================="
  echo "     PERFORMANCE TESTING COMPLETE"
  echo "=========================================="
  echo ""
  echo "Configuration:"
  echo "  Intensity: $INTENSITY"
  echo "  API URL: $API_URL"
  echo "  Frontend URL: $FRONTEND_URL"
  echo ""
  echo "Reports Location: $REPORTS_DIR"
  echo "Execution Log: $LOG_FILE"
  echo ""
  echo "Generated Reports:"
  find "$REPORTS_DIR" -name "*.html" -o -name "*.json" | while read -r file; do
    echo "  📄 $(basename "$file")"
  done
  echo ""
  echo "View the latest HTML dashboard:"
  LATEST_DASHBOARD=$(find "$REPORTS_DIR" -name "performance-dashboard-*.html" | sort | tail -n1)
  if [ -n "$LATEST_DASHBOARD" ]; then
    echo "  🌐 file://$LATEST_DASHBOARD"
  fi
  echo ""
}

# Cleanup function
cleanup() {
  info "Cleaning up..."
  # Kill any remaining background processes
  pkill -f "k6" 2>/dev/null || true
  pkill -f "node.*lighthouse" 2>/dev/null || true
}

# Trap cleanup on script exit
trap cleanup EXIT

# Main execution
main() {
  echo "🚀 Starting Pitchey Performance Test Suite"
  echo "==========================================="
  
  log "Performance test suite started with intensity: $INTENSITY"
  
  # Run all test phases
  check_prerequisites
  setup_environment
  
  # K6 Tests (can be skipped for light intensity)
  if [ "$INTENSITY" != "light" ] || [ "$1" = "force-k6" ]; then
    run_k6_api_tests
    run_k6_websocket_tests
    
    # Only run database stress tests for medium/heavy intensity
    if [ "$INTENSITY" != "light" ]; then
      run_k6_database_tests
    fi
  else
    info "Skipping K6 tests for light intensity (use 'force-k6' to override)"
  fi
  
  # Lighthouse Tests
  run_lighthouse_tests
  
  # Analysis and Reporting
  generate_analysis_report
  upload_results
  
  print_summary
  
  log "Performance test suite completed successfully"
  success "All performance tests completed!"
}

# Script execution with command line arguments
case "${1:-}" in
  "help"|"-h"|"--help")
    echo "Usage: $0 [force-k6]"
    echo ""
    echo "Environment Variables:"
    echo "  INTENSITY     Test intensity: light, medium, heavy (default: medium)"
    echo "  API_URL       Target API URL (default: production)"
    echo "  WS_URL        Target WebSocket URL (default: production)"
    echo "  FRONTEND_URL  Target frontend URL (default: production)"
    echo ""
    echo "Options:"
    echo "  force-k6      Run K6 tests even for light intensity"
    echo ""
    exit 0
    ;;
  *)
    main "$@"
    ;;
esac