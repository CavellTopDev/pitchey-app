#!/bin/bash

# Deploy WebSocket-enabled Creator Dashboard to Production
# This script builds the frontend with production environment variables and deploys to Cloudflare Pages

set -euo pipefail  # Exit on error, undefined variables, pipe failures

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/home/supremeisbeing/pitcheymovie/pitchey_v0.2"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
PAGES_PROJECT="pitchey"
PRODUCTION_URL="https://pitchey.pages.dev"
WEBSOCKET_URL="wss://pitchey-backend-fresh.deno.dev/ws"
API_URL="https://pitchey-api-production.cavelltheleaddev.workers.dev"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if we're in the correct directory
    if [[ ! -d "$PROJECT_ROOT" ]]; then
        error "Project root directory not found: $PROJECT_ROOT"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        error "Wrangler CLI not found. Install with: npm install -g wrangler"
        exit 1
    fi
    
    # Check if logged into Cloudflare
    if ! wrangler whoami &> /dev/null; then
        error "Not logged into Cloudflare. Run: wrangler login"
        exit 1
    fi
    
    # Check if frontend directory exists
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        error "Frontend directory not found: $FRONTEND_DIR"
        exit 1
    fi
    
    success "Prerequisites check completed"
}

# Function to backup current deployment
backup_deployment() {
    log "Creating deployment backup..."
    
    local backup_dir="${PROJECT_ROOT}/deployment-backups/$(date '+%Y%m%d-%H%M%S')"
    mkdir -p "$backup_dir"
    
    # Backup current build if it exists
    if [[ -d "${FRONTEND_DIR}/dist" ]]; then
        cp -r "${FRONTEND_DIR}/dist" "${backup_dir}/dist-backup"
        log "Build backup created at: ${backup_dir}/dist-backup"
    fi
    
    # Save current environment variables
    if [[ -f "${FRONTEND_DIR}/.env.production" ]]; then
        cp "${FRONTEND_DIR}/.env.production" "${backup_dir}/.env.production.backup"
        log "Environment backup created at: ${backup_dir}/.env.production.backup"
    fi
    
    echo "$backup_dir" > "${PROJECT_ROOT}/.last-backup"
    success "Deployment backup completed: $backup_dir"
}

# Function to verify environment configuration
verify_environment() {
    log "Verifying production environment configuration..."
    
    cd "$FRONTEND_DIR"
    
    # Check if .env.production exists
    if [[ ! -f ".env.production" ]]; then
        error "Production environment file not found: ${FRONTEND_DIR}/.env.production"
        exit 1
    fi
    
    # Verify required environment variables
    local env_vars=(
        "VITE_API_URL"
        "VITE_WS_URL"
        "VITE_NODE_ENV"
    )
    
    for var in "${env_vars[@]}"; do
        if ! grep -q "^${var}=" .env.production; then
            error "Missing required environment variable: $var"
            exit 1
        fi
    done
    
    # Verify URLs are pointing to production
    local api_url=$(grep "^VITE_API_URL=" .env.production | cut -d'=' -f2)
    local ws_url=$(grep "^VITE_WS_URL=" .env.production | cut -d'=' -f2)
    
    if [[ "$api_url" != "$API_URL" ]]; then
        error "API URL mismatch. Expected: $API_URL, Found: $api_url"
        exit 1
    fi
    
    if [[ "$ws_url" != "$WEBSOCKET_URL" ]]; then
        error "WebSocket URL mismatch. Expected: $WEBSOCKET_URL, Found: $ws_url"
        exit 1
    fi
    
    success "Environment configuration verified"
}

# Function to build the frontend
build_frontend() {
    log "Building frontend with production configuration..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies if node_modules doesn't exist
    if [[ ! -d "node_modules" ]]; then
        log "Installing dependencies..."
        npm install
    fi
    
    # Clean previous build
    if [[ -d "dist" ]]; then
        log "Cleaning previous build..."
        rm -rf dist
    fi
    
    # Build with production mode
    log "Running production build..."
    NODE_ENV=production npm run build:prod
    
    # Verify build was successful
    if [[ ! -d "dist" ]]; then
        error "Build failed - dist directory not created"
        exit 1
    fi
    
    # Check if index.html exists
    if [[ ! -f "dist/index.html" ]]; then
        error "Build failed - index.html not found in dist"
        exit 1
    fi
    
    # Display build size
    local build_size=$(du -sh dist | cut -f1)
    success "Frontend build completed successfully (Size: $build_size)"
}

# Function to run pre-deployment tests
run_pre_deployment_tests() {
    log "Running pre-deployment tests..."
    
    cd "$FRONTEND_DIR"
    
    # Type check
    log "Running TypeScript type check..."
    npm run type-check
    
    # Lint check
    log "Running ESLint..."
    npm run lint
    
    # Run unit tests if available
    if npm run test:ci --if-present &> /dev/null; then
        log "Running unit tests..."
        npm run test:ci
    else
        warning "No unit tests configured, skipping..."
    fi
    
    success "Pre-deployment tests completed"
}

# Function to deploy to Cloudflare Pages
deploy_to_pages() {
    log "Deploying to Cloudflare Pages..."
    
    cd "$FRONTEND_DIR"
    
    # Deploy using wrangler pages
    local deploy_output
    if deploy_output=$(wrangler pages deploy dist --project-name="$PAGES_PROJECT" 2>&1); then
        success "Deployment to Cloudflare Pages completed"
        
        # Extract deployment URL from output
        local deploy_url=$(echo "$deploy_output" | grep -o 'https://[a-zA-Z0-9-]*\.pitchey\.pages\.dev' | head -n1)
        if [[ -n "$deploy_url" ]]; then
            log "Deployment URL: $deploy_url"
        fi
        
        return 0
    else
        error "Deployment failed:"
        echo "$deploy_output" >&2
        return 1
    fi
}

# Function to verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for deployment to propagate
    log "Waiting for deployment to propagate (30 seconds)..."
    sleep 30
    
    # Test main site accessibility
    log "Testing site accessibility..."
    if curl -f -s "$PRODUCTION_URL" > /dev/null; then
        success "Production site is accessible"
    else
        error "Production site is not accessible"
        return 1
    fi
    
    # Test specific routes
    local test_routes=(
        "/"
        "/creator"
        "/creator/dashboard-test"
    )
    
    for route in "${test_routes[@]}"; do
        log "Testing route: $route"
        if curl -f -s "${PRODUCTION_URL}${route}" > /dev/null; then
            success "Route $route is accessible"
        else
            warning "Route $route may not be accessible"
        fi
    done
    
    success "Deployment verification completed"
}

# Function to test WebSocket connectivity
test_websocket_connectivity() {
    log "Testing WebSocket connectivity..."
    
    # Create a simple WebSocket test script
    local ws_test_script="${PROJECT_ROOT}/test-websocket.js"
    cat > "$ws_test_script" << 'EOF'
const WebSocket = require('ws');

const wsUrl = process.argv[2] || 'wss://pitchey-backend-fresh.deno.dev/ws';
console.log(`Testing WebSocket connection to: ${wsUrl}`);

const ws = new WebSocket(wsUrl);
let connected = false;

const timeout = setTimeout(() => {
    if (!connected) {
        console.error('❌ WebSocket connection timeout');
        process.exit(1);
    }
}, 10000); // 10 second timeout

ws.on('open', function() {
    connected = true;
    clearTimeout(timeout);
    console.log('✅ WebSocket connection established');
    
    // Send a test message
    ws.send(JSON.stringify({
        type: 'ping',
        data: { timestamp: new Date().toISOString() }
    }));
    
    // Close connection after successful test
    setTimeout(() => {
        ws.close();
        console.log('✅ WebSocket test completed successfully');
        process.exit(0);
    }, 2000);
});

ws.on('message', function(data) {
    try {
        const message = JSON.parse(data);
        console.log('📨 Received message:', message.type);
    } catch (e) {
        console.log('📨 Received raw message:', data.toString());
    }
});

ws.on('error', function(error) {
    clearTimeout(timeout);
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', function() {
    if (connected) {
        console.log('🔌 WebSocket connection closed');
    }
});
EOF
    
    # Test WebSocket connectivity (if Node.js is available)
    if command -v node &> /dev/null; then
        # Install ws package if not present
        if [[ ! -d "$PROJECT_ROOT/node_modules/ws" ]]; then
            log "Installing ws package for WebSocket testing..."
            cd "$PROJECT_ROOT"
            npm install ws
        fi
        
        node "$ws_test_script" "$WEBSOCKET_URL" || {
            error "WebSocket connectivity test failed"
            rm -f "$ws_test_script"
            return 1
        }
        
        rm -f "$ws_test_script"
        success "WebSocket connectivity test passed"
    else
        warning "Node.js not available, skipping WebSocket connectivity test"
    fi
}

# Function to rollback deployment
rollback_deployment() {
    log "Rolling back deployment..."
    
    local last_backup_file="${PROJECT_ROOT}/.last-backup"
    if [[ ! -f "$last_backup_file" ]]; then
        error "No backup found for rollback"
        return 1
    fi
    
    local backup_dir=$(cat "$last_backup_file")
    if [[ ! -d "$backup_dir" ]]; then
        error "Backup directory not found: $backup_dir"
        return 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Restore build if backup exists
    if [[ -d "${backup_dir}/dist-backup" ]]; then
        rm -rf dist
        cp -r "${backup_dir}/dist-backup" dist
        log "Build restored from backup"
    fi
    
    # Restore environment if backup exists
    if [[ -f "${backup_dir}/.env.production.backup" ]]; then
        cp "${backup_dir}/.env.production.backup" .env.production
        log "Environment restored from backup"
    fi
    
    # Redeploy the backup
    deploy_to_pages
    
    success "Rollback completed"
}

# Function to display deployment summary
display_summary() {
    log "Deployment Summary:"
    echo "==================="
    echo "Frontend URL: $PRODUCTION_URL"
    echo "WebSocket URL: $WEBSOCKET_URL"
    echo "API URL: $API_URL"
    echo "Dashboard Route: ${PRODUCTION_URL}/creator/dashboard-test"
    echo "Demo Account: alex.creator@demo.com / Demo123"
    echo ""
    echo "Next steps:"
    echo "1. Run verification script: ./verify-dashboard-production.sh"
    echo "2. Monitor WebSocket health: ./monitor-websocket-health.sh"
    echo "3. Test with demo account at: ${PRODUCTION_URL}/creator"
    echo "==================="
}

# Main deployment function
main() {
    log "Starting WebSocket-enabled Creator Dashboard deployment..."
    
    # Create deployment directory if it doesn't exist
    mkdir -p "${PROJECT_ROOT}/deployment-backups"
    
    # Trap errors and provide rollback option
    trap 'error "Deployment failed. Run with --rollback to revert changes."; exit 1' ERR
    
    # Handle command line arguments
    case "${1:-}" in
        --rollback)
            rollback_deployment
            exit 0
            ;;
        --help)
            echo "Usage: $0 [--rollback|--help]"
            echo "  --rollback: Rollback to previous deployment"
            echo "  --help: Show this help message"
            exit 0
            ;;
    esac
    
    # Execute deployment steps
    check_prerequisites
    backup_deployment
    verify_environment
    build_frontend
    run_pre_deployment_tests
    deploy_to_pages
    verify_deployment
    test_websocket_connectivity
    
    success "🎉 WebSocket-enabled Creator Dashboard deployment completed successfully!"
    display_summary
}

# Execute main function with all arguments
main "$@"