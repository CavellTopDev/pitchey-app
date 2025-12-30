#!/bin/bash

# Pitchey Platform Monitoring Dashboard
# Real-time monitoring of all critical endpoints and services
# Includes Better Auth status tracking

set -e

# Configuration
BASE_URL="${API_URL:-https://pitchey-api-prod.ndlovucavelle.workers.dev}"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-60}" # seconds
LOG_FILE="monitoring.log"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Track status
declare -A endpoint_status
declare -A response_times
declare -A last_check

# Clear screen and show header
show_header() {
    clear
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║           PITCHEY PLATFORM MONITORING DASHBOARD              ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}API:${NC} $BASE_URL"
    echo -e "${BLUE}Time:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "${BLUE}Refresh:${NC} Every ${REFRESH_INTERVAL}s"
    echo ""
}

# Test endpoint and return status
test_endpoint() {
    local name=$1
    local endpoint=$2
    local method=${3:-GET}
    local data=${4:-}
    local expected=${5:-"success"}
    
    local start_time=$(date +%s%N)
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo "FAIL\n000")
    else
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null || echo "FAIL\n000")
    fi
    
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to ms
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    # Determine status
    if [ "$http_code" = "000" ]; then
        status="DOWN"
        color=$RED
    elif [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        if echo "$body" | grep -q "$expected" 2>/dev/null; then
            status="OK"
            color=$GREEN
        else
            status="PARTIAL"
            color=$YELLOW
        fi
    elif [ "$http_code" = "404" ]; then
        status="NOT FOUND"
        color=$YELLOW
    elif [ "$http_code" -ge 500 ]; then
        status="ERROR"
        color=$RED
    else
        status="ISSUE ($http_code)"
        color=$YELLOW
    fi
    
    # Store results
    endpoint_status["$name"]="$status"
    response_times["$name"]="$response_time"
    last_check["$name"]=$(date '+%H:%M:%S')
    
    # Display result
    printf "%-30s [%b%s%b] %4dms %s\n" \
        "$name" "$color" "$status" "$NC" "$response_time" "$endpoint"
}

# Monitor all endpoints
monitor_endpoints() {
    echo -e "${BOLD}${MAGENTA}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${MAGENTA}│                     ENDPOINT STATUS                        │${NC}"
    echo -e "${BOLD}${MAGENTA}└─────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    # Core Public Endpoints
    echo -e "${CYAN}Public Endpoints:${NC}"
    test_endpoint "Browse Enhanced" "/api/pitches/browse/enhanced?limit=1" "GET" "" "success"
    test_endpoint "Public Pitches" "/api/pitches/public?limit=1" "GET" "" "success\|pitches"
    test_endpoint "Search" "/api/pitches/search?q=test" "GET" "" "success\|results"
    echo ""
    
    # Better Auth Endpoints
    echo -e "${CYAN}Better Auth Status:${NC}"
    test_endpoint "Session Check" "/api/auth/session" "GET" "" "session\|success"
    test_endpoint "Better Auth Sign-In" "/api/auth/sign-in" "POST" \
        '{"email":"alex.creator@demo.com","password":"Demo123"}' "success\|session"
    test_endpoint "Better Auth User" "/api/auth/user" "GET" "" "email\|user"
    echo ""
    
    # Legacy Auth Endpoints (for backward compatibility)
    echo -e "${CYAN}Legacy Portal Auth:${NC}"
    test_endpoint "Creator Login" "/api/auth/creator/login" "POST" \
        '{"email":"alex.creator@demo.com","password":"Demo123"}' "success\|token"
    test_endpoint "Investor Login" "/api/auth/investor/login" "POST" \
        '{"email":"sarah.investor@demo.com","password":"Demo123"}' "success\|token"
    test_endpoint "Production Login" "/api/auth/production/login" "POST" \
        '{"email":"stellar.production@demo.com","password":"Demo123"}' "success\|token"
    echo ""
    
    # Dashboard Endpoints
    echo -e "${CYAN}Dashboard Endpoints:${NC}"
    test_endpoint "Creator Dashboard" "/api/creator/dashboard" "GET" "" "success\|stats"
    test_endpoint "Investor Dashboard" "/api/investor/dashboard" "GET" "" "success\|stats"
    test_endpoint "Production Dashboard" "/api/production/dashboard" "GET" "" "success\|stats"
}

# Show summary statistics
show_summary() {
    echo ""
    echo -e "${BOLD}${MAGENTA}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${MAGENTA}│                        SUMMARY                             │${NC}"
    echo -e "${BOLD}${MAGENTA}└─────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    local total=0
    local ok_count=0
    local down_count=0
    local issue_count=0
    local total_response_time=0
    
    for name in "${!endpoint_status[@]}"; do
        total=$((total + 1))
        case "${endpoint_status[$name]}" in
            "OK") ok_count=$((ok_count + 1)) ;;
            "DOWN") down_count=$((down_count + 1)) ;;
            *) issue_count=$((issue_count + 1)) ;;
        esac
        total_response_time=$((total_response_time + ${response_times[$name]}))
    done
    
    local avg_response_time=0
    if [ $total -gt 0 ]; then
        avg_response_time=$((total_response_time / total))
    fi
    
    echo -e "Total Endpoints: ${BOLD}$total${NC}"
    echo -e "Status: ${GREEN}$ok_count OK${NC} | ${YELLOW}$issue_count Issues${NC} | ${RED}$down_count Down${NC}"
    echo -e "Average Response Time: ${BOLD}${avg_response_time}ms${NC}"
    
    # Overall health indicator
    echo ""
    if [ $down_count -eq 0 ] && [ $issue_count -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✅ SYSTEM HEALTHY${NC}"
    elif [ $down_count -eq 0 ]; then
        echo -e "${YELLOW}${BOLD}⚠️  SYSTEM DEGRADED${NC}"
    else
        echo -e "${RED}${BOLD}❌ SYSTEM CRITICAL${NC}"
    fi
    
    # Log to file
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: $ok_count, Issues: $issue_count, Down: $down_count, Avg: ${avg_response_time}ms" >> "$LOG_FILE"
}

# Show Better Auth specific status
show_better_auth_status() {
    echo ""
    echo -e "${BOLD}${MAGENTA}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${MAGENTA}│                  BETTER AUTH STATUS                        │${NC}"
    echo -e "${BOLD}${MAGENTA}└─────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    local better_auth_working=false
    
    if [ "${endpoint_status["Better Auth Sign-In"]}" = "OK" ] || \
       [ "${endpoint_status["Session Check"]}" = "OK" ]; then
        better_auth_working=true
        echo -e "${GREEN}✅ Better Auth: ACTIVE${NC}"
    elif [ "${endpoint_status["Better Auth Sign-In"]}" = "NOT FOUND" ]; then
        echo -e "${YELLOW}⚠️  Better Auth: NOT DEPLOYED${NC}"
        echo "   Better Auth endpoints not found in production."
        echo "   Deploy the Better Auth worker to enable session-based auth."
    else
        echo -e "${RED}❌ Better Auth: ERROR${NC}"
        echo "   Better Auth endpoints are returning errors."
    fi
    
    # Show which auth system is working
    echo ""
    echo -e "${CYAN}Authentication Systems:${NC}"
    
    if [ "${endpoint_status["Creator Login"]}" = "OK" ] || \
       [ "${endpoint_status["Creator Login"]}" = "PARTIAL" ]; then
        echo -e "  • Legacy JWT Auth: ${GREEN}Working${NC}"
    else
        echo -e "  • Legacy JWT Auth: ${RED}Not Working${NC}"
    fi
    
    if [ "$better_auth_working" = true ]; then
        echo -e "  • Better Auth: ${GREEN}Working${NC}"
    else
        echo -e "  • Better Auth: ${RED}Not Working${NC}"
    fi
}

# Main monitoring loop
main() {
    echo "Starting Pitchey Platform Monitoring..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    # Create log file if it doesn't exist
    touch "$LOG_FILE"
    
    while true; do
        show_header
        monitor_endpoints
        show_summary
        show_better_auth_status
        
        echo ""
        echo -e "${BLUE}Next refresh in ${REFRESH_INTERVAL} seconds...${NC}"
        echo -e "${BLUE}Press Ctrl+C to exit${NC}"
        
        sleep "$REFRESH_INTERVAL"
    done
}

# Handle Ctrl+C gracefully
trap 'echo -e "\n${YELLOW}Monitoring stopped.${NC}"; exit 0' INT

# Run main function
main