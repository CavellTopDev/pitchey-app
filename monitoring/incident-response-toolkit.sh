#!/bin/bash

# Pitchey Incident Response Toolkit
# Quick response tools for production incidents

set -e

echo "🚨 Pitchey Incident Response Toolkit"
echo "==================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_URL="https://pitchey-production.cavelltheleaddev.workers.dev"
INCIDENT_LOG="./monitoring/logs/incidents.log"

# Create log directory
mkdir -p ./monitoring/logs

# Function to log incident actions
log_action() {
    local message=$1
    echo "$(date): $message" >> "$INCIDENT_LOG"
    echo -e "${BLUE}[LOG]${NC} $message"
}

# Function to check system health
check_health() {
    echo -e "\n${YELLOW}🏥 System Health Check${NC}"
    echo "====================="
    
    local health_status=0
    
    # Check API health
    echo -n "API Health: "
    response=$(curl -s "$PRODUCTION_URL/api/health" 2>/dev/null || echo "ERROR")
    if echo "$response" | grep -q "healthy"; then
        echo -e "${GREEN}✅ HEALTHY${NC}"
        log_action "API health check: PASSED"
    else
        echo -e "${RED}❌ UNHEALTHY${NC}"
        log_action "API health check: FAILED - $response"
        health_status=1
    fi
    
    # Check response time
    echo -n "Response Time: "
    start_time=$(date +%s%3N)
    curl -s "$PRODUCTION_URL/api/health" > /dev/null 2>&1
    end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))
    
    if [ $response_time -lt 1000 ]; then
        echo -e "${GREEN}✅ ${response_time}ms${NC}"
        log_action "Response time check: GOOD (${response_time}ms)"
    else
        echo -e "${RED}❌ ${response_time}ms (SLOW)${NC}"
        log_action "Response time check: SLOW (${response_time}ms)"
        health_status=1
    fi
    
    # Check error rate (sample recent requests)
    echo -n "Error Rate: "
    error_count=0
    for i in {1..10}; do
        status=$(curl -s -w "%{http_code}" "$PRODUCTION_URL/api/health" -o /dev/null 2>/dev/null)
        if [ "$status" != "200" ]; then
            ((error_count++))
        fi
    done
    
    error_rate=$((error_count * 10))
    if [ $error_rate -le 5 ]; then
        echo -e "${GREEN}✅ ${error_rate}%${NC}"
        log_action "Error rate check: GOOD (${error_rate}%)"
    else
        echo -e "${RED}❌ ${error_rate}%${NC}"
        log_action "Error rate check: HIGH (${error_rate}%)"
        health_status=1
    fi
    
    return $health_status
}

# Function to collect diagnostic information
collect_diagnostics() {
    echo -e "\n${YELLOW}🔍 Collecting Diagnostics${NC}"
    echo "========================="
    
    local diag_file="./monitoring/logs/diagnostics-$(date +%Y%m%d_%H%M%S).log"
    
    echo "Creating diagnostic report: $diag_file"
    
    {
        echo "Pitchey Diagnostic Report"
        echo "Generated: $(date)"
        echo "========================================"
        echo ""
        
        echo "API Health Response:"
        curl -s "$PRODUCTION_URL/api/health" 2>/dev/null || echo "ERROR: Cannot reach API"
        echo ""
        
        echo "Authentication Test:"
        curl -s -X POST -H "Content-Type: application/json" \
             -d '{"email":"test@example.com","password":"test"}' \
             "$PRODUCTION_URL/api/auth/creator/login" 2>/dev/null || echo "ERROR: Cannot test auth"
        echo ""
        
        echo "Performance Test (5 requests):"
        for i in {1..5}; do
            response_time=$(curl -w "%{time_total}" -s "$PRODUCTION_URL/api/health" -o /dev/null 2>/dev/null)
            echo "Request $i: ${response_time}s"
        done
        echo ""
        
        echo "Recent Git Changes:"
        git log --oneline -10 2>/dev/null || echo "Cannot access git history"
        echo ""
        
    } > "$diag_file"
    
    echo -e "${GREEN}✅ Diagnostics collected: $diag_file${NC}"
    log_action "Diagnostics collected: $diag_file"
}

# Function to run quick fixes
run_quick_fixes() {
    echo -e "\n${YELLOW}🔧 Quick Fix Toolkit${NC}"
    echo "===================="
    
    echo "1. Clear cache and test"
    echo "2. Restart monitoring"
    echo "3. Test critical endpoints"
    echo "4. Check recent deployments"
    echo "5. Verify secrets are set"
    echo ""
    
    read -p "Enter fix number (1-5) or 'skip': " fix_choice
    
    case $fix_choice in
        1)
            echo -e "${BLUE}🗄️ Cache operations would require Upstash dashboard access${NC}"
            log_action "Cache clear requested (manual action required)"
            ;;
        2)
            echo -e "${BLUE}🔄 Restarting health monitoring...${NC}"
            pkill -f "health-monitor" 2>/dev/null || echo "No monitoring process found"
            nohup ./monitoring/health-monitor.sh > /dev/null 2>&1 &
            echo "Health monitoring restarted"
            log_action "Health monitoring restarted"
            ;;
        3)
            echo -e "${BLUE}🧪 Testing critical endpoints...${NC}"
            ./test-security-verification.sh --production || echo "Security test failed"
            log_action "Critical endpoint test executed"
            ;;
        4)
            echo -e "${BLUE}📝 Recent deployments:${NC}"
            git log --oneline --since="24 hours ago" || echo "No recent git changes"
            log_action "Recent deployment check performed"
            ;;
        5)
            echo -e "${BLUE}🔐 Secret verification would require Cloudflare dashboard${NC}"
            log_action "Secret verification requested (manual action required)"
            ;;
        skip)
            echo "Skipping quick fixes"
            ;;
        *)
            echo "Invalid option"
            ;;
    esac
}

