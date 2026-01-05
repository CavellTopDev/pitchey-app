#!/bin/bash

# Development Tools and Debugging Utilities
# Comprehensive toolkit for local development with Podman/Docker

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
readonly DEV_DIR="${PROJECT_ROOT}/.dev"
readonly LOGS_DIR="${PROJECT_ROOT}/logs/dev"
readonly COMPOSE_FILE="${PROJECT_ROOT}/podman-compose.yml"

# Development configuration
DEV_ENVIRONMENT="${DEV_ENVIRONMENT:-development}"
HOT_RELOAD="${HOT_RELOAD:-true}"
DEBUG_MODE="${DEBUG_MODE:-true}"
LOG_LEVEL="${LOG_LEVEL:-debug}"

# Port configuration
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
WORKER_PORT="${WORKER_PORT:-8787}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6380}"
MINIO_PORT="${MINIO_PORT:-9000}"
ADMINER_PORT="${ADMINER_PORT:-8080}"

# =============================================================================
# COLORS AND LOGGING
# =============================================================================

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

log_dev() {
    echo -e "${CYAN}[DEV]${NC} $1" | tee -a "${LOGS_DIR}/dev_$(date +%Y%m%d).log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOGS_DIR}/dev_$(date +%Y%m%d).log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOGS_DIR}/dev_$(date +%Y%m%d).log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOGS_DIR}/dev_$(date +%Y%m%d).log"
}

log_header() {
    echo -e "\n${PURPLE}=== $1 ===${NC}"
}

# =============================================================================
# ENVIRONMENT DETECTION
# =============================================================================

detect_dev_environment() {
    log_header "Detecting Development Environment"
    
    # Load environment setup
    if [[ -f "${SCRIPT_DIR}/environment-setup.sh" ]]; then
        # shellcheck source=scripts/environment-setup.sh
        source "${SCRIPT_DIR}/environment-setup.sh"
        detect_container_runtime
    else
        log_error "Environment setup script not found"
        exit 1
    fi
    
    # Create required directories
    mkdir -p "${DEV_DIR}" "${LOGS_DIR}"
    
    # Check development dependencies
    check_dev_dependencies
    
    log_success "Development environment ready: ${CONTAINER_RUNTIME}"
}

check_dev_dependencies() {
    log_dev "Checking development dependencies..."
    
    local missing_deps=()
    
    # Node.js ecosystem
    if ! command -v node >/dev/null 2>&1; then
        missing_deps+=("node")
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        missing_deps+=("npm")
    fi
    
    # Development tools
    if ! command -v git >/dev/null 2>&1; then
        missing_deps+=("git")
    fi
    
    if ! command -v curl >/dev/null 2>&1; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        missing_deps+=("jq")
    fi
    
    # Optional but recommended
    local optional_deps=()
    
    if ! command -v tmux >/dev/null 2>&1; then
        optional_deps+=("tmux")
    fi
    
    if ! command -v code >/dev/null 2>&1 && ! command -v codium >/dev/null 2>&1; then
        optional_deps+=("vscode")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_dev "Install missing dependencies and try again"
        return 1
    fi
    
    if [[ ${#optional_deps[@]} -gt 0 ]]; then
        log_warning "Optional dependencies not found: ${optional_deps[*]}"
    fi
    
    log_success "All required dependencies satisfied"
}

# =============================================================================
# DEVELOPMENT ENVIRONMENT MANAGEMENT
# =============================================================================

start_dev_environment() {
    log_header "Starting Development Environment"
    
    # Detect and configure environment
    detect_dev_environment
    
    # Setup development configuration
    setup_dev_config
    
    # Start backend services
    start_backend_services
    
    # Start frontend development server
    start_frontend_dev
    
    # Start worker development
    start_worker_dev
    
    # Show development dashboard
    show_dev_dashboard
    
    log_success "Development environment started successfully!"
}

setup_dev_config() {
    log_dev "Setting up development configuration..."
    
    # Create development environment file
    create_dev_env_file
    
    # Setup frontend environment
    setup_frontend_dev_env
    
    # Configure worker development
    setup_worker_dev_config
    
    log_success "Development configuration ready"
}

create_dev_env_file() {
    local env_file="${PROJECT_ROOT}/.env.development"
    
    log_dev "Creating development environment file..."
    
    cat > "${env_file}" << EOF
# Development Environment Configuration
NODE_ENV=development
ENVIRONMENT=development

# Frontend Configuration
VITE_API_URL=http://localhost:${BACKEND_PORT}
VITE_WS_URL=ws://localhost:${BACKEND_PORT}
VITE_HOT_RELOAD=${HOT_RELOAD}
VITE_DEBUG_MODE=${DEBUG_MODE}

# Backend Configuration
PORT=${BACKEND_PORT}
HOST=localhost

# Database Configuration
DATABASE_URL=postgresql://pitchey_dev:localdev123@localhost:${POSTGRES_PORT}/pitchey_local
REDIS_URL=redis://localhost:${REDIS_PORT}

# Storage Configuration
MINIO_ENDPOINT=localhost:${MINIO_PORT}
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Development Features
DEBUG=${DEBUG_MODE}
LOG_LEVEL=${LOG_LEVEL}
HOT_RELOAD=${HOT_RELOAD}
SOURCE_MAPS=true
ENABLE_DEVTOOLS=true

# Worker Configuration
WRANGLER_PORT=${WORKER_PORT}
CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-02967e39e44b6266e7873829e94849f5}
EOF
    
    log_success "Development environment file created: ${env_file}"
}

setup_frontend_dev_env() {
    local frontend_env="${PROJECT_ROOT}/frontend/.env.development"
    
    log_dev "Setting up frontend development environment..."
    
    cat > "${frontend_env}" << EOF
# Frontend Development Configuration
VITE_API_URL=http://localhost:${BACKEND_PORT}
VITE_WS_URL=ws://localhost:${BACKEND_PORT}
VITE_NODE_ENV=development
VITE_HOT_RELOAD=${HOT_RELOAD}
VITE_DEBUG_MODE=${DEBUG_MODE}
VITE_LOG_LEVEL=${LOG_LEVEL}
EOF
    
    log_success "Frontend development environment configured"
}

setup_worker_dev_config() {
    local worker_config="${PROJECT_ROOT}/wrangler.dev.toml"
    
    log_dev "Setting up worker development configuration..."
    
    cat > "${worker_config}" << EOF
name = "pitchey-api-dev"
main = "src/worker-integrated.ts"
compatibility_date = "$(date +%Y-%m-%d)"
account_id = "${CLOUDFLARE_ACCOUNT_ID:-02967e39e44b6266e7873829e94849f5}"

[env.development]
vars = { 
  ENVIRONMENT = "development",
  DEBUG = "true",
  LOG_LEVEL = "${LOG_LEVEL}"
}

[dev]
port = ${WORKER_PORT}
local_protocol = "http"
host = "localhost"

[build]
command = ""
EOF
    
    log_success "Worker development configuration created"
}

# =============================================================================
# SERVICE MANAGEMENT
# =============================================================================

start_backend_services() {
    log_header "Starting Backend Services"
    
    # Check if services are already running
    if services_running; then
        log_warning "Backend services already running. Use 'restart' to reload."
        return 0
    fi
    
    log_dev "Starting backend services with ${CONTAINER_RUNTIME}..."
    
    # Start services using compose
    if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
        if command -v podman-compose >/dev/null 2>&1; then
            podman-compose -f "${COMPOSE_FILE}" up -d
        else
            log_warning "podman-compose not found, using docker-compose with Podman socket"
            DOCKER_HOST="unix://${XDG_RUNTIME_DIR}/podman/podman.sock" \
                docker-compose -f "${COMPOSE_FILE}" up -d
        fi
    else
        docker-compose -f "${COMPOSE_FILE}" up -d
    fi
    
    # Wait for services to be ready
    wait_for_services
    
    log_success "Backend services started successfully"
}

wait_for_services() {
    log_dev "Waiting for services to be ready..."
    
    local services=(
        "postgres:${POSTGRES_PORT}"
        "redis:${REDIS_PORT}"
        "minio:${MINIO_PORT}"
        "adminer:${ADMINER_PORT}"
    )
    
    local max_wait=60
    local wait_interval=2
    local total_wait=0
    
    for service in "${services[@]}"; do
        local service_name="${service%:*}"
        local service_port="${service#*:}"
        
        log_dev "Waiting for ${service_name} on port ${service_port}..."
        
        while [[ $total_wait -lt $max_wait ]]; do
            if nc -z localhost "${service_port}" 2>/dev/null; then
                log_success "${service_name} is ready"
                break
            fi
            
            sleep $wait_interval
            total_wait=$((total_wait + wait_interval))
            
            if [[ $total_wait -ge $max_wait ]]; then
                log_warning "${service_name} not ready after ${max_wait}s"
            fi
        done
    done
}

services_running() {
    ${CONTAINER_RUNTIME} ps --filter "name=pitchey" --format "table {{.Names}}" | grep -q pitchey 2>/dev/null
}

# =============================================================================
# FRONTEND DEVELOPMENT
# =============================================================================

start_frontend_dev() {
    log_header "Starting Frontend Development Server"
    
    cd "${PROJECT_ROOT}/frontend"
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_dev "Installing frontend dependencies..."
        npm install
    fi
    
    # Start development server in background
    log_dev "Starting frontend development server on port ${FRONTEND_PORT}..."
    
    if [[ "${HOT_RELOAD}" == "true" ]]; then
        npm run dev -- --host --port "${FRONTEND_PORT}" > "${LOGS_DIR}/frontend_$(date +%Y%m%d_%H%M%S).log" 2>&1 &
        echo $! > "${DEV_DIR}/frontend.pid"
    else
        npm run build
        npx serve -s dist -l "${FRONTEND_PORT}" > "${LOGS_DIR}/frontend_$(date +%Y%m%d_%H%M%S).log" 2>&1 &
        echo $! > "${DEV_DIR}/frontend.pid"
    fi
    
    cd "${PROJECT_ROOT}"
    
    # Wait for frontend to be ready
    wait_for_frontend_ready
    
    log_success "Frontend development server started on http://localhost:${FRONTEND_PORT}"
}

wait_for_frontend_ready() {
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
            return 0
        fi
        
        sleep 2
        ((attempt++))
    done
    
    log_warning "Frontend development server not ready after ${max_attempts} attempts"
}

# =============================================================================
# WORKER DEVELOPMENT
# =============================================================================

start_worker_dev() {
    log_header "Starting Worker Development Server"
    
    cd "${PROJECT_ROOT}"
    
    # Check if wrangler is available
    if ! command -v wrangler >/dev/null 2>&1; then
        log_dev "Installing Wrangler CLI..."
        npm install -g wrangler
    fi
    
    # Start worker development server
    log_dev "Starting worker development server on port ${WORKER_PORT}..."
    
    wrangler dev \
        --config "wrangler.dev.toml" \
        --port "${WORKER_PORT}" \
        --host "localhost" \
        --local > "${LOGS_DIR}/worker_$(date +%Y%m%d_%H%M%S).log" 2>&1 &
    
    echo $! > "${DEV_DIR}/worker.pid"
    
    # Wait for worker to be ready
    wait_for_worker_ready
    
    log_success "Worker development server started on http://localhost:${WORKER_PORT}"
}

wait_for_worker_ready() {
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "http://localhost:${WORKER_PORT}/api/health" >/dev/null 2>&1; then
            return 0
        fi
        
        sleep 2
        ((attempt++))
    done
    
    log_warning "Worker development server not ready after ${max_attempts} attempts"
}

# =============================================================================
# PROXY SERVER
# =============================================================================

start_proxy_server() {
    log_header "Starting Development Proxy Server"
    
    log_dev "Starting proxy server on port ${BACKEND_PORT}..."
    
    # Start the working server proxy
    cd "${PROJECT_ROOT}"
    
    PORT="${BACKEND_PORT}" deno run --allow-all working-server.ts > "${LOGS_DIR}/proxy_$(date +%Y%m%d_%H%M%S).log" 2>&1 &
    echo $! > "${DEV_DIR}/proxy.pid"
    
    # Wait for proxy to be ready
    sleep 3
    
    if curl -sf "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
        log_success "Proxy server started on http://localhost:${BACKEND_PORT}"
    else
        log_warning "Proxy server may not be ready yet"
    fi
}

# =============================================================================
# DEBUGGING TOOLS
# =============================================================================

debug_services() {
    log_header "Debugging Services"
    
    echo -e "\n${CYAN}=== Service Status ===${NC}"
    show_service_status
    
    echo -e "\n${CYAN}=== Process Status ===${NC}"
    show_process_status
    
    echo -e "\n${CYAN}=== Network Status ===${NC}"
    show_network_status
    
    echo -e "\n${CYAN}=== Container Logs ===${NC}"
    show_recent_logs
}

show_service_status() {
    local services=(
        "Frontend:${FRONTEND_PORT}"
        "Proxy:${BACKEND_PORT}"
        "Worker:${WORKER_PORT}"
        "PostgreSQL:${POSTGRES_PORT}"
        "Redis:${REDIS_PORT}"
        "MinIO:${MINIO_PORT}"
        "Adminer:${ADMINER_PORT}"
    )
    
    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"
        
        if nc -z localhost "${port}" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} ${name} (port ${port})"
        else
            echo -e "${RED}✗${NC} ${name} (port ${port})"
        fi
    done
}

show_process_status() {
    local pids=("frontend" "worker" "proxy")
    
    for pid_name in "${pids[@]}"; do
        local pid_file="${DEV_DIR}/${pid_name}.pid"
        
        if [[ -f "$pid_file" ]]; then
            local pid="$(cat "$pid_file")"
            if ps -p "$pid" >/dev/null 2>&1; then
                echo -e "${GREEN}✓${NC} ${pid_name} (PID: ${pid})"
            else
                echo -e "${RED}✗${NC} ${pid_name} (PID: ${pid}) - Process not running"
                rm -f "$pid_file"
            fi
        else
            echo -e "${YELLOW}?${NC} ${pid_name} - No PID file found"
        fi
    done
}

show_network_status() {
    echo "Active connections on development ports:"
    netstat -tlnp 2>/dev/null | grep -E ":${FRONTEND_PORT}|:${BACKEND_PORT}|:${WORKER_PORT}|:${POSTGRES_PORT}|:${REDIS_PORT}|:${MINIO_PORT}|:${ADMINER_PORT}" || echo "No active connections found"
}

show_recent_logs() {
    if [[ -d "${LOGS_DIR}" ]]; then
        echo "Recent log files:"
        ls -lt "${LOGS_DIR}" | head -5
        
        echo -e "\nLatest log entries:"
        find "${LOGS_DIR}" -name "*.log" -type f -exec tail -3 {} + 2>/dev/null | head -20
    else
        echo "No log directory found"
    fi
}

# =============================================================================
# DEVELOPMENT DASHBOARD
# =============================================================================

show_dev_dashboard() {
    log_header "Development Dashboard"
    
    cat << EOF

${CYAN}🚀 Pitchey Development Environment${NC}

${BLUE}Frontend:${NC}     http://localhost:${FRONTEND_PORT}
${BLUE}API Proxy:${NC}    http://localhost:${BACKEND_PORT}/api
${BLUE}Worker Dev:${NC}   http://localhost:${WORKER_PORT}

${PURPLE}Database Services:${NC}
${BLUE}PostgreSQL:${NC}   localhost:${POSTGRES_PORT} (pitchey_dev/localdev123)
${BLUE}Redis:${NC}        localhost:${REDIS_PORT}
${BLUE}MinIO:${NC}        http://localhost:${MINIO_PORT} (minioadmin/minioadmin)
${BLUE}Adminer:${NC}      http://localhost:${ADMINER_PORT}

${PURPLE}Development Tools:${NC}
${BLUE}Logs:${NC}         ${LOGS_DIR}
${BLUE}Config:${NC}       ${DEV_DIR}

${YELLOW}Quick Commands:${NC}
  ${SCRIPT_DIR}/dev-tools.sh status    - Show service status
  ${SCRIPT_DIR}/dev-tools.sh logs      - Show recent logs  
  ${SCRIPT_DIR}/dev-tools.sh debug     - Debug services
  ${SCRIPT_DIR}/dev-tools.sh stop      - Stop all services
  ${SCRIPT_DIR}/dev-tools.sh restart   - Restart all services

EOF
}

# =============================================================================
# LOG MANAGEMENT
# =============================================================================

show_logs() {
    local service="${1:-all}"
    local follow="${2:-false}"
    
    log_header "Development Logs"
    
    case "$service" in
        all)
            if [[ "$follow" == "follow" || "$follow" == "-f" ]]; then
                log_dev "Following all development logs..."
                tail -f "${LOGS_DIR}"/*.log 2>/dev/null
            else
                log_dev "Showing recent logs from all services..."
                find "${LOGS_DIR}" -name "*.log" -type f -exec tail -20 {} + 2>/dev/null
            fi
            ;;
        frontend|worker|proxy)
            local log_pattern="${LOGS_DIR}/${service}_*.log"
            local latest_log="$(ls -t ${log_pattern} 2>/dev/null | head -1)"
            
            if [[ -f "$latest_log" ]]; then
                if [[ "$follow" == "follow" || "$follow" == "-f" ]]; then
                    log_dev "Following ${service} logs: $latest_log"
                    tail -f "$latest_log"
                else
                    log_dev "Showing recent ${service} logs: $latest_log"
                    tail -50 "$latest_log"
                fi
            else
                log_warning "No logs found for ${service}"
            fi
            ;;
        containers)
            if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
                if command -v podman-compose >/dev/null 2>&1; then
                    podman-compose -f "${COMPOSE_FILE}" logs ${follow:+-f}
                else
                    ${CONTAINER_RUNTIME} ps --filter "name=pitchey" --format "{{.Names}}" | \
                        xargs -I {} ${CONTAINER_RUNTIME} logs ${follow:+-f} {}
                fi
            else
                docker-compose -f "${COMPOSE_FILE}" logs ${follow:+-f}
            fi
            ;;
        *)
            log_error "Unknown service: $service"
            log_dev "Available services: all, frontend, worker, proxy, containers"
            ;;
    esac
}

# =============================================================================
# ENVIRONMENT CONTROL
# =============================================================================

stop_dev_environment() {
    log_header "Stopping Development Environment"
    
    # Stop development processes
    stop_dev_processes
    
    # Stop backend services
    stop_backend_services
    
    # Clean up
    cleanup_dev_environment
    
    log_success "Development environment stopped"
}

stop_dev_processes() {
    log_dev "Stopping development processes..."
    
    local pids=("frontend" "worker" "proxy")
    
    for pid_name in "${pids[@]}"; do
        local pid_file="${DEV_DIR}/${pid_name}.pid"
        
        if [[ -f "$pid_file" ]]; then
            local pid="$(cat "$pid_file")"
            if ps -p "$pid" >/dev/null 2>&1; then
                log_dev "Stopping ${pid_name} (PID: ${pid})"
                kill "$pid" 2>/dev/null || true
                sleep 2
                
                # Force kill if still running
                if ps -p "$pid" >/dev/null 2>&1; then
                    log_warning "Force killing ${pid_name}"
                    kill -9 "$pid" 2>/dev/null || true
                fi
            fi
            rm -f "$pid_file"
        fi
    done
    
    log_success "Development processes stopped"
}

stop_backend_services() {
    log_dev "Stopping backend services..."
    
    if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
        if command -v podman-compose >/dev/null 2>&1; then
            podman-compose -f "${COMPOSE_FILE}" down
        else
            ${CONTAINER_RUNTIME} ps --filter "name=pitchey" --format "{{.Names}}" | \
                xargs -r ${CONTAINER_RUNTIME} stop
        fi
    else
        docker-compose -f "${COMPOSE_FILE}" down
    fi
    
    log_success "Backend services stopped"
}

restart_dev_environment() {
    log_header "Restarting Development Environment"
    
    stop_dev_environment
    sleep 3
    start_dev_environment
}

cleanup_dev_environment() {
    log_dev "Cleaning up development environment..."
    
    # Remove old log files (keep last 3 days)
    if [[ -d "${LOGS_DIR}" ]]; then
        find "${LOGS_DIR}" -name "*.log" -type f -mtime +3 -delete 2>/dev/null || true
    fi
    
    # Clean up PID files
    rm -f "${DEV_DIR}"/*.pid
    
    log_success "Cleanup completed"
}

# =============================================================================
# TESTING HELPERS
# =============================================================================

run_dev_tests() {
    log_header "Running Development Tests"
    
    # Frontend tests
    if [[ -d "${PROJECT_ROOT}/frontend" ]]; then
        log_dev "Running frontend tests..."
        cd "${PROJECT_ROOT}/frontend"
        npm test -- --run 2>/dev/null || log_warning "Frontend tests failed or not configured"
        cd "${PROJECT_ROOT}"
    fi
    
    # Worker tests
    if command -v deno >/dev/null 2>&1; then
        log_dev "Running worker tests..."
        deno test src/ --allow-all 2>/dev/null || log_warning "Worker tests failed or not configured"
    fi
    
    # Integration tests
    log_dev "Running integration tests..."
    test_api_endpoints
    
    log_success "Development tests completed"
}

test_api_endpoints() {
    local endpoints=(
        "http://localhost:${BACKEND_PORT}/api/health"
        "http://localhost:${WORKER_PORT}/api/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -sf "$endpoint" >/dev/null 2>&1; then
            log_success "API endpoint accessible: $endpoint"
        else
            log_warning "API endpoint not accessible: $endpoint"
        fi
    done
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_usage() {
    cat << EOF
Development Tools and Debugging Utilities

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    start               Start complete development environment
    stop                Stop all development services
    restart             Restart development environment
    status              Show service status
    logs [SERVICE]      Show logs (all|frontend|worker|proxy|containers)
    debug               Debug services and show diagnostics
    test                Run development tests
    clean               Clean up logs and temporary files
    dashboard           Show development dashboard
    proxy               Start proxy server only
    services            Start backend services only
    help                Show this help

LOG COMMANDS:
    logs all            Show all recent logs
    logs frontend       Show frontend logs
    logs worker         Show worker logs  
    logs proxy          Show proxy logs
    logs containers     Show container logs
    logs SERVICE -f     Follow logs in real-time

EXAMPLES:
    $0 start                    Start full development environment
    $0 logs worker -f           Follow worker logs
    $0 debug                    Show debugging information
    $0 restart                  Restart all services
    $0 clean                    Clean up development artifacts

ENVIRONMENT VARIABLES:
    DEV_ENVIRONMENT     Development environment (default: development)
    HOT_RELOAD         Enable hot reload (default: true)
    DEBUG_MODE         Enable debug mode (default: true)
    LOG_LEVEL          Log level (default: debug)
    FRONTEND_PORT      Frontend port (default: 5173)
    BACKEND_PORT       Backend proxy port (default: 8001)
    WORKER_PORT        Worker port (default: 8787)

CONFIGURATION FILES:
    .env.development           Global development environment
    frontend/.env.development  Frontend-specific environment
    wrangler.dev.toml         Worker development configuration

EOF
}

main() {
    local command="${1:-help}"
    shift 2>/dev/null || true
    
    # Create required directories
    mkdir -p "${DEV_DIR}" "${LOGS_DIR}"
    
    case "$command" in
        start)
            start_dev_environment
            ;;
        stop)
            detect_dev_environment
            stop_dev_environment
            ;;
        restart)
            detect_dev_environment
            restart_dev_environment
            ;;
        status)
            detect_dev_environment
            debug_services
            ;;
        logs)
            show_logs "$@"
            ;;
        debug)
            detect_dev_environment
            debug_services
            ;;
        test)
            detect_dev_environment
            run_dev_tests
            ;;
        clean)
            cleanup_dev_environment
            ;;
        dashboard)
            show_dev_dashboard
            ;;
        proxy)
            detect_dev_environment
            start_proxy_server
            ;;
        services)
            detect_dev_environment
            start_backend_services
            ;;
        help|*)
            show_usage
            ;;
    esac
}

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi