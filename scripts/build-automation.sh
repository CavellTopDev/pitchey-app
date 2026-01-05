#!/bin/bash

# Pitchey Build Automation Scripts
# Advanced container build system with parallel processing, caching, and optimization

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
readonly BUILD_DIR="${PROJECT_ROOT}/.build"
readonly CACHE_DIR="${PROJECT_ROOT}/.cache"
readonly LOG_DIR="${PROJECT_ROOT}/logs/build"

# Build configuration
BUILD_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BUILD_VERSION="${BUILD_VERSION:-${BUILD_TIMESTAMP}}"
PARALLEL_BUILDS="${PARALLEL_BUILDS:-true}"
ENABLE_CACHE="${ENABLE_CACHE:-true}"
ENABLE_OPTIMIZATION="${ENABLE_OPTIMIZATION:-true}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

# Container configuration
CONTAINER_REGISTRY="${CONTAINER_REGISTRY:-ghcr.io/supremeisbeing/pitchey}"
CONTAINER_TAG="${CONTAINER_TAG:-latest}"

# Performance settings
MAX_PARALLEL_BUILDS="${MAX_PARALLEL_BUILDS:-4}"
BUILD_MEMORY_LIMIT="${BUILD_MEMORY_LIMIT:-2g}"
BUILD_CPU_LIMIT="${BUILD_CPU_LIMIT:-2.0}"

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

log_build() {
    echo -e "${BLUE}[BUILD]${NC} $1" | tee -a "${LOG_DIR}/build_${BUILD_TIMESTAMP}.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_DIR}/build_${BUILD_TIMESTAMP}.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "${LOG_DIR}/build_${BUILD_TIMESTAMP}.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_DIR}/build_${BUILD_TIMESTAMP}.log"
}

log_header() {
    echo -e "\n${PURPLE}=== $1 ===${NC}" | tee -a "${LOG_DIR}/build_${BUILD_TIMESTAMP}.log"
}

# =============================================================================
# BUILD ENVIRONMENT DETECTION
# =============================================================================

detect_build_environment() {
    log_header "Detecting Build Environment"
    
    # Load environment setup
    if [[ -f "${SCRIPT_DIR}/environment-setup.sh" ]]; then
        # shellcheck source=scripts/environment-setup.sh
        source "${SCRIPT_DIR}/environment-setup.sh"
        detect_operating_system
        detect_architecture
        detect_container_runtime
    else
        log_error "Environment setup script not found"
        exit 1
    fi
    
    # Detect available resources
    detect_system_resources
    
    # Configure build runtime
    configure_build_runtime
    
    log_success "Build environment detected: ${CONTAINER_RUNTIME} on ${OS_NAME} ${NORMALIZED_ARCH}"
}

detect_system_resources() {
    log_build "Detecting system resources..."
    
    # CPU cores
    if command -v nproc >/dev/null 2>&1; then
        export AVAILABLE_CORES="$(nproc)"
    elif [[ -f /proc/cpuinfo ]]; then
        export AVAILABLE_CORES="$(grep -c ^processor /proc/cpuinfo)"
    else
        export AVAILABLE_CORES="2"
    fi
    
    # Memory
    if [[ -f /proc/meminfo ]]; then
        export AVAILABLE_MEMORY="$(awk '/MemTotal/ {print int($2/1024/1024)}' /proc/meminfo)G"
    else
        export AVAILABLE_MEMORY="4G"
    fi
    
    # Disk space  
    export AVAILABLE_DISK="$(df -h "${PROJECT_ROOT}" | awk 'NR==2 {print $4}')"
    
    log_build "Resources: ${AVAILABLE_CORES} cores, ${AVAILABLE_MEMORY} RAM, ${AVAILABLE_DISK} disk"
}

