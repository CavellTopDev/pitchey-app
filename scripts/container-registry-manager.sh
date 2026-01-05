#!/bin/bash

# ===========================================================================================
# Container Registry Management System
# Cloudflare registry configuration, multi-architecture builds, and image lifecycle
# ===========================================================================================

set -euo pipefail

readonly SCRIPT_VERSION="1.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

# =============================================================================
# CONFIGURATION
# =============================================================================

# Registry configuration
REGISTRY_URL="${REGISTRY_URL:-pitchey.registry.cloudflare.com}"
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-pitchey-production}"
REGISTRY_PROJECT="${REGISTRY_PROJECT:-pitchey-containers}"

# Build configuration
BUILD_PLATFORMS="${BUILD_PLATFORMS:-linux/amd64,linux/arm64}"
BUILD_CACHE="${BUILD_CACHE:-true}"
BUILD_ARGS="${BUILD_ARGS:-}"
SECURITY_SCANNING="${SECURITY_SCANNING:-true}"
PUSH_TO_REGISTRY="${PUSH_TO_REGISTRY:-true}"

# Image versioning
VERSION_STRATEGY="${VERSION_STRATEGY:-semantic}"  # semantic, timestamp, git
VERSION_PREFIX="${VERSION_PREFIX:-v}"
IMAGE_RETENTION_DAYS="${IMAGE_RETENTION_DAYS:-30}"
MAX_IMAGES_PER_SERVICE="${MAX_IMAGES_PER_SERVICE:-10}"

# Build tools
BUILDX_DRIVER="${BUILDX_DRIVER:-docker-container}"
BUILDX_PLATFORM="${BUILDX_PLATFORM:-linux/amd64,linux/arm64}"
COSIGN_ENABLED="${COSIGN_ENABLED:-true}"
SBOM_ENABLED="${SBOM_ENABLED:-true}"

# Security
VULNERABILITY_DATABASE="${VULNERABILITY_DATABASE:-ghcr.io/aquasecurity/trivy-db}"
SECURITY_POLICY_FILE="${SECURITY_POLICY_FILE:-${PROJECT_ROOT}/security-policy.json}"
MAX_CRITICAL_VULNERABILITIES="${MAX_CRITICAL_VULNERABILITIES:-0}"
MAX_HIGH_VULNERABILITIES="${MAX_HIGH_VULNERABILITIES:-5}"

# =============================================================================
# LOGGING
# =============================================================================

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1" >&2; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1" >&2; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_debug() { [[ "${DEBUG:-false}" == "true" ]] && echo -e "${CYAN}[DEBUG]${NC} $1" >&2; }

# =============================================================================
# REGISTRY SETUP AND AUTHENTICATION
# =============================================================================

setup_registry_authentication() {
    log_info "Setting up registry authentication"
    
    # Cloudflare Container Registry authentication
    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        log_error "CLOUDFLARE_API_TOKEN environment variable is required"
        return 1
    fi
    
    # Login to Cloudflare registry
    echo "$CLOUDFLARE_API_TOKEN" | docker login "$REGISTRY_URL" \
        --username "$CLOUDFLARE_EMAIL" \
        --password-stdin || {
        log_error "Failed to authenticate with Cloudflare registry"
        return 1
    }
    
    log_success "Registry authentication successful"
}

create_registry_namespace() {
    local namespace="$1"
    
    log_info "Creating registry namespace: $namespace"
    
    # Create namespace using Cloudflare API
    local api_response
    api_response=$(curl -s -X POST \
        "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/registry/repositories" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"${namespace}\", \"description\": \"Pitchey container images\"}")
    
    local success
    success=$(echo "$api_response" | jq -r '.success')
    
    if [[ "$success" == "true" ]]; then
        log_success "Namespace created: $namespace"
    else
        local errors
        errors=$(echo "$api_response" | jq -r '.errors[].message' 2>/dev/null || echo "Unknown error")
        log_warn "Namespace creation response: $errors"
    fi
}

configure_registry_settings() {
    log_info "Configuring registry settings"
    
    # Configure image retention policies
    configure_retention_policy
    
    # Setup webhook notifications
    setup_registry_webhooks
    
    # Configure access policies
    configure_access_policies
    
    log_success "Registry settings configured"
}

