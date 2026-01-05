#!/bin/bash

# Pitchey Environment Setup and Detection Utilities
# Comprehensive environment configuration for Podman/Docker deployments

set -euo pipefail

# =============================================================================
# CONSTANTS AND CONFIGURATION
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
readonly ENV_CONFIG_DIR="${PROJECT_ROOT}/.env-configs"

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

# =============================================================================
# LOGGING UTILITIES
# =============================================================================

log() {
    echo -e "${CYAN}[ENV-SETUP]${NC} $1"
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

# =============================================================================
# SYSTEM DETECTION
# =============================================================================

detect_operating_system() {
    log "Detecting operating system..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v lsb_release >/dev/null 2>&1; then
            export OS_NAME="$(lsb_release -si)"
            export OS_VERSION="$(lsb_release -sr)"
        elif [[ -f /etc/os-release ]]; then
            # shellcheck source=/dev/null
            source /etc/os-release
            export OS_NAME="${ID^}"
            export OS_VERSION="${VERSION_ID}"
        else
            export OS_NAME="Linux"
            export OS_VERSION="Unknown"
        fi
        export OS_TYPE="linux"
        export PACKAGE_MANAGER=""
        
        # Detect package manager
        if command -v dnf >/dev/null 2>&1; then
            export PACKAGE_MANAGER="dnf"
        elif command -v yum >/dev/null 2>&1; then
            export PACKAGE_MANAGER="yum"
        elif command -v apt >/dev/null 2>&1; then
            export PACKAGE_MANAGER="apt"
        elif command -v pacman >/dev/null 2>&1; then
            export PACKAGE_MANAGER="pacman"
        elif command -v zypper >/dev/null 2>&1; then
            export PACKAGE_MANAGER="zypper"
        fi
        
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        export OS_NAME="macOS"
        export OS_VERSION="$(sw_vers -productVersion)"
        export OS_TYPE="darwin"
        export PACKAGE_MANAGER="brew"
        
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        # Windows
        export OS_NAME="Windows"
        export OS_VERSION="$(cmd.exe /c ver 2>/dev/null || echo "Unknown")"
        export OS_TYPE="windows"
        export PACKAGE_MANAGER="choco"
    else
        export OS_NAME="Unknown"
        export OS_VERSION="Unknown"
        export OS_TYPE="unknown"
        export PACKAGE_MANAGER=""
    fi
    
    log_success "OS: ${OS_NAME} ${OS_VERSION} (${OS_TYPE})"
    [[ -n "${PACKAGE_MANAGER}" ]] && log_success "Package manager: ${PACKAGE_MANAGER}"
}

detect_architecture() {
    log "Detecting system architecture..."
    
    export ARCH="$(uname -m)"
    case "${ARCH}" in
        x86_64|amd64)
            export NORMALIZED_ARCH="amd64"
            export DOCKER_ARCH="linux/amd64"
            ;;
        aarch64|arm64)
            export NORMALIZED_ARCH="arm64"
            export DOCKER_ARCH="linux/arm64"
            ;;
        armv7l)
            export NORMALIZED_ARCH="arm"
            export DOCKER_ARCH="linux/arm/v7"
            ;;
        i386|i686)
            export NORMALIZED_ARCH="386"
            export DOCKER_ARCH="linux/386"
            ;;
        *)
            export NORMALIZED_ARCH="${ARCH}"
            export DOCKER_ARCH="linux/${ARCH}"
            ;;
    esac
    
    log_success "Architecture: ${ARCH} (normalized: ${NORMALIZED_ARCH})"
}

detect_container_runtime() {
    log "Detecting available container runtimes..."
    
    export CONTAINER_RUNTIME=""
    export CONTAINER_COMPOSE=""
    export CONTAINER_SOCKET=""
    export ROOTLESS_MODE=false

    # Check for Podman (preferred)
    if command -v podman >/dev/null 2>&1; then
        export CONTAINER_RUNTIME="podman"
        
        # Check if running rootless
        if podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null | grep -q true; then
            export ROOTLESS_MODE=true
            export CONTAINER_SOCKET="unix://${XDG_RUNTIME_DIR}/podman/podman.sock"
        else
            export CONTAINER_SOCKET="unix:///run/podman/podman.sock"
        fi
        
        # Check for podman-compose
        if command -v podman-compose >/dev/null 2>&1; then
            export CONTAINER_COMPOSE="podman-compose"
        elif command -v docker-compose >/dev/null 2>&1; then
            export CONTAINER_COMPOSE="docker-compose"
            log_warning "Using docker-compose with Podman socket"
        else
            log_warning "No compose tool found for Podman"
        fi
        
        log_success "Podman detected (rootless: ${ROOTLESS_MODE})"
        
    # Fallback to Docker
    elif command -v docker >/dev/null 2>&1; then
        export CONTAINER_RUNTIME="docker"
        export CONTAINER_SOCKET="unix:///var/run/docker.sock"
        
        if command -v docker-compose >/dev/null 2>&1; then
            export CONTAINER_COMPOSE="docker-compose"
        else
            log_warning "docker-compose not found"
        fi
        
        log_success "Docker detected"
    else
        log_error "No container runtime found (podman/docker)"
        return 1
    fi

    # Verify socket accessibility
    verify_container_socket
}

verify_container_socket() {
    local socket_path="${CONTAINER_SOCKET#unix://}"
    
    if [[ -S "${socket_path}" ]]; then
        log_success "Container socket verified: ${CONTAINER_SOCKET}"
    else
        log_warning "Container socket not found: ${socket_path}"
        
        if [[ "${CONTAINER_RUNTIME}" == "podman" ]]; then
            log "Attempting to start Podman socket..."
            start_podman_socket
        else
            log_error "Docker socket not accessible"
            return 1
        fi
    fi
}

start_podman_socket() {
    if [[ "${ROOTLESS_MODE}" == "true" ]]; then
        # Start rootless Podman socket
        if systemctl --user is-active --quiet podman.socket; then
            log_success "Podman socket already running"
        else
            log "Starting rootless Podman socket..."
            systemctl --user start podman.socket || {
                log_warning "systemd user service not available, starting manually"
                podman system service --time=0 "${CONTAINER_SOCKET}" &
                sleep 3
            }
        fi
    else
        # Start system Podman socket
        if sudo systemctl is-active --quiet podman.socket; then
            log_success "Podman socket already running"
        else
            log "Starting system Podman socket..."
            sudo systemctl start podman.socket || {
                log_warning "systemd service not available, starting manually"
                sudo podman system service --time=0 "${CONTAINER_SOCKET}" &
                sleep 3
            }
        fi
    fi

    # Verify socket is working
    if podman info >/dev/null 2>&1; then
        log_success "Podman socket started successfully"
    else
        log_error "Failed to start Podman socket"
        return 1
    fi
}

# =============================================================================
# DEPENDENCY DETECTION AND INSTALLATION
# =============================================================================

detect_dependencies() {
    log "Detecting installed dependencies..."
    
    declare -A DEPENDENCIES=(
        ["node"]="Node.js runtime"
        ["npm"]="Node package manager"
        ["git"]="Version control"
        ["curl"]="HTTP client"
        ["jq"]="JSON processor"
        ["wrangler"]="Cloudflare CLI"
    )
    
    export MISSING_DEPS=()
    export INSTALLED_DEPS=()
    
    for cmd in "${!DEPENDENCIES[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            local version=""
            case "$cmd" in
                node) version="$(node --version 2>/dev/null || echo "unknown")" ;;
                npm) version="$(npm --version 2>/dev/null || echo "unknown")" ;;
                git) version="$(git --version 2>/dev/null | cut -d' ' -f3 || echo "unknown")" ;;
                curl) version="$(curl --version 2>/dev/null | head -n1 | cut -d' ' -f2 || echo "unknown")" ;;
                jq) version="$(jq --version 2>/dev/null || echo "unknown")" ;;
                wrangler) version="$(wrangler --version 2>/dev/null || echo "unknown")" ;;
                *) version="installed" ;;
            esac
            
            INSTALLED_DEPS+=("${cmd}:${version}")
            log_success "${DEPENDENCIES[$cmd]}: ${version}"
        else
            MISSING_DEPS+=("$cmd")
            log_warning "${DEPENDENCIES[$cmd]}: not found"
        fi
    done
    
    if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
        log_warning "Missing dependencies: ${MISSING_DEPS[*]}"
        return 1
    else
        log_success "All dependencies satisfied"
        return 0
    fi
}

install_dependencies() {
    log "Installing missing dependencies..."
    
    if [[ ${#MISSING_DEPS[@]} -eq 0 ]]; then
        log "No dependencies to install"
        return 0
    fi
    
    for dep in "${MISSING_DEPS[@]}"; do
        install_dependency "$dep"
    done
}

install_dependency() {
    local dep="$1"
    log "Installing $dep..."
    
    case "${PACKAGE_MANAGER}" in
        apt)
            case "$dep" in
                node) 
                    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                    sudo apt-get install -y nodejs
                    ;;
                npm) log "npm included with nodejs" ;;
                jq) sudo apt-get install -y jq ;;
                curl) sudo apt-get install -y curl ;;
                git) sudo apt-get install -y git ;;
                wrangler) npm install -g wrangler ;;
            esac
            ;;
        dnf|yum)
            case "$dep" in
                node) 
                    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
                    sudo $PACKAGE_MANAGER install -y nodejs
                    ;;
                npm) log "npm included with nodejs" ;;
                jq) sudo $PACKAGE_MANAGER install -y jq ;;
                curl) sudo $PACKAGE_MANAGER install -y curl ;;
                git) sudo $PACKAGE_MANAGER install -y git ;;
                wrangler) npm install -g wrangler ;;
            esac
            ;;
        pacman)
            case "$dep" in
                node) sudo pacman -S --noconfirm nodejs ;;
                npm) sudo pacman -S --noconfirm npm ;;
                jq) sudo pacman -S --noconfirm jq ;;
                curl) sudo pacman -S --noconfirm curl ;;
                git) sudo pacman -S --noconfirm git ;;
                wrangler) npm install -g wrangler ;;
            esac
            ;;
        brew)
            case "$dep" in
                node) brew install node ;;
                npm) log "npm included with node" ;;
                jq) brew install jq ;;
                curl) log "curl included with macOS" ;;
                git) brew install git ;;
                wrangler) npm install -g wrangler ;;
            esac
            ;;
        *)
            log_warning "Automatic installation not supported for ${PACKAGE_MANAGER}"
            log "Please install $dep manually"
            ;;
    esac
}

# =============================================================================
# ENVIRONMENT CONFIGURATION
# =============================================================================

setup_environment_configs() {
    log "Setting up environment configurations..."
    
    mkdir -p "${ENV_CONFIG_DIR}"
    
    # Create environment templates
    create_env_template "development"
    create_env_template "staging" 
    create_env_template "production"
    
    # Create runtime-specific configs
    create_podman_config
    create_docker_config
    
    log_success "Environment configurations created"
}

create_env_template() {
    local env="$1"
    local env_file="${ENV_CONFIG_DIR}/${env}.env"
    
    log "Creating ${env} environment template..."
    
    case "$env" in
        development)
            cat > "$env_file" << EOF
# Development Environment Configuration
NODE_ENV=development
ENVIRONMENT=development

# API Configuration
VITE_API_URL=http://localhost:8001
VITE_WS_URL=ws://localhost:8001

# Database (Local)
DATABASE_URL=postgresql://pitchey_dev:localdev123@localhost:5432/pitchey_local
REDIS_URL=redis://localhost:6380

# Cloudflare (Development)
CLOUDFLARE_ACCOUNT_ID=02967e39e44b6266e7873829e94849f5
WRANGLER_ENV=development

# Local Services
MINIO_URL=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Monitoring
ENABLE_DEBUG=true
LOG_LEVEL=debug
EOF
            ;;
        staging)
            cat > "$env_file" << EOF
# Staging Environment Configuration  
NODE_ENV=production
ENVIRONMENT=staging

# API Configuration
VITE_API_URL=https://pitchey-api-staging.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-api-staging.ndlovucavelle.workers.dev

# Database (Staging)
DATABASE_URL=\${STAGING_DATABASE_URL}
REDIS_URL=\${STAGING_REDIS_URL}

# Cloudflare (Staging)
CLOUDFLARE_ACCOUNT_ID=02967e39e44b6266e7873829e94849f5
WRANGLER_ENV=staging

# Monitoring
ENABLE_DEBUG=false
LOG_LEVEL=info
SENTRY_DSN=\${STAGING_SENTRY_DSN}
EOF
            ;;
        production)
            cat > "$env_file" << EOF
# Production Environment Configuration
NODE_ENV=production
ENVIRONMENT=production

# API Configuration  
VITE_API_URL=https://pitchey-api-prod.ndlovucavelle.workers.dev
VITE_WS_URL=wss://pitchey-api-prod.ndlovucavelle.workers.dev

# Database (Production)
DATABASE_URL=\${PRODUCTION_DATABASE_URL}
REDIS_URL=\${PRODUCTION_REDIS_URL}

# Cloudflare (Production)
CLOUDFLARE_ACCOUNT_ID=02967e39e44b6266e7873829e94849f5
WRANGLER_ENV=production

# Monitoring
ENABLE_DEBUG=false
LOG_LEVEL=error
SENTRY_DSN=\${PRODUCTION_SENTRY_DSN}

# Performance
ENABLE_CACHING=true
CACHE_TTL=300
EOF
            ;;
    esac
    
    log_success "Created ${env_file}"
}

create_podman_config() {
    local config_file="${ENV_CONFIG_DIR}/podman.conf"
    
    log "Creating Podman configuration..."
    
    cat > "$config_file" << EOF
# Podman Configuration for Pitchey

[runtime]
runtime = "podman"
socket = "${CONTAINER_SOCKET}"
rootless = ${ROOTLESS_MODE}

[build]
cache_dir = "${PROJECT_ROOT}/.cache/podman"
parallel_builds = true
platforms = "linux/amd64,linux/arm64"

[compose]
compose_cmd = "${CONTAINER_COMPOSE}"
compose_file = "${PROJECT_ROOT}/podman-compose.yml"

[security]
enable_selinux = $(getenforce 2>/dev/null | grep -q Enforcing && echo "true" || echo "false")
user_namespace = ${ROOTLESS_MODE}
EOF
    
    log_success "Created ${config_file}"
}

create_docker_config() {
    local config_file="${ENV_CONFIG_DIR}/docker.conf"
    
    log "Creating Docker configuration..."
    
    cat > "$config_file" << EOF
# Docker Configuration for Pitchey

[runtime]
runtime = "docker"
socket = "${CONTAINER_SOCKET}"
rootless = false

[build]
cache_dir = "${PROJECT_ROOT}/.cache/docker"
parallel_builds = true
platforms = "linux/amd64,linux/arm64"

[compose]
compose_cmd = "${CONTAINER_COMPOSE}"
compose_file = "${PROJECT_ROOT}/docker-compose.yml"

[security]
enable_selinux = false
user_namespace = false
EOF
    
    log_success "Created ${config_file}"
}

# =============================================================================
# REGISTRY SETUP
# =============================================================================

setup_container_registry() {
    log "Setting up container registry configuration..."
    
    local registry_config="${ENV_CONFIG_DIR}/registry.conf"
    
    cat > "$registry_config" << EOF
# Container Registry Configuration

[registry]
url = "${CONTAINER_REGISTRY:-ghcr.io/supremeisbeing/pitchey}"
username = "\${REGISTRY_USERNAME}"
password = "\${REGISTRY_PASSWORD}"

[images]
frontend = "\${CONTAINER_REGISTRY}/frontend"
backend = "\${CONTAINER_REGISTRY}/backend" 
worker = "\${CONTAINER_REGISTRY}/worker"

[tags]
latest = "latest"
version = "\${BUILD_VERSION:-\$(date +%Y%m%d_%H%M%S)}"
environment = "\${ENVIRONMENT:-development}"
EOF
    
    log_success "Registry configuration created: ${registry_config}"
}

# =============================================================================
# LOCAL REGISTRY FOR DEVELOPMENT
# =============================================================================

setup_local_registry() {
    log "Setting up local container registry for development..."
    
    local registry_port="${LOCAL_REGISTRY_PORT:-5000}"
    local registry_name="pitchey-registry"
    
    # Check if registry is already running
    if ${CONTAINER_RUNTIME} ps --filter "name=${registry_name}" --filter "status=running" | grep -q "${registry_name}"; then
        log_success "Local registry already running on port ${registry_port}"
        return 0
    fi
    
    # Start local registry
    log "Starting local container registry..."
    
    ${CONTAINER_RUNTIME} run -d \
        --name "${registry_name}" \
        --restart=unless-stopped \
        -p "${registry_port}:5000" \
        -v "${PROJECT_ROOT}/.cache/registry:/var/lib/registry" \
        registry:2 || {
        log_warning "Failed to start local registry"
        return 1
    }
    
    # Wait for registry to start
    sleep 3
    
    if curl -sf "http://localhost:${registry_port}/v2/" >/dev/null 2>&1; then
        log_success "Local registry started on port ${registry_port}"
        export LOCAL_REGISTRY_URL="localhost:${registry_port}"
    else
        log_error "Local registry failed to start"
        return 1
    fi
}

# =============================================================================
# VALIDATION
# =============================================================================

validate_setup() {
    log "Validating environment setup..."
    
    local validation_errors=()
    
    # Check container runtime
    if ! ${CONTAINER_RUNTIME} info >/dev/null 2>&1; then
        validation_errors+=("Container runtime not functional")
    fi
    
    # Check required tools
    if ! detect_dependencies >/dev/null 2>&1; then
        validation_errors+=("Missing required dependencies")
    fi
    
    # Check project structure
    local required_files=(
        "${PROJECT_ROOT}/frontend/package.json"
        "${PROJECT_ROOT}/src/worker-integrated.ts"
        "${PROJECT_ROOT}/wrangler.toml.backup"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            validation_errors+=("Missing file: ${file}")
        fi
    done
    
    # Check environment configs
    if [[ ! -d "${ENV_CONFIG_DIR}" ]]; then
        validation_errors+=("Environment configs not created")
    fi
    
    # Report results
    if [[ ${#validation_errors[@]} -eq 0 ]]; then
        log_success "Environment validation passed"
        return 0
    else
        log_error "Environment validation failed:"
        printf '%s\n' "${validation_errors[@]}" | sed 's/^/  - /'
        return 1
    fi
}

# =============================================================================
# MAIN FUNCTIONS
# =============================================================================

show_environment_info() {
    cat << EOF

${CYAN}=== Environment Information ===${NC}
${BLUE}Operating System:${NC} ${OS_NAME} ${OS_VERSION} (${OS_TYPE})
${BLUE}Architecture:${NC} ${ARCH} (${NORMALIZED_ARCH})
${BLUE}Package Manager:${NC} ${PACKAGE_MANAGER}
${BLUE}Container Runtime:${NC} ${CONTAINER_RUNTIME}
${BLUE}Container Compose:${NC} ${CONTAINER_COMPOSE}
${BLUE}Container Socket:${NC} ${CONTAINER_SOCKET}
${BLUE}Rootless Mode:${NC} ${ROOTLESS_MODE}

${CYAN}=== Installed Dependencies ===${NC}
EOF
    
    for dep in "${INSTALLED_DEPS[@]}"; do
        echo -e "${GREEN}✓${NC} ${dep}"
    done
    
    if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
        echo -e "\n${CYAN}=== Missing Dependencies ===${NC}"
        for dep in "${MISSING_DEPS[@]}"; do
            echo -e "${RED}✗${NC} ${dep}"
        done
    fi
    
    echo
}

setup_complete_environment() {
    log "Setting up complete development environment..."
    
    detect_operating_system
    detect_architecture  
    detect_container_runtime
    detect_dependencies
    
    if [[ ${#MISSING_DEPS[@]} -gt 0 ]]; then
        read -p "Install missing dependencies? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_dependencies
        else
            log_warning "Skipping dependency installation"
        fi
    fi
    
    setup_environment_configs
    setup_container_registry
    
    # Optional local registry setup
    read -p "Set up local container registry for development? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_local_registry
    fi
    
    validate_setup
    show_environment_info
    
    log_success "Environment setup completed!"
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_usage() {
    cat << EOF
Environment Setup and Detection Utilities

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    setup           Complete environment setup
    detect          Detect system and dependencies  
    install         Install missing dependencies
    validate        Validate current setup
    info            Show environment information
    registry        Setup local container registry
    help            Show this help

EXAMPLES:
    $0 setup                Setup complete environment
    $0 detect               Detect system capabilities
    $0 install             Install missing dependencies  
    $0 validate            Validate environment
    $0 registry            Setup local registry

EOF
}

main() {
    local command="${1:-help}"
    
    case "$command" in
        setup)
            setup_complete_environment
            ;;
        detect)
            detect_operating_system
            detect_architecture
            detect_container_runtime
            detect_dependencies
            show_environment_info
            ;;
        install)
            detect_dependencies
            install_dependencies
            ;;
        validate)
            validate_setup
            ;;
        info)
            show_environment_info
            ;;
        registry)
            setup_local_registry
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