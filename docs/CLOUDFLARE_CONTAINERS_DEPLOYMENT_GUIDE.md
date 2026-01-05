# Pitchey Cloudflare Containers Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Docker Deployment](#docker-deployment)
5. [Podman Deployment](#podman-deployment)
6. [Staging Environment Setup](#staging-environment-setup)
7. [Production Deployment](#production-deployment)
8. [CI/CD Pipeline Configuration](#cicd-pipeline-configuration)
9. [Environment Configuration](#environment-configuration)
10. [Troubleshooting](#troubleshooting)

## Overview

This comprehensive deployment guide covers all aspects of deploying the Pitchey Cloudflare Containers system across different environments. The system supports both Docker and Podman runtimes for maximum flexibility.

### Deployment Architecture

```
Development → Staging → Production
     ↓           ↓          ↓
   Local       Test      Global
 Container    Deploy     Deploy
   Stack      Stack      Stack
```

### Key Features

- **Multi-Runtime Support**: Docker and Podman compatibility
- **Environment Isolation**: Separate configurations for each environment
- **Auto-Scaling**: Production auto-scaling with cost optimization
- **Health Monitoring**: Comprehensive health checks and monitoring
- **Security Hardening**: Container security best practices

## Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 4 cores (8 recommended for production)
- **Memory**: 8GB RAM (16GB recommended for production)
- **Storage**: 50GB available disk space
- **Network**: Stable internet connection with 100Mbps+ bandwidth

#### Software Requirements
- **Operating System**: Ubuntu 20.04+ / RHEL 8+ / macOS 12+
- **Container Runtime**: Docker 24.0+ or Podman 4.0+
- **Node.js**: v18.0+ (for build tools)
- **Git**: v2.30+
- **curl**: Latest version

### Account Requirements

#### Cloudflare Accounts
- **Cloudflare Account**: With Workers and Pages access
- **Cloudflare API Token**: With appropriate permissions
- **Domain**: For custom container endpoints (optional)

#### Database Access
- **Neon PostgreSQL**: Production database connection
- **Upstash Redis**: Caching layer access

### Pre-deployment Checklist

```bash
# Verify system requirements
./scripts/verify-prerequisites.sh

# Check account access
./scripts/check-cloudflare-access.sh

# Validate configuration
./scripts/validate-config.sh
```

## Local Development Setup

### 1. Repository Setup

```bash
# Clone repository
git clone https://github.com/your-org/pitchey.git
cd pitchey_v0.2

# Install dependencies
npm install
deno install --allow-scripts=npm:esbuild

# Setup environment files
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 2. Container Runtime Selection

#### Option A: Docker Setup (Recommended)
```bash
# Install Docker (Ubuntu)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

#### Option B: Podman Setup (RHEL/Fedora)
```bash
# Install Podman (RHEL/Fedora)
sudo dnf install podman podman-compose
# OR for Ubuntu
sudo apt-get install podman podman-compose

# Configure rootless Podman
./scripts/setup-podman-rootless.sh

# Verify installation
podman --version
podman-compose --version
```

### 3. Local Environment Configuration

#### Docker Development Stack
```bash
# Start local development stack
docker-compose -f docker-compose.yml up -d

# Verify services
docker-compose ps
docker-compose logs -f
```

#### Podman Development Stack
```bash
# Start local development stack
podman-compose -f podman-compose.yml up -d

# Verify services
podman-compose ps
podman-compose logs -f
```

### 4. Development Services

The local development stack includes:

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Database |
| Redis | 6380 | Caching |
| MinIO | 9000/9001 | S3-compatible storage |
| Adminer | 8080 | Database management |

### 5. Local Container Testing

```bash
# Build all containers locally
./scripts/build-containers.sh

# Test individual containers
docker run --rm -p 8080:8080 pitchey/video-processor:latest
docker run --rm -p 8081:8080 pitchey/document-processor:latest
docker run --rm -p 8082:8080 pitchey/ai-inference:latest
docker run --rm -p 8083:8080 pitchey/media-transcoder:latest
docker run --rm -p 8084:8080 pitchey/code-executor:latest

# Run integration tests
npm run test:containers
```

## Docker Deployment

### 1. Multi-Platform Build Setup

```bash
# Setup buildx for multi-platform builds
docker buildx create --name multiplatform --use
docker buildx inspect --bootstrap

# Verify platform support
docker buildx ls
```

### 2. Container Image Building

#### Build All Services
```bash
#!/bin/bash
# scripts/build-docker-containers.sh

set -e

REGISTRY=${REGISTRY:-"ghcr.io/your-org/pitchey"}
VERSION=${VERSION:-$(git rev-parse --short HEAD)}
PLATFORMS="linux/amd64,linux/arm64"

# Define container services
declare -A SERVICES=(
    ["video-processor"]="src/containers/video-processor"
    ["document-processor"]="src/containers/document-processor"
    ["ai-inference"]="src/containers/ai-inference"
    ["media-transcoder"]="src/containers/media-transcoder"
    ["code-executor"]="src/containers/code-executor"
)

echo "Building container images for platforms: $PLATFORMS"

for service in "${!SERVICES[@]}"; do
    echo "Building $service..."
    
    # Generate Dockerfile if not exists
    if [[ ! -f "Dockerfile.$service" ]]; then
        ./scripts/generate-dockerfile.sh "$service" > "Dockerfile.$service"
    fi
    
    # Build and push multi-platform image
    docker buildx build \
        --platform "$PLATFORMS" \
        --tag "$REGISTRY/$service:$VERSION" \
        --tag "$REGISTRY/$service:latest" \
        --file "Dockerfile.$service" \
        --context "${SERVICES[$service]}" \
        --push \
        --build-arg BUILD_VERSION="$VERSION" \
        --build-arg BUILD_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --label "org.opencontainers.image.source=https://github.com/your-org/pitchey" \
        --label "org.opencontainers.image.version=$VERSION" \
        --label "pitchey.service=$service" \
        .
        
    echo "✅ Built $service"
done

echo "🎉 All containers built successfully!"
```

### 3. Docker Compose Production Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Video Processing Service
  video-processor:
    image: ghcr.io/your-org/pitchey/video-processor:latest
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      - NODE_ENV=production
      - MAX_CONCURRENT_JOBS=3
      - MEMORY_LIMIT=1536M
      - FFMPEG_THREADS=2
    volumes:
      - video_cache:/tmp/video-processing
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # Document Processing Service  
  document-processor:
    image: ghcr.io/your-org/pitchey/document-processor:latest
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M
    environment:
      - NODE_ENV=production
      - MAX_CONCURRENT_JOBS=5
      - OCR_QUALITY=high
    volumes:
      - doc_cache:/tmp/doc-processing
    ports:
      - "8081:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # AI Inference Service
  ai-inference:
    image: ghcr.io/your-org/pitchey/ai-inference:latest
    restart: unless-stopped
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '1'
          memory: 2G
    environment:
      - NODE_ENV=production
      - TENSORFLOW_THREADS=4
      - MODEL_CACHE_SIZE=2G
    volumes:
      - ai_models:/app/models
      - ai_cache:/tmp/ai-processing
    ports:
      - "8082:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 60s
      timeout: 30s
      retries: 3
      start_period: 120s

  # Media Transcoding Service
  media-transcoder:
    image: ghcr.io/your-org/pitchey/media-transcoder:latest
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 1.5G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      - NODE_ENV=production
      - AUDIO_QUALITY=high
      - STREAMING_OPTIMIZATION=true
    volumes:
      - media_cache:/tmp/media-processing
    ports:
      - "8083:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Code Execution Service
  code-executor:
    image: ghcr.io/your-org/pitchey/code-executor:latest
    restart: unless-stopped
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M
    environment:
      - NODE_ENV=production
      - EXECUTION_TIMEOUT=30
      - MEMORY_LIMIT=256M
      - NETWORK_ACCESS=false
    security_opt:
      - no-new-privileges:true
      - seccomp:unconfined
    volumes:
      - code_cache:/tmp/code-execution
    ports:
      - "8084:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      retries: 3

  # Nginx Load Balancer
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - video-processor
      - document-processor
      - ai-inference
      - media-transcoder
      - code-executor

volumes:
  video_cache:
    driver: local
  doc_cache:
    driver: local
  ai_models:
    driver: local
  ai_cache:
    driver: local
  media_cache:
    driver: local
  code_cache:
    driver: local

networks:
  default:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 4. Production Deployment Commands

```bash
# Deploy production stack
docker-compose -f docker-compose.prod.yml up -d

# Scale specific services
docker-compose -f docker-compose.prod.yml up -d --scale video-processor=4

# Rolling updates
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --remove-orphans

# Monitor deployment
docker-compose -f docker-compose.prod.yml logs -f
docker-compose -f docker-compose.prod.yml ps
```

## Podman Deployment

### 1. Rootless Podman Setup

```bash
#!/bin/bash
# scripts/setup-podman-rootless.sh

set -e

echo "Setting up rootless Podman..."

# Add subuid/subgid mappings
sudo usermod --add-subuids 10000-75535 $USER
sudo usermod --add-subgids 10000-75535 $USER

# Create config directories
mkdir -p ~/.config/containers
mkdir -p ~/.local/share/containers/storage

# Configure registries
cat > ~/.config/containers/registries.conf << 'EOF'
[registries.search]
registries = ['docker.io', 'quay.io', 'ghcr.io']

[registries.insecure]
registries = []

[registries.block]
registries = []
EOF

# Configure storage
cat > ~/.config/containers/storage.conf << 'EOF'
[storage]
driver = "overlay"
runroot = "/run/user/$UID/containers"
graphroot = "$HOME/.local/share/containers/storage"

[storage.options]
additionalimagestores = []

[storage.options.overlay]
mountopt = "nodev,metacopy=on"
EOF

# Test configuration
podman info --debug

echo "✅ Rootless Podman configured successfully"
```

### 2. Podman Container Building

```bash
#!/bin/bash
# scripts/build-podman-containers.sh

set -e

REGISTRY=${REGISTRY:-"ghcr.io/your-org/pitchey"}
VERSION=${VERSION:-$(git rev-parse --short HEAD)}

# Build function
build_container() {
    local service=$1
    local context=$2
    
    echo "Building $service with Podman..."
    
    # Generate Dockerfile
    if [[ ! -f "Dockerfile.$service" ]]; then
        ./scripts/generate-dockerfile.sh "$service" > "Dockerfile.$service"
    fi
    
    # Build for multiple architectures
    for arch in amd64 arm64; do
        echo "Building $service for $arch..."
        
        podman build \
            --platform "linux/$arch" \
            --tag "$REGISTRY/$service:$VERSION-$arch" \
            --file "Dockerfile.$service" \
            --build-arg BUILD_VERSION="$VERSION" \
            --build-arg BUILD_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            "$context"
    done
    
    # Create manifest
    podman manifest create "$REGISTRY/$service:$VERSION"
    podman manifest add "$REGISTRY/$service:$VERSION" "$REGISTRY/$service:$VERSION-amd64"
    podman manifest add "$REGISTRY/$service:$VERSION" "$REGISTRY/$service:$VERSION-arm64"
    
    # Tag as latest
    podman tag "$REGISTRY/$service:$VERSION" "$REGISTRY/$service:latest"
    
    echo "✅ Built $service"
}

# Build all services
build_container "video-processor" "src/containers/video-processor"
build_container "document-processor" "src/containers/document-processor"
build_container "ai-inference" "src/containers/ai-inference"
build_container "media-transcoder" "src/containers/media-transcoder"
build_container "code-executor" "src/containers/code-executor"

echo "🎉 All Podman containers built successfully!"
```

### 3. Podman Systemd Services

```ini
# ~/.config/systemd/user/pitchey-containers.service
[Unit]
Description=Pitchey Container Services
Requires=podman.socket
After=podman.socket

[Service]
Type=notify
ExecStart=/usr/bin/podman-compose -f %h/pitchey/podman-compose.prod.yml up
ExecStop=/usr/bin/podman-compose -f %h/pitchey/podman-compose.prod.yml down
ExecReload=/usr/bin/podman-compose -f %h/pitchey/podman-compose.prod.yml restart
Restart=on-failure
RestartSec=30
TimeoutStartSec=300
TimeoutStopSec=120

[Install]
WantedBy=default.target
```

```bash
# Enable and start services
systemctl --user daemon-reload
systemctl --user enable pitchey-containers.service
systemctl --user start pitchey-containers.service

# Check status
systemctl --user status pitchey-containers.service
journalctl --user -u pitchey-containers.service -f
```

## Staging Environment Setup

### 1. Staging Infrastructure

```yaml
# staging/docker-compose.staging.yml
version: '3.8'

services:
  # Use same services as production but with:
  # - Reduced resource limits
  # - Debug logging enabled
  # - Test data volumes
  # - Integration test endpoints

  video-processor:
    image: ghcr.io/your-org/pitchey/video-processor:staging
    environment:
      - NODE_ENV=staging
      - LOG_LEVEL=debug
      - MAX_CONCURRENT_JOBS=2
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '1'
          memory: 1G
    # ... other staging-specific configs
```

### 2. Staging Deployment Script

```bash
#!/bin/bash
# scripts/deploy-staging.sh

set -e

STAGING_HOST=${STAGING_HOST:-"staging.containers.pitchey.com"}
DEPLOY_KEY=${DEPLOY_KEY:-"~/.ssh/pitchey_staging_key"}

echo "Deploying to staging environment..."

# Build staging images
./scripts/build-containers.sh staging

# Deploy to staging server
ssh -i "$DEPLOY_KEY" deploy@"$STAGING_HOST" << 'EOF'
  cd /opt/pitchey
  
  # Pull latest code
  git pull origin main
  
  # Pull latest images
  docker-compose -f docker-compose.staging.yml pull
  
  # Deploy with zero-downtime
  docker-compose -f docker-compose.staging.yml up -d --remove-orphans
  
  # Wait for health checks
  sleep 30
  
  # Verify deployment
  ./scripts/verify-deployment.sh
EOF

echo "✅ Staging deployment completed"
```

### 3. Staging Verification

```bash
#!/bin/bash
# scripts/verify-deployment.sh

set -e

STAGING_URL="https://staging.containers.pitchey.com"

echo "Verifying staging deployment..."

# Health check endpoints
endpoints=(
    "$STAGING_URL/video-processor/health"
    "$STAGING_URL/document-processor/health"
    "$STAGING_URL/ai-inference/health"
    "$STAGING_URL/media-transcoder/health"
    "$STAGING_URL/code-executor/health"
)

for endpoint in "${endpoints[@]}"; do
    if curl -sf "$endpoint" > /dev/null; then
        echo "✅ $endpoint is healthy"
    else
        echo "❌ $endpoint is not responding"
        exit 1
    fi
done

# Run integration tests
npm run test:integration:staging

echo "🎉 Staging verification completed successfully!"
```

## Production Deployment

### 1. Production Architecture

```
                                Production Container Infrastructure
                                
                    ┌─────────────────────────────────────────────────┐
                    │                Load Balancer                    │
                    │              (Nginx/Cloudflare)                 │
                    └─────────────────────┬───────────────────────────┘
                                          │
                    ┌─────────────────────────────────────────────────┐
                    │              Container Cluster                   │
                    │                                                 │
                    │  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
                    │  │Video x2 │  │Doc x3   │  │AI x1    │         │
                    │  └─────────┘  └─────────┘  └─────────┘         │
                    │                                                 │
                    │  ┌─────────┐  ┌─────────┐                      │
                    │  │Media x2 │  │Code x5  │                      │
                    │  └─────────┘  └─────────┘                      │
                    └─────────────────────────────────────────────────┘
```

### 2. Production Deployment Script

```bash
#!/bin/bash
# scripts/deploy-production.sh

set -e

PRODUCTION_HOSTS=(
    "prod-container-1.pitchey.com"
    "prod-container-2.pitchey.com"
    "prod-container-3.pitchey.com"
)

DEPLOY_KEY="~/.ssh/pitchey_production_key"
VERSION=${VERSION:-$(git rev-parse --short HEAD)}

echo "🚀 Starting production deployment (Version: $VERSION)..."

# Pre-deployment checks
./scripts/pre-deployment-checks.sh

# Build and push production images
./scripts/build-containers.sh production
./scripts/push-containers.sh production

# Deploy to each host
for host in "${PRODUCTION_HOSTS[@]}"; do
    echo "Deploying to $host..."
    
    ssh -i "$DEPLOY_KEY" deploy@"$host" << EOF
        cd /opt/pitchey
        
        # Backup current deployment
        ./scripts/backup-deployment.sh
        
        # Pull latest code and images
        git fetch --all
        git checkout $VERSION
        docker-compose -f docker-compose.prod.yml pull
        
        # Rolling update
        ./scripts/rolling-update.sh
        
        # Verify deployment
        ./scripts/verify-production-health.sh
EOF
    
    echo "✅ Deployed to $host"
done

# Post-deployment verification
./scripts/post-deployment-verification.sh

echo "🎉 Production deployment completed successfully!"
```

### 3. Rolling Update Strategy

```bash
#!/bin/bash
# scripts/rolling-update.sh

set -e

SERVICES=("video-processor" "document-processor" "ai-inference" "media-transcoder" "code-executor")

echo "Starting rolling update..."

for service in "${SERVICES[@]}"; do
    echo "Updating $service..."
    
    # Get current replicas
    current_replicas=$(docker service ls --filter name="$service" --format "{{.Replicas}}" | cut -d'/' -f2)
    
    # Scale up with new image
    docker service update \
        --image "ghcr.io/your-org/pitchey/$service:$VERSION" \
        --update-parallelism 1 \
        --update-delay 30s \
        --update-order start-first \
        "$service"
    
    # Wait for update to complete
    while [[ $(docker service ls --filter name="$service" --format "{{.Replicas}}") != "$current_replicas/$current_replicas" ]]; do
        echo "Waiting for $service to update..."
        sleep 10
    done
    
    # Verify health
    if ./scripts/verify-service-health.sh "$service"; then
        echo "✅ $service updated successfully"
    else
        echo "❌ $service update failed, rolling back..."
        docker service rollback "$service"
        exit 1
    fi
done

echo "✅ Rolling update completed"
```

### 4. Production Monitoring

```yaml
# monitoring/docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secure_password
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  prometheus_data:
  grafana_data:
```

## CI/CD Pipeline Configuration

### 1. GitHub Actions Workflow

The system includes a comprehensive CI/CD pipeline defined in `.github/workflows/container-build.yml` that provides:

- **Multi-Runtime Builds**: Both Docker and Podman support
- **Security Scanning**: Trivy vulnerability scanning and Hadolint linting
- **Multi-Platform Builds**: AMD64 and ARM64 architecture support
- **Integration Testing**: Automated testing across environments
- **Performance Benchmarking**: Build time and runtime performance analysis

### 2. Deployment Triggers

```yaml
# .github/workflows/deploy.yml
name: Deploy Containers

on:
  push:
    branches:
      - main
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'staging' }}
    
    steps:
      - name: Deploy to Environment
        run: |
          if [[ "${{ github.event.inputs.environment }}" == "production" ]]; then
            ./scripts/deploy-production.sh
          else
            ./scripts/deploy-staging.sh
          fi
```

### 3. Deployment Notifications

```bash
#!/bin/bash
# scripts/notify-deployment.sh

ENVIRONMENT=$1
VERSION=$2
STATUS=$3

# Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data "{
    \"text\": \"🚀 Container deployment to *$ENVIRONMENT* ($VERSION): $STATUS\",
    \"channel\": \"#deployments\",
    \"username\": \"Deployment Bot\"
  }" \
  "$SLACK_WEBHOOK_URL"

# Email notification (if configured)
if [[ -n "$EMAIL_NOTIFICATIONS" ]]; then
  echo "Container deployment to $ENVIRONMENT ($VERSION): $STATUS" | \
    mail -s "Pitchey Container Deployment" "$EMAIL_NOTIFICATIONS"
fi
```

## Environment Configuration

### 1. Environment Variables

```bash
# .env.production
# ===== Container Configuration =====
CONTAINER_REGISTRY=ghcr.io/your-org/pitchey
CONTAINER_VERSION=latest
CONTAINER_NETWORK=pitchey_containers

# ===== Resource Limits =====
VIDEO_PROCESSOR_MEMORY=2G
VIDEO_PROCESSOR_CPUS=2
DOCUMENT_PROCESSOR_MEMORY=1G
DOCUMENT_PROCESSOR_CPUS=1
AI_INFERENCE_MEMORY=8G
AI_INFERENCE_CPUS=4
MEDIA_TRANSCODER_MEMORY=1.5G
MEDIA_TRANSCODER_CPUS=2
CODE_EXECUTOR_MEMORY=512M
CODE_EXECUTOR_CPUS=0.5

# ===== Scaling Configuration =====
VIDEO_PROCESSOR_REPLICAS=2
DOCUMENT_PROCESSOR_REPLICAS=3
AI_INFERENCE_REPLICAS=1
MEDIA_TRANSCODER_REPLICAS=2
CODE_EXECUTOR_REPLICAS=5

# ===== Database Configuration =====
DATABASE_URL=postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-a9pr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
REDIS_URL=redis://default:password@redis-12345.upstash.io:12345

# ===== Cloudflare Configuration =====
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_ZONE_ID=your_zone_id

# ===== Storage Configuration =====
R2_BUCKET_NAME=pitchey-containers
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key

# ===== Monitoring Configuration =====
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url

# ===== Security Configuration =====
CONTAINER_SECURITY_ENABLED=true
RESOURCE_LIMITS_ENABLED=true
NETWORK_ISOLATION_ENABLED=true
```

### 2. Configuration Management

```bash
#!/bin/bash
# scripts/manage-config.sh

set -e

ENVIRONMENT=${1:-"development"}
CONFIG_DIR="config/$ENVIRONMENT"

case "$1" in
    "validate")
        echo "Validating $ENVIRONMENT configuration..."
        ./scripts/validate-env.sh "$CONFIG_DIR/.env"
        ;;
    
    "deploy")
        echo "Deploying $ENVIRONMENT configuration..."
        cp "$CONFIG_DIR/.env" .env
        cp "$CONFIG_DIR/docker-compose.yml" docker-compose.yml
        ;;
        
    "backup")
        echo "Backing up $ENVIRONMENT configuration..."
        mkdir -p "backups/$ENVIRONMENT/$(date +%Y%m%d_%H%M%S)"
        cp .env "backups/$ENVIRONMENT/$(date +%Y%m%d_%H%M%S)/"
        ;;
        
    *)
        echo "Usage: $0 {validate|deploy|backup} [environment]"
        exit 1
        ;;
esac
```

## Troubleshooting

### 1. Common Issues and Solutions

#### Container Startup Issues

**Problem**: Container fails to start with "out of memory" error
```bash
# Solution: Increase memory limits
docker-compose -f docker-compose.prod.yml config | grep memory
# Edit resource limits in compose file
```

**Problem**: Container exits with code 125
```bash
# Solution: Check image availability
docker images | grep pitchey
docker pull ghcr.io/your-org/pitchey/video-processor:latest
```

#### Network Connectivity Issues

**Problem**: Services cannot communicate with each other
```bash
# Solution: Check network configuration
docker network ls
docker network inspect pitchey_default
```

**Problem**: External API calls timeout
```bash
# Solution: Check firewall and DNS
docker exec container_name nslookup api.external-service.com
docker exec container_name curl -v https://api.external-service.com/health
```

#### Resource Management Issues

**Problem**: Containers consuming excessive memory
```bash
# Solution: Monitor and adjust limits
docker stats
docker-compose -f docker-compose.prod.yml config
# Update memory limits and restart
```

### 2. Debugging Tools

#### Container Debugging
```bash
# Inspect container logs
docker-compose logs -f service_name

# Execute interactive shell
docker exec -it container_name /bin/bash

# Check resource usage
docker stats container_name

# Inspect container configuration
docker inspect container_name
```

#### Health Monitoring
```bash
#!/bin/bash
# scripts/health-check.sh

SERVICES=("video-processor" "document-processor" "ai-inference" "media-transcoder" "code-executor")

for service in "${SERVICES[@]}"; do
    echo "Checking $service health..."
    
    # Container health
    if docker ps --filter "name=$service" --filter "health=healthy" | grep -q "$service"; then
        echo "✅ $service container is healthy"
    else
        echo "❌ $service container is unhealthy"
    fi
    
    # Service endpoint health
    if curl -sf "http://localhost:808x/health" > /dev/null 2>&1; then
        echo "✅ $service endpoint is responding"
    else
        echo "❌ $service endpoint is not responding"
    fi
done
```

### 3. Performance Optimization

#### Resource Optimization
```bash
# Optimize Docker daemon
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  }
}
EOF
sudo systemctl restart docker
```

#### Container Optimization
```dockerfile
# Optimized Dockerfile example
FROM node:18-alpine AS builder

# Install dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy application
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

USER appuser

# Optimized startup
CMD ["node", "--max-old-space-size=1024", "index.js"]
```

### 4. Emergency Procedures

#### Rollback Deployment
```bash
#!/bin/bash
# scripts/emergency-rollback.sh

set -e

PREVIOUS_VERSION=${1:-"previous"}

echo "🚨 Emergency rollback initiated..."

# Stop current services
docker-compose -f docker-compose.prod.yml down

# Restore previous configuration
git checkout "$PREVIOUS_VERSION"

# Deploy previous version
docker-compose -f docker-compose.prod.yml up -d

# Verify rollback
sleep 30
./scripts/verify-deployment.sh

echo "✅ Emergency rollback completed"
```

#### Scale Services
```bash
# Quick scaling commands
docker-compose -f docker-compose.prod.yml up -d --scale video-processor=4
docker-compose -f docker-compose.prod.yml up -d --scale document-processor=6
docker-compose -f docker-compose.prod.yml up -d --scale code-executor=10
```

This deployment guide provides comprehensive coverage of all deployment scenarios while maintaining flexibility for different environments and requirements. The multi-runtime support ensures compatibility across different infrastructure setups, while the detailed troubleshooting section helps resolve common issues quickly.