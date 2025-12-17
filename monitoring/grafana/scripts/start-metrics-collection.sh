#!/bin/bash

# Metrics Collection Startup Script for Pitchey Monitoring
# Starts the metrics collection process with proper configuration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="/var/run/pitchey-metrics-collector.pid"
LOG_FILE="/var/log/pitchey-metrics-collector.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$LOG_FILE" 2>/dev/null || true
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$LOG_FILE" 2>/dev/null || true
}

# Check if running as root for systemd integration
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        RUNNING_AS_ROOT=true
        log_info "Running as root, will configure systemd service"
    else
        RUNNING_AS_ROOT=false
        log_info "Running as non-root user, will use background process"
        PID_FILE="$HOME/.pitchey-metrics-collector.pid"
        LOG_FILE="$HOME/.pitchey-metrics-collector.log"
    fi
}

# Check required environment variables
check_env_vars() {
    local required_vars=(
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ZONE_ID"
        "GRAFANA_PUSH_URL"
        "GRAFANA_API_KEY"
    )
    
    local optional_vars=(
        "CLOUDFLARE_WORKER_NAME"
        "WORKER_METRICS_TOKEN"
        "METRICS_COLLECTION_INTERVAL"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        log_error "Please set these variables and try again."
        exit 1
    fi
    
    log_info "Environment variables check passed"
    
    # Display optional variables status
    for var in "${optional_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            log_info "Optional variable set: $var"
        else
            log_warning "Optional variable not set: $var"
        fi
    done
}

# Create systemd service file
create_systemd_service() {
    local service_content
    read -r -d '' service_content << EOF || true
[Unit]
Description=Pitchey Metrics Collector
After=network.target
Wants=network.target

[Service]
Type=simple
User=nobody
Group=nogroup
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/deno run --allow-all $SCRIPT_DIR/metrics-collector.ts --interval=5
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

# Environment variables
Environment="CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN"
Environment="CLOUDFLARE_ZONE_ID=$CLOUDFLARE_ZONE_ID"
Environment="CLOUDFLARE_WORKER_NAME=${CLOUDFLARE_WORKER_NAME:-pitchey-production}"
Environment="GRAFANA_PUSH_URL=$GRAFANA_PUSH_URL"
Environment="GRAFANA_API_KEY=$GRAFANA_API_KEY"
Environment="WORKER_METRICS_TOKEN=${WORKER_METRICS_TOKEN:-}"

[Install]
WantedBy=multi-user.target
EOF

    echo "$service_content" > "/etc/systemd/system/pitchey-metrics-collector.service"
    log_success "Systemd service file created"
    
    systemctl daemon-reload
    systemctl enable pitchey-metrics-collector
    log_success "Service enabled for auto-start"
}

# Check if Deno is installed
check_deno() {
    if ! command -v deno &> /dev/null; then
        log_error "Deno is not installed or not in PATH"
        log_info "Installing Deno..."
        
        if [[ "$RUNNING_AS_ROOT" == true ]]; then
            curl -fsSL https://deno.land/install.sh | sh
            ln -sf ~/.deno/bin/deno /usr/local/bin/deno
        else
            curl -fsSL https://deno.land/install.sh | sh
            export PATH="$HOME/.deno/bin:$PATH"
        fi
        
        if command -v deno &> /dev/null; then
            log_success "Deno installed successfully"
        else
            log_error "Failed to install Deno"
            exit 1
        fi
    else
        log_success "Deno is available: $(deno --version | head -n1)"
    fi
}

# Check if metrics collector is already running
check_running() {
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid=$(cat "$PID_FILE")
        
        if kill -0 "$pid" 2>/dev/null; then
            log_warning "Metrics collector is already running (PID: $pid)"
            return 0
        else
            log_info "Stale PID file found, removing..."
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# Start metrics collection in background
start_background() {
    local interval="${METRICS_COLLECTION_INTERVAL:-5}"
    
    log_info "Starting metrics collection in background (interval: ${interval}m)"
    
    # Start the process in background
    nohup deno run --allow-all "$SCRIPT_DIR/metrics-collector.ts" --interval="$interval" \
        >> "$LOG_FILE" 2>&1 &
    
    local pid=$!
    echo "$pid" > "$PID_FILE"
    
    log_success "Metrics collector started (PID: $pid)"
    log_info "Logs: $LOG_FILE"
    log_info "PID file: $PID_FILE"
    
    # Test if process is still running after a few seconds
    sleep 3
    if kill -0 "$pid" 2>/dev/null; then
        log_success "Process is running successfully"
    else
        log_error "Process failed to start or crashed immediately"
        log_error "Check the log file for details: $LOG_FILE"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# Start with systemd
start_systemd() {
    create_systemd_service
    
    log_info "Starting systemd service..."
    systemctl start pitchey-metrics-collector
    
    sleep 3
    
    if systemctl is-active pitchey-metrics-collector >/dev/null; then
        log_success "Service started successfully"
        log_info "Service status:"
        systemctl status pitchey-metrics-collector --no-pager -l
    else
        log_error "Service failed to start"
        log_error "Service logs:"
        journalctl -u pitchey-metrics-collector --no-pager -n 20
        exit 1
    fi
}

# Stop metrics collection
stop_collection() {
    if [[ "$RUNNING_AS_ROOT" == true ]] && systemctl is-enabled pitchey-metrics-collector >/dev/null 2>&1; then
        log_info "Stopping systemd service..."
        systemctl stop pitchey-metrics-collector
        systemctl disable pitchey-metrics-collector
        rm -f /etc/systemd/system/pitchey-metrics-collector.service
        systemctl daemon-reload
        log_success "Systemd service stopped and removed"
    else
        if [[ -f "$PID_FILE" ]]; then
            local pid
            pid=$(cat "$PID_FILE")
            
            if kill -0 "$pid" 2>/dev/null; then
                log_info "Stopping metrics collector (PID: $pid)..."
                kill "$pid"
                
                # Wait for process to stop
                local count=0
                while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
                    sleep 1
                    ((count++))
                done
                
                if kill -0 "$pid" 2>/dev/null; then
                    log_warning "Process didn't stop gracefully, forcing..."
                    kill -9 "$pid"
                fi
                
                log_success "Metrics collector stopped"
            else
                log_warning "Process not running"
            fi
            
            rm -f "$PID_FILE"
        else
            log_warning "No PID file found"
        fi
    fi
}

# Show status
show_status() {
    if [[ "$RUNNING_AS_ROOT" == true ]] && systemctl is-enabled pitchey-metrics-collector >/dev/null 2>&1; then
        log_info "Systemd service status:"
        systemctl status pitchey-metrics-collector --no-pager
        log_info "Recent logs:"
        journalctl -u pitchey-metrics-collector --no-pager -n 10
    else
        if [[ -f "$PID_FILE" ]]; then
            local pid
            pid=$(cat "$PID_FILE")
            
            if kill -0 "$pid" 2>/dev/null; then
                log_success "Metrics collector is running (PID: $pid)"
                
                # Show memory usage
                local mem_usage
                mem_usage=$(ps -o rss= -p "$pid" 2>/dev/null || echo "unknown")
                log_info "Memory usage: ${mem_usage} KB"
                
                # Show recent logs
                log_info "Recent logs:"
                tail -n 10 "$LOG_FILE" 2>/dev/null || log_warning "No log file found"
            else
                log_error "Process not running (stale PID file)"
                rm -f "$PID_FILE"
            fi
        else
            log_warning "Metrics collector is not running"
        fi
    fi
}

# Test configuration
test_config() {
    log_info "Testing configuration..."
    
    # Test Deno
    check_deno
    
    # Test environment variables
    check_env_vars
    
    # Test metrics collector script
    if [[ -f "$SCRIPT_DIR/metrics-collector.ts" ]]; then
        log_success "Metrics collector script found"
    else
        log_error "Metrics collector script not found: $SCRIPT_DIR/metrics-collector.ts"
        exit 1
    fi
    
    # Test single metrics collection run
    log_info "Testing single metrics collection run..."
    if timeout 30 deno run --allow-all "$SCRIPT_DIR/metrics-collector.ts" --once; then
        log_success "Test collection completed successfully"
    else
        log_error "Test collection failed"
        exit 1
    fi
}

# Main function
main() {
    local action="${1:-start}"
    
    check_permissions
    
    case "$action" in
        start)
            log_info "Starting Pitchey metrics collection..."
            
            if check_running; then
                exit 0
            fi
            
            check_env_vars
            check_deno
            
            if [[ "$RUNNING_AS_ROOT" == true ]]; then
                start_systemd
            else
                start_background
            fi
            ;;
        
        stop)
            log_info "Stopping Pitchey metrics collection..."
            stop_collection
            ;;
        
        restart)
            log_info "Restarting Pitchey metrics collection..."
            stop_collection
            sleep 2
            main start
            ;;
        
        status)
            show_status
            ;;
        
        test)
            test_config
            ;;
        
        *)
            echo "Usage: $0 {start|stop|restart|status|test}"
            echo
            echo "Commands:"
            echo "  start   - Start metrics collection"
            echo "  stop    - Stop metrics collection"
            echo "  restart - Restart metrics collection"
            echo "  status  - Show current status"
            echo "  test    - Test configuration"
            exit 1
            ;;
    esac
}