# Function to create incident report
create_incident_report() {
    echo -e "\n${YELLOW}📋 Incident Report Creation${NC}"
    echo "==========================="
    
    local incident_id="INC-$(date +%Y%m%d-%H%M%S)"
    local report_file="./monitoring/logs/incident-${incident_id}.md"
    
    echo "Creating incident report: $incident_id"
    
    read -p "Incident severity (P1/P2/P3/P4): " severity
    read -p "Brief description: " description
    read -p "Impact assessment: " impact
    
    cat > "$report_file" << EOF
# Incident Report: $incident_id

## Basic Information
- **Incident ID**: $incident_id
- **Date/Time**: $(date)
- **Severity**: $severity
- **Status**: Under Investigation

## Description
$description

## Impact Assessment
$impact

## Timeline
- **$(date)**: Incident detected and response initiated

## Actions Taken
- System health check performed
- Diagnostic information collected
- Quick fixes evaluated

## Next Steps
- [ ] Root cause analysis
- [ ] Implement permanent fix
- [ ] Update monitoring/alerting
- [ ] Schedule post-mortem

## Technical Details
See diagnostic file: diagnostics-$(date +%Y%m%d)*.log

---
*Report generated by Incident Response Toolkit*
EOF

    echo -e "${GREEN}✅ Incident report created: $report_file${NC}"
    log_action "Incident report created: $incident_id"
}

# Function to show emergency contacts
show_emergency_contacts() {
    echo -e "\n${YELLOW}📞 Emergency Contacts${NC}"
    echo "===================="
    echo ""
    echo -e "${BLUE}Platform Team:${NC}"
    echo "- Primary: Platform Team Lead"
    echo "- Secondary: Senior Engineer"
    echo "- Escalation: Engineering Manager"
    echo ""
    echo -e "${BLUE}Communication Channels:${NC}"
    echo "- Slack: #pitchey-alerts"
    echo "- Email: alerts@pitchey.com"
    echo ""
    echo -e "${BLUE}External Support:${NC}"
    echo "- Cloudflare: Enterprise Support Portal"
    echo "- Neon: Console Support Chat"
    echo "- Upstash: Email Support"
    echo ""
    log_action "Emergency contacts displayed"
}

# Function to display dashboard links
show_dashboards() {
    echo -e "\n${YELLOW}📊 Monitoring Dashboards${NC}"
    echo "======================="
    echo ""
    echo -e "${BLUE}Production Monitoring:${NC}"
    echo "- API Health: $PRODUCTION_URL/api/health"
    echo "- Cloudflare Workers: https://dash.cloudflare.com/workers"
    echo "- Neon Database: https://console.neon.tech/"
    echo "- Upstash Redis: https://console.upstash.com/"
    echo ""
    echo -e "${BLUE}Local Tools:${NC}"
    echo "- Security Verification: ./test-security-verification.sh"
    echo "- Capacity Testing: ./quick-capacity-test.sh"
    echo "- Health Monitoring: ./monitoring/health-monitor.sh"
    echo ""
    log_action "Dashboard links displayed"
}

# Main menu
main_menu() {
    while true; do
        echo -e "\n${BLUE}🚨 Incident Response Menu${NC}"
        echo "========================"
        echo "1. 🏥 Check System Health"
        echo "2. 🔍 Collect Diagnostics"
        echo "3. 🔧 Quick Fix Toolkit"
        echo "4. 📋 Create Incident Report"
        echo "5. 📞 Emergency Contacts"
        echo "6. 📊 Dashboard Links"
        echo "7. 🚪 Exit"
        echo ""
        
        read -p "Select option (1-7): " choice
        
        case $choice in
            1)
                if check_health; then
                    echo -e "\n${GREEN}✅ System appears healthy${NC}"
                else
                    echo -e "\n${RED}⚠️ System health issues detected${NC}"
                fi
                ;;
            2)
                collect_diagnostics
                ;;
            3)
                run_quick_fixes
                ;;
            4)
                create_incident_report
                ;;
            5)
                show_emergency_contacts
                ;;
            6)
                show_dashboards
                ;;
            7)
                echo -e "\n${GREEN}Incident Response Toolkit closed${NC}"
                log_action "Incident Response Toolkit session ended"
                exit 0
                ;;
            *)
                echo -e "\n${RED}Invalid option. Please try again.${NC}"
                ;;
        esac
    done
}

# Initialize
echo -e "${BLUE}Initializing Incident Response Toolkit...${NC}"
log_action "Incident Response Toolkit started"

# Check if this is an automated call
if [ "$1" = "--auto-check" ]; then
    check_health
    exit $?
elif [ "$1" = "--diagnostics" ]; then
    collect_diagnostics
    exit 0
else
    # Show interactive menu
    main_menu
fi