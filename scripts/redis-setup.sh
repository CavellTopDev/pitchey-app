#!/bin/bash

# Redis Setup Script for Pitchey Platform
# This script sets up Redis infrastructure for development

set -e

echo "🚀 Setting up Redis infrastructure for Pitchey..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

print_status "Docker is installed"

# Check if Redis container is already running
if docker ps | grep -q pitchey-redis; then
    print_warning "Redis container is already running"
    REDIS_RUNNING=true
else
    REDIS_RUNNING=false
fi

# Stop existing Redis container if needed
if [ "$REDIS_RUNNING" = true ]; then
    print_info "Stopping existing Redis container..."
    docker stop pitchey-redis || true
    docker rm pitchey-redis || true
fi

# Start Redis container
print_info "Starting Redis container..."
docker run -d \
    --name pitchey-redis \
    -p 6379:6379 \
    --restart unless-stopped \
    -v pitchey_redis_data:/data \
    redis:7-alpine \
    redis-server --save 60 1 --loglevel warning --maxmemory 256mb --maxmemory-policy allkeys-lru

if [ $? -eq 0 ]; then
    print_status "Redis container started successfully"
else
    print_error "Failed to start Redis container"
    exit 1
fi

# Wait for Redis to be ready
print_info "Waiting for Redis to be ready..."
sleep 3

# Test Redis connection
if docker exec pitchey-redis redis-cli ping | grep -q PONG; then
    print_status "Redis is responding to ping"
else
    print_error "Redis is not responding"
    exit 1
fi

# Run health check
print_info "Running comprehensive health check..."
if command -v deno &> /dev/null; then
    deno run --allow-net --allow-env scripts/redis-health-check.ts
else
    print_warning "Deno not found, skipping health check script"
fi

# Print summary
echo ""
echo "🎉 Redis Infrastructure Setup Complete!"
echo ""
echo "📋 Summary:"
echo "   - Redis 7 Alpine container running on port 6379"
echo "   - Persistent data storage enabled"
echo "   - Memory limit: 256MB with LRU eviction"
echo "   - Auto-restart enabled"
echo ""
echo "🛠️ Available Commands:"
echo "   - Health check: deno task redis:health"
echo "   - Start Redis:  deno task redis:start"
echo "   - Stop Redis:   deno task redis:stop"
echo "   - View logs:    docker logs pitchey-redis"
echo "   - Redis CLI:    docker exec -it pitchey-redis redis-cli"
echo ""
echo "📁 Configuration Files:"
echo "   - Redis config: ./redis.conf"
echo "   - Dev env vars: ./.env.development"
echo "   - Health check: ./scripts/redis-health-check.ts"
echo ""
echo "🚀 Redis is ready for the Pitchey platform!"