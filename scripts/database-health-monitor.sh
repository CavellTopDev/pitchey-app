#!/bin/bash

# =====================================================
# Database Health Monitoring Script
# For Pitchey Platform Operational Excellence
# =====================================================

set -euo pipefail

# Configuration
HEALTH_ENDPOINT="https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health/database"
BACKUP_ENDPOINT="https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health"
LOCAL_ENDPOINT="http://localhost:8001/api/health/database"
ALERT_THRESHOLD=70
LOG_FILE="/tmp/pitchey-db-health.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Test database health
test_health() {
    local endpoint="$1"
    local name="$2"
    
    echo -e "${BLUE}Testing $name...${NC}"
    
    # Test connectivity and parse health score
    if response=$(curl -s -w "HTTPSTATUS:%{http_code}\nRESPONSETIME:%{time_total}" "$endpoint" 2>/dev/null); then
        http_status=$(echo "$response" | grep "HTTPSTATUS:" | sed 's/.*HTTPSTATUS://')
        response_time=$(echo "$response" | grep "RESPONSETIME:" | cut -d: -f2)
        json_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*//' | sed '/RESPONSETIME:/d')
        
        if [ "$http_status" = "200" ]; then
            # Extract health score using jq if available, fallback to grep
            if command -v jq >/dev/null 2>&1; then
                health_score=$(echo "$json_body" | jq -r '.data.health_score // 0' 2>/dev/null || echo "0")
                db_status=$(echo "$json_body" | jq -r '.data.status // "unknown"' 2>/dev/null || echo "unknown")
                latency=$(echo "$json_body" | jq -r '.data.database.connection.latency_ms // 0' 2>/dev/null || echo "0")
                total_tables=$(echo "$json_body" | jq -r '.data.database.schema.total_tables // 0' 2>/dev/null || echo "0")
                core_tables=$(echo "$json_body" | jq -r '.data.database.schema.core_tables.found // 0' 2>/dev/null || echo "0")
            else
                health_score=$(echo "$json_body" | grep -o '"health_score":[0-9]*' | cut -d: -f2 | head -1 || echo "0")
                db_status=$(echo "$json_body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 | head -1 || echo "unknown")
                latency=$(echo "$json_body" | grep -o '"latency_ms":[0-9]*' | cut -d: -f2 | head -1 || echo "0")
                total_tables=$(echo "$json_body" | grep -o '"total_tables":[0-9]*' | cut -d: -f2 | head -1 || echo "0")
                core_tables=$(echo "$json_body" | grep -o '"found":[0-9]*' | cut -d: -f2 | head -1 || echo "0")
            fi
            
            # Default values if parsing failed
            health_score=${health_score:-0}
            db_status=${db_status:-"unknown"}
            latency=${latency:-0}
            total_tables=${total_tables:-0}
            core_tables=${core_tables:-0}
            
            # Color-coded output based on health score
            if [ "$health_score" -ge 90 ]; then
                status_color="$GREEN"
                status_text="EXCELLENT"
            elif [ "$health_score" -ge 80 ]; then
                status_color="$GREEN"
                status_text="GOOD"
            elif [ "$health_score" -ge "$ALERT_THRESHOLD" ]; then
                status_color="$YELLOW"
                status_text="ACCEPTABLE"
            else
                status_color="$RED"
                status_text="DEGRADED"
            fi
            
            echo -e "  ${status_color}✓ $name: $status_text (Score: $health_score/100)${NC}"
            echo -e "    Database Status: $db_status"
            echo -e "    Response Time: ${response_time}s"
            echo -e "    DB Latency: ${latency}ms"
            echo -e "    Tables: ${total_tables} total, ${core_tables}/6 core tables"
            
            log "$name - Score: $health_score, Status: $db_status, Latency: ${latency}ms, Response: ${response_time}s"
            
            # Alert if below threshold
            if [ "$health_score" -lt "$ALERT_THRESHOLD" ]; then
                echo -e "  ${RED}⚠️  ALERT: Health score below threshold ($ALERT_THRESHOLD)${NC}"
                log "ALERT: $name health score $health_score below threshold $ALERT_THRESHOLD"
                return 1
            fi
            
        else
            echo -e "  ${RED}✗ $name: HTTP $http_status${NC}"
            log "ERROR: $name returned HTTP $http_status"
            return 1
        fi
    else
        echo -e "  ${RED}✗ $name: Connection failed${NC}"
        log "ERROR: $name connection failed"
        return 1
    fi
    
    return 0
}

# Backup retention check
check_backup_status() {
    echo -e "\n${BLUE}Checking backup and retention policies...${NC}"
    
    # This would integrate with actual backup systems
    # For now, we'll check if the basic health endpoint works
    if curl -s "$BACKUP_ENDPOINT" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓ Basic health endpoint operational${NC}"
        echo -e "  ${YELLOW}ℹ️  Backup validation: Manual verification required${NC}"
        echo -e "    - Verify Neon automatic backups are enabled"
        echo -e "    - Check point-in-time recovery settings"
        echo -e "    - Validate cross-region backup replication"
    else
        echo -e "  ${RED}✗ Basic health endpoint failed${NC}"
        return 1
    fi
}

# User management audit
check_user_access() {
    echo -e "\n${BLUE}Database user management check...${NC}"
    echo -e "  ${YELLOW}ℹ️  Manual verification required:${NC}"
    echo -e "    - Review database user permissions"
    echo -e "    - Audit connection pooler settings"
    echo -e "    - Verify least-privilege access controls"
    echo -e "    - Check for unused or expired credentials"
}

# Performance monitoring
performance_benchmarks() {
    echo -e "\n${BLUE}Performance benchmarking...${NC}"
    
    # Run multiple tests for average latency
    total_time=0
    successful_tests=0
    
    for i in {1..3}; do
        if response=$(curl -s -w "%{time_total}" "$HEALTH_ENDPOINT" -o /dev/null 2>/dev/null); then
            total_time=$(echo "$total_time + $response" | bc -l 2>/dev/null || echo "$total_time")
            successful_tests=$((successful_tests + 1))
        fi
    done
    
    if [ "$successful_tests" -gt 0 ]; then
        avg_time=$(echo "scale=3; $total_time / $successful_tests" | bc -l 2>/dev/null || echo "0")
        echo -e "  ${GREEN}✓ Average response time: ${avg_time}s (3 tests)${NC}"
        
        # Performance thresholds
        if (( $(echo "$avg_time < 0.5" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  ${GREEN}✓ Performance: EXCELLENT (< 0.5s)${NC}"
        elif (( $(echo "$avg_time < 1.0" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  ${GREEN}✓ Performance: GOOD (< 1.0s)${NC}"
        elif (( $(echo "$avg_time < 2.0" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "  ${YELLOW}⚠ Performance: ACCEPTABLE (< 2.0s)${NC}"
        else
            echo -e "  ${RED}⚠ Performance: SLOW (> 2.0s)${NC}"
        fi
    else
        echo -e "  ${RED}✗ Performance test failed${NC}"
    fi
}

# Main monitoring function
main() {
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}   Pitchey Database Health Monitor      ${NC}"
    echo -e "${BLUE}   $(date '+%Y-%m-%d %H:%M:%S')                    ${NC}"
    echo -e "${BLUE}=========================================${NC}\n"
    
    local exit_code=0
    
    # Test production endpoint
    if ! test_health "$HEALTH_ENDPOINT" "Production API"; then
        exit_code=1
    fi
    
    # Test local endpoint if accessible
    if curl -s "$LOCAL_ENDPOINT" >/dev/null 2>&1; then
        echo ""
        if ! test_health "$LOCAL_ENDPOINT" "Local Development"; then
            exit_code=1
        fi
    fi
    
    # Additional checks
    check_backup_status
    check_user_access
    performance_benchmarks
    
    echo -e "\n${BLUE}=========================================${NC}"
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ Database health check completed successfully${NC}"
    else
        echo -e "${RED}⚠ Database health check found issues${NC}"
    fi
    echo -e "${BLUE}Log file: $LOG_FILE${NC}"
    echo -e "${BLUE}=========================================${NC}"
    
    exit $exit_code
}

# Handle script arguments
case "${1:-check}" in
    "check")
        main
        ;;
    "monitor")
        echo "Starting continuous monitoring (5-minute intervals)..."
        while true; do
            main
            echo -e "\nWaiting 5 minutes for next check...\n"
            sleep 300
        done
        ;;
    "alert-test")
        # Force alert condition for testing
        ALERT_THRESHOLD=100
        main
        ;;
    *)
        echo "Usage: $0 [check|monitor|alert-test]"
        echo "  check      - Single health check (default)"
        echo "  monitor    - Continuous monitoring every 5 minutes"  
        echo "  alert-test - Test alert conditions"
        exit 1
        ;;
esac