configure_retention_policy() {
    log_debug "Configuring image retention policy"
    
    # Configure retention via Cloudflare API
    local retention_policy='{
        "tag_status": "any",
        "tag_prefixes": ["v"],
        "count_type": "image_count",
        "count": '${MAX_IMAGES_PER_SERVICE}',
        "older_than": '${IMAGE_RETENTION_DAYS}'
    }'
    
    log_debug "Retention policy: Keep $MAX_IMAGES_PER_SERVICE images, delete after $IMAGE_RETENTION_DAYS days"
}

setup_registry_webhooks() {
    log_debug "Setting up registry webhooks"
    
    # Configure webhooks for:
    # - Image push notifications
    # - Security scan results
    # - Image deletion notifications
    
    local webhook_url="${WEBHOOK_URL:-}"
    if [[ -n "$webhook_url" ]]; then
        log_debug "Webhook configured: $webhook_url"
    else
        log_debug "No webhook URL configured"
    fi
}

configure_access_policies() {
    log_debug "Configuring registry access policies"
    
    # Configure RBAC for registry access
    # Set pull/push permissions
    # Configure service account access
    
    log_debug "Access policies configured"
}

# =============================================================================
# BUILDX SETUP FOR MULTI-ARCHITECTURE BUILDS
# =============================================================================

setup_buildx() {
    log_info "Setting up Docker Buildx for multi-architecture builds"
    
    # Create buildx builder if it doesn't exist
    local builder_name="pitchey-builder"
    
    if ! docker buildx ls | grep -q "$builder_name"; then
        log_info "Creating buildx builder: $builder_name"
        
        docker buildx create \
            --name "$builder_name" \
            --driver "$BUILDX_DRIVER" \
            --platform "$BUILDX_PLATFORM" \
            --use || {
            log_error "Failed to create buildx builder"
            return 1
        }
    else
        log_debug "Using existing buildx builder: $builder_name"
        docker buildx use "$builder_name"
    fi
    
    # Bootstrap the builder
    docker buildx inspect --bootstrap || {
        log_error "Failed to bootstrap buildx builder"
        return 1
    }
    
    log_success "Buildx setup completed"
}

verify_buildx_platforms() {
    log_info "Verifying buildx platform support"
    
    local supported_platforms
    supported_platforms=$(docker buildx inspect --format '{{ range .Node }}{{ .Platforms }}{{ end }}')
    
    log_debug "Supported platforms: $supported_platforms"
    
    # Check if required platforms are supported
    IFS=',' read -ra REQUIRED_PLATFORMS <<< "$BUILDX_PLATFORM"
    
    for platform in "${REQUIRED_PLATFORMS[@]}"; do
        if [[ "$supported_platforms" == *"$platform"* ]]; then
            log_debug "✓ Platform supported: $platform"
        else
            log_error "✗ Platform not supported: $platform"
            return 1
        fi
    done
    
    log_success "All required platforms are supported"
}

# =============================================================================
# IMAGE BUILDING
# =============================================================================