configure_build_runtime() {
    log_build "Configuring build runtime..."
    
    # Adjust parallel builds based on resources
    if [[ "${PARALLEL_BUILDS}" == "true" ]]; then
        export ACTUAL_PARALLEL_BUILDS="$((AVAILABLE_CORES > MAX_PARALLEL_BUILDS ? MAX_PARALLEL_BUILDS : AVAILABLE_CORES))"
    else
        export ACTUAL_PARALLEL_BUILDS="1"
    fi
    
    # Configure container runtime
    export CONTAINER_BUILD_CMD="${CONTAINER_RUNTIME}"
    
    # Set build arguments
    export BUILD_ARGS=(
        "--build-arg" "BUILDKIT_INLINE_CACHE=1"
        "--build-arg" "NODE_ENV=production"
        "--build-arg" "BUILD_TIMESTAMP=${BUILD_TIMESTAMP}"
        "--build-arg" "BUILD_VERSION=${BUILD_VERSION}"
    )
    
    # Platform arguments
    if [[ -n "${PLATFORMS}" ]]; then
        export PLATFORM_ARGS=("--platform" "${PLATFORMS}")
    else
        export PLATFORM_ARGS=()
    fi
    
    # Cache arguments
    if [[ "${ENABLE_CACHE}" == "true" ]]; then
        export CACHE_ARGS=(
            "--cache-from" "type=local,src=${CACHE_DIR}/buildkit"
            "--cache-to" "type=local,dest=${CACHE_DIR}/buildkit,mode=max"
        )
        mkdir -p "${CACHE_DIR}/buildkit"
    else
        export CACHE_ARGS=()
    fi
    
    # Resource limits
    export RESOURCE_ARGS=(
        "--memory" "${BUILD_MEMORY_LIMIT}"
        "--cpus" "${BUILD_CPU_LIMIT}"
    )
    
    log_success "Build runtime configured: ${ACTUAL_PARALLEL_BUILDS} parallel builds"
}

# =============================================================================
# DOCKERFILE GENERATION
# =============================================================================

generate_optimized_dockerfiles() {
    log_header "Generating Optimized Dockerfiles"
    
    generate_frontend_dockerfile
    generate_worker_dockerfile
    generate_nginx_dockerfile
    generate_development_dockerfile
    
    log_success "All Dockerfiles generated"
}

generate_frontend_dockerfile() {
    local dockerfile="${PROJECT_ROOT}/frontend/Dockerfile.prod"
    
    log_build "Generating optimized frontend Dockerfile..."
    
    cat > "${dockerfile}" << 'EOF'
# =============================================================================
# Multi-stage Production Frontend Build
# Optimized for size, security, and performance
# =============================================================================

# Build stage
FROM node:20-alpine AS builder

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files for better caching
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./

# Install dependencies with exact versions
RUN npm ci --only=production --silent --no-audit --no-fund \
    && npm cache clean --force

# Copy source code
COPY public/ public/
COPY src/ src/
COPY index.html .
COPY .env.production .

# Build application with optimizations
ENV NODE_ENV=production
ENV VITE_BUILD_TARGET=production

RUN npm run build \
    && du -sh dist/ \
    && ls -la dist/

# Production stage with minimal footprint
FROM nginx:1.25-alpine AS production

# Install security updates and tools
RUN apk update && apk upgrade && apk add --no-cache \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/* \
    && addgroup -g 1001 -S pitchey \
    && adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G pitchey -g pitchey pitchey

# Copy built application
COPY --from=builder --chown=1001:1001 /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY nginx.prod.conf /etc/nginx/nginx.conf

# Security headers and optimization
COPY nginx-security.conf /etc/nginx/conf.d/security.conf

# Health check script
COPY docker-healthcheck.sh /usr/local/bin/healthcheck
RUN chmod +x /usr/local/bin/healthcheck

# Switch to non-root user
USER 1001:1001

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /usr/local/bin/healthcheck || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
EOF

    # Generate nginx configuration
    generate_nginx_config "prod"
    
    # Generate health check script
    cat > "${PROJECT_ROOT}/frontend/docker-healthcheck.sh" << 'EOF'
#!/bin/sh
curl -f http://localhost:8080/health || exit 1
EOF
    chmod +x "${PROJECT_ROOT}/frontend/docker-healthcheck.sh"
    
    log_success "Frontend Dockerfile generated: ${dockerfile}"
}

generate_worker_dockerfile() {
    local dockerfile="${PROJECT_ROOT}/Dockerfile.worker"
    
    log_build "Generating optimized worker Dockerfile..."
    
    cat > "${dockerfile}" << 'EOF'
# =============================================================================
# Cloudflare Worker Development Container
# Optimized for Wrangler and local development
# =============================================================================

FROM denoland/deno:1.40-alpine AS base

# Install system dependencies
RUN apk update && apk upgrade && apk add --no-cache \
    nodejs \
    npm \
    git \
    curl \
    bash \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Install Wrangler globally
RUN npm install -g wrangler@latest

# Copy dependency files
COPY deno.json deno.lock ./
COPY package*.json ./

# Cache Deno dependencies
RUN deno cache --reload --lock=deno.lock deno.json

# Copy source code
COPY src/ src/
COPY wrangler.toml.backup wrangler.toml

# Copy scripts
COPY scripts/ scripts/

# Set proper permissions
RUN chmod +x scripts/*.sh

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8787/api/health || exit 1

# Expose ports
EXPOSE 8787 8788

# Default command
CMD ["wrangler", "dev", "--port", "8787", "--host", "0.0.0.0", "--local"]
EOF
    
    log_success "Worker Dockerfile generated: ${dockerfile}"
}

generate_nginx_config() {
    local env="$1"
    local config_file="${PROJECT_ROOT}/frontend/nginx.${env}.conf"
    
    log_build "Generating nginx configuration for ${env}..."
    
    cat > "${config_file}" << 'EOF'
# Nginx Configuration for Pitchey Frontend
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    # MIME types
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 16M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        application/atom+xml
        application/javascript
        application/json
        application/ld+json
        application/manifest+json
        application/rss+xml
        application/vnd.geo+json
        application/vnd.ms-fontobject
        application/x-font-ttf
        application/x-web-app-manifest+json
        application/xhtml+xml
        application/xml
        font/opentype
        image/bmp
        image/svg+xml
        image/x-icon
        text/cache-manifest
        text/css
        text/plain
        text/vcard
        text/vnd.rim.location.xloc
        text/vtt
        text/x-component
        text/x-cross-domain-policy;

    server {
        listen 8080;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;" always;

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Static assets with long cache
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header X-Frame-Options "SAMEORIGIN" always;
            add_header X-Content-Type-Options "nosniff" always;
        }

        # SPA routing
        location / {
            try_files $uri $uri/ @rewrites;
            add_header Cache-Control "no-cache";
        }

        location @rewrites {
            rewrite ^(.+)$ /index.html last;
        }

        # API proxy (for development)
        location /api/ {
            proxy_pass http://worker:8787;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_buffering off;
            proxy_request_buffering off;
        }

        # WebSocket proxy
        location /ws {
            proxy_pass http://worker:8787;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_buffering off;
            proxy_read_timeout 86400;
        }

        # Block access to dotfiles
        location ~ /\. {
            deny all;
        }
    }
}
EOF
    
    log_success "Nginx configuration generated: ${config_file}"
}

generate_nginx_dockerfile() {
    local dockerfile="${PROJECT_ROOT}/Dockerfile.nginx"
    
    log_build "Generating nginx Dockerfile..."
    
    cat > "${dockerfile}" << 'EOF'
# =============================================================================
# Nginx Reverse Proxy for Local Development
# =============================================================================

FROM nginx:1.25-alpine

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copy configuration
COPY nginx.dev.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF
    
    log_success "Nginx Dockerfile generated: ${dockerfile}"
}

generate_development_dockerfile() {
    local dockerfile="${PROJECT_ROOT}/Dockerfile.dev"
    
    log_build "Generating development Dockerfile..."
    
    cat > "${dockerfile}" << 'EOF'
# =============================================================================
# Development Environment with Hot Reload
# =============================================================================

FROM node:20-alpine AS development

# Install development tools
RUN apk add --no-cache \
    git \
    curl \
    bash \
    && npm install -g nodemon

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev)
RUN npm install

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Development server
EXPOSE 5173 8787

# Default development command
CMD ["npm", "run", "dev"]
EOF
    
    log_success "Development Dockerfile generated: ${dockerfile}"
}

# =============================================================================
# BUILD ORCHESTRATION
# =============================================================================

build_all_containers() {
    log_header "Building All Containers"
    
    local build_jobs=()
    local build_results=()
    
    if [[ "${PARALLEL_BUILDS}" == "true" && "${ACTUAL_PARALLEL_BUILDS}" -gt 1 ]]; then
        log_build "Building containers in parallel (${ACTUAL_PARALLEL_BUILDS} jobs)"
        
        # Start parallel builds
        build_container_parallel "frontend" &
        build_jobs+=($!)
        
        build_container_parallel "worker" &
        build_jobs+=($!)
        
        if [[ -f "${PROJECT_ROOT}/Dockerfile.nginx" ]]; then
            build_container_parallel "nginx" &
            build_jobs+=($!)
        fi
        
        # Wait for all builds to complete
        for job in "${build_jobs[@]}"; do
            if wait "$job"; then
                build_results+=("success")
            else
                build_results+=("failed")
            fi
        done
        
        # Check results
        local failed_builds=0
        for result in "${build_results[@]}"; do
            if [[ "$result" == "failed" ]]; then
                ((failed_builds++))
            fi
        done
        
        if [[ $failed_builds -eq 0 ]]; then
            log_success "All parallel builds completed successfully"
        else
            log_error "${failed_builds} builds failed"
            return 1
        fi
        
    else
        log_build "Building containers sequentially"
        
        build_container "frontend" || return 1
        build_container "worker" || return 1
        
        if [[ -f "${PROJECT_ROOT}/Dockerfile.nginx" ]]; then
            build_container "nginx" || return 1
        fi
        
        log_success "All sequential builds completed"
    fi
}

build_container_parallel() {
    local container="$1"
    local log_file="${LOG_DIR}/build_${container}_${BUILD_TIMESTAMP}.log"
    
    {
        echo "Starting parallel build for ${container}..."
        build_container "$container"
        echo "Parallel build for ${container} completed"
    } > "$log_file" 2>&1
}

build_container() {
    local container="$1"
    local dockerfile=""
    local context=""
    local image_tag="${CONTAINER_REGISTRY}/${container}:${CONTAINER_TAG}"
    
    case "$container" in
        frontend)
            dockerfile="${PROJECT_ROOT}/frontend/Dockerfile.prod"
            context="${PROJECT_ROOT}/frontend"
            ;;
        worker)
            dockerfile="${PROJECT_ROOT}/Dockerfile.worker"
            context="${PROJECT_ROOT}"
            ;;
        nginx)
            dockerfile="${PROJECT_ROOT}/Dockerfile.nginx"
            context="${PROJECT_ROOT}"
            ;;
        *)
            log_error "Unknown container: $container"
            return 1
            ;;
    esac
    
    if [[ ! -f "$dockerfile" ]]; then
        log_error "Dockerfile not found: $dockerfile"
        return 1
    fi
    
    log_build "Building ${container} container: ${image_tag}"
    
    # Build with progress and timing
    local start_time=$(date +%s)
    
    ${CONTAINER_BUILD_CMD} build \
        "${BUILD_ARGS[@]}" \
        "${PLATFORM_ARGS[@]}" \
        "${CACHE_ARGS[@]}" \
        "${RESOURCE_ARGS[@]}" \
        --progress=plain \
        --tag "${image_tag}" \
        --file "${dockerfile}" \
        "${context}" || {
        log_error "Failed to build ${container} container"
        return 1
    }
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Get image size
    local image_size=""
    if command -v "${CONTAINER_BUILD_CMD}" >/dev/null 2>&1; then
        image_size="$(${CONTAINER_BUILD_CMD} images --format 'table {{.Size}}' "${image_tag}" | tail -1)"
    fi
    
    log_success "${container} built in ${duration}s (${image_size}): ${image_tag}"
    
    # Optional: Tag with version
    if [[ "${BUILD_VERSION}" != "${CONTAINER_TAG}" ]]; then
        ${CONTAINER_BUILD_CMD} tag "${image_tag}" "${CONTAINER_REGISTRY}/${container}:${BUILD_VERSION}"
        log_build "${container} tagged with version: ${BUILD_VERSION}"
    fi
    
    return 0
}

# =============================================================================
# BUILD VERIFICATION
# =============================================================================

verify_builds() {
    log_header "Verifying Container Builds"
    
    local containers=("frontend" "worker")
    local verification_errors=()
    
    for container in "${containers[@]}"; do
        local image_tag="${CONTAINER_REGISTRY}/${container}:${CONTAINER_TAG}"
        
        log_build "Verifying ${container} container..."
        
        # Check if image exists
        if ! ${CONTAINER_BUILD_CMD} images | grep -q "${image_tag}"; then
            verification_errors+=("Image not found: ${image_tag}")
            continue
        fi
        
        # Quick container test
        local container_id
        container_id="$(${CONTAINER_BUILD_CMD} run -d --rm "${image_tag}" /bin/sh -c "sleep 10" 2>/dev/null || echo "")"
        
        if [[ -n "$container_id" ]]; then
            log_success "${container} container verified"
            ${CONTAINER_BUILD_CMD} stop "$container_id" >/dev/null 2>&1 || true
        else
            verification_errors+=("Container failed to start: ${image_tag}")
        fi
    done
    
    if [[ ${#verification_errors[@]} -eq 0 ]]; then
        log_success "All container verifications passed"
        return 0
    else
        log_error "Container verification failed:"
        printf '%s\n' "${verification_errors[@]}" | sed 's/^/  - /'
        return 1
    fi
}

# =============================================================================
# BUILD OPTIMIZATION
# =============================================================================

optimize_images() {
    log_header "Optimizing Container Images"
    
    if [[ "${ENABLE_OPTIMIZATION}" != "true" ]]; then
        log_build "Image optimization disabled"
        return 0
    fi
    
    local containers=("frontend" "worker")
    
    for container in "${containers[@]}"; do
        optimize_image "$container"
    done
    
    log_success "Image optimization completed"
}

optimize_image() {
    local container="$1"
    local image_tag="${CONTAINER_REGISTRY}/${container}:${CONTAINER_TAG}"
    
    log_build "Optimizing ${container} image..."
    
    # Get original size
    local original_size=""
    if command -v "${CONTAINER_BUILD_CMD}" >/dev/null 2>&1; then
        original_size="$(${CONTAINER_BUILD_CMD} images --format '{{.Size}}' "${image_tag}")"
    fi
    
    # Export and reimport to remove intermediate layers
    local temp_file="${BUILD_DIR}/${container}_optimized.tar"
    mkdir -p "${BUILD_DIR}"
    
    log_build "Exporting ${container} image..."
    ${CONTAINER_BUILD_CMD} save "${image_tag}" > "${temp_file}"
    
    log_build "Removing original ${container} image..."
    ${CONTAINER_BUILD_CMD} rmi "${image_tag}" >/dev/null 2>&1 || true
    
    log_build "Importing optimized ${container} image..."
    ${CONTAINER_BUILD_CMD} load < "${temp_file}"
    
    # Clean up
    rm -f "${temp_file}"
    
    # Get new size
    local new_size=""
    if command -v "${CONTAINER_BUILD_CMD}" >/dev/null 2>&1; then
        new_size="$(${CONTAINER_BUILD_CMD} images --format '{{.Size}}' "${image_tag}")"
    fi
    
    log_success "${container} optimized: ${original_size} → ${new_size}"
}

# =============================================================================
# CLEANUP AND MAINTENANCE
# =============================================================================

cleanup_build_artifacts() {
    log_header "Cleaning Up Build Artifacts"
    
    # Remove build directory
    if [[ -d "${BUILD_DIR}" ]]; then
        rm -rf "${BUILD_DIR}"
        log_build "Build directory cleaned"
    fi
    
    # Clean old cache entries (keep last 3 days)
    if [[ -d "${CACHE_DIR}" ]]; then
        find "${CACHE_DIR}" -type f -mtime +3 -delete 2>/dev/null || true
        log_build "Old cache entries removed"
    fi
    
    # Clean old logs (keep last 7 days)
    if [[ -d "${LOG_DIR}" ]]; then
        find "${LOG_DIR}" -name "*.log" -mtime +7 -delete 2>/dev/null || true
        log_build "Old build logs removed"
    fi
    
    # Prune unused containers and images
    ${CONTAINER_BUILD_CMD} system prune -f --filter "until=24h" >/dev/null 2>&1 || true
    
    log_success "Build cleanup completed"
}

# =============================================================================
# MAIN ORCHESTRATION
# =============================================================================

show_usage() {
    cat << EOF
Build Automation Scripts for Pitchey

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    all             Build all containers with optimization
    frontend        Build frontend container only
    worker          Build worker container only
    nginx           Build nginx container only
    dev             Build development containers
    verify          Verify built containers
    optimize        Optimize container images
    clean           Clean build artifacts
    help            Show this help

OPTIONS:
    --parallel              Enable parallel builds
    --no-cache             Disable build cache
    --no-optimization      Disable image optimization
    --platforms=PLATFORMS  Set build platforms
    --tag=TAG              Set container tag
    --registry=REGISTRY    Set container registry

EXAMPLES:
    $0 all --parallel                  Build all with parallel processing
    $0 frontend --no-cache             Build frontend without cache
    $0 worker --tag=v1.0.0             Build worker with specific tag
    $0 dev                             Build development containers

ENVIRONMENT VARIABLES:
    PARALLEL_BUILDS         Enable parallel builds (true|false)
    ENABLE_CACHE           Enable build cache (true|false) 
    ENABLE_OPTIMIZATION    Enable image optimization (true|false)
    PLATFORMS              Build platforms (comma-separated)
    CONTAINER_REGISTRY     Container registry URL
    CONTAINER_TAG          Container tag
    MAX_PARALLEL_BUILDS    Maximum parallel build jobs

EOF
}

main() {
    local command="${1:-help}"
    shift 2>/dev/null || true
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --parallel)
                PARALLEL_BUILDS="true"
                ;;
            --no-cache)
                ENABLE_CACHE="false"
                ;;
            --no-optimization)
                ENABLE_OPTIMIZATION="false"
                ;;
            --platforms=*)
                PLATFORMS="${1#*=}"
                ;;
            --tag=*)
                CONTAINER_TAG="${1#*=}"
                ;;
            --registry=*)
                CONTAINER_REGISTRY="${1#*=}"
                ;;
            *)
                log_warning "Unknown option: $1"
                ;;
        esac
        shift
    done
    
    # Create required directories
    mkdir -p "${BUILD_DIR}" "${CACHE_DIR}" "${LOG_DIR}"
    
    # Execute command
    case "$command" in
        all)
            detect_build_environment
            generate_optimized_dockerfiles
            build_all_containers
            verify_builds
            optimize_images
            cleanup_build_artifacts
            ;;
        frontend)
            detect_build_environment
            generate_frontend_dockerfile
            build_container "frontend"
            ;;
        worker)
            detect_build_environment
            generate_worker_dockerfile
            build_container "worker"
            ;;
        nginx)
            detect_build_environment
            generate_nginx_dockerfile
            build_container "nginx"
            ;;
        dev)
            detect_build_environment
            generate_development_dockerfile
            build_container "dev"
            ;;
        verify)
            verify_builds
            ;;
        optimize)
            optimize_images
            ;;
        clean)
            cleanup_build_artifacts
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