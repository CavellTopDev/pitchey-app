#!/bin/bash

# Wrangler Integration Scripts for Podman
# Seamless Cloudflare Workers development with Podman containers

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
readonly WRANGLER_DIR="${PROJECT_ROOT}/.wrangler"
readonly CONTAINER_NAME="pitchey-wrangler"

# Wrangler configuration
WRANGLER_VERSION="${WRANGLER_VERSION:-latest}"
WRANGLER_ENV="${WRANGLER_ENV:-development}"
WRANGLER_PORT="${WRANGLER_PORT:-8787}"
WRANGLER_HOST="${WRANGLER_HOST:-0.0.0.0}"

# Container settings
CONTAINER_REGISTRY="${CONTAINER_REGISTRY:-ghcr.io/supremeisbeing/pitchey}"
CONTAINER_IMAGE="${CONTAINER_REGISTRY}/wrangler:${WRANGLER_VERSION}"

# =============================================================================
# COLORS AND LOGGING
# =============================================================================

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

log_wrangler() {
    echo -e "${CYAN}[WRANGLER]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# =============================================================================
# ENVIRONMENT DETECTION
# =============================================================================

detect_wrangler_environment() {
    log_header "Detecting Wrangler Environment"
    
    # Load container runtime detection
    if [[ -f "${SCRIPT_DIR}/environment-setup.sh" ]]; then
        # shellcheck source=scripts/environment-setup.sh
        source "${SCRIPT_DIR}/environment-setup.sh"
        detect_container_runtime
    else
        log_error "Environment setup script not found"
        exit 1
    fi
    
    # Check for existing Wrangler installation
    if command -v wrangler >/dev/null 2>&1; then
        export WRANGLER_LOCAL="true"
        export WRANGLER_VERSION_LOCAL="$(wrangler --version | cut -d' ' -f2)"
        log_success "Local Wrangler found: ${WRANGLER_VERSION_LOCAL}"
    else
        export WRANGLER_LOCAL="false"
        log_wrangler "No local Wrangler installation found"
    fi
    
    # Check Podman socket for rootless mode
    if [[ "${CONTAINER_RUNTIME}" == "podman" && "${ROOTLESS_MODE}" == "true" ]]; then
        export PODMAN_SOCKET="${XDG_RUNTIME_DIR}/podman/podman.sock"
        
        if [[ ! -S "$PODMAN_SOCKET" ]]; then
            log_wrangler "Starting Podman socket for rootless mode..."
            systemctl --user start podman.socket || {
                podman system service --time=0 "unix://${PODMAN_SOCKET}" &
                sleep 3
            }
        fi
        
        log_success "Podman socket ready: ${PODMAN_SOCKET}"
    fi
    
    # Setup Wrangler environment variables
    setup_wrangler_env
}

setup_wrangler_env() {
    log_wrangler "Setting up Wrangler environment variables..."
    
    # Cloudflare configuration
    export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-02967e39e44b6266e7873829e94849f5}"
    
    # Wrangler configuration  
    export WRANGLER_SEND_METRICS="${WRANGLER_SEND_METRICS:-false}"
    export WRANGLER_LOG_LEVEL="${WRANGLER_LOG_LEVEL:-log}"
    export NO_WRANGLER_WARNING="${NO_WRANGLER_WARNING:-true}"
    
    # Container-specific configuration
    if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
        export DOCKER_HOST="unix://${PODMAN_SOCKET}"
    fi
    
    log_success "Wrangler environment configured"
}

# =============================================================================
# WRANGLER CONTAINER BUILD
# =============================================================================

build_wrangler_container() {
    log_header "Building Wrangler Container"
    
    local dockerfile="${PROJECT_ROOT}/Dockerfile.wrangler"
    
    # Generate Wrangler Dockerfile if it doesn't exist
    if [[ ! -f "$dockerfile" ]]; then
        generate_wrangler_dockerfile "$dockerfile"
    fi
    
    log_wrangler "Building Wrangler container: ${CONTAINER_IMAGE}"
    
    ${CONTAINER_RUNTIME} build \
        --build-arg "WRANGLER_VERSION=${WRANGLER_VERSION}" \
        --build-arg "NODE_ENV=${WRANGLER_ENV}" \
        --tag "${CONTAINER_IMAGE}" \
        --tag "${CONTAINER_REGISTRY}/wrangler:latest" \
        --file "${dockerfile}" \
        "${PROJECT_ROOT}" || {
        log_error "Failed to build Wrangler container"
        return 1
    }
    
    log_success "Wrangler container built: ${CONTAINER_IMAGE}"
}

generate_wrangler_dockerfile() {
    local dockerfile="$1"
    
    log_wrangler "Generating Wrangler Dockerfile..."
    
    cat > "$dockerfile" << 'EOF'
# =============================================================================
# Wrangler Development Container for Cloudflare Workers
# Optimized for Podman with full Cloudflare CLI support
# =============================================================================

FROM node:20-alpine AS base

# Install system dependencies
RUN apk update && apk upgrade && apk add --no-cache \
    bash \
    curl \
    git \
    openssh-client \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Install Wrangler CLI globally
ARG WRANGLER_VERSION=latest
RUN if [ "$WRANGLER_VERSION" = "latest" ]; then \
        npm install -g wrangler; \
    else \
        npm install -g wrangler@${WRANGLER_VERSION}; \
    fi

# Verify Wrangler installation
RUN wrangler --version

WORKDIR /app

# Copy package files for caching
COPY package*.json ./

# Install project dependencies
RUN npm ci --only=production

# Copy project files
COPY . .

# Create required directories
RUN mkdir -p .wrangler logs

# Set up proper permissions for rootless Podman
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Environment variables
ENV NODE_ENV=development
ENV WRANGLER_SEND_METRICS=false
ENV NO_WRANGLER_WARNING=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8787/api/health || exit 1

# Expose Wrangler dev server port
EXPOSE 8787 8788

# Default command
CMD ["wrangler", "dev", "--port", "8787", "--host", "0.0.0.0"]
EOF
    
    log_success "Wrangler Dockerfile generated: $dockerfile"
}

# =============================================================================
# CONTAINER MANAGEMENT
# =============================================================================

start_wrangler_container() {
    local environment="${1:-development}"
    
    log_header "Starting Wrangler Container (${environment})"
    
    # Stop existing container
    stop_wrangler_container 2>/dev/null || true
    
    # Prepare environment-specific configuration
    local wrangler_config="${PROJECT_ROOT}/wrangler.toml"
    setup_wrangler_config "$environment"
    
    log_wrangler "Starting Wrangler container for ${environment} environment..."
    
    # Container run arguments
    local run_args=(
        "--name" "${CONTAINER_NAME}"
        "--rm"
        "-d"
        "-p" "${WRANGLER_PORT}:8787"
        "-p" "8788:8788"  # Additional debug port
        "--workdir" "/app"
    )
    
    # Volume mounts
    local volume_args=(
        "-v" "${PROJECT_ROOT}:/app:Z"  # :Z for SELinux compatibility
        "-v" "${WRANGLER_DIR}:/app/.wrangler:Z"
        "-v" "${HOME}/.cloudflare:/home/node/.cloudflare:Z"  # Wrangler auth
    )
    
    # Environment variables
    local env_args=(
        "-e" "NODE_ENV=${WRANGLER_ENV}"
        "-e" "CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}"
        "-e" "WRANGLER_SEND_METRICS=false"
        "-e" "NO_WRANGLER_WARNING=true"
    )
    
    # Add Cloudflare API token if available
    if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        env_args+=("-e" "CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}")
    fi
    
    # Additional container runtime specific arguments
    if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
        run_args+=("--userns=keep-id")  # Preserve user ID in rootless mode
    fi
    
    # Start container
    ${CONTAINER_RUNTIME} run \
        "${run_args[@]}" \
        "${volume_args[@]}" \
        "${env_args[@]}" \
        "${CONTAINER_IMAGE}" \
        wrangler dev \
        --env "${environment}" \
        --port 8787 \
        --host 0.0.0.0 \
        --local || {
        log_error "Failed to start Wrangler container"
        return 1
    }
    
    # Wait for container to be ready
    wait_for_wrangler_ready
    
    log_success "Wrangler container started on port ${WRANGLER_PORT}"
    show_wrangler_info
}

setup_wrangler_config() {
    local environment="$1"
    local config_source=""
    local config_target="${PROJECT_ROOT}/wrangler.toml"
    
    case "$environment" in
        development|dev)
            config_source="${PROJECT_ROOT}/wrangler.local.toml"
            if [[ ! -f "$config_source" ]]; then
                config_source="${PROJECT_ROOT}/wrangler.toml.backup"
            fi
            ;;
        staging)
            config_source="${PROJECT_ROOT}/wrangler-staging.toml"
            ;;
        production|prod)
            config_source="${PROJECT_ROOT}/wrangler-production.toml"
            ;;
        *)
            config_source="${PROJECT_ROOT}/wrangler.toml.backup"
            ;;
    esac
    
    if [[ -f "$config_source" ]]; then
        cp "$config_source" "$config_target"
        log_wrangler "Using Wrangler config: $config_source"
    else
        log_warning "Wrangler config not found: $config_source"
        create_default_wrangler_config "$config_target" "$environment"
    fi
}

create_default_wrangler_config() {
    local config_file="$1"
    local environment="$2"
    
    log_wrangler "Creating default Wrangler configuration for ${environment}..."
    
    cat > "$config_file" << EOF
name = "pitchey-api-${environment}"
main = "src/worker-integrated.ts"
compatibility_date = "2024-01-01"
account_id = "${CLOUDFLARE_ACCOUNT_ID}"

# Environment-specific configuration
[env.${environment}]
vars = { ENVIRONMENT = "${environment}" }

# Development settings
[dev]
port = 8787
local_protocol = "http"
upstream_protocol = "https"

# Build configuration  
[build]
command = "npm run build"

[build.upload]
format = "service-worker"
EOF
    
    log_success "Default Wrangler config created: $config_file"
}

wait_for_wrangler_ready() {
    local timeout=60
    local interval=2
    local elapsed=0
    
    log_wrangler "Waiting for Wrangler to be ready..."
    
    while [[ $elapsed -lt $timeout ]]; do
        if curl -sf "http://localhost:${WRANGLER_PORT}/api/health" >/dev/null 2>&1; then
            log_success "Wrangler is ready!"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        
        if [[ $((elapsed % 10)) -eq 0 ]]; then
            log_wrangler "Still waiting... (${elapsed}s elapsed)"
        fi
    done
    
    log_error "Wrangler failed to become ready within ${timeout}s"
    return 1
}

stop_wrangler_container() {
    log_wrangler "Stopping Wrangler container..."
    
    if ${CONTAINER_RUNTIME} ps --filter "name=${CONTAINER_NAME}" | grep -q "${CONTAINER_NAME}"; then
        ${CONTAINER_RUNTIME} stop "${CONTAINER_NAME}" || true
        log_success "Wrangler container stopped"
    else
        log_wrangler "No running Wrangler container found"
    fi
}

restart_wrangler_container() {
    local environment="${1:-development}"
    
    log_header "Restarting Wrangler Container"
    
    stop_wrangler_container
    sleep 2
    start_wrangler_container "$environment"
}

# =============================================================================
# WRANGLER OPERATIONS
# =============================================================================

wrangler_exec() {
    local cmd="$*"
    
    log_wrangler "Executing: wrangler ${cmd}"
    
    if [[ "${WRANGLER_LOCAL}" == "true" ]]; then
        # Use local Wrangler
        wrangler ${cmd}
    else
        # Use containerized Wrangler
        if ! ${CONTAINER_RUNTIME} ps --filter "name=${CONTAINER_NAME}" | grep -q "${CONTAINER_NAME}"; then
            start_wrangler_container
        fi
        
        ${CONTAINER_RUNTIME} exec -it "${CONTAINER_NAME}" wrangler ${cmd}
    fi
}

