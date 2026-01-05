# Deployment Automation Scripts

Comprehensive deployment automation system for Pitchey with full Podman compatibility as an alternative to Docker. This system provides seamless container orchestration, CI/CD pipelines, and production deployment with advanced features like blue-green deployments and automated rollbacks.

## 🚀 Quick Start

### Prerequisites

```bash
# Install required dependencies
./scripts/environment-setup.sh setup

# Verify environment
./scripts/environment-setup.sh validate
```

### Local Development

```bash
# Start complete development environment
./scripts/dev-tools.sh start

# Access services
# Frontend: http://localhost:5173
# API Proxy: http://localhost:8001
# Worker Dev: http://localhost:8787
# Database: localhost:5432
```

### Production Deployment

```bash
# Deploy to production with blue-green strategy
./scripts/production-deploy.sh deploy

# Check deployment status
./scripts/production-deploy.sh status

# Rollback if needed
./scripts/production-deploy.sh rollback
```

## 📋 Script Overview

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `deploy-podman.sh` | Main deployment orchestrator | Runtime detection, multi-platform builds, health checks |
| `scripts/environment-setup.sh` | Environment detection & setup | OS detection, dependency installation, container runtime config |
| `scripts/build-automation.sh` | Container build system | Parallel builds, optimization, multi-platform support |
| `scripts/wrangler-podman.sh` | Cloudflare Workers integration | Containerized Wrangler, environment management |
| `scripts/dev-tools.sh` | Development environment | Hot reload, debugging, service management |
| `scripts/production-deploy.sh` | Production deployment | Blue-green deployment, rollback, monitoring |

## 🔧 Environment Setup

### Automatic Setup
```bash
# Complete environment setup with dependency installation
./scripts/environment-setup.sh setup

# Detect current environment capabilities
./scripts/environment-setup.sh detect

# Setup local container registry
./scripts/environment-setup.sh registry
```

### Manual Configuration

#### Container Runtime Detection
The scripts automatically detect and configure the best available container runtime:

1. **Podman** (preferred) - Rootless, secure, Docker-compatible
2. **Docker** (fallback) - Traditional container runtime

#### Environment Variables
```bash
# Container runtime selection
export CONTAINER_RUNTIME=podman  # or 'docker' for explicit selection

# Build configuration
export PARALLEL_BUILDS=true
export BUILD_CACHE=true
export PLATFORMS=linux/amd64,linux/arm64

# Cloudflare configuration
export CLOUDFLARE_API_TOKEN=your_token_here
export CLOUDFLARE_ACCOUNT_ID=02967e39e44b6266e7873829e94849f5
```

## 🏗️ Build System

### Build All Containers
```bash
# Parallel build with optimization
./scripts/build-automation.sh all --parallel

# Build specific component
./scripts/build-automation.sh frontend
./scripts/build-automation.sh worker

# Build for specific platforms
./scripts/build-automation.sh all --platforms=linux/amd64,linux/arm64
```

### Build Configuration
```bash
# Enable/disable features
--parallel              # Enable parallel builds
--no-cache             # Disable build cache
--no-optimization      # Disable image optimization
--platforms=PLATFORMS  # Set build platforms
--tag=TAG              # Set container tag
--registry=REGISTRY    # Set container registry
```

### Generated Dockerfiles

The build system automatically generates optimized Dockerfiles:

- **Frontend**: Multi-stage build with Nginx, security headers, health checks
- **Worker**: Deno-based with Wrangler CLI, development ready
- **Development**: Hot reload enabled, debugging tools included

## 🌐 Cloudflare Integration

### Wrangler with Podman
```bash
# Build Wrangler container
./scripts/wrangler-podman.sh build

# Start development server
./scripts/wrangler-podman.sh start development

# Deploy to production
./scripts/wrangler-podman.sh deploy production

# Deploy Pages
./scripts/wrangler-podman.sh pages pitchey production
```

### Environment Management
```bash
# Development
./scripts/wrangler-podman.sh start development

# Staging
./scripts/wrangler-podman.sh start staging  

# Production
./scripts/wrangler-podman.sh deploy production
```

### Authentication
```bash
# Set Cloudflare API token
export CLOUDFLARE_API_TOKEN=your_token_here

# Validate authentication
./scripts/wrangler-podman.sh auth

# Interactive login
./scripts/wrangler-podman.sh exec "auth login"
```

## 🛠️ Development Tools

### Complete Development Environment
```bash
# Start all services
./scripts/dev-tools.sh start

# Service status
./scripts/dev-tools.sh status

# View logs
./scripts/dev-tools.sh logs all
./scripts/dev-tools.sh logs frontend -f  # Follow logs

# Debug services
./scripts/dev-tools.sh debug

# Restart environment
./scripts/dev-tools.sh restart
```

