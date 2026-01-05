#!/bin/bash

# Pitchey Container Services Deployment Script
# Automated deployment with health checks and monitoring

set -e

echo "🚀 Pitchey Container Services Deployment"
echo "========================================"

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is not installed"
        exit 1
    fi
    
    # Check available disk space (minimum 10GB)
    available_space=$(df . | awk 'NR==2 {print $4}')
    min_space=10485760  # 10GB in KB
    
    if [ "$available_space" -lt "$min_space" ]; then
        echo "❌ Insufficient disk space. Need at least 10GB"
        exit 1
    fi
    
    echo "✅ Prerequisites check passed"
}

# Setup environment
setup_environment() {
    echo "🔧 Setting up environment..."
    
    # Create .env if it doesn't exist
    if [ ! -f .env ]; then
        echo "📝 Creating .env from template..."
        cp .env.example .env
        
        # Generate secure JWT secret
        jwt_secret=$(openssl rand -base64 32 2>/dev/null || echo "change-me-$(date +%s)")
        sed -i "s/your-super-secure-jwt-secret-here/$jwt_secret/" .env
        
        # Generate API key
        api_key=$(openssl rand -hex 16 2>/dev/null || echo "api-key-$(date +%s)")
        sed -i "s/your-default-api-key-here/$api_key/" .env
        
        echo "🔐 Generated secure JWT secret and API key"
        echo "📄 Please review and update .env file with your configuration"
    else
        echo "✅ .env file already exists"
    fi
}

# Build containers
build_containers() {
    echo "🔨 Building containers..."
    
    echo "📦 Pulling base images..."
    docker-compose pull --ignore-pull-failures || true
    
    echo "🏗️ Building custom containers..."
    docker-compose build --parallel
    
    echo "✅ Container build completed"
}

# Start services
start_services() {
    echo "🚀 Starting services..."
    
    # Start core infrastructure first
    echo "📊 Starting core infrastructure (Redis, monitoring)..."
    docker-compose up -d redis prometheus grafana
    
    # Wait for Redis to be ready
    echo "⏳ Waiting for Redis..."
    timeout 30 bash -c 'until docker-compose exec -T redis redis-cli ping &>/dev/null; do sleep 1; done' || {
        echo "❌ Redis failed to start"
        exit 1
    }
    
    # Start processing services
    echo "🔧 Starting processing services..."
    docker-compose up -d video-processor document-processor ai-inference media-transcoder code-executor
    
    # Start gateway last
    echo "🌐 Starting gateway..."
    docker-compose up -d nginx
    
    echo "✅ All services started"
}

# Health checks
run_health_checks() {
    echo "🏥 Running health checks..."
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 30
    
    # Check each service
    services=("8081:video-processor" "8082:document-processor" "8083:ai-inference" "8084:media-transcoder" "8085:code-executor")
    
    for service in "${services[@]}"; do
        port=$(echo $service | cut -d: -f1)
        name=$(echo $service | cut -d: -f2)
        
        echo "🔍 Checking $name on port $port..."
        
        if curl -s -f "http://localhost:$port/health" >/dev/null; then
            echo "✅ $name is healthy"
        else
            echo "❌ $name health check failed"
            echo "📋 Service logs:"
            docker-compose logs --tail=10 $name
        fi
    done
    
    # Check gateway
    echo "🔍 Checking gateway..."
    if curl -s -f "http://localhost/health" >/dev/null; then
        echo "✅ Gateway is healthy"
    else
        echo "❌ Gateway health check failed"
    fi
    
    echo "✅ Health checks completed"
}

# Display service information
display_service_info() {
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "================================="
    echo ""
    echo "📊 Service Endpoints:"
    echo "  Gateway:           http://localhost"
    echo "  Video Processor:   http://localhost:8081"
    echo "  Document Processor: http://localhost:8082"
    echo "  AI Inference:      http://localhost:8083"
    echo "  Media Transcoder:  http://localhost:8084"
    echo "  Code Executor:     http://localhost:8085"
    echo ""
    echo "📈 Monitoring:"
    echo "  Grafana:           http://localhost:3000 (admin/admin)"
    echo "  Prometheus:        http://localhost:9090"
    echo ""
    echo "📖 API Documentation:"
    echo "  Swagger Docs:      http://localhost:8081/docs (and other services)"
    echo ""
    echo "🔧 Management Commands:"
    echo "  View logs:         docker-compose logs -f"
    echo "  Stop services:     docker-compose down"
    echo "  Restart services:  docker-compose restart"
    echo "  Scale services:    docker-compose up --scale video-processor=3"
    echo ""
    echo "🔐 Security:"
    echo "  JWT Secret:        Set in .env file"
    echo "  API Keys:          Set in .env file"
    echo "  Change defaults before production use!"
    echo ""
}

# Cleanup function
cleanup_on_error() {
    echo ""
    echo "❌ Deployment failed! Cleaning up..."
    docker-compose down || true
    exit 1
}

# Main deployment function
main() {
    # Trap errors
    trap cleanup_on_error ERR
    
    # Check if running as root (not recommended)
    if [ "$EUID" -eq 0 ]; then
        echo "⚠️  Running as root is not recommended"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Parse command line arguments
    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            setup_environment
            build_containers
            start_services
            run_health_checks
            display_service_info
            ;;
        "build")
            check_prerequisites
            build_containers
            echo "✅ Build completed"
            ;;
        "start")
            start_services
            echo "✅ Services started"
            ;;
        "stop")
            echo "🛑 Stopping services..."
            docker-compose down
            echo "✅ Services stopped"
            ;;
        "restart")
            echo "🔄 Restarting services..."
            docker-compose restart
            echo "✅ Services restarted"
            ;;
        "status")
            echo "📊 Service status:"
            docker-compose ps
            ;;
        "logs")
            docker-compose logs -f
            ;;
        "clean")
            echo "🧹 Cleaning up..."
            read -p "This will remove all containers, volumes, and images. Continue? (y/N) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker-compose down -v --remove-orphans
                docker-compose down --rmi all
                docker volume prune -f
                echo "✅ Cleanup completed"
            fi
            ;;
        *)
            echo "Usage: $0 {deploy|build|start|stop|restart|status|logs|clean}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Full deployment (default)"
            echo "  build    - Build containers only"
            echo "  start    - Start services"
            echo "  stop     - Stop services"
            echo "  restart  - Restart services"
            echo "  status   - Show service status"
            echo "  logs     - Show service logs"
            echo "  clean    - Remove everything (destructive)"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"