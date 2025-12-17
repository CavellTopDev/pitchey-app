#!/bin/bash

# Capacity Planning Load Testing Script
# Tests various load scenarios to validate scaling capability

set -e

echo "📈 Pitchey Capacity Planning & Load Testing Suite"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
LOCAL_URL="http://localhost:8001"

# Load test parameters
LIGHT_LOAD_USERS=10
MEDIUM_LOAD_USERS=50
HEAVY_LOAD_USERS=100
STRESS_TEST_USERS=200
SPIKE_TEST_USERS=500

TEST_DURATION=30
RAMP_UP_TIME=10

# Check if hey is installed (simple HTTP load testing tool)
check_load_testing_tools() {
    echo -e "${BLUE}🔍 Checking load testing tools...${NC}"
    
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl not found. Please install curl.${NC}"
        return 1
    fi
    
    # Check if hey is available
    if command -v hey &> /dev/null; then
        echo -e "${GREEN}✅ hey load testing tool found${NC}"
        LOAD_TOOL="hey"
        return 0
    fi
    
    # Check if ab (Apache Bench) is available
    if command -v ab &> /dev/null; then
        echo -e "${GREEN}✅ Apache Bench (ab) found${NC}"
        LOAD_TOOL="ab"
        return 0
    fi
    
    echo -e "${YELLOW}⚠️ No advanced load testing tools found. Using curl-based testing.${NC}"
    LOAD_TOOL="curl"
    return 0
}

# Function to run load test with hey
run_hey_load_test() {
    local url=$1
    local requests=$2
    local concurrent=$3
    local description=$4
    
    echo -e "\n${BLUE}Running $description${NC}"
    echo "URL: $url"
    echo "Requests: $requests, Concurrent: $concurrent"
    
    hey -n $requests -c $concurrent -o csv "$url" > /tmp/hey_results.csv 2>/dev/null
    
    # Parse results
    local avg_time=$(awk -F',' 'NR>1 {sum+=$2; count++} END {print sum/count*1000}' /tmp/hey_results.csv)
    local success_rate=$(awk -F',' 'NR>1 && $3<400 {success++} NR>1 {total++} END {print (success/total)*100}' /tmp/hey_results.csv)
    
    echo -e "Average Response Time: ${avg_time}ms"
    echo -e "Success Rate: ${success_rate}%"
    
    if (( $(echo "$avg_time > 1000" | bc -l) )); then
        echo -e "${RED}⚠️ High latency detected${NC}"
    else
        echo -e "${GREEN}✅ Response time acceptable${NC}"
    fi
    
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        echo -e "${RED}❌ Low success rate${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Good success rate${NC}"
        return 0
    fi
}

# Function to run load test with Apache Bench
run_ab_load_test() {
    local url=$1
    local requests=$2
    local concurrent=$3
    local description=$4
    
    echo -e "\n${BLUE}Running $description${NC}"
    echo "URL: $url"
    echo "Requests: $requests, Concurrent: $concurrent"
    
    ab -n $requests -c $concurrent "$url" > /tmp/ab_results.txt 2>/dev/null
    
    # Parse results
    local avg_time=$(grep "Time per request" /tmp/ab_results.txt | head -1 | awk '{print $4}')
    local success_rate=$(grep "Non-2xx responses" /tmp/ab_results.txt || echo "0")
    local total_requests=$(grep "Complete requests" /tmp/ab_results.txt | awk '{print $3}')
    
    if [[ $success_rate == "0" ]]; then
        success_rate="100"
    else
        local failed=$(echo $success_rate | awk '{print $3}')
        success_rate=$(echo "scale=2; (($total_requests - $failed) / $total_requests) * 100" | bc)
    fi
    
    echo -e "Average Response Time: ${avg_time}ms"
    echo -e "Success Rate: ${success_rate}%"
    
    if (( $(echo "$avg_time > 1000" | bc -l) )); then
        echo -e "${RED}⚠️ High latency detected${NC}"
    else
        echo -e "${GREEN}✅ Response time acceptable${NC}"
    fi
    
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        echo -e "${RED}❌ Low success rate${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Good success rate${NC}"
        return 0
    fi
}

# Function to run load test with curl (fallback)
run_curl_load_test() {
    local url=$1
    local requests=$2
    local concurrent=$3
    local description=$4
    
    echo -e "\n${BLUE}Running $description (curl-based)${NC}"
    echo "URL: $url"
    echo "Sequential requests: $requests"
    
    local total_time=0
    local success_count=0
    local start_time=$(date +%s)
    
    for ((i=1; i<=requests; i++)); do
        local response_time=$(curl -w "%{time_total}" -s -o /dev/null "$url")
        local status_code=$(curl -w "%{http_code}" -s -o /dev/null "$url")
        
        total_time=$(echo "$total_time + $response_time" | bc)
        
        if [[ $status_code -lt 400 ]]; then
            ((success_count++))
        fi
        
        if ((i % 10 == 0)); then
            echo -n "."
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local avg_time=$(echo "scale=3; ($total_time / $requests) * 1000" | bc)
    local success_rate=$(echo "scale=2; ($success_count / $requests) * 100" | bc)
    local rps=$(echo "scale=2; $requests / $duration" | bc)
    
    echo -e "\nTotal Duration: ${duration}s"
    echo -e "Requests Per Second: ${rps}"
    echo -e "Average Response Time: ${avg_time}ms"
    echo -e "Success Rate: ${success_rate}%"
    
    if (( $(echo "$avg_time > 1000" | bc -l) )); then
        echo -e "${RED}⚠️ High latency detected${NC}"
    else
        echo -e "${GREEN}✅ Response time acceptable${NC}"
    fi
    
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        echo -e "${RED}❌ Low success rate${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Good success rate${NC}"
        return 0
    fi
}

# Function to run appropriate load test based on available tools
run_load_test() {
    case $LOAD_TOOL in
        "hey")
            run_hey_load_test "$@"
            ;;
        "ab")
            run_ab_load_test "$@"
            ;;
        "curl")
            run_curl_load_test "$@"
            ;;
        *)
            echo -e "${RED}❌ No suitable load testing tool available${NC}"
            return 1
            ;;
    esac
}

# Function to test different endpoints
test_endpoint_performance() {
    local base_url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}🎯 Testing Endpoint Performance - $environment${NC}"
    echo "=================================================="
    
    local failed=0
    
    # Test health endpoint (baseline)
    echo -e "\n${BLUE}Testing Health Endpoint (Baseline)${NC}"
    run_load_test "$base_url/api/health" 50 10 "Health Endpoint Test" || ((failed++))
    
    # Test auth endpoint
    echo -e "\n${BLUE}Testing Authentication Endpoint${NC}"
    run_load_test "$base_url/api/auth/creator/login" 30 5 "Auth Endpoint Test" || ((failed++))
    
    # Test browse endpoint (public)
    echo -e "\n${BLUE}Testing Browse Endpoint${NC}"
    run_load_test "$base_url/api/pitches/browse" 40 8 "Browse Endpoint Test" || ((failed++))
    
    return $failed
}

# Function to simulate different user loads
simulate_user_loads() {
    local base_url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}👥 Simulating User Loads - $environment${NC}"
    echo "===========================================" 
    
    local failed=0
    
    # Light load (10 users)
    echo -e "\n${BLUE}🟢 Light Load Simulation${NC}"
    echo "Simulating $LIGHT_LOAD_USERS concurrent users"
    run_load_test "$base_url/api/health" 100 $LIGHT_LOAD_USERS "Light Load Test" || ((failed++))
    
    # Medium load (50 users)
    echo -e "\n${BLUE}🟡 Medium Load Simulation${NC}"
    echo "Simulating $MEDIUM_LOAD_USERS concurrent users"
    run_load_test "$base_url/api/health" 200 $MEDIUM_LOAD_USERS "Medium Load Test" || ((failed++))
    
    # Heavy load (100 users)
    echo -e "\n${BLUE}🟠 Heavy Load Simulation${NC}"
    echo "Simulating $HEAVY_LOAD_USERS concurrent users"
    run_load_test "$base_url/api/health" 300 $HEAVY_LOAD_USERS "Heavy Load Test" || ((failed++))
    
    return $failed
}

# Function to run stress tests
run_stress_tests() {
    local base_url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}💪 Stress Testing - $environment${NC}"
    echo "==================================="
    
    local failed=0
    
    # Stress test
    echo -e "\n${BLUE}🔴 Stress Test${NC}"
    echo "Pushing system to limits: $STRESS_TEST_USERS concurrent users"
    run_load_test "$base_url/api/health" 400 $STRESS_TEST_USERS "Stress Test" || ((failed++))
    
    # Spike test (if using advanced tools)
    if [[ $LOAD_TOOL != "curl" ]]; then
        echo -e "\n${BLUE}⚡ Spike Test${NC}"
        echo "Sudden traffic spike: $SPIKE_TEST_USERS concurrent users"
        run_load_test "$base_url/api/health" 500 $SPIKE_TEST_USERS "Spike Test" || ((failed++))
    fi
    
    return $failed
}

# Function to test resource limits
test_resource_limits() {
    local base_url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}📊 Testing Resource Limits - $environment${NC}"
    echo "============================================="
    
    # Test request size limits
    echo -e "\n${BLUE}Testing Request Size Limits${NC}"
    
    # Test small request
    response=$(curl -s -X POST "$base_url/api/auth/creator/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test"}' \
        -w "%{http_code}")
    
    status_code=$(echo "$response" | tail -c 4)
    echo "Small request status: $status_code"
    
    # Test large request (should be rejected)
    large_data=$(printf '{"data":"%*s"}' 20000000 "")  # 20MB of data
    response=$(curl -s -X POST "$base_url/api/auth/creator/login" \
        -H "Content-Type: application/json" \
        -d "$large_data" \
        -w "%{http_code}" --max-time 5)
    
    status_code=$(echo "$response" | tail -c 4)
    echo "Large request status: $status_code"
    
    if [[ $status_code == "413" ]]; then
        echo -e "${GREEN}✅ Request size limit working correctly${NC}"
    else
        echo -e "${YELLOW}⚠️ Request size limit response: $status_code${NC}"
    fi
}

# Function to measure performance metrics
measure_performance_metrics() {
    local base_url=$1
    local environment=$2
    
    echo -e "\n${YELLOW}📈 Performance Metrics Analysis - $environment${NC}"
    echo "================================================="
    
    echo -e "\n${BLUE}Running performance measurement...${NC}"
    
    # Measure response times for different endpoints
    declare -A endpoints=(
        ["Health"]="$base_url/api/health"
        ["Browse"]="$base_url/api/pitches/browse"
        ["Trending"]="$base_url/api/pitches/trending"
    )
    
    for name in "${!endpoints[@]}"; do
        url="${endpoints[$name]}"
        echo -e "\n${PURPLE}Testing $name endpoint:${NC}"
        
        total_time=0
        requests=10
        
        for ((i=1; i<=requests; i++)); do
            response_time=$(curl -w "%{time_total}" -s -o /dev/null "$url")
            total_time=$(echo "$total_time + $response_time" | bc)
        done
        
        avg_time=$(echo "scale=3; ($total_time / $requests) * 1000" | bc)
        echo "Average response time: ${avg_time}ms"
        
        # Check against performance targets
        if (( $(echo "$avg_time < 500" | bc -l) )); then
            echo -e "${GREEN}✅ Excellent performance (< 500ms)${NC}"
        elif (( $(echo "$avg_time < 1000" | bc -l) )); then
            echo -e "${YELLOW}⚠️ Acceptable performance (< 1000ms)${NC}"
        else
            echo -e "${RED}❌ Poor performance (> 1000ms)${NC}"
        fi
    done
}

# Function to generate capacity planning report
generate_capacity_report() {
    local environment=$1
    local total_tests=$2
    local failed_tests=$3
    
    echo -e "\n${BLUE}📋 Capacity Planning Report - $environment${NC}"
    echo "============================================="
    
    local success_rate=$(echo "scale=2; (($total_tests - $failed_tests) / $total_tests) * 100" | bc)
    
    echo -e "\n${PURPLE}Test Summary:${NC}"
    echo "Total Tests: $total_tests"
    echo "Failed Tests: $failed_tests"
    echo "Success Rate: ${success_rate}%"
    
    if (( failed_tests == 0 )); then
        echo -e "\n${GREEN}✅ Capacity Status: EXCELLENT${NC}"
        echo "The system handled all load scenarios successfully."
        echo ""
        echo "Capacity Recommendations:"
        echo "• Current infrastructure can handle expected load"
        echo "• Consider monitoring during peak usage"
        echo "• Plan for 2x current capacity for growth"
    elif (( failed_tests <= 2 )); then
        echo -e "\n${YELLOW}⚠️ Capacity Status: GOOD${NC}"
        echo "The system handled most load scenarios well."
        echo ""
        echo "Capacity Recommendations:"
        echo "• Monitor performance during high load periods"
        echo "• Consider optimizing failed test scenarios"
        echo "• Plan for infrastructure scaling at 1.5x current load"
    else
        echo -e "\n${RED}❌ Capacity Status: NEEDS IMPROVEMENT${NC}"
        echo "The system struggled with several load scenarios."
        echo ""
        echo "Capacity Recommendations:"
        echo "• Immediate infrastructure scaling required"
        echo "• Implement performance optimizations"
        echo "• Set up auto-scaling for traffic spikes"
        echo "• Consider CDN and caching improvements"
    fi
    
    echo -e "\n${BLUE}Performance Targets:${NC}"
    echo "• P95 Response Time: < 500ms"
    echo "• P99 Response Time: < 1000ms" 
    echo "• Success Rate: > 99%"
    echo "• Throughput: > 1000 RPS"
    echo "• Error Rate: < 1%"
    
    echo -e "\n${BLUE}Scaling Recommendations:${NC}"
    echo "• 1K DAU: Current infrastructure sufficient"
    echo "• 10K DAU: Add read replicas and CDN"
    echo "• 100K DAU: Horizontal scaling + database sharding"
    echo "• 1M DAU: Multi-region deployment + auto-scaling"
}

# Function to run comprehensive capacity test
run_capacity_test() {
    local url=$1
    local environment=$2
    
    echo -e "\n${BLUE}🚀 Running Comprehensive Capacity Test - $environment${NC}"
    echo "========================================================"
    
    local total_failed=0
    local total_tests=0
    
    # Test endpoint performance
    test_endpoint_performance "$url" "$environment"
    local endpoint_failed=$?
    total_failed=$((total_failed + endpoint_failed))
    total_tests=$((total_tests + 3))
    
    # Simulate user loads
    simulate_user_loads "$url" "$environment"
    local load_failed=$?
    total_failed=$((total_failed + load_failed))
    total_tests=$((total_tests + 3))
    
    # Run stress tests
    run_stress_tests "$url" "$environment"
    local stress_failed=$?
    total_failed=$((total_failed + stress_failed))
    total_tests=$((total_tests + 2))
    
    # Test resource limits
    test_resource_limits "$url" "$environment"
    total_tests=$((total_tests + 1))
    
    # Measure performance metrics
    measure_performance_metrics "$url" "$environment"
    
    # Generate report
    generate_capacity_report "$environment" "$total_tests" "$total_failed"
    
    return $total_failed
}

# Function to check if local server is running
check_local_server() {
    if curl -s "$LOCAL_URL/api/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Starting capacity planning and load testing...${NC}"
    
    # Check tools
    if ! check_load_testing_tools; then
        echo -e "${RED}❌ Required tools not available${NC}"
        exit 1
    fi
    
    local test_local=false
    local test_production=false
    
    # Parse command line arguments
    for arg in "$@"; do
        case $arg in
            --local)
                test_local=true
                shift
                ;;
            --production)
                test_production=true
                shift
                ;;
            --all)
                test_local=true
                test_production=true
                shift
                ;;
            *)
                # Default: test production only
                test_production=true
                ;;
        esac
    done
    
    # If no arguments, default to production testing
    if [ "$test_local" = false ] && [ "$test_production" = false ]; then
        test_production=true
    fi
    
    local overall_success=true
    
    # Test local environment
    if [ "$test_local" = true ]; then
        if check_local_server; then
            run_capacity_test "$LOCAL_URL" "LOCAL" || overall_success=false
        else
            echo -e "${RED}❌ Local server not available at $LOCAL_URL${NC}"
            overall_success=false
        fi
    fi
    
    # Test production environment
    if [ "$test_production" = true ]; then
        run_capacity_test "$PRODUCTION_URL" "PRODUCTION" || overall_success=false
    fi
    
    # Final summary
    echo -e "\n${BLUE}🎯 Final Capacity Assessment${NC}"
    echo "==============================="
    
    if [ "$overall_success" = true ]; then
        echo -e "${GREEN}✅ Capacity planning tests completed successfully!${NC}"
        echo -e "\n${GREEN}🚀 System ready for scale!${NC}"
        echo -e "\nNext steps:"
        echo "• Monitor production performance"
        echo "• Set up auto-scaling policies"
        echo "• Plan for peak traffic events"
        exit 0
    else
        echo -e "${RED}❌ Some capacity tests indicated potential issues.${NC}"
        echo -e "\n${YELLOW}🔧 Action required:${NC}"
        echo "• Review failed test results"
        echo "• Implement performance optimizations"
        echo "• Scale infrastructure as recommended"
        exit 1
    fi
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Capacity Planning & Load Testing Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --local       Test local development server"
    echo "  --production  Test production server (default)"
    echo "  --all         Test both local and production"
    echo "  --help        Show this help message"
    echo ""
    echo "Load Test Scenarios:"
    echo "  - Light Load: 10 concurrent users"
    echo "  - Medium Load: 50 concurrent users" 
    echo "  - Heavy Load: 100 concurrent users"
    echo "  - Stress Test: 200 concurrent users"
    echo "  - Spike Test: 500 concurrent users"
    echo ""
    echo "Performance Targets:"
    echo "  - Response Time: < 500ms (P95)"
    echo "  - Success Rate: > 99%"
    echo "  - Error Rate: < 1%"
    echo ""
    echo "Tools Required (in order of preference):"
    echo "  - hey (recommended): go install github.com/rakyll/hey@latest"
    echo "  - ab (Apache Bench): included in apache2-utils"
    echo "  - curl (fallback): basic testing capability"
    echo ""
    echo "Examples:"
    echo "  $0                    # Test production capacity"
    echo "  $0 --local           # Test local server capacity"
    echo "  $0 --all             # Test both environments"
    exit 0
fi

# Run main function with all arguments
main "$@"