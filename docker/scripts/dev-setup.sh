#!/bin/bash

# Development Environment Setup Script
# This script sets up the complete development environment using Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.dev.yml"
PROJECT_NAME="pitchey-dev"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    # Check available disk space (minimum 5GB)
    AVAILABLE_SPACE=$(df . | tail -1 | awk '{print $4}')
    MIN_SPACE=5242880 # 5GB in KB
    
    if [ "$AVAILABLE_SPACE" -lt "$MIN_SPACE" ]; then
        log_warning "Low disk space detected. At least 5GB recommended for development environment."
    fi
    
    log_success "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p docker/nginx
    mkdir -p docker/prometheus
    mkdir -p docker/grafana/provisioning/datasources
    mkdir -p docker/grafana/provisioning/dashboards
    mkdir -p docker/grafana/dashboards
    mkdir -p docker/pgadmin
    mkdir -p scripts
    mkdir -p logs/development
    
    log_success "Directories created"
}

# Create configuration files
create_configs() {
    log_info "Creating configuration files..."
    
    # Create Nginx development configuration
    cat > docker/nginx/dev.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend-dev:5173;
    }
    
    upstream backend {
        server backend-dev:8001;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
        
        # Backend API
        location /api {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # WebSocket endpoint
        location /ws {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
EOF

    # Create Prometheus configuration
    cat > docker/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'pitchey-backend'
    static_configs:
      - targets: ['backend-dev:8001']
    metrics_path: '/metrics'
    scrape_interval: 10s
    
  - job_name: 'pitchey-frontend'
    static_configs:
      - targets: ['frontend-dev:5173']
    metrics_path: '/metrics'
    scrape_interval: 30s
    
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF

    # Create Grafana datasource configuration
    cat > docker/grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

    # Create Grafana dashboard provisioning
    cat > docker/grafana/provisioning/dashboards/pitchey.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'pitchey-dev'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /etc/grafana/dashboards
EOF

    # Create pgAdmin servers configuration
    cat > docker/pgadmin/servers.json << 'EOF'
{
    "Servers": {
        "1": {
            "Name": "Pitchey Development",
            "Group": "Servers",
            "Host": "postgres",
            "Port": 5432,
            "MaintenanceDB": "pitchey_dev",
            "Username": "pitchey",
            "SSLMode": "prefer",
            "SSLCert": "<STORAGE_DIR>/.postgresql/postgresql.crt",
            "SSLKey": "<STORAGE_DIR>/.postgresql/postgresql.key",
            "SSLCompression": 0,
            "Timeout": 10,
            "UseSSHTunnel": 0,
            "TunnelPort": "22",
            "TunnelAuthentication": 0
        }
    }
}
EOF

    # Create database initialization script
    cat > scripts/init-db.sql << 'EOF'
-- Development database initialization
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create development user with appropriate permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pitchey_dev') THEN
        CREATE ROLE pitchey_dev LOGIN PASSWORD 'pitchey_dev_password';
    END IF;
END
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE pitchey_dev TO pitchey_dev;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pitchey_dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pitchey_dev;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pitchey_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pitchey_dev;
EOF

    # Create Redis configuration
    cat > docker/redis.conf << 'EOF'
# Redis development configuration
bind 0.0.0.0
port 6379
requirepass pitchey_dev_redis

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence (for development)
save 900 1
save 300 10
save 60 10000

# Logging
loglevel notice
logfile ""

# Development settings
timeout 300
tcp-keepalive 300
EOF

    log_success "Configuration files created"
}

# Create environment file
create_env_file() {
    log_info "Creating environment file..."
    
    cat > .env.development << 'EOF'
# Development Environment Variables
NODE_ENV=development
COMPOSE_PROJECT_NAME=pitchey-dev

# Database
DATABASE_URL=postgresql://pitchey:pitchey_dev_password@localhost:5432/pitchey_dev
POSTGRES_DB=pitchey_dev
POSTGRES_USER=pitchey
POSTGRES_PASSWORD=pitchey_dev_password

# Redis
REDIS_URL=redis://:pitchey_dev_redis@localhost:6379
UPSTASH_REDIS_REST_URL=redis://:pitchey_dev_redis@localhost:6379
UPSTASH_REDIS_REST_TOKEN=dev_token

# API Configuration
JWT_SECRET=development_jwt_secret_key_not_for_production
API_URL=http://localhost:8001
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Object Storage (MinIO)
AWS_ENDPOINT=http://localhost:9000
AWS_ACCESS_KEY_ID=pitchey_dev
AWS_SECRET_ACCESS_KEY=pitchey_dev_minio_password
AWS_BUCKET_NAME=pitchey-uploads-dev

# Email (MailHog)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=dev@pitchey.com

# Monitoring
LOG_LEVEL=debug
ENABLE_DEBUG=true
ENABLE_MONITORING=true

# Development flags
HOT_RELOAD=true
AUTO_RELOAD=true
ENABLE_DEBUG_TOOLS=true
MOCK_EXTERNAL_SERVICES=true
EOF

    log_success "Environment file created"
}

# Start the development environment
start_environment() {
    log_info "Starting development environment..."
    
    # Stop any existing containers
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down --remove-orphans
    
    # Build and start services
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d --build
    
    log_success "Development environment started"
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    # Wait for database
    log_info "Waiting for PostgreSQL..."
    timeout 60s bash -c 'until docker-compose -f '$COMPOSE_FILE' -p '$PROJECT_NAME' exec -T postgres pg_isready -U pitchey -d pitchey_dev; do sleep 2; done'
    
    # Wait for Redis
    log_info "Waiting for Redis..."
    timeout 60s bash -c 'until docker-compose -f '$COMPOSE_FILE' -p '$PROJECT_NAME' exec -T redis redis-cli ping; do sleep 2; done'
    
    # Wait for backend
    log_info "Waiting for backend..."
    timeout 120s bash -c 'until curl -f http://localhost:8001/health; do sleep 5; done'
    
    # Wait for frontend
    log_info "Waiting for frontend..."
    timeout 60s bash -c 'until curl -f http://localhost:5173; do sleep 5; done'
    
    log_success "All services are ready"
}

# Show service information
show_services() {
    log_success "Development environment is ready!"
    echo ""
    echo "🚀 Services:"
    echo "   Frontend:     http://localhost:5173"
    echo "   Backend API:  http://localhost:8001"
    echo "   Nginx Proxy:  http://localhost:80"
    echo ""
    echo "🛠  Admin Tools:"
    echo "   pgAdmin:      http://localhost:8080 (dev@pitchey.com / pitchey_dev_admin)"
    echo "   Redis Insight: http://localhost:8081"
    echo "   MinIO Console: http://localhost:9001 (pitchey_dev / pitchey_dev_minio_password)"
    echo "   MailHog:      http://localhost:8025"
    echo ""
    echo "📊 Monitoring:"
    echo "   Prometheus:   http://localhost:9090"
    echo "   Grafana:      http://localhost:3000 (admin / pitchey_dev_grafana)"
    echo ""
    echo "🔧 Useful commands:"
    echo "   Stop:         docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down"
    echo "   Restart:      docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME restart"
    echo "   Logs:         docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f"
    echo "   Status:       docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps"
    echo ""
}

# Main execution
main() {
    echo "🐳 Pitchey Development Environment Setup"
    echo "========================================"
    
    check_prerequisites
    create_directories
    create_configs
    create_env_file
    start_environment
    wait_for_services
    show_services
}

# Handle script arguments
case "${1:-setup}" in
    setup)
        main
        ;;
    start)
        log_info "Starting development environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
        wait_for_services
        show_services
        ;;
    stop)
        log_info "Stopping development environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
        log_success "Development environment stopped"
        ;;
    restart)
        log_info "Restarting development environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME restart
        wait_for_services
        log_success "Development environment restarted"
        ;;
    logs)
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
        ;;
    status)
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
        ;;
    clean)
        log_warning "Cleaning development environment (this will remove all data)..."
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v --remove-orphans
            docker system prune -f
            log_success "Development environment cleaned"
        else
            log_info "Cleanup cancelled"
        fi
        ;;
    *)
        echo "Usage: $0 {setup|start|stop|restart|logs|status|clean}"
        echo ""
        echo "Commands:"
        echo "  setup   - Initial setup and start (default)"
        echo "  start   - Start the development environment"
        echo "  stop    - Stop the development environment"
        echo "  restart - Restart the development environment"
        echo "  logs    - Show logs from all services"
        echo "  status  - Show status of all services"
        echo "  clean   - Stop and remove all containers and volumes"
        exit 1
        ;;
esac