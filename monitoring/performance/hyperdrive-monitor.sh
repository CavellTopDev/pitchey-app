#!/bin/bash

# Hyperdrive Performance Monitoring Script
# Tests database performance with and without Hyperdrive
# Usage: ./hyperdrive-monitor.sh [production-worker-url]

WORKER_URL=${1:-"https://pitchey-production.cavelltheleaddev.workers.dev"}
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🚀 Hyperdrive Performance Monitor for Pitchey"
echo "=============================================="
echo "Testing worker at: $WORKER_URL"
echo ""

# Function to perform health check
check_health() {
    local endpoint=$1
    local name=$2
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\nRESPONSE_TIME:%{time_total}\nHTTP_CODE:%{http_code}" "$WORKER_URL$endpoint")
    
    # Extract response time and HTTP code
    response_time=$(echo "$response" | grep "RESPONSE_TIME:" | cut -d: -f2)
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    response_body=$(echo "$response" | grep -v -E "(RESPONSE_TIME|HTTP_CODE)")
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ Success${NC} (${response_time}s)"
        return 0
    else
        echo -e "${RED}✗ Failed${NC} (HTTP $http_code)"
        echo "Response: $response_body"
        return 1
    fi
}

# Function to test database performance
test_database_performance() {
    echo "📊 Database Performance Test"
    echo "----------------------------"
    
    response=$(curl -s "$WORKER_URL/api/health/database-performance")
    
    if [ $? -eq 0 ]; then
        echo "Raw response:"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        echo ""
        
        # Extract key metrics
        using_hyperdrive=$(echo "$response" | jq -r '.performance.usingHyperdrive' 2>/dev/null)
        connection_type=$(echo "$response" | jq -r '.performance.connectionType' 2>/dev/null)
        query_latency=$(echo "$response" | jq -r '.performance.queryLatency' 2>/dev/null)
        
        echo "Connection Analysis:"
        echo "- Using Hyperdrive: $using_hyperdrive"
        echo "- Connection Type: $connection_type"
        echo "- Query Latency: $query_latency"
        
        if [ "$using_hyperdrive" = "true" ]; then
            echo -e "${GREEN}✓ Hyperdrive is ENABLED${NC} - Optimal edge performance"
        else
            echo -e "${YELLOW}⚠ Hyperdrive is DISABLED${NC} - Consider enabling for better performance"
        fi
        
    else
        echo -e "${RED}✗ Failed to get database performance metrics${NC}"
    fi
    
    echo ""
}

# Function to run multiple performance tests
run_performance_benchmark() {
    echo "🏃‍♂️ Performance Benchmark (10 requests)"
    echo "==========================================="
    
    total_time=0
    success_count=0
    
    for i in {1..10}; do
        echo -n "Request $i/10: "
        
        start_time=$(date +%s.%3N)
        response=$(curl -s -w "%{http_code}" "$WORKER_URL/api/health/database-performance")
        end_time=$(date +%s.%3N)
        
        # Calculate time difference in milliseconds
        request_time=$(echo "($end_time - $start_time) * 1000" | bc -l)
        total_time=$(echo "$total_time + $request_time" | bc -l)
        
        http_code=$(echo "$response" | tail -c 4)
        
        if [ "$http_code" = "200" ]; then
            echo -e "${GREEN}✓${NC} ${request_time}ms"
            success_count=$((success_count + 1))
        else
            echo -e "${RED}✗${NC} HTTP $http_code"
        fi
    done
    
    if [ $success_count -gt 0 ]; then
        avg_time=$(echo "scale=2; $total_time / $success_count" | bc -l)
        echo ""
        echo "Benchmark Results:"
        echo "- Successful requests: $success_count/10"
        echo "- Average response time: ${avg_time}ms"
        echo "- Success rate: $(echo "scale=1; $success_count * 10" | bc -l)%"
        
        # Performance evaluation
        avg_time_int=$(echo "$avg_time / 1" | bc)
        if [ "$avg_time_int" -lt 100 ]; then
            echo -e "${GREEN}✓ Excellent performance${NC} (<100ms)"
        elif [ "$avg_time_int" -lt 500 ]; then
            echo -e "${YELLOW}⚠ Good performance${NC} (100-500ms)"
        else
            echo -e "${RED}⚠ Consider optimization${NC} (>500ms)"
        fi
    fi
    
    echo ""
}

# Function to check connection info
check_connection_info() {
    echo "🔌 Connection Information"
    echo "------------------------"
    
    response=$(curl -s "$WORKER_URL/api/health/database-performance")
    
    if [ $? -eq 0 ]; then
        echo "$response" | jq '.connections' 2>/dev/null || echo "Could not parse connection info"
        echo ""
        
        recommendations=$(echo "$response" | jq -r '.recommendations[]' 2>/dev/null)
        if [ ! -z "$recommendations" ]; then
            echo "Recommendations:"
            echo "$recommendations" | while read -r recommendation; do
                echo "- $recommendation"
            done
        fi
    fi
    
    echo ""
}

# Main execution
echo "1. Basic Health Checks"
echo "====================="
check_health "/api/health" "Basic Health"
check_health "/api/health/ready" "Readiness"
check_health "/api/health/live" "Liveness"
echo ""

echo "2. Database Performance Analysis"
echo "==============================="
test_database_performance

echo "3. Connection Information"
echo "========================"
check_connection_info

echo "4. Performance Benchmark"
echo "======================="
run_performance_benchmark

echo "✅ Hyperdrive monitoring complete!"
echo ""
echo "💡 Tips for optimization:"
echo "- Ensure Hyperdrive is properly configured in wrangler.toml"
echo "- Monitor query latency trends over time"
echo "- Consider read replicas for read-heavy workloads"
echo "- Use connection pooling for high-concurrency scenarios"