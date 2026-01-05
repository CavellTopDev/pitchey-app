#!/bin/bash

# Pitchey Podman Deployment Script
# Comprehensive deployment automation with full Podman compatibility
# Supports container runtime detection, multi-platform builds, and production deployment

set -euo pipefail

# =============================================================================
# CONFIGURATION AND CONSTANTS
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}"
BUILD_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BUILD_LOG_DIR="${PROJECT_ROOT}/logs/build"
CONTAINER_REGISTRY="${CONTAINER_REGISTRY:-ghcr.io/supremeisbeing/pitchey}"
CONTAINER_TAG="${CONTAINER_TAG:-latest}"

# Platform support
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
PARALLEL_BUILDS="${PARALLEL_BUILDS:-true}"
BUILD_CACHE="${BUILD_CACHE:-true}"

# Environment detection
ENVIRONMENT="${ENVIRONMENT:-production}"
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-02967e39e44b6266e7873829e94849f5}"

# =============================================================================
# COLOR OUTPUT AND LOGGING
# =============================================================================

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1" | tee -a "${BUILD_LOG_DIR}/deploy_${BUILD_TIMESTAMP}.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${BUILD_LOG_DIR}/deploy_${BUILD_TIMESTAMP}.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${BUILD_LOG_DIR}/deploy_${BUILD_TIMESTAMP}.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${BUILD_LOG_DIR}/deploy_${BUILD_TIMESTAMP}.log"
}

log_header() {
    echo -e "\n${PURPLE}=== $1 ===${NC}" | tee -a "${BUILD_LOG_DIR}/deploy_${BUILD_TIMESTAMP}.log"
}

# =============================================================================
# CONTAINER RUNTIME DETECTION
# =============================================================================

detect_container_runtime() {
    local runtime=""
    local socket_path=""
    local rootless_mode=false

    log_header "Detecting Container Runtime"

    # Check for Podman first (preferred)
    if command -v podman >/dev/null 2>&1; then
        runtime="podman"
        
        # Check if running rootless
        if podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null | grep -q true; then
            rootless_mode=true
            socket_path="unix://${XDG_RUNTIME_DIR}/podman/podman.sock"
            log_info "Podman detected (rootless mode)"
        else
            socket_path="unix:///run/podman/podman.sock"
            log_info "Podman detected (rootful mode)"
        fi

        # Verify Podman socket
        if [[ -S "${socket_path#unix://}" ]]; then
            log_success "Podman socket verified: ${socket_path}"
        else
            log_warning "Podman socket not found, starting Podman service"
            start_podman_service
        fi

    # Fallback to Docker
    elif command -v docker >/dev/null 2>&1; then
        runtime="docker"
        socket_path="unix:///var/run/docker.sock"
        log_info "Docker detected as fallback runtime"

        # Verify Docker socket
        if [[ -S "/var/run/docker.sock" ]]; then
            log_success "Docker socket verified"
        else
            log_error "Docker socket not available"
            exit 1
        fi

    else
        log_error "No container runtime found. Please install Podman or Docker."
        exit 1
    fi

    # Export runtime configuration
    export CONTAINER_RUNTIME="${runtime}"
    export CONTAINER_SOCKET="${socket_path}"
    export ROOTLESS_MODE="${rootless_mode}"
    
    log_success "Container runtime: ${runtime} (socket: ${socket_path})"
}

start_podman_service() {
    log_info "Starting Podman service..."
    
    if [[ "${ROOTLESS_MODE}" == "true" ]]; then
        # Start rootless Podman socket
        systemctl --user start podman.socket || {
            log_warning "systemd user service not available, starting manually"
            podman system service --time=0 "${CONTAINER_SOCKET}" &
            sleep 2
        }
    else
        # Start system Podman socket
        sudo systemctl start podman.socket || {
            log_warning "systemd service not available, starting manually"
            sudo podman system service --time=0 "${CONTAINER_SOCKET}" &
            sleep 2
        }
    fi

    # Verify service is running
    if podman info >/dev/null 2>&1; then
        log_success "Podman service started successfully"
    else
        log_error "Failed to start Podman service"
        exit 1
    fi
}

# =============================================================================
# ENVIRONMENT VALIDATION
# =============================================================================

validate_environment() {
    log_header "Environment Validation"

    # Create log directory
    mkdir -p "${BUILD_LOG_DIR}"

    # Check required tools
    local missing_tools=()
    
    for tool in jq curl git; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing_tools+=("$tool")
        fi
    done

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi

    # Validate Cloudflare credentials
    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        log_warning "CLOUDFLARE_API_TOKEN not set, some features may not work"
    fi

    # Check container runtime
    detect_container_runtime

    # Validate project structure
    local required_files=(
        "frontend/package.json"
        "src/worker-integrated.ts"
        "wrangler.toml.backup"
        "podman-compose.yml"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "${PROJECT_ROOT}/${file}" ]]; then
            log_error "Required file missing: ${file}"
            exit 1
        fi
    done

    log_success "Environment validation completed"
}

# =============================================================================
# BUILD CONFIGURATION
# =============================================================================

setup_build_config() {
    log_header "Setting up Build Configuration"

    # Create build context
    export BUILD_CONTEXT="${PROJECT_ROOT}/build-context"
    mkdir -p "${BUILD_CONTEXT}"

    # Configure container build arguments
    export BUILD_ARGS=(
        "--build-arg" "BUILDKIT_INLINE_CACHE=1"
        "--build-arg" "NODE_ENV=${ENVIRONMENT}"
        "--build-arg" "BUILD_TIMESTAMP=${BUILD_TIMESTAMP}"
        "--build-arg" "CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}"
    )

    # Platform-specific configuration
    if [[ "${PARALLEL_BUILDS}" == "true" ]]; then
        export PLATFORM_ARGS=("--platform" "${PLATFORMS}")
    else
        export PLATFORM_ARGS=()
    fi

    # Cache configuration
    if [[ "${BUILD_CACHE}" == "true" ]]; then
        export CACHE_ARGS=(
            "--cache-from" "type=local,src=${PROJECT_ROOT}/.cache/buildkit"
            "--cache-to" "type=local,dest=${PROJECT_ROOT}/.cache/buildkit,mode=max"
        )
        mkdir -p "${PROJECT_ROOT}/.cache/buildkit"
    else
        export CACHE_ARGS=()
    fi

    log_success "Build configuration completed"
}

# =============================================================================
# CONTAINER BUILDS
# =============================================================================

build_frontend_container() {
    log_header "Building Frontend Container"

    local dockerfile="${PROJECT_ROOT}/frontend/Dockerfile.prod"
    local image_tag="${CONTAINER_REGISTRY}/frontend:${CONTAINER_TAG}"

    # Create production Dockerfile if it doesn't exist
    if [[ ! -f "${dockerfile}" ]]; then
        create_frontend_dockerfile "${dockerfile}"
    fi

    log_info "Building frontend container: ${image_tag}"

    ${CONTAINER_RUNTIME} build \
        "${BUILD_ARGS[@]}" \
        "${PLATFORM_ARGS[@]}" \
        "${CACHE_ARGS[@]}" \
        -t "${image_tag}" \
        -f "${dockerfile}" \
        "${PROJECT_ROOT}/frontend" || {
        log_error "Frontend container build failed"
        return 1
    }

    log_success "Frontend container built: ${image_tag}"
}

build_backend_container() {
    log_header "Building Backend Container"

    local dockerfile="${PROJECT_ROOT}/Dockerfile.worker"
    local image_tag="${CONTAINER_REGISTRY}/worker:${CONTAINER_TAG}"

    # Create worker Dockerfile if it doesn't exist
    if [[ ! -f "${dockerfile}" ]]; then
        create_worker_dockerfile "${dockerfile}"
    fi

    log_info "Building worker container: ${image_tag}"

    ${CONTAINER_RUNTIME} build \
        "${BUILD_ARGS[@]}" \
        "${PLATFORM_ARGS[@]}" \
        "${CACHE_ARGS[@]}" \
        -t "${image_tag}" \
        -f "${dockerfile}" \
        "${PROJECT_ROOT}" || {
        log_error "Worker container build failed"
        return 1
    }

    log_success "Worker container built: ${image_tag}"
}

build_development_stack() {
    log_header "Building Development Stack"

    log_info "Starting development services with ${CONTAINER_RUNTIME}"

    # Use podman-compose or docker-compose based on runtime
    if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
        if command -v podman-compose >/dev/null 2>&1; then
            podman-compose -f "${PROJECT_ROOT}/podman-compose.yml" up -d
        else
            log_warning "podman-compose not found, using docker-compose with podman socket"
            DOCKER_HOST="${CONTAINER_SOCKET}" docker-compose -f "${PROJECT_ROOT}/podman-compose.yml" up -d
        fi
    else
        docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d
    fi

    log_success "Development stack started"
}

# =============================================================================
# DOCKERFILE GENERATION
# =============================================================================

create_frontend_dockerfile() {
    local dockerfile="$1"
    
    log_info "Creating production frontend Dockerfile: ${dockerfile}"

    cat > "${dockerfile}" << 'EOF'
# Multi-stage build for optimized production frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

    log_success "Frontend Dockerfile created"
}

create_worker_dockerfile() {
    local dockerfile="$1"
    
    log_info "Creating production worker Dockerfile: ${dockerfile}"

    cat > "${dockerfile}" << 'EOF'
# Worker container for Cloudflare development
FROM denoland/deno:alpine

WORKDIR /app

# Copy dependencies
COPY deno.json deno.lock ./

# Cache dependencies
RUN deno cache --lock=deno.lock deno.json

# Copy source code
COPY src/ ./src/
COPY wrangler.toml.backup ./wrangler.toml

# Install wrangler
RUN deno install -A --unstable --global --name wrangler \
    https://raw.githubusercontent.com/cloudflare/wrangler2/main/packages/wrangler/wrangler-dist/index.js

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD deno eval "console.log('healthy')" || exit 1

EXPOSE 8787

# Default command for development
CMD ["wrangler", "dev", "--port", "8787", "--host", "0.0.0.0"]
EOF

    log_success "Worker Dockerfile created"
}

# =============================================================================
# CLOUDFLARE INTEGRATION
# =============================================================================

deploy_to_cloudflare() {
    log_header "Deploying to Cloudflare"

    # Check for wrangler
    if ! command -v wrangler >/dev/null 2>&1; then
        log_info "Installing Wrangler CLI"
        npm install -g wrangler
    fi

    # Authenticate with Cloudflare
    if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        log_info "Authenticating with Cloudflare"
        wrangler auth -t "${CLOUDFLARE_API_TOKEN}"
    else
        log_warning "No Cloudflare API token provided, manual authentication required"
    fi

    # Deploy Worker
    log_info "Deploying Cloudflare Worker"
    cd "${PROJECT_ROOT}"
    
    # Use backup wrangler config as primary
    cp wrangler.toml.backup wrangler.toml
    
    # Deploy with environment-specific config
    wrangler deploy --env "${ENVIRONMENT}" || {
        log_error "Worker deployment failed"
        return 1
    }

    # Deploy Pages (Frontend)
    if [[ -d "${PROJECT_ROOT}/frontend/dist" ]]; then
        log_info "Deploying Cloudflare Pages"
        cd "${PROJECT_ROOT}/frontend"
        
        # Build frontend if not already built
        if [[ ! -d "dist" ]]; then
            npm run build
        fi
        
        wrangler pages deploy dist --project-name=pitchey --env="${ENVIRONMENT}" || {
            log_warning "Pages deployment failed, continuing..."
        }
    fi

    log_success "Cloudflare deployment completed"
}

# =============================================================================
# HEALTH CHECKS AND MONITORING
# =============================================================================

run_health_checks() {
    log_header "Running Health Checks"

    local health_check_timeout=60
    local check_interval=5

    # Check container health
    if ${CONTAINER_RUNTIME} ps --filter "status=running" | grep -q pitchey; then
        log_success "Containers are running"
    else
        log_warning "No running containers found"
    fi

    # Check Cloudflare Worker health
    if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        local worker_url="https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health"
        
        log_info "Checking Worker health: ${worker_url}"
        
        for ((i=0; i<health_check_timeout; i+=check_interval)); do
            if curl -sf "${worker_url}" >/dev/null 2>&1; then
                log_success "Worker health check passed"
                break
            fi
            
            if [[ $i -ge $((health_check_timeout - check_interval)) ]]; then
                log_warning "Worker health check timeout"
                break
            fi
            
            log_info "Waiting for Worker to become healthy..."
            sleep "${check_interval}"
        done
    fi

    # Check frontend health
    local frontend_url="https://pitchey-5o8-66n.pages.dev"
    log_info "Checking frontend health: ${frontend_url}"
    
    if curl -sf "${frontend_url}" >/dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_warning "Frontend health check failed"
    fi

    log_success "Health checks completed"
}

# =============================================================================
# CLEANUP AND OPTIMIZATION
# =============================================================================

cleanup_build_artifacts() {
    log_header "Cleaning up Build Artifacts"

    # Remove temporary build context
    if [[ -d "${BUILD_CONTEXT:-}" ]]; then
        rm -rf "${BUILD_CONTEXT}"
        log_info "Build context cleaned up"
    fi

    # Clean up old container images (keep last 3)
    if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
        podman image prune -f --filter "label=pitchey-build"
        log_info "Old container images pruned"
    else
        docker image prune -f --filter "label=pitchey-build"
        log_info "Old container images pruned"
    fi

    # Compress logs
    if [[ -d "${BUILD_LOG_DIR}" ]]; then
        find "${BUILD_LOG_DIR}" -name "*.log" -mtime +7 -exec gzip {} \;
        log_info "Old logs compressed"
    fi

    log_success "Cleanup completed"
}

# =============================================================================
# ROLLBACK PROCEDURES
# =============================================================================

rollback_deployment() {
    log_header "Rolling Back Deployment"

    local rollback_tag="${1:-previous}"

    log_warning "Initiating rollback to tag: ${rollback_tag}"

    # Rollback Cloudflare Worker
    if command -v wrangler >/dev/null 2>&1; then
        log_info "Rolling back Cloudflare Worker"
        # Note: Wrangler doesn't have built-in rollback, would need to deploy previous version
        log_warning "Manual worker rollback required - deploy previous worker version"
    fi

    # Rollback containers
    if ${CONTAINER_RUNTIME} images | grep -q "${CONTAINER_REGISTRY}.*${rollback_tag}"; then
        log_info "Rolling back containers to tag: ${rollback_tag}"
        
        # Update container tags
        ${CONTAINER_RUNTIME} tag "${CONTAINER_REGISTRY}/frontend:${rollback_tag}" "${CONTAINER_REGISTRY}/frontend:latest"
        ${CONTAINER_RUNTIME} tag "${CONTAINER_REGISTRY}/worker:${rollback_tag}" "${CONTAINER_REGISTRY}/worker:latest"
        
        log_success "Container rollback completed"
    else
        log_error "Rollback tag not found: ${rollback_tag}"
        return 1
    fi

    log_success "Rollback completed"
}

# =============================================================================
# MAIN DEPLOYMENT ORCHESTRATION
# =============================================================================

show_usage() {
    cat << EOF
Pitchey Podman Deployment Script

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    build           Build all containers
    deploy          Deploy to production
    dev             Start development environment
    health          Run health checks
    rollback [TAG]  Rollback to previous version
    clean           Clean up build artifacts
    help            Show this help

OPTIONS:
    --runtime=RUNTIME       Force container runtime (podman|docker)
    --env=ENVIRONMENT       Set environment (development|staging|production)
    --parallel              Enable parallel builds
    --no-cache              Disable build cache
    --platforms=PLATFORMS   Set build platforms (default: linux/amd64,linux/arm64)

EXAMPLES:
    $0 build --parallel                    Build with parallel processing
    $0 deploy --env=production             Deploy to production
    $0 dev                                 Start development stack
    $0 rollback v1.2.3                    Rollback to version 1.2.3
    $0 health                             Check deployment health

ENVIRONMENT VARIABLES:
    CLOUDFLARE_API_TOKEN     Cloudflare API token for deployment
    CONTAINER_REGISTRY       Container registry URL
    CONTAINER_TAG           Container tag (default: latest)
    PLATFORMS               Build platforms
    PARALLEL_BUILDS         Enable parallel builds (true|false)
    BUILD_CACHE             Enable build cache (true|false)

EOF
}

main() {
    local command="${1:-help}"
    shift 2>/dev/null || true

    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --runtime=*)
                CONTAINER_RUNTIME="${1#*=}"
                ;;
            --env=*)
                ENVIRONMENT="${1#*=}"
                ;;
            --parallel)
                PARALLEL_BUILDS="true"
                ;;
            --no-cache)
                BUILD_CACHE="false"
                ;;
            --platforms=*)
                PLATFORMS="${1#*=}"
                ;;
            *)
                log_warning "Unknown option: $1"
                ;;
        esac
        shift
    done

    # Execute command
    case "${command}" in
        build)
            validate_environment
            setup_build_config
            build_frontend_container
            build_backend_container
            ;;
        deploy)
            validate_environment
            setup_build_config
            build_frontend_container
            build_backend_container
            deploy_to_cloudflare
            run_health_checks
            cleanup_build_artifacts
            ;;
        dev)
            validate_environment
            build_development_stack
            ;;
        health)
            run_health_checks
            ;;
        rollback)
            rollback_deployment "$1"
            ;;
        clean)
            cleanup_build_artifacts
            ;;
        help|*)
            show_usage
            ;;
    esac
}

# =============================================================================
# ERROR HANDLING AND SIGNAL TRAPS
# =============================================================================

cleanup_on_exit() {
    local exit_code=$?
    if [[ ${exit_code} -ne 0 ]]; then
        log_error "Deployment failed with exit code: ${exit_code}"
        log_info "Check logs in: ${BUILD_LOG_DIR}/deploy_${BUILD_TIMESTAMP}.log"
    fi
    
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

trap cleanup_on_exit EXIT
trap 'exit 1' INT TERM

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi