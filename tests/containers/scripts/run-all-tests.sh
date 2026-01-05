#!/bin/bash

# Comprehensive Container Integration Test Runner
# Runs all container tests with proper setup, monitoring, and reporting

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$TEST_DIR/../.." && pwd)"
REPORT_DIR="$TEST_DIR/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/test-run-$TIMESTAMP.html"
LOG_FILE="$REPORT_DIR/test-run-$TIMESTAMP.log"

# Default values
RUNTIME="docker"
ENVIRONMENT="local"
PARALLEL=false
VERBOSE=false
CLEANUP=true
TIMEOUT=3600
SERVICES_ONLY=false
PERFORMANCE_ONLY=false
SECURITY_ONLY=false

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}$message${NC}"
}

print_header() {
    echo "========================================"
    print_status $BLUE "$1"
    echo "========================================"
}

print_success() {
    print_status $GREEN "✅ $1"
}

print_error() {
    print_status $RED "❌ $1"
}

print_warning() {
    print_status $YELLOW "⚠️  $1"
}

# Function to show usage
usage() {
    cat << EOF
Container Integration Test Suite Runner

Usage: $0 [OPTIONS]

OPTIONS:
    --runtime RUNTIME       Container runtime (docker|podman) [default: docker]
    --environment ENV       Test environment (local|ci|staging) [default: local]
    --parallel              Run tests in parallel where possible
    --verbose               Enable verbose output
    --no-cleanup            Skip cleanup after tests
    --timeout SECONDS       Total test timeout [default: 3600]
    --services-only         Run only service tests
    --performance-only      Run only performance tests
    --security-only         Run only security tests
    --help                  Show this help message

EXAMPLES:
    $0                                          # Run all tests with defaults
    $0 --runtime podman --parallel             # Run with Podman in parallel
    $0 --services-only --verbose               # Run only service tests with verbose output
    $0 --environment ci --no-cleanup           # CI environment without cleanup
    $0 --performance-only --timeout 7200       # Performance tests with 2h timeout

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --runtime)
                RUNTIME="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --parallel)
                PARALLEL=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --no-cleanup)
                CLEANUP=false
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --services-only)
                SERVICES_ONLY=true
                shift
                ;;
            --performance-only)
                PERFORMANCE_ONLY=true
                shift
                ;;
            --security-only)
                SECURITY_ONLY=true
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Deno
    if ! command -v deno &> /dev/null; then
        print_error "Deno is not installed"
        return 1
    fi
    print_success "Deno $(deno --version | head -n1)"
    
    # Check container runtime
    case $RUNTIME in
        docker)
            if ! command -v docker &> /dev/null; then
                print_error "Docker is not installed"
                return 1
            fi
            if ! command -v docker-compose &> /dev/null; then
                print_error "Docker Compose is not installed"
                return 1
            fi
            print_success "Docker $(docker --version)"
            print_success "Docker Compose $(docker-compose --version)"
            ;;
        podman)
            if ! command -v podman &> /dev/null; then
                print_error "Podman is not installed"
                return 1
            fi
            if ! command -v podman-compose &> /dev/null; then
                print_error "Podman Compose is not installed"
                return 1
            fi
            print_success "Podman $(podman --version)"
            print_success "Podman Compose $(podman-compose --version)"
            ;;
        *)
            print_error "Unsupported runtime: $RUNTIME"
            return 1
            ;;
    esac
    
    # Check k6 for performance tests
    if [[ $PERFORMANCE_ONLY == true ]] || [[ $SERVICES_ONLY == false && $SECURITY_ONLY == false ]]; then
        if ! command -v k6 &> /dev/null; then
            print_warning "k6 not installed - performance tests will be skipped"
        else
            print_success "k6 $(k6 version --quiet 2>/dev/null || echo 'available')"
        fi
    fi
    
    # Check available disk space (containers need significant space)
    available_space=$(df . | awk 'NR==2 {print $4}')
    required_space=5000000  # 5GB in KB
    if [[ $available_space -lt $required_space ]]; then
        print_warning "Low disk space: $(( available_space / 1000000 ))GB available, 5GB+ recommended"
    else
        print_success "Sufficient disk space available"
    fi
    
    # Check available memory
    available_memory=$(free -m | awk 'NR==2{print $7}')
    required_memory=4000  # 4GB
    if [[ $available_memory -lt $required_memory ]]; then
        print_warning "Low memory: ${available_memory}MB available, 4GB+ recommended"
    else
        print_success "Sufficient memory available"
    fi
}

