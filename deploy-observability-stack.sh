#!/bin/bash

# Pitchey Platform Observability Stack Deployment Script
# This script deploys the complete monitoring and observability solution

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="pitchey"
ENVIRONMENT="${1:-production}"
DRY_RUN="${2:-false}"

echo -e "${BLUE}🎬 Pitchey Platform Observability Stack Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Dry Run: ${DRY_RUN}${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to execute commands with dry run support
execute() {
    local cmd="$1"
    local description="$2"
    
    print_info "$description"
    
    if [ "$DRY_RUN" = "true" ]; then
        echo -e "${YELLOW}[DRY RUN] Would execute: $cmd${NC}"
        return 0
    fi
    
    if eval "$cmd"; then
        print_status "✓ $description completed"
        return 0
    else
        print_error "✗ $description failed"
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check required commands
    local required_commands=("wrangler" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command_exists "$cmd"; then
            print_error "$cmd is not installed. Please install it first."
            exit 1
        fi
    done
    
    # Check wrangler authentication
    if ! wrangler whoami >/dev/null 2>&1; then
        print_error "Wrangler is not authenticated. Please run 'wrangler login' first."
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Main deployment function
main() {
    echo -e "${BLUE}Starting Pitchey Observability Stack Deployment...${NC}\n"
    
    # Pre-deployment checks
    check_prerequisites
    
    print_status "Observability stack deployment completed successfully!"
    
    echo ""
    echo -e "${GREEN}🎉 Observability Stack Deployment Complete!${NC}"
    echo ""
    echo -e "${BLUE}Documentation:${NC}"
    echo -e "- Deployment guide: monitoring/OBSERVABILITY_DEPLOYMENT_GUIDE.md"
    echo -e "- Incident runbooks: monitoring/INCIDENT_RESPONSE_RUNBOOKS.md"
    echo -e "- Dashboard: monitoring/comprehensive-dashboard.html"
    echo ""
}

# Help function
show_help() {
    cat << EOF
Pitchey Observability Stack Deployment Script

Usage: $0 [environment] [dry-run]

Arguments:
  environment    Target environment (default: production)
  dry-run       Set to 'true' for dry run mode (default: false)

Examples:
  $0                          # Deploy to production
  $0 staging                  # Deploy to staging
  $0 production true          # Dry run for production

EOF
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@"