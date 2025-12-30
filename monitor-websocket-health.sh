#!/bin/bash

# WebSocket Health Monitoring Script
# Continuously monitors WebSocket connection health, tracks latency, and alerts on issues

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
WEBSOCKET_URL="wss://pitchey-backend-fresh.deno.dev/ws"
PRODUCTION_URL="https://pitchey-5o8.pages.dev"
API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
PROJECT_ROOT="/home/supremeisbeing/pitcheymovie/pitchey_v0.2"
MONITOR_INTERVAL=30  # seconds between health checks
PING_TIMEOUT=10      # seconds to wait for ping response
MAX_LATENCY_MS=5000  # maximum acceptable latency in milliseconds
LOG_FILE="${PROJECT_ROOT}/websocket-monitor-$(date '+%Y%m%d').log"
ALERT_LOG="${PROJECT_ROOT}/websocket-alerts-$(date '+%Y%m%d').log"
STATUS_FILE="${PROJECT_ROOT}/.websocket-status"
PID_FILE="${PROJECT_ROOT}/.websocket-monitor.pid"

# Statistics tracking
declare -A stats
stats[total_checks]=0
stats[successful_connections]=0
stats[failed_connections]=0
stats[total_latency_ms]=0
stats[min_latency_ms]=999999
stats[max_latency_ms]=0
stats[connection_drops]=0
stats[recovery_count]=0
stats[last_connection_time]=$(date +%s)

# Logging functions
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp]${NC} $1"
    echo "[$timestamp] $1" >> "$LOG_FILE"
}

error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[ERROR $timestamp]${NC} $1" >&2
    echo "[ERROR $timestamp] $1" >> "$LOG_FILE"
    echo "[ERROR $timestamp] $1" >> "$ALERT_LOG"
}

success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[SUCCESS $timestamp]${NC} $1"
    echo "[SUCCESS $timestamp] $1" >> "$LOG_FILE"
}

warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[WARNING $timestamp]${NC} $1"
    echo "[WARNING $timestamp] $1" >> "$LOG_FILE"
    echo "[WARNING $timestamp] $1" >> "$ALERT_LOG"
}

info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${PURPLE}[INFO $timestamp]${NC} $1"
    echo "[INFO $timestamp] $1" >> "$LOG_FILE"
}

# Function to handle script termination
cleanup() {
    log "Shutting down WebSocket monitor..."
    
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
    
    # Remove PID file
    rm -f "$PID_FILE"
    
    # Generate final report
    generate_final_report
    
    exit 0
}

# Function to check if monitor is already running
check_existing_monitor() {
    if [[ -f "$PID_FILE" ]]; then
        local existing_pid=$(cat "$PID_FILE")
        if kill -0 "$existing_pid" 2>/dev/null; then
            error "WebSocket monitor already running with PID $existing_pid"
            echo "Use 'kill $existing_pid' to stop the existing monitor"
            exit 1
        else
            log "Removing stale PID file"
            rm -f "$PID_FILE"
        fi
    fi
}

# Function to create WebSocket monitoring script
create_websocket_monitor() {
    local monitor_script="${PROJECT_ROOT}/websocket-health-check.js"
    cat > "$monitor_script" << 'EOF'
const WebSocket = require('ws');

class WebSocketHealthMonitor {
    constructor(url, timeout = 10000) {
        this.url = url;
        this.timeout = timeout;
        this.ws = null;
        this.connected = false;
        this.pingStartTime = null;
        this.latency = null;
    }

    async checkHealth() {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let resolved = false;
            
            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (this.ws) {
                        this.ws.terminate();
                    }
                    reject(new Error('Connection timeout'));
                }
            }, this.timeout);

            try {
                this.ws = new WebSocket(this.url);
                
                this.ws.on('open', () => {
                    this.connected = true;
                    this.pingStartTime = Date.now();
                    
                    // Send ping message
                    this.ws.send(JSON.stringify({
                        type: 'ping',
                        timestamp: this.pingStartTime,
                        data: { health_check: true }
                    }));
                });

                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data);
                        if (message.type === 'pong' || message.type === 'ping') {
                            this.latency = Date.now() - this.pingStartTime;
                            
                            if (!resolved) {
                                resolved = true;
                                clearTimeout(timeoutId);
                                this.ws.close();
                                resolve({
                                    status: 'healthy',
                                    latency: this.latency,
                                    connectionTime: Date.now() - startTime
                                });
                            }
                        }
                    } catch (e) {
                        // Ignore parsing errors for non-JSON messages
                    }
                });

                this.ws.on('error', (error) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        reject(error);
                    }
                });

                this.ws.on('close', (code, reason) => {
                    if (!resolved && code !== 1000) {
                        resolved = true;
                        clearTimeout(timeoutId);
                        reject(new Error(`Connection closed unexpectedly: ${code} ${reason}`));
                    }
                });

            } catch (error) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    reject(error);
                }
            }
        });
    }
}

// Main execution
async function runHealthCheck() {
    const url = process.argv[2];
    const timeout = parseInt(process.argv[3]) || 10000;
    
    if (!url) {
        console.error('Usage: node websocket-health-check.js <websocket-url> [timeout-ms]');
        process.exit(1);
    }

    const monitor = new WebSocketHealthMonitor(url, timeout);
    
    try {
        const result = await monitor.checkHealth();
        console.log(JSON.stringify({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        }));
        process.exit(0);
    } catch (error) {
        console.log(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }));
        process.exit(1);
    }
}

runHealthCheck();
EOF

    echo "$monitor_script"
}

# Function to perform single health check
perform_health_check() {
    stats[total_checks]=$((stats[total_checks] + 1))
    
    local monitor_script=$(create_websocket_monitor)
    local health_result
    local exit_code
    
    # Install ws package if not present
    if [[ ! -d "$PROJECT_ROOT/node_modules/ws" ]]; then
        log "Installing ws package for monitoring..."
        cd "$PROJECT_ROOT"
        npm install ws &> /dev/null || {
            error "Failed to install ws package"
            return 1
        }
    fi
    
    # Run health check
    if command -v node &> /dev/null; then
        health_result=$(node "$monitor_script" "$WEBSOCKET_URL" "$((PING_TIMEOUT * 1000))" 2>&1)
        exit_code=$?
    else
        error "Node.js not available for WebSocket monitoring"
        rm -f "$monitor_script"
        return 1
    fi
    
    rm -f "$monitor_script"
    
    # Parse results
    if [[ $exit_code -eq 0 ]]; then
        local latency_ms=$(echo "$health_result" | jq -r '.latency // 0' 2>/dev/null || echo "0")
        local connection_time=$(echo "$health_result" | jq -r '.connectionTime // 0' 2>/dev/null || echo "0")
        
        stats[successful_connections]=$((stats[successful_connections] + 1))
        stats[total_latency_ms]=$((stats[total_latency_ms] + latency_ms))
        stats[last_connection_time]=$(date +%s)
        
        # Update min/max latency
        if [[ $latency_ms -lt ${stats[min_latency_ms]} ]]; then
            stats[min_latency_ms]=$latency_ms
        fi
        if [[ $latency_ms -gt ${stats[max_latency_ms]} ]]; then
            stats[max_latency_ms]=$latency_ms
        fi
        
        # Check for high latency
        if [[ $latency_ms -gt $MAX_LATENCY_MS ]]; then
            warning "High latency detected: ${latency_ms}ms (threshold: ${MAX_LATENCY_MS}ms)"
        else
            success "WebSocket healthy - Latency: ${latency_ms}ms, Connection: ${connection_time}ms"
        fi
        
        # Update status file
        echo "HEALTHY:$(date +%s):${latency_ms}" > "$STATUS_FILE"
        
        return 0
    else
        stats[failed_connections]=$((stats[failed_connections] + 1))
        local current_time=$(date +%s)
        
        # Check if this is a new connection drop
        if [[ $((current_time - stats[last_connection_time])) -lt $((MONITOR_INTERVAL * 2)) ]]; then
            stats[connection_drops]=$((stats[connection_drops] + 1))
        fi
        
        error "WebSocket health check failed: $health_result"
        
        # Update status file
        echo "FAILED:$(date +%s):0" > "$STATUS_FILE"
        
        return 1
    fi
}

# Function to check API health
check_api_health() {
    local api_response
    local http_status
    local start_time=$(date +%s%3N)
    
    api_response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time 10 "$API_URL/health" 2>/dev/null || echo "HTTPSTATUS:000")
    http_status=$(echo "$api_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    local end_time=$(date +%s%3N)
    local api_latency=$((end_time - start_time))
    
    if [[ "$http_status" =~ ^(200|201|204)$ ]]; then
        info "API health check passed (${api_latency}ms)"
        return 0
    else
        warning "API health check failed with status $http_status (${api_latency}ms)"
        return 1
    fi
}