# Function to setup test environment
setup_environment() {
    print_header "Setting Up Test Environment"
    
    # Create report directory
    mkdir -p "$REPORT_DIR"
    
    # Initialize log file
    echo "Container Integration Test Run - $(date)" > "$LOG_FILE"
    echo "Runtime: $RUNTIME" >> "$LOG_FILE"
    echo "Environment: $ENVIRONMENT" >> "$LOG_FILE"
    echo "Parallel: $PARALLEL" >> "$LOG_FILE"
    echo "Verbose: $VERBOSE" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # Set environment variables
    export CONTAINER_RUNTIME="$RUNTIME"
    export TEST_ENVIRONMENT="$ENVIRONMENT"
    export TEST_PARALLEL="$PARALLEL"
    export TEST_VERBOSE="$VERBOSE"
    
    print_success "Test environment configured"
}

# Function to start container services
start_services() {
    print_header "Starting Container Services"
    
    cd "$PROJECT_ROOT/containers"
    
    case $RUNTIME in
        docker)
            if [[ $VERBOSE == true ]]; then
                docker-compose -f docker-compose.test.yml up -d
            else
                docker-compose -f docker-compose.test.yml up -d > /dev/null 2>&1
            fi
            ;;
        podman)
            if [[ $VERBOSE == true ]]; then
                podman-compose -f docker-compose.test.yml up -d
            else
                podman-compose -f docker-compose.test.yml up -d > /dev/null 2>&1
            fi
            ;;
    esac
    
    print_success "Container services started"
    
    # Wait for services to be healthy
    print_header "Waiting for Services to be Ready"
    
    local max_wait=300  # 5 minutes
    local wait_time=0
    local check_interval=10
    
    while [[ $wait_time -lt $max_wait ]]; do
        local all_healthy=true
        
        for port in 8081 8082 8083 8084 8085; do
            if ! curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
                all_healthy=false
                break
            fi
        done
        
        if [[ $all_healthy == true ]]; then
            print_success "All services are healthy"
            return 0
        fi
        
        sleep $check_interval
        wait_time=$((wait_time + check_interval))
        echo -n "."
    done
    
    print_error "Services did not become healthy within ${max_wait} seconds"
    return 1
}

# Function to run service tests
run_service_tests() {
    print_header "Running Service Tests"
    
    local test_files=(
        "services/video-processor.test.ts"
        "services/document-processor.test.ts"
        "services/ai-inference.test.ts"
        "services/media-transcoder.test.ts"
        "services/code-executor.test.ts"
    )
    
    local failed_tests=()
    
    for test_file in "${test_files[@]}"; do
        local test_path="$TEST_DIR/$test_file"
        local test_name=$(basename "$test_file" .test.ts)
        
        if [[ -f "$test_path" ]]; then
            print_status $BLUE "Running $test_name tests..."
            
            if [[ $VERBOSE == true ]]; then
                if deno test --allow-all "$test_path"; then
                    print_success "$test_name tests passed"
                else
                    print_error "$test_name tests failed"
                    failed_tests+=("$test_name")
                fi
            else
                if deno test --allow-all "$test_path" >> "$LOG_FILE" 2>&1; then
                    print_success "$test_name tests passed"
                else
                    print_error "$test_name tests failed"
                    failed_tests+=("$test_name")
                fi
            fi
        else
            print_warning "$test_file not found, skipping"
        fi
    done
    
    if [[ ${#failed_tests[@]} -gt 0 ]]; then
        print_error "Failed service tests: ${failed_tests[*]}"
        return 1
    fi
    
    print_success "All service tests passed"
    return 0
}

# Function to run integration tests
run_integration_tests() {
    print_header "Running Integration Tests"
    
    local test_files=(
        "integration/e2e-workflows.test.ts"
        "integration/worker-container.test.ts"
        "integration/database-integration.test.ts"
        "integration/cache-integration.test.ts"
        "integration/storage-integration.test.ts"
    )
    
    local failed_tests=()
    
    for test_file in "${test_files[@]}"; do
        local test_path="$TEST_DIR/$test_file"
        local test_name=$(basename "$test_file" .test.ts)
        
        if [[ -f "$test_path" ]]; then
            print_status $BLUE "Running $test_name tests..."
            
            if [[ $VERBOSE == true ]]; then
                if deno test --allow-all "$test_path"; then
                    print_success "$test_name tests passed"
                else
                    print_error "$test_name tests failed"
                    failed_tests+=("$test_name")
                fi
            else
                if deno test --allow-all "$test_path" >> "$LOG_FILE" 2>&1; then
                    print_success "$test_name tests passed"
                else
                    print_error "$test_name tests failed"
                    failed_tests+=("$test_name")
                fi
            fi
        else
            print_warning "$test_file not found, skipping"
        fi
    done
    
    if [[ ${#failed_tests[@]} -gt 0 ]]; then
        print_error "Failed integration tests: ${failed_tests[*]}"
        return 1
    fi
    
    print_success "All integration tests passed"
    return 0
}

# Function to run performance tests
run_performance_tests() {
    print_header "Running Performance Tests"
    
    # Run Deno performance tests
    if [[ -f "$TEST_DIR/performance/benchmark-suite.test.ts" ]]; then
        print_status $BLUE "Running Deno performance tests..."
        
        if deno test --allow-all "$TEST_DIR/performance/benchmark-suite.test.ts" >> "$LOG_FILE" 2>&1; then
            print_success "Deno performance tests passed"
        else
            print_error "Deno performance tests failed"
            return 1
        fi
    fi
    
    # Run k6 load tests if available
    if command -v k6 &> /dev/null && [[ -f "$TEST_DIR/performance/load-testing.js" ]]; then
        print_status $BLUE "Running k6 load tests..."
        
        if k6 run "$TEST_DIR/performance/load-testing.js" >> "$LOG_FILE" 2>&1; then
            print_success "k6 load tests passed"
        else
            print_error "k6 load tests failed"
            return 1
        fi
    else
        print_warning "k6 not available or load test file not found, skipping load tests"
    fi
    
    print_success "Performance tests completed"
    return 0
}

# Function to run security tests
run_security_tests() {
    print_header "Running Security Tests"
    
    local test_files=(
        "security/container-security.test.ts"
        "security/sandbox-isolation.test.ts"
        "security/network-security.test.ts"
    )
    
    local failed_tests=()
    
    for test_file in "${test_files[@]}"; do
        local test_path="$TEST_DIR/$test_file"
        local test_name=$(basename "$test_file" .test.ts)
        
        if [[ -f "$test_path" ]]; then
            print_status $BLUE "Running $test_name tests..."
            
            if deno test --allow-all "$test_path" >> "$LOG_FILE" 2>&1; then
                print_success "$test_name tests passed"
            else
                print_error "$test_name tests failed"
                failed_tests+=("$test_name")
            fi
        else
            print_warning "$test_file not found, skipping"
        fi
    done
    
    if [[ ${#failed_tests[@]} -gt 0 ]]; then
        print_error "Failed security tests: ${failed_tests[*]}"
        return 1
    fi
    
    print_success "All security tests passed"
    return 0
}

# Function to run runtime compatibility tests
run_runtime_tests() {
    print_header "Running Runtime Compatibility Tests"
    
    local test_file="runtime/${RUNTIME}-compatibility.test.ts"
    local test_path="$TEST_DIR/$test_file"
    
    if [[ -f "$test_path" ]]; then
        print_status $BLUE "Running $RUNTIME compatibility tests..."
        
        if deno test --allow-all "$test_path" >> "$LOG_FILE" 2>&1; then
            print_success "$RUNTIME compatibility tests passed"
        else
            print_error "$RUNTIME compatibility tests failed"
            return 1
        fi
    else
        print_warning "$test_file not found, skipping runtime tests"
    fi
    
    return 0
}

# Function to collect test results and generate report
generate_report() {
    print_header "Generating Test Report"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Create HTML report
    cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Container Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .logs { background-color: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Container Integration Test Report</h1>
        <p><strong>Timestamp:</strong> $(date)</p>
        <p><strong>Runtime:</strong> $RUNTIME</p>
        <p><strong>Environment:</strong> $ENVIRONMENT</p>
        <p><strong>Duration:</strong> ${duration}s</p>
        <p><strong>Result:</strong> <span class="$([ $1 -eq 0 ] && echo 'success' || echo 'error')">$([ $1 -eq 0 ] && echo 'PASSED' || echo 'FAILED')</span></p>
    </div>
    
    <div class="section">
        <h2>Test Summary</h2>
        <ul>
            <li>Service Tests: $([ -f "$TEST_DIR/services/video-processor.test.ts" ] && echo 'Executed' || echo 'Skipped')</li>
            <li>Integration Tests: $([ $SERVICES_ONLY == false ] && echo 'Executed' || echo 'Skipped')</li>
            <li>Performance Tests: $([ $PERFORMANCE_ONLY == true ] || [ $SERVICES_ONLY == false ] && echo 'Executed' || echo 'Skipped')</li>
            <li>Security Tests: $([ $SECURITY_ONLY == true ] || [ $SERVICES_ONLY == false ] && echo 'Executed' || echo 'Skipped')</li>
            <li>Runtime Tests: $([ $SERVICES_ONLY == false ] && echo 'Executed' || echo 'Skipped')</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Test Logs</h2>
        <div class="logs">$(cat "$LOG_FILE" 2>/dev/null || echo "No logs available")</div>
    </div>
</body>
</html>
EOF
    
    print_success "Test report generated: $REPORT_FILE"
}

# Function to cleanup test environment
cleanup_environment() {
    if [[ $CLEANUP == false ]]; then
        print_warning "Skipping cleanup (--no-cleanup specified)"
        return 0
    fi
    
    print_header "Cleaning Up Test Environment"
    
    cd "$PROJECT_ROOT/containers"
    
    case $RUNTIME in
        docker)
            docker-compose -f docker-compose.test.yml down -v > /dev/null 2>&1 || true
            ;;
        podman)
            podman-compose -f docker-compose.test.yml down -v > /dev/null 2>&1 || true
            ;;
    esac
    
    print_success "Cleanup completed"
}

# Main execution function
main() {
    local exit_code=0
    start_time=$(date +%s)
    
    # Parse arguments
    parse_args "$@"
    
    # Trap cleanup on exit
    trap cleanup_environment EXIT
    
    print_header "Container Integration Test Suite"
    echo "Runtime: $RUNTIME"
    echo "Environment: $ENVIRONMENT"
    echo "Parallel: $PARALLEL"
    echo "Timeout: ${TIMEOUT}s"
    echo ""
    
    # Check prerequisites
    if ! check_prerequisites; then
        print_error "Prerequisites check failed"
        exit 1
    fi
    
    # Setup environment
    setup_environment
    
    # Start services
    if ! start_services; then
        print_error "Failed to start services"
        exit 1
    fi
    
    # Set timeout for entire test run
    (
        sleep $TIMEOUT
        print_error "Test execution timed out after ${TIMEOUT} seconds"
        exit 124
    ) &
    timeout_pid=$!
    
    # Run tests based on options
    if [[ $SERVICES_ONLY == true ]]; then
        run_service_tests || exit_code=1
    elif [[ $PERFORMANCE_ONLY == true ]]; then
        run_performance_tests || exit_code=1
    elif [[ $SECURITY_ONLY == true ]]; then
        run_security_tests || exit_code=1
    else
        # Run full test suite
        run_service_tests || exit_code=1
        
        if [[ $exit_code -eq 0 ]]; then
            run_integration_tests || exit_code=1
        fi
        
        if [[ $exit_code -eq 0 ]]; then
            run_runtime_tests || exit_code=1
        fi
        
        if [[ $exit_code -eq 0 ]]; then
            run_performance_tests || exit_code=1
        fi
        
        if [[ $exit_code -eq 0 ]]; then
            run_security_tests || exit_code=1
        fi
    fi
    
    # Kill timeout process
    kill $timeout_pid 2>/dev/null || true
    
    # Generate report
    generate_report $exit_code
    
    # Print final status
    echo ""
    if [[ $exit_code -eq 0 ]]; then
        print_header "🎉 ALL TESTS PASSED!"
        echo "Test report: $REPORT_FILE"
        echo "Test logs: $LOG_FILE"
    else
        print_header "❌ SOME TESTS FAILED"
        echo "Test report: $REPORT_FILE"
        echo "Test logs: $LOG_FILE"
        echo "Check the logs for detailed error information."
    fi
    
    exit $exit_code
}

# Run main function with all arguments
main "$@"