wrangler_deploy() {
    local environment="${1:-production}"
    
    log_header "Deploying to Cloudflare Workers (${environment})"
    
    # Validate authentication
    validate_cloudflare_auth
    
    # Deploy using containerized Wrangler for consistency
    log_wrangler "Deploying Worker to ${environment}..."
    
    ${CONTAINER_RUNTIME} run --rm \
        -v "${PROJECT_ROOT}:/app:Z" \
        -v "${HOME}/.cloudflare:/home/node/.cloudflare:Z" \
        -e "CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN:-}" \
        -e "CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}" \
        --workdir "/app" \
        "${CONTAINER_IMAGE}" \
        wrangler deploy --env "${environment}" || {
        log_error "Deployment failed"
        return 1
    }
    
    log_success "Worker deployed to ${environment}"
    
    # Verify deployment
    verify_deployment "$environment"
}

wrangler_publish_pages() {
    local project_name="${1:-pitchey}"
    local environment="${2:-production}"
    
    log_header "Deploying Pages (${project_name})"
    
    # Build frontend first
    log_wrangler "Building frontend for Pages deployment..."
    
    cd "${PROJECT_ROOT}/frontend"
    
    if [[ ! -d "dist" ]]; then
        npm run build || {
            log_error "Frontend build failed"
            return 1
        }
    fi
    
    # Deploy Pages using containerized Wrangler
    log_wrangler "Deploying Pages to ${environment}..."
    
    ${CONTAINER_RUNTIME} run --rm \
        -v "${PROJECT_ROOT}/frontend:/app:Z" \
        -v "${HOME}/.cloudflare:/home/node/.cloudflare:Z" \
        -e "CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN:-}" \
        -e "CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}" \
        --workdir "/app" \
        "${CONTAINER_IMAGE}" \
        wrangler pages deploy dist \
        --project-name "${project_name}" \
        --env "${environment}" || {
        log_error "Pages deployment failed"
        return 1
    }
    
    cd "${PROJECT_ROOT}"
    
    log_success "Pages deployed: ${project_name}"
}

# =============================================================================
# VALIDATION AND TESTING
# =============================================================================

validate_cloudflare_auth() {
    log_wrangler "Validating Cloudflare authentication..."
    
    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        log_error "CLOUDFLARE_API_TOKEN not set"
        log_wrangler "Please set your Cloudflare API token:"
        log_wrangler "export CLOUDFLARE_API_TOKEN=your_token_here"
        return 1
    fi
    
    # Test authentication using containerized Wrangler
    if ${CONTAINER_RUNTIME} run --rm \
        -e "CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}" \
        -e "CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}" \
        "${CONTAINER_IMAGE}" \
        wrangler whoami >/dev/null 2>&1; then
        log_success "Cloudflare authentication verified"
    else
        log_error "Cloudflare authentication failed"
        return 1
    fi
}

verify_deployment() {
    local environment="$1"
    local worker_url=""
    
    case "$environment" in
        development|dev)
            worker_url="http://localhost:${WRANGLER_PORT}"
            ;;
        staging)
            worker_url="https://pitchey-api-staging.ndlovucavelle.workers.dev"
            ;;
        production|prod)
            worker_url="https://pitchey-api-prod.ndlovucavelle.workers.dev"
            ;;
        *)
            log_warning "Unknown environment for verification: $environment"
            return 0
            ;;
    esac
    
    log_wrangler "Verifying deployment: ${worker_url}"
    
    local health_url="${worker_url}/api/health"
    local max_attempts=10
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$health_url" >/dev/null 2>&1; then
            log_success "Deployment verification passed"
            return 0
        fi
        
        log_wrangler "Attempt ${attempt}/${max_attempts} failed, retrying..."
        sleep 5
        ((attempt++))
    done
    
    log_error "Deployment verification failed after ${max_attempts} attempts"
    return 1
}

# =============================================================================
# MONITORING AND LOGS
# =============================================================================

show_wrangler_logs() {
    local follow="${1:-false}"
    
    if [[ "$follow" == "follow" ]] || [[ "$follow" == "-f" ]]; then
        log_wrangler "Following Wrangler container logs..."
        ${CONTAINER_RUNTIME} logs -f "${CONTAINER_NAME}"
    else
        log_wrangler "Showing Wrangler container logs..."
        ${CONTAINER_RUNTIME} logs "${CONTAINER_NAME}"
    fi
}

show_wrangler_info() {
    log_header "Wrangler Container Information"
    
    echo -e "${CYAN}Container Runtime:${NC} ${CONTAINER_RUNTIME}"
    echo -e "${CYAN}Container Name:${NC} ${CONTAINER_NAME}"
    echo -e "${CYAN}Container Image:${NC} ${CONTAINER_IMAGE}"
    echo -e "${CYAN}Wrangler Port:${NC} ${WRANGLER_PORT}"
    echo -e "${CYAN}Environment:${NC} ${WRANGLER_ENV}"
    echo -e "${CYAN}Local URL:${NC} http://localhost:${WRANGLER_PORT}"
    
    if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        echo -e "${CYAN}Cloudflare Auth:${NC} ✓ Configured"
    else
        echo -e "${CYAN}Cloudflare Auth:${NC} ⚠ Not configured"
    fi
    
    # Show container status
    if ${CONTAINER_RUNTIME} ps --filter "name=${CONTAINER_NAME}" | grep -q "${CONTAINER_NAME}"; then
        echo -e "${CYAN}Container Status:${NC} ${GREEN}Running${NC}"
        
        # Show resource usage
        local stats
        stats="$(${CONTAINER_RUNTIME} stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" "${CONTAINER_NAME}" 2>/dev/null | tail -n1)"
        if [[ -n "$stats" ]]; then
            echo -e "${CYAN}Resource Usage:${NC} ${stats}"
        fi
    else
        echo -e "${CYAN}Container Status:${NC} ${RED}Not running${NC}"
    fi
    
    echo
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_usage() {
    cat << EOF
Wrangler Integration Scripts for Podman

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    build                   Build Wrangler container
    start [ENV]             Start Wrangler development server
    stop                    Stop Wrangler container  
    restart [ENV]           Restart Wrangler container
    deploy [ENV]            Deploy Worker to Cloudflare
    pages [PROJECT] [ENV]   Deploy Pages to Cloudflare
    exec CMD                Execute Wrangler command
    logs [-f]               Show container logs
    info                    Show container information
    auth                    Validate Cloudflare authentication
    help                    Show this help

ENVIRONMENTS:
    development (default)   Local development
    staging                Staging environment
    production             Production environment

EXAMPLES:
    $0 start development           Start dev server
    $0 deploy production          Deploy to production
    $0 pages pitchey staging      Deploy Pages to staging
    $0 exec "secrets list"        List Worker secrets
    $0 logs -f                    Follow container logs

ENVIRONMENT VARIABLES:
    CLOUDFLARE_API_TOKEN          Cloudflare API token (required)
    CLOUDFLARE_ACCOUNT_ID         Cloudflare account ID
    WRANGLER_PORT                 Development server port (default: 8787)
    WRANGLER_ENV                  Environment (development|staging|production)
    CONTAINER_REGISTRY            Container registry for Wrangler image

AUTHENTICATION:
    Set your Cloudflare API token:
    export CLOUDFLARE_API_TOKEN=your_token_here

    Or authenticate interactively:
    $0 exec "auth login"

EOF
}

main() {
    local command="${1:-help}"
    shift 2>/dev/null || true
    
    # Initialize
    mkdir -p "${WRANGLER_DIR}"
    
    case "$command" in
        build)
            detect_wrangler_environment
            build_wrangler_container
            ;;
        start)
            local env="${1:-development}"
            detect_wrangler_environment
            start_wrangler_container "$env"
            ;;
        stop)
            stop_wrangler_container
            ;;
        restart)
            local env="${1:-development}"
            detect_wrangler_environment
            restart_wrangler_container "$env"
            ;;
        deploy)
            local env="${1:-production}"
            detect_wrangler_environment
            wrangler_deploy "$env"
            ;;
        pages)
            local project="${1:-pitchey}"
            local env="${2:-production}"
            detect_wrangler_environment
            wrangler_publish_pages "$project" "$env"
            ;;
        exec)
            detect_wrangler_environment
            wrangler_exec "$@"
            ;;
        logs)
            show_wrangler_logs "$@"
            ;;
        info)
            detect_wrangler_environment
            show_wrangler_info
            ;;
        auth)
            detect_wrangler_environment
            validate_cloudflare_auth
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