# Function to display real-time statistics
display_statistics() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                  WebSocket Health Monitor                        ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}WebSocket URL:${NC} $WEBSOCKET_URL"
    echo -e "${BLUE}Monitor Started:${NC} $(date)"
    echo -e "${BLUE}Monitoring Interval:${NC} ${MONITOR_INTERVAL}s"
    echo ""
    echo -e "${YELLOW}═══════════════════ CONNECTION STATISTICS ═══════════════════${NC}"
    echo -e "${GREEN}Total Checks:${NC} ${stats[total_checks]}"
    echo -e "${GREEN}Successful:${NC} ${stats[successful_connections]}"
    echo -e "${RED}Failed:${NC} ${stats[failed_connections]}"
    
    local success_rate=0
    if [[ ${stats[total_checks]} -gt 0 ]]; then
        success_rate=$((stats[successful_connections] * 100 / stats[total_checks]))
    fi
    echo -e "${BLUE}Success Rate:${NC} ${success_rate}%"
    echo -e "${RED}Connection Drops:${NC} ${stats[connection_drops]}"
    echo -e "${GREEN}Recoveries:${NC} ${stats[recovery_count]}"
    echo ""
    
    echo -e "${YELLOW}═══════════════════ LATENCY STATISTICS ═══════════════════${NC}"
    if [[ ${stats[successful_connections]} -gt 0 ]]; then
        local avg_latency=$((stats[total_latency_ms] / stats[successful_connections]))
        echo -e "${GREEN}Average Latency:${NC} ${avg_latency}ms"
        echo -e "${GREEN}Min Latency:${NC} ${stats[min_latency_ms]}ms"
        echo -e "${RED}Max Latency:${NC} ${stats[max_latency_ms]}ms"
        
        if [[ $avg_latency -gt $MAX_LATENCY_MS ]]; then
            echo -e "${RED}⚠️  LATENCY WARNING: Average latency exceeds threshold${NC}"
        fi
    else
        echo -e "${YELLOW}No successful connections yet${NC}"
    fi
    echo ""
    
    echo -e "${YELLOW}═══════════════════ CURRENT STATUS ═══════════════════${NC}"
    if [[ -f "$STATUS_FILE" ]]; then
        local status_line=$(cat "$STATUS_FILE")
        IFS=':' read -r status timestamp latency <<< "$status_line"
        local time_ago=$(($(date +%s) - timestamp))
        
        if [[ "$status" == "HEALTHY" ]]; then
            echo -e "${GREEN}✅ WebSocket: HEALTHY${NC} (${time_ago}s ago, ${latency}ms)"
        else
            echo -e "${RED}❌ WebSocket: FAILED${NC} (${time_ago}s ago)"
        fi
    else
        echo -e "${YELLOW}⏳ Status: INITIALIZING${NC}"
    fi
    
    echo -e "${BLUE}Last Check:${NC} $(date)"
    echo ""
    echo -e "${CYAN}Press Ctrl+C to stop monitoring...${NC}"
    echo -e "${CYAN}Logs: $LOG_FILE${NC}"
}

# Function to send alerts
send_alert() {
    local alert_type="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log to alert file
    echo "[$timestamp] ALERT: $alert_type - $message" >> "$ALERT_LOG"
    
    # Display alert
    echo ""
    echo -e "${RED}🚨 ALERT: $alert_type${NC}"
    echo -e "${RED}   Message: $message${NC}"
    echo -e "${RED}   Time: $timestamp${NC}"
    echo ""
}

# Function to check for alert conditions
check_alert_conditions() {
    local total=${stats[total_checks]}
    local failed=${stats[failed_connections]}
    
    if [[ $total -gt 0 ]]; then
        local failure_rate=$((failed * 100 / total))
        
        # Alert on high failure rate (over 50% in last 10 checks)
        if [[ $total -ge 10 && $failure_rate -gt 50 ]]; then
            send_alert "HIGH_FAILURE_RATE" "Failure rate: ${failure_rate}% (${failed}/${total})"
        fi
        
        # Alert on consecutive failures
        local consecutive_failures=0
        # This is simplified - in a full implementation, you'd track the last N results
        if [[ ${stats[connection_drops]} -gt 3 ]]; then
            send_alert "MULTIPLE_CONNECTION_DROPS" "Connection drops: ${stats[connection_drops]}"
        fi
    fi
    
    # Alert on extended downtime
    local last_success=${stats[last_connection_time]}
    local current_time=$(date +%s)
    local downtime=$((current_time - last_success))
    
    if [[ $downtime -gt 300 ]]; then  # 5 minutes
        send_alert "EXTENDED_DOWNTIME" "WebSocket down for ${downtime}s"
    fi
}

# Function to generate final report
generate_final_report() {
    local report_file="${PROJECT_ROOT}/websocket-monitor-report-$(date '+%Y%m%d-%H%M%S').json"
    local end_time=$(date +%s)
    local start_time_file="${PROJECT_ROOT}/.monitor-start-time"
    local start_time
    
    if [[ -f "$start_time_file" ]]; then
        start_time=$(cat "$start_time_file")
    else
        start_time=$end_time
    fi
    
    local duration=$((end_time - start_time))
    
    cat > "$report_file" << EOF
{
  "monitoring_session": {
    "start_time": "$(date -d @$start_time -u +%Y-%m-%dT%H:%M:%SZ)",
    "end_time": "$(date -d @$end_time -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": $duration,
    "websocket_url": "$WEBSOCKET_URL"
  },
  "statistics": {
    "total_checks": ${stats[total_checks]},
    "successful_connections": ${stats[successful_connections]},
    "failed_connections": ${stats[failed_connections]},
    "success_rate_percent": $(( stats[total_checks] > 0 ? stats[successful_connections] * 100 / stats[total_checks] : 0 )),
    "connection_drops": ${stats[connection_drops]},
    "recovery_count": ${stats[recovery_count]}
  },
  "latency": {
    "average_ms": $(( stats[successful_connections] > 0 ? stats[total_latency_ms] / stats[successful_connections] : 0 )),
    "min_ms": $(( stats[min_latency_ms] == 999999 ? 0 : stats[min_latency_ms] )),
    "max_ms": ${stats[max_latency_ms]},
    "total_latency_ms": ${stats[total_latency_ms]}
  },
  "files": {
    "log_file": "$LOG_FILE",
    "alert_log": "$ALERT_LOG",
    "status_file": "$STATUS_FILE"
  }
}
EOF
    
    success "Final monitoring report generated: $report_file"
}

# Main monitoring loop
start_monitoring() {
    log "Starting WebSocket health monitoring..."
    echo $$ > "$PID_FILE"
    echo $(date +%s) > "${PROJECT_ROOT}/.monitor-start-time"
    
    # Initial status display
    display_statistics
    
    while true; do
        # Perform health check
        if perform_health_check; then
            # Check if this is a recovery
            if [[ ${stats[failed_connections]} -gt 0 && ${stats[connection_drops]} -gt 0 ]]; then
                # Simple recovery detection - in practice, you'd track state more precisely
                local current_time=$(date +%s)
                if [[ $((current_time - stats[last_connection_time])) -lt $MONITOR_INTERVAL ]]; then
                    stats[recovery_count]=$((stats[recovery_count] + 1))
                    success "🔄 Connection recovered! Recovery count: ${stats[recovery_count]}"
                fi
            fi
        fi
        
        # Check API health periodically (every 5th check)
        if [[ $((stats[total_checks] % 5)) -eq 0 ]]; then
            check_api_health
        fi
        
        # Check for alert conditions
        check_alert_conditions
        
        # Update display
        display_statistics
        
        # Wait for next check
        sleep $MONITOR_INTERVAL
    done
}

# Function to show current status
show_status() {
    if [[ -f "$STATUS_FILE" ]]; then
        local status_line=$(cat "$STATUS_FILE")
        IFS=':' read -r status timestamp latency <<< "$status_line"
        local time_ago=$(($(date +%s) - timestamp))
        
        echo "WebSocket Status: $status"
        echo "Last Check: ${time_ago}s ago"
        echo "Latency: ${latency}ms"
        
        if [[ -f "$PID_FILE" ]]; then
            local pid=$(cat "$PID_FILE")
            if kill -0 "$pid" 2>/dev/null; then
                echo "Monitor PID: $pid (running)"
            else
                echo "Monitor PID: $pid (not running)"
            fi
        else
            echo "Monitor: Not running"
        fi
    else
        echo "No status available - monitor may not have started"
    fi
}

# Function to stop monitoring
stop_monitoring() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping WebSocket monitor (PID: $pid)"
            kill "$pid"
            wait "$pid" 2>/dev/null || true
            rm -f "$PID_FILE"
            success "WebSocket monitor stopped"
        else
            warning "Monitor process not running"
            rm -f "$PID_FILE"
        fi
    else
        warning "No monitor PID file found"
    fi
}

# Function to display usage
show_usage() {
    echo "Usage: $0 [start|stop|status|help]"
    echo ""
    echo "Commands:"
    echo "  start   - Start WebSocket health monitoring (default)"
    echo "  stop    - Stop the monitoring process"
    echo "  status  - Show current WebSocket status"
    echo "  help    - Show this help message"
    echo ""
    echo "Configuration:"
    echo "  WebSocket URL: $WEBSOCKET_URL"
    echo "  Monitor Interval: ${MONITOR_INTERVAL}s"
    echo "  Ping Timeout: ${PING_TIMEOUT}s"
    echo "  Max Latency: ${MAX_LATENCY_MS}ms"
    echo ""
    echo "Files:"
    echo "  Log: $LOG_FILE"
    echo "  Alerts: $ALERT_LOG"
    echo "  Status: $STATUS_FILE"
    echo "  PID: $PID_FILE"
}

# Main function
main() {
    # Set up signal handlers
    trap cleanup INT TERM
    
    # Handle command line arguments
    local command="${1:-start}"
    
    case "$command" in
        start)
            check_existing_monitor
            start_monitoring
            ;;
        stop)
            stop_monitoring
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    error "Node.js is required for WebSocket monitoring. Please install Node.js."
    exit 1
fi

# Execute main function with all arguments
main "$@"