### Individual Services
```bash
# Backend services only
./scripts/dev-tools.sh services

# Proxy server only
./scripts/dev-tools.sh proxy

# Run tests
./scripts/dev-tools.sh test
```

### Service URLs
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend Proxy**: http://localhost:8001 (forwards to production API)
- **Worker Dev**: http://localhost:8787 (Wrangler dev)
- **PostgreSQL**: localhost:5432 (pitchey_dev/localdev123)
- **Redis**: localhost:6380
- **MinIO**: http://localhost:9000 (minioadmin/minioadmin)
- **Adminer**: http://localhost:8080

## 🚀 Production Deployment

### Blue-Green Deployment
```bash
# Deploy with blue-green strategy (default)
./scripts/production-deploy.sh deploy

# Check deployment status
./scripts/production-deploy.sh status

# Run health checks
./scripts/production-deploy.sh health
```

### Rollback Procedures
```bash
# Automatic rollback to previous slot
./scripts/production-deploy.sh rollback

# Rollback to specific slot
./scripts/production-deploy.sh rollback blue
```

### Deployment Strategies
- **Blue-Green** (default): Zero-downtime deployment with traffic switching
- **Rolling** (planned): Gradual instance replacement
- **Canary** (planned): Percentage-based traffic routing

### Health Validation
The deployment system performs comprehensive health checks:

- **Basic Connectivity**: HTTP response validation
- **API Functionality**: Critical endpoint testing
- **Performance Validation**: Response time and success rate checks
- **Database Connectivity**: Backend service validation
- **Cache Connectivity**: Redis/caching layer validation

### Monitoring & Alerts
```bash
# Setup post-deployment monitoring
./scripts/production-deploy.sh monitor

# Generate deployment report
./scripts/production-deploy.sh report

# Create backup
./scripts/production-deploy.sh backup
```

## 🏭 CI/CD Pipelines

### GitHub Actions Workflows

#### Container Build Matrix (`.github/workflows/container-build.yml`)
- **Multi-runtime support**: Docker and Podman
- **Multi-platform builds**: AMD64 and ARM64
- **Security scanning**: Trivy vulnerability scanner
- **Performance benchmarks**: Build time comparisons
- **Integration testing**: Full stack validation

#### Podman Deployment (`.github/workflows/podman-deploy.yml`)
- **Environment detection**: Automatic runtime selection
- **Parallel builds**: Matrix-based container building
- **Cloudflare deployment**: Automated Worker and Pages deployment
- **Health validation**: Comprehensive post-deployment checks
- **Deployment summary**: Detailed reporting

### Workflow Triggers
- **Push to main**: Production deployment
- **Push to develop**: Staging deployment
- **Pull requests**: Build and test only
- **Manual dispatch**: Custom environment deployment

### Build Matrix Strategy
```yaml
strategy:
  matrix:
    runtime: [podman, docker]
    component: [frontend, worker, nginx]
    platform: [linux/amd64, linux/arm64]
```

## 🔍 Debugging & Troubleshooting

### Common Issues

#### Container Runtime Issues
```bash
# Check runtime status
./scripts/environment-setup.sh detect

# Restart Podman socket
systemctl --user restart podman.socket

# Check container permissions
podman info
```

#### Build Issues
```bash
# Clean build cache
./scripts/build-automation.sh clean

# Verify Dockerfiles
./scripts/build-automation.sh verify

# Debug build process
./scripts/build-automation.sh frontend --no-cache
```

#### Development Environment Issues
```bash
# Debug all services
./scripts/dev-tools.sh debug

# Check service logs
./scripts/dev-tools.sh logs containers

# Restart services
./scripts/dev-tools.sh restart
```

#### Deployment Issues
```bash
# Check deployment health
./scripts/production-deploy.sh health

# View deployment logs
tail -f logs/deploy/deploy_$(date +%Y%m%d).log

# Emergency rollback
./scripts/production-deploy.sh rollback
```

### Log Locations
- **Build Logs**: `logs/build/`
- **Development Logs**: `logs/dev/`
- **Deployment Logs**: `logs/deploy/`
- **Container Logs**: Use `./scripts/dev-tools.sh logs containers`

## 📊 Performance & Optimization

### Container Optimization
- **Multi-stage builds**: Minimal production images
- **Layer caching**: Optimized build times
- **Security scanning**: Vulnerability detection
- **Image compression**: Reduced storage footprint

### Build Performance
- **Parallel builds**: Multi-core utilization
- **Build cache**: Persistent layer caching
- **Platform targeting**: Architecture-specific builds
- **Resource limits**: Controlled memory/CPU usage

### Deployment Performance
- **Blue-green strategy**: Zero-downtime deployments
- **Health validation**: Automated quality gates
- **Performance thresholds**: Response time monitoring
- **Rollback procedures**: Rapid failure recovery

## 🔐 Security Features

