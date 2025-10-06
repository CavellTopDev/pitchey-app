#!/bin/bash

# Automated Cron Setup Script for Pitchey Monitoring
# This script helps set up automated monitoring tasks

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================"
echo "Pitchey Monitoring - Cron Job Setup"
echo "================================================"
echo ""

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please don't run this script as root${NC}"
   exit 1
fi

# Function to check if cron is installed
check_cron() {
    if command -v crontab &> /dev/null; then
        echo -e "${GREEN}✓ Cron is installed${NC}"
        return 0
    else
        echo -e "${RED}✗ Cron is not installed${NC}"
        echo "Please install cron first:"
        echo "  Ubuntu/Debian: sudo apt-get install cron"
        echo "  RedHat/CentOS: sudo yum install cronie"
        echo "  macOS: Cron is pre-installed"
        return 1
    fi
}

# Function to backup existing crontab
backup_crontab() {
    local backup_file="$PROJECT_DIR/monitoring/crontab-backup-$(date +%Y%m%d-%H%M%S).txt"
    
    if crontab -l 2>/dev/null > "$backup_file"; then
        echo -e "${GREEN}✓ Current crontab backed up to: $backup_file${NC}"
    else
        echo -e "${YELLOW}No existing crontab to backup${NC}"
    fi
}

# Function to check if monitoring scripts exist
check_scripts() {
    local scripts=(
        "$PROJECT_DIR/monitoring/health-check.sh"
        "$PROJECT_DIR/monitoring/daily-summary.sh"
        "$PROJECT_DIR/monitoring/uptime-monitor.sh"
    )
    
    echo -e "\n${BLUE}Checking monitoring scripts...${NC}"
    local all_exist=true
    
    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            echo -e "  ${GREEN}✓${NC} $(basename "$script")"
        else
            echo -e "  ${RED}✗${NC} $(basename "$script") not found"
            all_exist=false
        fi
    done
    
    if [ "$all_exist" = false ]; then
        echo -e "\n${RED}Some scripts are missing. Please run setup-alerts.sh first.${NC}"
        return 1
    fi
    
    return 0
}

# Function to add cron jobs
setup_cron_jobs() {
    echo -e "\n${BLUE}Setting up cron jobs...${NC}"
    
    # Create temporary file with new cron jobs
    local temp_cron="/tmp/pitchey-cron-$$"
    
    # Get existing crontab (if any)
    crontab -l 2>/dev/null > "$temp_cron" || true
    
    # Check if our jobs already exist
    if grep -q "Pitchey Production Monitoring" "$temp_cron" 2>/dev/null; then
        echo -e "${YELLOW}⚠ Pitchey monitoring jobs already exist in crontab${NC}"
        echo -n "Do you want to update them? (y/n): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "Skipping cron setup"
            return 0
        fi
        # Remove existing Pitchey jobs
        sed -i '/# Pitchey Production Monitoring/,/# End Pitchey Monitoring/d' "$temp_cron"
    fi
    
    # Add new cron jobs
    cat >> "$temp_cron" << EOF

# Pitchey Production Monitoring - Added $(date +%Y-%m-%d)
# Health check every 5 minutes
*/5 * * * * $PROJECT_DIR/monitoring/health-check.sh >> $PROJECT_DIR/monitoring/logs/health-check.log 2>&1

# Daily summary report at 9 AM
0 9 * * * $PROJECT_DIR/monitoring/daily-summary.sh

# Weekly cleanup - remove logs older than 30 days (Sunday 2 AM)
0 2 * * 0 find $PROJECT_DIR/monitoring/logs -name "*.log" -mtime +30 -delete

# Optional: Continuous monitoring (commented out by default)
# @reboot nohup $PROJECT_DIR/monitoring/uptime-monitor.sh > $PROJECT_DIR/monitoring/logs/uptime.log 2>&1 &
# End Pitchey Monitoring

EOF
    
    # Install new crontab
    if crontab "$temp_cron"; then
        echo -e "${GREEN}✓ Cron jobs installed successfully${NC}"
        rm "$temp_cron"
        return 0
    else
        echo -e "${RED}✗ Failed to install cron jobs${NC}"
        rm "$temp_cron"
        return 1
    fi
}

# Function to verify cron installation
verify_cron() {
    echo -e "\n${BLUE}Verifying cron installation...${NC}"
    
    if crontab -l 2>/dev/null | grep -q "Pitchey Production Monitoring"; then
        echo -e "${GREEN}✓ Pitchey monitoring jobs are active${NC}"
        echo ""
        echo "Active monitoring jobs:"
        crontab -l | sed -n '/# Pitchey Production Monitoring/,/# End Pitchey Monitoring/p' | grep -v "^#" | grep -v "^$"
        return 0
    else
        echo -e "${RED}✗ No Pitchey monitoring jobs found${NC}"
        return 1
    fi
}

# Function to show cron management commands
show_commands() {
    echo -e "\n${YELLOW}Useful cron commands:${NC}"
    echo "  crontab -l          # List current cron jobs"
    echo "  crontab -e          # Edit cron jobs"
    echo "  crontab -r          # Remove all cron jobs (use with caution!)"
    echo ""
    echo -e "${YELLOW}Monitor cron execution:${NC}"
    echo "  tail -f $PROJECT_DIR/monitoring/logs/health-check.log"
    echo "  tail -f /var/log/syslog | grep CRON    # On Ubuntu/Debian"
    echo "  tail -f /var/log/cron                  # On RedHat/CentOS"
    echo ""
    echo -e "${YELLOW}Start continuous monitoring manually:${NC}"
    echo "  nohup $PROJECT_DIR/monitoring/uptime-monitor.sh > $PROJECT_DIR/monitoring/logs/uptime.log 2>&1 &"
}

# Function to setup systemd service (alternative to cron)
setup_systemd_service() {
    echo -e "\n${BLUE}Optional: Setup systemd service for continuous monitoring${NC}"
    echo -n "Do you want to create a systemd service? (y/n): "
    read -r response
    
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        return 0
    fi
    
    # Create service file
    cat > /tmp/pitchey-monitor.service << EOF
[Unit]
Description=Pitchey Uptime Monitor
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$PROJECT_DIR/monitoring/uptime-monitor.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    echo -e "\n${YELLOW}Systemd service file created at: /tmp/pitchey-monitor.service${NC}"
    echo "To install it, run:"
    echo "  sudo cp /tmp/pitchey-monitor.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable pitchey-monitor"
    echo "  sudo systemctl start pitchey-monitor"
    echo "  sudo systemctl status pitchey-monitor"
}

# Main execution
main() {
    echo -e "${BLUE}Starting cron setup...${NC}"
    
    # Step 1: Check cron
    if ! check_cron; then
        exit 1
    fi
    
    # Step 2: Check scripts
    if ! check_scripts; then
        exit 1
    fi
    
    # Step 3: Backup existing crontab
    backup_crontab
    
    # Step 4: Setup cron jobs
    echo ""
    echo -e "${YELLOW}This will add the following scheduled tasks:${NC}"
    echo "  • Health check every 5 minutes"
    echo "  • Daily summary report at 9 AM"
    echo "  • Weekly log cleanup on Sundays"
    echo ""
    echo -n "Do you want to proceed? (y/n): "
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        if setup_cron_jobs; then
            verify_cron
        fi
    else
        echo "Cron setup cancelled"
    fi
    
    # Step 5: Optional systemd service
    setup_systemd_service
    
    # Step 6: Show helpful commands
    show_commands
    
    echo ""
    echo "================================================"
    echo -e "${GREEN}✅ Cron setup complete!${NC}"
    echo "================================================"
    echo ""
    echo "Next steps:"
    echo "1. Check logs: tail -f $PROJECT_DIR/monitoring/logs/health-check.log"
    echo "2. Configure alerts: nano $PROJECT_DIR/monitoring/.env.alerts"
    echo "3. View dashboard: open $PROJECT_DIR/monitoring/performance-dashboard.html"
}

# Run main function
main