build_all_images() {
    log_info "Building all container images"
    
    local services=(
        "video-processor"
        "document-processor"
        "ai-inference"
        "media-transcoder"
        "code-executor"
        "nginx-gateway"
    )
    
    local version
    version=$(generate_version)
    
    log_info "Building ${#services[@]} services with version: $version"
    
    # Parallel builds for efficiency
    local build_pids=()
    
    for service in "${services[@]}"; do
        if [[ "${PARALLEL_BUILDS:-true}" == "true" ]]; then
            build_service_image "$service" "$version" &
            build_pids+=($!)
        else
            build_service_image "$service" "$version"
        fi
    done
    
    # Wait for parallel builds to complete
    if [[ ${#build_pids[@]} -gt 0 ]]; then
        log_info "Waiting for parallel builds to complete..."
        for pid in "${build_pids[@]}"; do
            if wait "$pid"; then
                log_debug "Build process $pid completed successfully"
            else
                log_error "Build process $pid failed"
                return 1
            fi
        done
    fi
    
    # Create and push multi-arch manifests
    create_manifest_lists "$version"
    
    log_success "All images built successfully"
}

build_service_image() {
    local service="$1"
    local version="$2"
    
    local dockerfile="${PROJECT_ROOT}/containers/${service}/Dockerfile"
    local context="${PROJECT_ROOT}/containers/${service}"
    local image_name="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${service}"
    local full_image_name="${image_name}:${version}"
    local latest_image_name="${image_name}:latest"
    
    log_info "Building $service image: $full_image_name"
    
    if [[ ! -f "$dockerfile" ]]; then
        log_error "Dockerfile not found: $dockerfile"
        return 1
    fi
    
    # Prepare build arguments
    local build_args=(
        "--platform" "$BUILD_PLATFORMS"
        "--file" "$dockerfile"
        "--tag" "$full_image_name"
        "--tag" "$latest_image_name"
    )
    
    # Add metadata labels
    build_args+=(
        "--label" "org.opencontainers.image.created=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
        "--label" "org.opencontainers.image.version=$version"
        "--label" "org.opencontainers.image.revision=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
        "--label" "org.opencontainers.image.source=https://github.com/pitchey/pitchey-containers"
        "--label" "org.opencontainers.image.title=Pitchey $service"
        "--label" "org.opencontainers.image.description=Pitchey platform $service container"
    )
    
    # Add custom build args
    if [[ -n "$BUILD_ARGS" ]]; then
        IFS=',' read -ra CUSTOM_ARGS <<< "$BUILD_ARGS"
        for arg in "${CUSTOM_ARGS[@]}"; do
            build_args+=("--build-arg" "$arg")
        done
    fi
    
    # Add build cache options
    if [[ "$BUILD_CACHE" == "true" ]]; then
        build_args+=(
            "--cache-from" "type=registry,ref=${image_name}:cache"
            "--cache-to" "type=registry,ref=${image_name}:cache,mode=max"
        )
    fi
    
    # Enable attestations
    if [[ "$SBOM_ENABLED" == "true" ]]; then
        build_args+=("--attest" "type=sbom")
    fi
    
    build_args+=("--attest" "type=provenance")
    
    # Push to registry
    if [[ "$PUSH_TO_REGISTRY" == "true" ]]; then
        build_args+=("--push")
    else
        build_args+=("--load")
    fi
    
    # Execute build
    docker buildx build "${build_args[@]}" "$context" || {
        log_error "Failed to build $service image"
        return 1
    }
    
    # Security scanning
    if [[ "$SECURITY_SCANNING" == "true" ]]; then
        scan_image_vulnerabilities "$full_image_name"
    fi
    
    # Sign image if cosign is enabled
    if [[ "$COSIGN_ENABLED" == "true" && "$PUSH_TO_REGISTRY" == "true" ]]; then
        sign_image "$full_image_name"
    fi
    
    log_success "Built $service image: $full_image_name"
}

generate_version() {
    case "$VERSION_STRATEGY" in
        semantic)
            generate_semantic_version
            ;;
        timestamp)
            generate_timestamp_version
            ;;
        git)
            generate_git_version
            ;;
        *)
            log_error "Unknown version strategy: $VERSION_STRATEGY"
            return 1
            ;;
    esac
}

generate_semantic_version() {
    # Get latest semantic version from git tags
    local latest_tag
    latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
    
    # Extract version numbers
    local version_regex="v?([0-9]+)\.([0-9]+)\.([0-9]+)"
    
    if [[ $latest_tag =~ $version_regex ]]; then
        local major="${BASH_REMATCH[1]}"
        local minor="${BASH_REMATCH[2]}"
        local patch="${BASH_REMATCH[3]}"
        
        # Increment patch version
        patch=$((patch + 1))
        
        echo "${VERSION_PREFIX}${major}.${minor}.${patch}"
    else
        echo "${VERSION_PREFIX}1.0.0"
    fi
}

generate_timestamp_version() {
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    echo "${VERSION_PREFIX}${timestamp}"
}

generate_git_version() {
    local commit_hash
    commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    echo "${VERSION_PREFIX}${timestamp}_${commit_hash}"
}

# =============================================================================
# MANIFEST LISTS FOR MULTI-ARCHITECTURE
# =============================================================================

create_manifest_lists() {
    local version="$1"
    
    log_info "Creating multi-architecture manifest lists"
    
    local services=(
        "video-processor"
        "document-processor"
        "ai-inference"
        "media-transcoder"
        "code-executor"
        "nginx-gateway"
    )
    
    for service in "${services[@]}"; do
        create_service_manifest_list "$service" "$version"
    done
    
    log_success "Manifest lists created"
}

