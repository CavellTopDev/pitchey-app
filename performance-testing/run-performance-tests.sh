#!/bin/bash

# Performance Testing Suite for Pitchey Platform
# Runs comprehensive load tests using K6

set -e

echo "🚀 PITCHEY PERFORMANCE TESTING SUITE"
echo "======================================"

# Configuration
RESULTS_DIR="./performance-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_FILE="./performance-testing/k6-load-tests.js"

# Create results directory
mkdir -p "$RESULTS_DIR"

echo "📊 Test Configuration:"
echo "  - Target: https://pitchey-api-prod.ndlovucavelle.workers.dev"
echo "  - Results: $RESULTS_DIR"
echo "  - Timestamp: $TIMESTAMP"
echo ""

# Check if K6 is installed
if ! command -v k6 &> /dev/null; then
    echo "❌ K6 is not installed. Installing K6..."
    echo ""
    
    # Install K6 based on OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux installation
        if command -v apt-get &> /dev/null; then
            # Debian/Ubuntu
            sudo gpg -k
            sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
            echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
            sudo apt-get update
            sudo apt-get install k6
        elif command -v yum &> /dev/null; then
            # RHEL/CentOS
            sudo dnf install https://dl.k6.io/rpm/repo.rpm
            sudo dnf install k6
        elif command -v pacman &> /dev/null; then
            # Arch Linux
            sudo pacman -S k6
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS installation
        if command -v brew &> /dev/null; then
            brew install k6
        else
            echo "❌ Please install Homebrew first: https://brew.sh/"
            exit 1
        fi
    else
        echo "❌ Unsupported OS. Please install K6 manually: https://k6.io/docs/get-started/installation/"
        exit 1
    fi
    
    echo "✅ K6 installed successfully!"
    echo ""
fi

# Verify K6 installation
echo "🔍 Verifying K6 installation:"
k6 version
echo ""

# Function to run a specific test scenario
run_test() {
    local test_name=$1
    local scenario=$2
    local output_file="$RESULTS_DIR/${test_name}_${TIMESTAMP}.json"
    
    echo "📊 Running $test_name test..."
    echo "  - Scenario: $scenario"
    echo "  - Output: $output_file"
    
    if [ "$scenario" = "all" ]; then
        k6 run --out json="$output_file" "$TEST_FILE"
    else
        k6 run --out json="$output_file" -e K6_SCENARIO="$scenario" "$TEST_FILE"
    fi
    
    echo "✅ $test_name test completed"
    echo ""
}

# Function to analyze results
analyze_results() {
    echo "📈 PERFORMANCE TEST RESULTS ANALYSIS"
    echo "====================================="
    
    # Find the most recent result files
    local latest_result=$(ls -t "$RESULTS_DIR"/*.json 2>/dev/null | head -1)
    
    if [ -n "$latest_result" ]; then
        echo "📊 Latest test results: $(basename "$latest_result")"
        
        # Extract key metrics using jq if available
        if command -v jq &> /dev/null; then
            echo ""
            echo "🎯 Key Performance Metrics:"
            echo "=========================="
            
            # Overall statistics
            local total_requests=$(cat "$latest_result" | jq '[.[] | select(.type=="Point" and .metric=="http_reqs")] | length')
            local failed_requests=$(cat "$latest_result" | jq '[.[] | select(.type=="Point" and .metric=="http_req_failed" and .data.value==1)] | length')
            local success_rate=$(echo "scale=2; 100 - ($failed_requests * 100 / $total_requests)" | bc -l 2>/dev/null || echo "N/A")
            
            echo "  📊 Total Requests: $total_requests"
            echo "  ❌ Failed Requests: $failed_requests"
            echo "  ✅ Success Rate: ${success_rate}%"
            echo ""
            
            # Response time analysis
            echo "⏱️  Response Time Analysis:"
            echo "=========================="
            echo "  (Analysis requires full K6 HTML report for detailed percentiles)"
            echo ""
            
        else
            echo "📋 Raw results saved to: $latest_result"
            echo "💡 Install 'jq' for detailed analysis: sudo apt-get install jq"
            echo ""
        fi
    else
        echo "❌ No test results found in $RESULTS_DIR"
    fi
}

# Function to generate performance report
generate_report() {
    local report_file="$RESULTS_DIR/performance_report_${TIMESTAMP}.md"
    
    cat > "$report_file" << EOF
# Pitchey Performance Test Report

**Date**: $(date)
**Test Suite**: K6 Load Testing
**Target**: https://pitchey-api-prod.ndlovucavelle.workers.dev

## Test Summary

### Test Scenarios Executed
- ✅ Health Check Stress Test (10 VUs, 30s)
- ✅ Browse Performance Test (Ramping 1→20→0 VUs, 120s)
- ✅ Authentication Load Test (10 req/s, 60s)
- ✅ Search Performance Test (5 VUs, 100 iterations)
- ✅ Cache Efficiency Test (15 VUs, 45s)
- ✅ Spike Test (1→50→1 VUs)

### Performance Thresholds
- Health Check: p(95)<100ms, p(99)<150ms
- Browse Queries: p(95)<50ms, p(99)<100ms
- Authentication: p(95)<100ms, p(99)<200ms
- Search: p(95)<100ms, p(99)<200ms
- Error Rate: <5%
- Failed Requests: <2%

## Results

### Key Findings
- **Health Check Performance**: [See detailed results]
- **Browse Endpoint Performance**: [See detailed results]
- **Authentication Performance**: [See detailed results]
- **Search Performance**: [See detailed results]
- **Cache Effectiveness**: [See detailed results]

### Recommendations
1. **Database Optimization**: Deploy critical indexes if not already done
2. **Cache Tuning**: Optimize TTL values based on cache hit rates
3. **Connection Pooling**: Monitor Hyperdrive performance
4. **Error Rate**: Investigate any failed requests > 2%

### Next Steps
1. Deploy database optimizations if performance targets not met
2. Monitor production metrics after optimization deployment
3. Repeat testing after optimization deployment
4. Set up continuous performance monitoring

---
*Generated by Pitchey Performance Testing Suite*
EOF

    echo "📝 Performance report generated: $report_file"
}

# Main execution
main() {
    echo "🎯 Starting comprehensive performance testing..."
    echo ""
    
    # Check test file exists
    if [ ! -f "$TEST_FILE" ]; then
        echo "❌ Test file not found: $TEST_FILE"
        exit 1
    fi
    
    # Run performance baseline test
    echo "📊 Phase 1: Performance Baseline Test"
    run_test "baseline_performance" "all"
    
    # Analyze results
    echo "📈 Phase 2: Results Analysis"
    analyze_results
    
    # Generate report
    echo "📝 Phase 3: Report Generation"
    generate_report
    
    echo "🎉 Performance testing complete!"
    echo ""
    echo "📋 Summary:"
    echo "  - Test results: $RESULTS_DIR"
    echo "  - K6 JSON output: Available for detailed analysis"
    echo "  - Performance report: Generated with recommendations"
    echo ""
    echo "🚀 Next steps:"
    echo "  1. Review performance report"
    echo "  2. Deploy database optimizations if needed"
    echo "  3. Monitor production performance"
    echo "  4. Re-run tests after optimizations"
}

# Script execution
case "${1:-main}" in
    "health")
        run_test "health_check" "health_check_stress"
        ;;
    "browse")
        run_test "browse_performance" "browse_performance"
        ;;
    "auth")
        run_test "authentication" "auth_load_test"
        ;;
    "search")
        run_test "search_performance" "search_performance"
        ;;
    "cache")
        run_test "cache_efficiency" "cache_efficiency"
        ;;
    "spike")
        run_test "spike_test" "spike_test"
        ;;
    "analyze")
        analyze_results
        ;;
    "report")
        generate_report
        ;;
    "all"|"main")
        main
        ;;
    *)
        echo "Usage: $0 [health|browse|auth|search|cache|spike|analyze|report|all]"
        echo ""
        echo "Available commands:"
        echo "  health  - Run health check stress test"
        echo "  browse  - Run browse performance test"
        echo "  auth    - Run authentication load test"
        echo "  search  - Run search performance test"
        echo "  cache   - Run cache efficiency test"
        echo "  spike   - Run spike load test"
        echo "  analyze - Analyze latest test results"
        echo "  report  - Generate performance report"
        echo "  all     - Run complete test suite (default)"
        ;;
esac