### Container Security
- **Rootless execution**: Non-privileged containers
- **Minimal base images**: Reduced attack surface
- **Security scanning**: Automated vulnerability detection
- **SELinux support**: Enhanced access controls

### Deployment Security
- **Secret management**: Environment-based configuration
- **API token validation**: Cloudflare authentication
- **Health verification**: Security endpoint testing
- **Backup procedures**: Deployment state preservation

### Development Security
- **Local environment isolation**: Containerized services
- **Credential protection**: Environment variable management
- **Network isolation**: Container networking
- **Access controls**: Service-specific permissions

## 📚 Advanced Usage

### Custom Container Registry
```bash
# Setup local registry for development
./scripts/environment-setup.sh registry

# Use custom registry
export CONTAINER_REGISTRY=your-registry.com/pitchey
./scripts/build-automation.sh all
```

### Multi-Platform Builds
```bash
# Build for multiple architectures
./scripts/build-automation.sh all --platforms=linux/amd64,linux/arm64,linux/arm/v7

# Platform-specific builds
./scripts/build-automation.sh frontend --platforms=linux/amd64
```

### Environment Customization
```bash
# Custom development ports
export FRONTEND_PORT=3000
export BACKEND_PORT=8000
./scripts/dev-tools.sh start

# Custom deployment configuration
export DEPLOYMENT_STRATEGY=canary
export HEALTH_CHECK_TIMEOUT=600
./scripts/production-deploy.sh deploy
```

## 🤝 Contributing

### Adding New Scripts
1. Place scripts in `scripts/` directory
2. Make executable: `chmod +x scripts/your-script.sh`
3. Follow existing patterns for logging and error handling
4. Add documentation to this README

### Testing Changes
```bash
# Test environment detection
./scripts/environment-setup.sh detect

# Test build system
./scripts/build-automation.sh frontend --no-cache

# Test development environment
./scripts/dev-tools.sh start
```

### Validation
```bash
# Validate all scripts
find scripts/ -name "*.sh" -exec shellcheck {} \;

# Test container builds
./scripts/build-automation.sh verify
```

## 📖 Reference

### Environment Variables Reference

#### Global Configuration
- `CONTAINER_RUNTIME`: Container runtime (podman/docker)
- `ENVIRONMENT`: Target environment (development/staging/production)
- `PARALLEL_BUILDS`: Enable parallel builds (true/false)
- `BUILD_CACHE`: Enable build cache (true/false)

#### Container Configuration
- `CONTAINER_REGISTRY`: Container registry URL
- `CONTAINER_TAG`: Container tag
- `PLATFORMS`: Build platforms (comma-separated)
- `MAX_PARALLEL_BUILDS`: Maximum parallel build jobs

#### Cloudflare Configuration
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token (required)
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
- `WRANGLER_PORT`: Wrangler development port

#### Development Configuration
- `HOT_RELOAD`: Enable hot reload (true/false)
- `DEBUG_MODE`: Enable debug mode (true/false)
- `LOG_LEVEL`: Log level (debug/info/warn/error)
- `FRONTEND_PORT`: Frontend development port
- `BACKEND_PORT`: Backend proxy port

#### Production Configuration
- `DEPLOYMENT_STRATEGY`: Deployment strategy (blue-green/rolling/canary)
- `HEALTH_CHECK_TIMEOUT`: Health check timeout (seconds)
- `MAX_RESPONSE_TIME`: Maximum response time threshold
- `MIN_SUCCESS_RATE`: Minimum success rate threshold

### File Structure
```
.
├── deploy-podman.sh                 # Main deployment orchestrator
├── scripts/
│   ├── environment-setup.sh         # Environment detection & setup
│   ├── build-automation.sh          # Container build system
│   ├── wrangler-podman.sh           # Cloudflare Workers integration
│   ├── dev-tools.sh                 # Development environment
│   └── production-deploy.sh         # Production deployment
├── .github/workflows/
│   ├── podman-deploy.yml            # Deployment workflow
│   └── container-build.yml          # Build matrix workflow
├── logs/
│   ├── build/                       # Build logs
│   ├── dev/                         # Development logs
│   └── deploy/                      # Deployment logs
└── .deploy/                         # Deployment metadata
```

### Port Reference
| Service | Default Port | Environment Variable |
|---------|-------------|---------------------|
| Frontend | 5173 | `FRONTEND_PORT` |
| Backend Proxy | 8001 | `BACKEND_PORT` |
| Worker Dev | 8787 | `WORKER_PORT` |
| PostgreSQL | 5432 | `POSTGRES_PORT` |
| Redis | 6380 | `REDIS_PORT` |
| MinIO | 9000 | `MINIO_PORT` |
| Adminer | 8080 | `ADMINER_PORT` |

---

For support or questions, please check the logs in the respective `logs/` directories or run the debug commands provided in this documentation.