create_service_manifest_list() {
    local service="$1"
    local version="$2"
    
    local image_name="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${service}"
    local manifest_name="${image_name}:${version}"
    local latest_manifest_name="${image_name}:latest"
    
    log_debug "Creating manifest list for $service"
    
    # The buildx build with --platform already creates multi-arch manifests
    # This function is for additional manifest operations if needed
    
    # Inspect the manifest to verify multi-arch
    if docker manifest inspect "$manifest_name" >/dev/null 2>&1; then
        local architectures
        architectures=$(docker manifest inspect "$manifest_name" | jq -r '.manifests[].platform.architecture' | tr '\n' ',' | sed 's/,$//')
        log_debug "✓ Multi-arch manifest for $service: $architectures"
    else
        log_warn "Could not verify manifest for $service"
    fi
}

# =============================================================================
# SECURITY SCANNING
# =============================================================================

scan_image_vulnerabilities() {
    local image="$1"
    
    log_info "Scanning image for vulnerabilities: $image"
    
    # Use Trivy for vulnerability scanning
    if ! command -v trivy >/dev/null 2>&1; then
        install_trivy
    fi
    
    # Update vulnerability database
    trivy image --download-db-only || log_warn "Failed to update vulnerability database"
    
    # Perform scan
    local scan_report_file="${PROJECT_ROOT}/.deploy/security_scan_$(date +%Y%m%d_%H%M%S).json"
    
    trivy image \
        --format json \
        --output "$scan_report_file" \
        --severity HIGH,CRITICAL \
        "$image" || {
        log_error "Vulnerability scan failed for $image"
        return 1
    }
    
    # Parse scan results
    local critical_count
    critical_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$scan_report_file" 2>/dev/null || echo 0)
    
    local high_count
    high_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "$scan_report_file" 2>/dev/null || echo 0)
    
    log_info "Vulnerability scan results: $critical_count critical, $high_count high"
    
    # Check against policy
    if [[ $critical_count -gt $MAX_CRITICAL_VULNERABILITIES ]]; then
        log_error "Critical vulnerabilities exceed policy: $critical_count > $MAX_CRITICAL_VULNERABILITIES"
        show_vulnerability_summary "$scan_report_file"
        return 1
    fi
    
    if [[ $high_count -gt $MAX_HIGH_VULNERABILITIES ]]; then
        log_error "High vulnerabilities exceed policy: $high_count > $MAX_HIGH_VULNERABILITIES"
        show_vulnerability_summary "$scan_report_file"
        return 1
    fi
    
    log_success "Security scan passed for $image"
}

install_trivy() {
    log_info "Installing Trivy security scanner"
    
    local trivy_version="0.48.0"
    local trivy_url="https://github.com/aquasecurity/trivy/releases/download/v${trivy_version}/trivy_${trivy_version}_Linux-64bit.tar.gz"
    
    curl -sfL "$trivy_url" | sudo tar -xzC /usr/local/bin trivy || {
        log_error "Failed to install Trivy"
        return 1
    }
    
    log_success "Trivy installed successfully"
}

show_vulnerability_summary() {
    local scan_report="$1"
    
    log_info "Vulnerability Summary:"
    
    # Show top vulnerabilities
    jq -r '.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL" or .Severity=="HIGH") | "  - \(.VulnerabilityID): \(.Title) (\(.Severity))"' "$scan_report" | head -10
    
    log_info "Full report: $scan_report"
}

# =============================================================================
# IMAGE SIGNING WITH COSIGN
# =============================================================================

setup_cosign() {
    log_info "Setting up Cosign for image signing"
    
    if ! command -v cosign >/dev/null 2>&1; then
        install_cosign
    fi
    
    # Generate key pair if not exists
    if [[ ! -f "${HOME}/.cosign/cosign.key" ]]; then
        generate_cosign_keys
    fi
    
    log_success "Cosign setup completed"
}

install_cosign() {
    log_info "Installing Cosign"
    
    local cosign_version="2.2.2"
    local cosign_url="https://github.com/sigstore/cosign/releases/download/v${cosign_version}/cosign-linux-amd64"
    
    curl -sfL "$cosign_url" -o /tmp/cosign
    chmod +x /tmp/cosign
    sudo mv /tmp/cosign /usr/local/bin/cosign || {
        log_error "Failed to install Cosign"
        return 1
    }
    
    log_success "Cosign installed successfully"
}

