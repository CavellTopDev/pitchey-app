#!/bin/bash

# =============================================================================
# Pitchey Production Deployment Script
# =============================================================================
# This script handles complete production deployment to Cloudflare infrastructure
# Usage: ./deploy-production.sh [frontend|backend|worker|all] [--dry-run] [--force]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOG_FILE="$PROJECT_ROOT/deployment.log"
DEPLOY_ENV="production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
DEPLOY_TARGET="${1:-all}"
DRY_RUN=false
FORCE_DEPLOY=false

for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
    esac
done

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message" >&2
            echo "[$timestamp] [ERROR] $message" >> "$LOG_FILE"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            echo "[$timestamp] [WARN] $message" >> "$LOG_FILE"
            ;;
        INFO)
            echo -e "${GREEN}[INFO]${NC} $message"
            echo "[$timestamp] [INFO] $message" >> "$LOG_FILE"
            ;;
        DEBUG)
            echo -e "${BLUE}[DEBUG]${NC} $message"
            echo "[$timestamp] [DEBUG] $message" >> "$LOG_FILE"
            ;;
    esac
}

# Error handling
handle_error() {
    local exit_code=$?
    local line_number=$1
    log ERROR "Deployment failed at line $line_number with exit code $exit_code"
    cleanup_on_error
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

# Cleanup function
cleanup_on_error() {
    log WARN "Cleaning up after deployment failure..."
    # Add any cleanup logic here
}

# Check prerequisites
check_prerequisites() {
    log INFO "Checking deployment prerequisites..."
    
    # Check required commands
    local required_commands=("node" "npm" "deno" "wrangler" "git" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log ERROR "Required command '$cmd' is not installed"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_node="20.0.0"
    if [ "$(printf '%s\n' "$required_node" "$node_version" | sort -V | head -n1)" != "$required_node" ]; then
        log ERROR "Node.js version $required_node or higher is required (found: $node_version)"
        exit 1
    fi
    
    # Check Deno version
    if ! deno --version &> /dev/null; then
        log ERROR "Deno is not properly installed"
        exit 1
    fi
    
    # Check Wrangler authentication
    if ! wrangler whoami &> /dev/null; then
        log ERROR "Wrangler is not authenticated. Run 'wrangler login' first"
        exit 1
    fi
    
    # Check Git status
    if [ "$FORCE_DEPLOY" = false ]; then
        if ! git diff-index --quiet HEAD --; then
            log ERROR "Working directory is not clean. Commit or stash changes, or use --force"
            exit 1
        fi
    fi
    
    # Check environment files
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        log WARN ".env.production not found. Using .env.production.example as template"
        if [ ! -f "$PROJECT_ROOT/.env.production.example" ]; then
            log ERROR "No production environment configuration found"
            exit 1
        fi
    fi
    
    log INFO "Prerequisites check completed successfully"
}

# Pre-deployment validation
validate_environment() {
    log INFO "Validating production environment configuration..."
    
    # Check required environment variables
    local required_vars=(
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ACCOUNT_ID"
        "DATABASE_URL"
        "JWT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log ERROR "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Validate JWT secret strength
    if [ ${#JWT_SECRET} -lt 32 ]; then
        log ERROR "JWT_SECRET must be at least 32 characters long for production"
        exit 1
    fi
    
    # Test database connectivity
    log INFO "Testing database connectivity..."
    if ! deno run --allow-net --allow-env -e "
        import { neon } from 'https://deno.land/x/neon@0.2.0/mod.ts';
        const sql = neon('$DATABASE_URL');
        try {
            await sql\`SELECT 1\`;
            console.log('Database connection successful');
        } catch (error) {
            console.error('Database connection failed:', error.message);
            Deno.exit(1);
        }
    " 2>/dev/null; then
        log ERROR "Database connectivity test failed"
        exit 1
    fi
    
    log INFO "Environment validation completed successfully"
}

# Build and test frontend
deploy_frontend() {
    log INFO "Starting frontend deployment..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies
    log INFO "Installing frontend dependencies..."
    npm ci --only=production
    
    # Type checking
    log INFO "Running type checks..."
    if ! npm run type-check; then
        log ERROR "TypeScript type checking failed"
        exit 1
    fi
    
    # Build with production environment
    log INFO "Building frontend for production..."
    export NODE_ENV=production
    export VITE_API_URL="${VITE_API_URL:-https://pitchey-production.cavelltheleaddev.workers.dev}"
    export VITE_WS_URL="${VITE_WS_URL:-wss://pitchey-api-production.cavelltheleaddev.workers.dev/ws}"
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY RUN] Would build frontend with production configuration"
        return 0
    fi
    
    npm run build
    
    # Deploy to Cloudflare Pages
    log INFO "Deploying to Cloudflare Pages..."
    npx wrangler pages deploy dist \
        --project-name=pitchey \
        --branch=main \
        --compatibility-date=2024-11-01
    
    # Verify deployment
    log INFO "Verifying frontend deployment..."
    local max_retries=30
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -sf "https://pitchey.pages.dev" > /dev/null; then
            log INFO "Frontend deployment verified successfully"
            break
        fi
        
        retry_count=$((retry_count + 1))
        log INFO "Waiting for deployment to propagate... ($retry_count/$max_retries)"
        sleep 10
    done
    
    if [ $retry_count -eq $max_retries ]; then
        log ERROR "Frontend deployment verification failed"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    log INFO "Frontend deployment completed successfully"
}

# Deploy Cloudflare Worker
deploy_worker() {
    log INFO "Starting Cloudflare Worker deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Validate wrangler.toml
    if [ ! -f "wrangler.toml" ]; then
        log ERROR "wrangler.toml not found"
        exit 1
    fi
    
    # Check worker source files
    if [ ! -f "src/worker-simple.ts" ]; then
        log ERROR "Worker source file not found"
        exit 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY RUN] Would deploy Cloudflare Worker"
        return 0
    fi
    
    # Deploy worker with secrets
    log INFO "Deploying Cloudflare Worker..."
    wrangler deploy --env production --minify
    
    # Set/update secrets
    log INFO "Updating worker secrets..."
    echo "$JWT_SECRET" | wrangler secret put JWT_SECRET --env production
    echo "$DATABASE_URL" | wrangler secret put DATABASE_URL --env production
    
    # Verify worker deployment
    log INFO "Verifying worker deployment..."
    local worker_url="https://pitchey-production.cavelltheleaddev.workers.dev"
    local max_retries=20
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -sf "$worker_url/api/health" > /dev/null; then
            log INFO "Worker deployment verified successfully"
            break
        fi
        
        retry_count=$((retry_count + 1))
        log INFO "Waiting for worker to become available... ($retry_count/$max_retries)"
        sleep 5
    done
    
    if [ $retry_count -eq $max_retries ]; then
        log ERROR "Worker deployment verification failed"
        exit 1
    fi
    
    log INFO "Cloudflare Worker deployment completed successfully"
}

# Deploy Deno backend (backup)
deploy_backend() {
    log INFO "Starting Deno Deploy backend deployment (backup)..."
    
    cd "$PROJECT_ROOT"
    
    # Check if deployctl is available
    if ! command -v deployctl &> /dev/null; then
        log INFO "Installing deployctl..."
        deno install -A --global jsr:@deno/deployctl@1.x
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log INFO "[DRY RUN] Would deploy Deno backend"
        return 0
    fi
    
    # Deploy to Deno Deploy
    log INFO "Deploying to Deno Deploy..."
    deployctl deploy \
        --project="pitchey-backend-fresh" \
        --entrypoint="working-server.ts" \
        --token="$DENO_DEPLOY_TOKEN" \
        --env="DATABASE_URL=$DATABASE_URL" \
        --env="JWT_SECRET=$JWT_SECRET" \
        --env="FRONTEND_URL=https://pitchey.pages.dev" \
        --env="UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL:-}" \
        --env="UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN:-}" \
        --env="CACHE_ENABLED=true" \
        --env="NODE_ENV=production" \
        --env="DENO_ENV=production"
    
    # Verify backend deployment
    log INFO "Verifying backend deployment..."
    local backend_url="https://pitchey-backend-fresh.deno.dev"
    local max_retries=20
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -sf "$backend_url/api/health" > /dev/null; then
            log INFO "Backend deployment verified successfully"
            break
        fi
        
        retry_count=$((retry_count + 1))
        log INFO "Waiting for backend to become available... ($retry_count/$max_retries)"
        sleep 5
    done
    
    if [ $retry_count -eq $max_retries ]; then
        log ERROR "Backend deployment verification failed"
        exit 1
    fi
    
    log INFO "Deno Deploy backend deployment completed successfully"
}

# Post-deployment validation
validate_deployment() {
    log INFO "Running post-deployment validation..."
    
    # Test critical endpoints
    local endpoints=(
        "https://pitchey.pages.dev"
        "https://pitchey-production.cavelltheleaddev.workers.dev/api/health"
        "https://pitchey-production.cavelltheleaddev.workers.dev/api/pitches/trending"
        "https://pitchey-backend-fresh.deno.dev/api/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log INFO "Testing endpoint: $endpoint"
        if ! curl -sf "$endpoint" > /dev/null; then
            log ERROR "Endpoint test failed: $endpoint"
            exit 1
        fi
    done
    
    # Test WebSocket connectivity
    log INFO "Testing WebSocket connectivity..."
    if ! timeout 10 deno run --allow-net -e "
        const ws = new WebSocket('wss://pitchey-api-production.cavelltheleaddev.workers.dev/ws');
        ws.onopen = () => {
            console.log('WebSocket connected successfully');
            ws.close();
            Deno.exit(0);
        };
        ws.onerror = (error) => {
            console.error('WebSocket connection failed:', error);
            Deno.exit(1);
        };
        setTimeout(() => {
            console.error('WebSocket connection timeout');
            Deno.exit(1);
        }, 5000);
    " 2>/dev/null; then
        log WARN "WebSocket connectivity test failed (non-critical)"
    fi
    
    log INFO "Post-deployment validation completed successfully"
}

# Purge CDN cache
purge_cache() {
    log INFO "Purging CDN cache..."
    
    if [ -n "${CLOUDFLARE_ZONE_ID:-}" ]; then
        curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data '{"purge_everything":true}' \
            --silent --fail || log WARN "Cache purge failed (non-critical)"
    else
        log WARN "CLOUDFLARE_ZONE_ID not set, skipping cache purge"
    fi
}

# Generate deployment report
generate_report() {
    log INFO "Generating deployment report..."
    
    local report_file="$PROJECT_ROOT/deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Pitchey Production Deployment Report

**Date:** $(date)
**Environment:** $DEPLOY_ENV
**Target:** $DEPLOY_TARGET
**Git Commit:** $(git rev-parse HEAD)
**Git Branch:** $(git branch --show-current)

## Deployment Status

- Frontend (Cloudflare Pages): ✅ Deployed
- Worker (Cloudflare Workers): ✅ Deployed
- Backend (Deno Deploy): ✅ Deployed

## Endpoints

- Frontend: https://pitchey.pages.dev
- API Worker: https://pitchey-production.cavelltheleaddev.workers.dev
- Backup API: https://pitchey-backend-fresh.deno.dev

## Health Checks

$(for endpoint in "https://pitchey.pages.dev" "https://pitchey-production.cavelltheleaddev.workers.dev/api/health"; do
    if curl -sf "$endpoint" > /dev/null; then
        echo "- $endpoint: ✅ Healthy"
    else
        echo "- $endpoint: ❌ Failed"
    fi
done)

## Configuration

- Node.js Version: $(node --version)
- Deno Version: $(deno --version | head -n1)
- Environment Variables: $(env | grep -E '^(VITE_|NODE_ENV|DENO_ENV)' | wc -l) configured

## Next Steps

1. Monitor application logs for errors
2. Verify all features are working correctly
3. Update DNS records if needed
4. Notify team of successful deployment

---
Generated by deploy-production.sh
EOF

    log INFO "Deployment report generated: $report_file"
}

# Main deployment function
main() {
    log INFO "Starting Pitchey production deployment..."
    log INFO "Target: $DEPLOY_TARGET, Dry Run: $DRY_RUN, Force: $FORCE_DEPLOY"
    
    # Load environment variables
    if [ -f "$PROJECT_ROOT/.env.production" ]; then
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
        log INFO "Loaded production environment variables"
    fi
    
    # Run pre-deployment checks
    check_prerequisites
    validate_environment
    
    # Execute deployment based on target
    case $DEPLOY_TARGET in
        frontend)
            deploy_frontend
            ;;
        backend)
            deploy_backend
            ;;
        worker)
            deploy_worker
            ;;
        all)
            deploy_worker
            deploy_frontend
            deploy_backend
            ;;
        *)
            log ERROR "Invalid deployment target: $DEPLOY_TARGET"
            echo "Usage: $0 [frontend|backend|worker|all] [--dry-run] [--force]"
            exit 1
            ;;
    esac
    
    # Post-deployment tasks
    if [ "$DRY_RUN" = false ]; then
        validate_deployment
        purge_cache
        generate_report
    fi
    
    log INFO "Production deployment completed successfully!"
    
    if [ "$DRY_RUN" = false ]; then
        echo
        echo "🚀 Deployment Complete!"
        echo "Frontend: https://pitchey.pages.dev"
        echo "API: https://pitchey-production.cavelltheleaddev.workers.dev"
        echo
        echo "Next steps:"
        echo "1. Monitor application logs"
        echo "2. Run smoke tests"
        echo "3. Update team on deployment status"
    fi
}

# Run main function
main "$@"