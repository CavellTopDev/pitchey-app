#!/bin/bash

# Deploy Production Monitoring Stack
# Comprehensive deployment script for Pitchey monitoring infrastructure

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$MONITORING_DIR/.env.monitoring"
STACK_FILE="$MONITORING_DIR/production-monitoring-stack.yml"
BACKUP_DIR="$MONITORING_DIR/backups"

echo -e "${BLUE}🚀 Deploying Pitchey Production Monitoring Stack${NC}"
echo "================================================"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${CYAN}📋 Checking prerequisites...${NC}"
    
    local missing_tools=()
    
    # Check required tools
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    command -v docker-compose >/dev/null 2>&1 || missing_tools+=("docker-compose")
    command -v jq >/dev/null 2>&1 || missing_tools+=("jq")
    command -v curl >/dev/null 2>&1 || missing_tools+=("curl")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required tools: ${missing_tools[*]}${NC}"
        echo "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        echo "Please start Docker and try again."
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Create environment file if it doesn't exist
create_env_file() {
    echo -e "${CYAN}📝 Setting up environment configuration...${NC}"
    
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" <<EOF
# Monitoring Stack Environment Configuration
# Generated: $(date)

# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=admin123
GRAFANA_SECRET_KEY=$(openssl rand -base64 32)

# Cloudflare API Configuration
# Get these from Cloudflare dashboard
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
CLOUDFLARE_ACCOUNT_ID=e16d3bf549153de23459a6c6a06a431b

# Worker Configuration
WORKER_NAME=pitchey-production

# Alert Configuration
ALERT_EMAIL=devops@pitchey.app
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK

# Database Configuration (for monitoring the monitoring)
POSTGRES_DB=monitoring
POSTGRES_USER=prometheus
POSTGRES_PASSWORD=$(openssl rand -base64 16)

# Security
PROMETHEUS_WEB_CONFIG_FILE=/etc/prometheus/web.yml
ALERTMANAGER_WEB_CONFIG_FILE=/etc/alertmanager/web.yml
EOF
        
        echo -e "${GREEN}✅ Environment file created: $ENV_FILE${NC}"
        echo -e "${YELLOW}⚠️  Please edit $ENV_FILE with your actual configuration${NC}"
        echo ""
        echo "Required updates:"
        echo "  - CLOUDFLARE_API_TOKEN: Get from Cloudflare dashboard"
        echo "  - CLOUDFLARE_ZONE_ID: Get from Cloudflare dashboard"
        echo "  - ALERT_EMAIL: Your email for alerts"
        echo "  - SLACK_WEBHOOK_URL: Your Slack webhook (optional)"
        echo ""
        
        read -p "Press Enter after updating the configuration file..."
    else
        echo -e "${GREEN}✅ Environment file exists: $ENV_FILE${NC}"
    fi
}

# Validate configuration
validate_configuration() {
    echo -e "${CYAN}🔍 Validating configuration...${NC}"
    
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
        return 1
    fi
    
    source "$ENV_FILE"
    
    local issues=()
    
    # Check critical configuration
    [ "$CLOUDFLARE_API_TOKEN" = "your_api_token_here" ] && issues+=("CLOUDFLARE_API_TOKEN not configured")
    [ "$CLOUDFLARE_ZONE_ID" = "your_zone_id_here" ] && issues+=("CLOUDFLARE_ZONE_ID not configured")
    [ -z "${GRAFANA_ADMIN_PASSWORD:-}" ] && issues+=("GRAFANA_ADMIN_PASSWORD not set")
    
    if [ ${#issues[@]} -ne 0 ]; then
        echo -e "${RED}❌ Configuration issues found:${NC}"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        return 1
    fi
    
    echo -e "${GREEN}✅ Configuration validated${NC}"
    return 0
}

# Create required directories
setup_directories() {
    echo -e "${CYAN}📁 Setting up directories...${NC}"
    
    local dirs=(
        "$MONITORING_DIR/data/prometheus"
        "$MONITORING_DIR/data/grafana"
        "$MONITORING_DIR/data/alertmanager"
        "$MONITORING_DIR/data/loki"
        "$MONITORING_DIR/logs"
        "$BACKUP_DIR"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            echo "  Created: $dir"
        fi
    done
    
    # Set proper permissions
    chmod 755 "$MONITORING_DIR/data"/*
    
    echo -e "${GREEN}✅ Directories set up${NC}"
}

# Build custom images
build_images() {
    echo -e "${CYAN}🏗️  Building custom images...${NC}"
    
    cd "$MONITORING_DIR"
    
    # Build Cloudflare exporter
    if [ -d "cloudflare-exporter" ]; then
        echo "Building Cloudflare exporter..."
        docker build -t pitchey/cloudflare-exporter:latest cloudflare-exporter/
        echo -e "${GREEN}✅ Cloudflare exporter built${NC}"
    fi
    
    # Build any other custom images here
    
    echo -e "${GREEN}✅ All images built${NC}"
}

# Deploy monitoring stack
deploy_stack() {
    echo -e "${CYAN}🚀 Deploying monitoring stack...${NC}"
    
    cd "$MONITORING_DIR"
    
    # Create backup if stack already exists
    if docker-compose -f "$STACK_FILE" ps -q 2>/dev/null | grep -q .; then
        echo "Creating backup of existing stack..."
        create_backup
    fi
    
    # Deploy the stack
    echo "Starting monitoring services..."
    docker-compose -f "$STACK_FILE" --env-file "$ENV_FILE" up -d
    
    # Wait for services to start
    echo "Waiting for services to start..."
    sleep 30
    
    echo -e "${GREEN}✅ Monitoring stack deployed${NC}"
}

# Verify deployment
verify_deployment() {
    echo -e "${CYAN}🔍 Verifying deployment...${NC}"
    
    local services=(
        "prometheus:9090"
        "grafana:3000"
        "alertmanager:9093"
        "loki:3100"
        "node-exporter:9100"
        "blackbox-exporter:9115"
        "cloudflare-exporter:9199"
    )
    
    local failed_services=()
    
    for service in "${services[@]}"; do
        local name=$(echo "$service" | cut -d: -f1)
        local port=$(echo "$service" | cut -d: -f2)
        
        echo -n "  Checking $name..."
        
        if curl -s "http://localhost:$port" >/dev/null 2>&1 || 
           curl -s "http://localhost:$port/health" >/dev/null 2>&1 || 
           curl -s "http://localhost:$port/metrics" >/dev/null 2>&1; then
            echo -e " ${GREEN}✅${NC}"
        else
            echo -e " ${RED}❌${NC}"
            failed_services+=("$name")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All services are healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed services: ${failed_services[*]}${NC}"
        return 1
    fi
}

# Create backup
create_backup() {
    echo -e "${CYAN}💾 Creating backup...${NC}"
    
    local backup_name="monitoring_backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup configuration files
    cp -r "$MONITORING_DIR"/{prometheus,grafana,alertmanager,loki,blackbox} "$backup_path/" 2>/dev/null || true
    
    # Backup data (if small enough)
    if [ -d "$MONITORING_DIR/data" ]; then
        du -sm "$MONITORING_DIR/data" | awk '{if ($1 < 100) exit 0; else exit 1}' && {
            cp -r "$MONITORING_DIR/data" "$backup_path/"
        } || {
            echo "  Data directory too large, skipping data backup"
        }
    fi
    
    # Backup environment file
    cp "$ENV_FILE" "$backup_path/" 2>/dev/null || true
    
    # Create archive
    tar -czf "${backup_path}.tar.gz" -C "$BACKUP_DIR" "$backup_name"
    rm -rf "$backup_path"
    
    echo -e "${GREEN}✅ Backup created: ${backup_path}.tar.gz${NC}"
}

# Setup Grafana dashboards
setup_grafana() {
    echo -e "${CYAN}📊 Setting up Grafana dashboards...${NC}"
    
    # Wait for Grafana to be ready
    echo "Waiting for Grafana to be ready..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
            break
        fi
        sleep 2
        retries=$((retries - 1))
    done
    
    if [ $retries -eq 0 ]; then
        echo -e "${RED}❌ Grafana not ready after 60 seconds${NC}"
        return 1
    fi
    
    source "$ENV_FILE"
    
    # Import dashboards
    local dashboard_dir="$MONITORING_DIR/grafana-dashboards"
    if [ -d "$dashboard_dir" ]; then
        for dashboard_file in "$dashboard_dir"/*.json; do
            if [ -f "$dashboard_file" ]; then
                echo "  Importing $(basename "$dashboard_file")..."
                
                curl -X POST "http://admin:${GRAFANA_ADMIN_PASSWORD}@localhost:3000/api/dashboards/db" \
                    -H "Content-Type: application/json" \
                    -d @"$dashboard_file" >/dev/null 2>&1 && {
                    echo -e "    ${GREEN}✅ Imported${NC}"
                } || {
                    echo -e "    ${YELLOW}⚠️  Import failed or already exists${NC}"
                }
            fi
        done
    fi
    
    echo -e "${GREEN}✅ Grafana setup complete${NC}"
}

# Setup alerts
setup_alerts() {
    echo -e "${CYAN}🚨 Setting up alerts...${NC}"
    
    # Test AlertManager configuration
    if docker-compose -f "$STACK_FILE" exec -T alertmanager amtool check-config /etc/alertmanager/alertmanager.yml >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ AlertManager configuration valid${NC}"
    else
        echo -e "  ${YELLOW}⚠️  AlertManager configuration issues detected${NC}"
    fi
    
    # Test Prometheus rules
    if docker-compose -f "$STACK_FILE" exec -T prometheus promtool check rules /etc/prometheus/rules/*.yml >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Prometheus rules valid${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Prometheus rules issues detected${NC}"
    fi
    
    echo -e "${GREEN}✅ Alerts setup complete${NC}"
}

# Display access information
show_access_info() {
    echo ""
    echo -e "${GREEN}🎉 Monitoring Stack Deployed Successfully!${NC}"
    echo "================================================"
    echo ""
    echo "Service Access URLs:"
    echo "────────────────────────────────────────────────"
    
    source "$ENV_FILE"
    
    echo -e "📊 ${CYAN}Grafana:${NC}         http://localhost:3000"
    echo -e "   Username: admin"
    echo -e "   Password: $GRAFANA_ADMIN_PASSWORD"
    echo ""
    echo -e "📈 ${CYAN}Prometheus:${NC}      http://localhost:9090"
    echo -e "🚨 ${CYAN}AlertManager:${NC}    http://localhost:9093"
    echo -e "📝 ${CYAN}Loki:${NC}            http://localhost:3100"
    echo ""
    echo -e "🔍 ${CYAN}BlackBox:${NC}        http://localhost:9115"
    echo -e "☁️  ${CYAN}CF Exporter:${NC}     http://localhost:9199"
    echo -e "💻 ${CYAN}Node Exporter:${NC}   http://localhost:9100"
    echo ""
    echo "Management Commands:"
    echo "────────────────────────────────────────────────"
    echo "  View logs:     docker-compose -f $STACK_FILE logs -f [service]"
    echo "  Restart:       docker-compose -f $STACK_FILE restart [service]"
    echo "  Stop all:      docker-compose -f $STACK_FILE down"
    echo "  Update:        docker-compose -f $STACK_FILE pull && docker-compose -f $STACK_FILE up -d"
    echo ""
    echo "Health Checks:"
    echo "────────────────────────────────────────────────"
    echo "  Quick health:  ./automated-health-monitor.sh"
    echo "  Full test:     ./performance-baseline-tracker.sh test"
    echo ""
}

# Main deployment function
main() {
    local action="${1:-deploy}"
    
    case "$action" in
        "deploy")
            check_prerequisites
            create_env_file
            validate_configuration || {
                echo -e "${RED}❌ Configuration validation failed${NC}"
                echo "Please fix the issues and try again."
                exit 1
            }
            setup_directories
            build_images
            deploy_stack
            sleep 10  # Give services time to start
            verify_deployment || {
                echo -e "${YELLOW}⚠️  Some services failed health checks${NC}"
                echo "Check the logs: docker-compose -f $STACK_FILE logs"
            }
            setup_grafana
            setup_alerts
            show_access_info
            ;;
        "backup")
            create_backup
            ;;
        "verify")
            verify_deployment
            ;;
        "restart")
            echo -e "${CYAN}🔄 Restarting monitoring stack...${NC}"
            cd "$MONITORING_DIR"
            docker-compose -f "$STACK_FILE" restart
            verify_deployment
            ;;
        "stop")
            echo -e "${CYAN}⏹️  Stopping monitoring stack...${NC}"
            cd "$MONITORING_DIR"
            docker-compose -f "$STACK_FILE" down
            echo -e "${GREEN}✅ Monitoring stack stopped${NC}"
            ;;
        "logs")
            local service="${2:-}"
            cd "$MONITORING_DIR"
            if [ -n "$service" ]; then
                docker-compose -f "$STACK_FILE" logs -f "$service"
            else
                docker-compose -f "$STACK_FILE" logs -f
            fi
            ;;
        *)
            echo "Usage: $0 [deploy|backup|verify|restart|stop|logs [service]]"
            echo ""
            echo "  deploy   - Full deployment (default)"
            echo "  backup   - Create backup of current configuration"
            echo "  verify   - Verify all services are healthy"
            echo "  restart  - Restart all services"
            echo "  stop     - Stop all services"
            echo "  logs     - View logs (optionally for specific service)"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