# Help function
show_help() {
    cat << EOF
Pitchey Metrics Collection Manager

This script manages the metrics collection process for Pitchey monitoring.

Usage:
    $0 [COMMAND]

Commands:
    start       Start metrics collection (default)
    stop        Stop metrics collection
    restart     Restart metrics collection
    status      Show current status
    test        Test configuration
    -h, --help  Show this help message

Required Environment Variables:
    CLOUDFLARE_API_TOKEN    Your Cloudflare API token
    CLOUDFLARE_ZONE_ID      Your Cloudflare zone ID
    GRAFANA_PUSH_URL        Grafana metrics endpoint URL
    GRAFANA_API_KEY         Grafana API key for metrics pushing

Optional Environment Variables:
    CLOUDFLARE_WORKER_NAME          Worker name (default: pitchey-production)
    WORKER_METRICS_TOKEN            Token for worker metrics endpoint
    METRICS_COLLECTION_INTERVAL     Collection interval in minutes (default: 5)

Examples:
    # Start collection
    $0 start
    
    # Check status
    $0 status
    
    # Test configuration
    $0 test

EOF
}

# Parse command line arguments
if [[ "${1:-}" =~ ^(-h|--help)$ ]]; then
    show_help
    exit 0
fi

# Run main function
main "${1:-start}"