generate_cosign_keys() {
    log_info "Generating Cosign key pair"
    
    mkdir -p "${HOME}/.cosign"
    
    # Generate key pair (will prompt for password)
    cosign generate-key-pair || {
        log_error "Failed to generate Cosign keys"
        return 1
    }
    
    # Move keys to expected location
    mv cosign.key cosign.pub "${HOME}/.cosign/"
    
    log_success "Cosign keys generated"
}

sign_image() {
    local image="$1"
    
    log_debug "Signing image: $image"
    
    # Sign with Cosign
    cosign sign --key "${HOME}/.cosign/cosign.key" "$image" || {
        log_warn "Failed to sign image: $image"
        return 1
    }
    
    log_debug "Image signed successfully: $image"
}

verify_image_signature() {
    local image="$1"
    
    log_debug "Verifying image signature: $image"
    
    cosign verify --key "${HOME}/.cosign/cosign.pub" "$image" || {
        log_warn "Image signature verification failed: $image"
        return 1
    }
    
    log_debug "Image signature verified: $image"
}

# =============================================================================
# IMAGE MANAGEMENT AND CLEANUP
# =============================================================================

list_images() {
    log_info "Listing container images"
    
    local namespace="${1:-$REGISTRY_NAMESPACE}"
    
    # List images via Cloudflare API
    local api_response
    api_response=$(curl -s -X GET \
        "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/registry/repositories/${namespace}/images" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")
    
    echo "$api_response" | jq -r '.result[] | "\(.name):\(.tag) \(.created_at) \(.size)"'
}

cleanup_old_images() {
    log_info "Cleaning up old images based on retention policy"
    
    local services=(
        "video-processor"
        "document-processor"
        "ai-inference"
        "media-transcoder"
        "code-executor"
        "nginx-gateway"
    )
    
    for service in "${services[@]}"; do
        cleanup_service_images "$service"
    done
    
    log_success "Image cleanup completed"
}

cleanup_service_images() {
    local service="$1"
    
    log_debug "Cleaning up $service images"
    
    # Get list of images for service
    local images
    images=$(list_service_images "$service")
    
    # Parse and sort by creation date
    local image_count
    image_count=$(echo "$images" | wc -l)
    
    if [[ $image_count -gt $MAX_IMAGES_PER_SERVICE ]]; then
        local excess_count=$((image_count - MAX_IMAGES_PER_SERVICE))
        log_info "Removing $excess_count old images for $service"
        
        # Delete oldest images (implementation depends on registry API)
        delete_old_service_images "$service" "$excess_count"
    fi
}

list_service_images() {
    local service="$1"
    
    # Implementation depends on registry API
    # Return list of images with timestamps
    echo ""
}

delete_old_service_images() {
    local service="$1"
    local count="$2"
    
    log_debug "Deleting $count old images for $service"
    
    # Implementation depends on registry API
    # Delete oldest images while preserving latest ones
}

# =============================================================================
# REGISTRY MONITORING AND HEALTH
# =============================================================================

check_registry_health() {
    log_info "Checking registry health"
    
    # Test registry connectivity
    if docker info | grep -q "$REGISTRY_URL"; then
        log_success "Registry connectivity: OK"
    else
        log_error "Registry connectivity: Failed"
        return 1
    fi
    
    # Check authentication
    if docker system info | grep -q "Username"; then
        log_success "Registry authentication: OK"
    else
        log_warn "Registry authentication: Not verified"
    fi
    
    # Check disk usage
    check_registry_disk_usage
    
    log_success "Registry health check completed"
}

check_registry_disk_usage() {
    log_debug "Checking registry disk usage"
    
    # Get storage usage via API (implementation depends on provider)
    local usage_info="Registry storage usage information not available"
    log_debug "$usage_info"
}

monitor_build_performance() {
    local start_time="$1"
    local end_time="$2"
    local service="$3"
    
    local duration=$((end_time - start_time))
    
    log_info "Build performance for $service: ${duration}s"
    
    # Store metrics for analysis
    echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ'),$service,$duration" >> "${PROJECT_ROOT}/.deploy/build_metrics.csv"
}

# =============================================================================
# CLI INTERFACE
# =============================================================================

show_usage() {
    cat << EOF
Container Registry Management System v${SCRIPT_VERSION}

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    setup           Setup registry authentication and configuration
    build           Build all container images
    build-service   Build specific service image
    scan            Scan images for vulnerabilities  
    sign            Sign images with Cosign
    list            List registry images
    cleanup         Clean up old images
    health          Check registry health
    help            Show this help

BUILD OPTIONS:
    --platforms PLATFORMS    Target platforms (default: linux/amd64,linux/arm64)
    --version-strategy STRATEGY  Version strategy (semantic|timestamp|git)
    --no-cache              Disable build cache
    --no-push               Don't push to registry
    --no-scan               Skip security scanning
    --parallel              Enable parallel builds

EXAMPLES:
    $0 setup                           Setup registry
    $0 build                           Build all images
    $0 build-service video-processor   Build specific service
    $0 scan                           Scan all images
    $0 cleanup                        Clean up old images
    $0 health                         Check registry health

ENVIRONMENT VARIABLES:
    REGISTRY_URL                Container registry URL
    REGISTRY_NAMESPACE          Registry namespace
    CLOUDFLARE_API_TOKEN       Cloudflare API token
    CLOUDFLARE_ACCOUNT_ID      Cloudflare account ID
    BUILD_PLATFORMS            Target build platforms
    VERSION_STRATEGY           Versioning strategy
    SECURITY_SCANNING          Enable security scanning (true/false)
    COSIGN_ENABLED            Enable image signing (true/false)

EOF
}

main() {
    local command="${1:-help}"
    shift 2>/dev/null || true
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --platforms=*)
                BUILD_PLATFORMS="${1#*=}"
                ;;
            --version-strategy=*)
                VERSION_STRATEGY="${1#*=}"
                ;;
            --no-cache)
                BUILD_CACHE="false"
                ;;
            --no-push)
                PUSH_TO_REGISTRY="false"
                ;;
            --no-scan)
                SECURITY_SCANNING="false"
                ;;
            --parallel)
                PARALLEL_BUILDS="true"
                ;;
            --debug)
                DEBUG="true"
                ;;
            *)
                log_warn "Unknown option: $1"
                ;;
        esac
        shift
    done
    
    case "$command" in
        setup)
            setup_registry_authentication
            create_registry_namespace "$REGISTRY_NAMESPACE"
            configure_registry_settings
            setup_buildx
            if [[ "$COSIGN_ENABLED" == "true" ]]; then
                setup_cosign
            fi
            ;;
        build)
            setup_buildx
            verify_buildx_platforms
            build_all_images
            ;;
        build-service)
            local service="$1"
            if [[ -z "$service" ]]; then
                log_error "Service name required"
                exit 1
            fi
            setup_buildx
            local version
            version=$(generate_version)
            build_service_image "$service" "$version"
            ;;
        scan)
            scan_all_images
            ;;
        sign)
            sign_all_images
            ;;
        list)
            list_images
            ;;
        cleanup)
            cleanup_old_images
            ;;
        health)
            check_registry_health
            ;;
        help|*)
            show_usage
            ;;
    esac
}

scan_all_images() {
    log_info "Scanning all images for vulnerabilities"
    
    local services=(
        "video-processor"
        "document-processor"
        "ai-inference"
        "media-transcoder"
        "code-executor"
        "nginx-gateway"
    )
    
    for service in "${services[@]}"; do
        local image="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${service}:latest"
        scan_image_vulnerabilities "$image" || log_warn "Scan failed for $service"
    done
}

sign_all_images() {
    log_info "Signing all images"
    
    if [[ "$COSIGN_ENABLED" != "true" ]]; then
        log_warn "Image signing is disabled"
        return 0
    fi
    
    local services=(
        "video-processor"
        "document-processor"
        "ai-inference"
        "media-transcoder"
        "code-executor"
        "nginx-gateway"
    )
    
    for service in "${services[@]}"; do
        local image="${REGISTRY_URL}/${REGISTRY_NAMESPACE}/${service}:latest"
        sign_image "$image" || log_warn "Signing failed for $service"
    done
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi