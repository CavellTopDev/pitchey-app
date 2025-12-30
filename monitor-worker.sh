#!/bin/bash

# Real-time Cloudflare Worker Monitoring Dashboard
# Displays live metrics and performance indicators

API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Function to draw a progress bar
draw_bar() {
    local percent=$1
    local width=30
    local filled=$((percent * width / 100))
    local empty=$((width - filled))
    
    printf "["
    printf "%0.s█" $(seq 1 $filled)
    printf "%0.s░" $(seq 1 $empty)
    printf "] %3d%%" $percent
}

# Function to get color based on value
get_color() {
    local value=$1
    local threshold_good=$2
    local threshold_warn=$3
    
    if [ $value -lt $threshold_good ]; then
        echo "${GREEN}"
    elif [ $value -lt $threshold_warn ]; then
        echo "${YELLOW}"
    else
        echo "${RED}"
    fi
}

# Initialize variables
total_requests=0
total_errors=0
cache_hits=0
cache_misses=0
response_times=()
start_time=$(date +%s)

# Main monitoring loop
while true; do
    clear
    
    # Header
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║       ${WHITE}📊 Cloudflare Worker Performance Monitor${CYAN}         ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Worker URL:${NC} $API_URL"
    echo -e "${BLUE}Monitoring Since:${NC} $(date -d @$start_time '+%Y-%m-%d %H:%M:%S')"
    echo -e "${BLUE}Current Time:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Make test request and capture metrics
    response=$(curl -s -w "\n%{time_total}|%{http_code}" \
        -H "Accept: application/json" \
        -D /tmp/monitor_headers_$$.txt \
        "$API_URL/api/health" 2>/dev/null)
    
    # Parse response
    metrics=$(echo "$response" | tail -1)
    time=$(echo "$metrics" | cut -d'|' -f1)
    code=$(echo "$metrics" | cut -d'|' -f2)
    
    # Get headers
    cache_status=$(grep -i "x-cache-status" /tmp/monitor_headers_$$.txt 2>/dev/null | cut -d' ' -f2 | tr -d '\r\n')
    response_time_header=$(grep -i "x-response-time" /tmp/monitor_headers_$$.txt 2>/dev/null | cut -d' ' -f2 | tr -d '\r\n')
    environment=$(grep -i "x-environment" /tmp/monitor_headers_$$.txt 2>/dev/null | cut -d' ' -f2 | tr -d '\r\n')
    
    # Convert to milliseconds
    time_ms=$(echo "$time * 1000" | bc | cut -d'.' -f1)
    
    # Update statistics
    ((total_requests++))
    response_times+=($time_ms)
    
    if [ "$cache_status" = "HIT" ]; then
        ((cache_hits++))
    else
        ((cache_misses++))
    fi
    
    if [ "$code" -ge 400 ]; then
        ((total_errors++))
    fi
    
    # Calculate metrics
    if [ $total_requests -gt 0 ]; then
        cache_rate=$((cache_hits * 100 / total_requests))
        error_rate=$((total_errors * 100 / total_requests))
        uptime=$((100 - error_rate))
    else
        cache_rate=0
        error_rate=0
        uptime=100
    fi
    
    # Calculate average response time
    if [ ${#response_times[@]} -gt 0 ]; then
        sum=0
        for rt in "${response_times[@]}"; do
            sum=$((sum + rt))
        done
        avg_response=$((sum / ${#response_times[@]}))
    else
        avg_response=0
    fi
    
    # Keep only last 100 response times
    if [ ${#response_times[@]} -gt 100 ]; then
        response_times=("${response_times[@]: -100}")
    fi
    
    # Status Section
    echo -e "${WHITE}═══ System Status ═══════════════════════════════════════${NC}"
    
    # Health Status
    if [ "$code" = "200" ]; then
        health_status="${GREEN}● HEALTHY${NC}"
    elif [ "$code" -ge 500 ]; then
        health_status="${RED}● ERROR${NC}"
    else
        health_status="${YELLOW}● DEGRADED${NC}"
    fi
    
    echo -e "Health Status: $health_status"
    echo -e "Environment:   ${CYAN}${environment:-production}${NC}"
    echo -e "Uptime:        $(draw_bar $uptime)"
    echo ""
    
    # Performance Metrics
    echo -e "${WHITE}═══ Performance Metrics ═════════════════════════════════${NC}"
    
    # Response Time with color coding
    time_color=$(get_color $time_ms 100 300)
    echo -e "Last Response:  ${time_color}${time_ms}ms${NC}"
    echo -e "Avg Response:   ${avg_response}ms"
    
    # Response time graph (simple ASCII)
    echo -n "Trend (last 10): "
    if [ ${#response_times[@]} -ge 10 ]; then
        for i in {1..10}; do
            idx=$((${#response_times[@]} - 11 + i))
            val=${response_times[$idx]}
            if [ $val -lt 50 ]; then
                echo -n "▁"
            elif [ $val -lt 100 ]; then
                echo -n "▂"
            elif [ $val -lt 200 ]; then
                echo -n "▄"
            elif [ $val -lt 300 ]; then
                echo -n "▆"
            else
                echo -n "█"
            fi
        done
    else
        echo -n "Loading..."
    fi
    echo ""
    echo ""
    
    # Cache Performance
    echo -e "${WHITE}═══ Cache Performance ═══════════════════════════════════${NC}"
    echo -e "Cache Status:   ${cache_status:-MISS}"
    echo -e "Hit Rate:       $(draw_bar $cache_rate)"
    echo -e "Hits/Misses:    ${GREEN}${cache_hits}${NC} / ${RED}${cache_misses}${NC}"
    echo ""
    
    # Request Statistics
    echo -e "${WHITE}═══ Request Statistics ══════════════════════════════════${NC}"
    echo -e "Total Requests: ${total_requests}"
    echo -e "Total Errors:   ${total_errors}"
    echo -e "Error Rate:     $(draw_bar $error_rate)"
    echo ""
    
    # Alerts Section
    echo -e "${WHITE}═══ Alerts ══════════════════════════════════════════════${NC}"
    
    alerts=0
    
    if [ $time_ms -gt 500 ]; then
        echo -e "${RED}⚠ High response time: ${time_ms}ms${NC}"
        ((alerts++))
    fi
    
    if [ $cache_rate -lt 50 ] && [ $total_requests -gt 10 ]; then
        echo -e "${YELLOW}⚠ Low cache hit rate: ${cache_rate}%${NC}"
        ((alerts++))
    fi
    
    if [ $error_rate -gt 5 ] && [ $total_requests -gt 10 ]; then
        echo -e "${RED}⚠ High error rate: ${error_rate}%${NC}"
        ((alerts++))
    fi
    
    if [ $alerts -eq 0 ]; then
        echo -e "${GREEN}✓ All systems operational${NC}"
    fi
    
    echo ""
    echo -e "${WHITE}════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}Refreshing every 3 seconds... Press Ctrl+C to exit${NC}"
    
    # Clean up
    rm -f /tmp/monitor_headers_$$.txt
    
    # Wait before next update
    sleep 3
done