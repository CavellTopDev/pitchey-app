#!/bin/bash

# Start Pitchey server with Redis configuration
echo "🚀 Starting Pitchey server with Redis configuration..."

# Set environment variables for Redis
export CACHE_ENABLED=true
export REDIS_HOST=localhost
export REDIS_PORT=6379
export NODE_ENV=development
export DENO_ENV=development
export DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
export PORT=8001
export JWT_SECRET="test-secret-key-for-development"

echo "Environment variables set:"
echo "  CACHE_ENABLED: $CACHE_ENABLED"
echo "  REDIS_HOST: $REDIS_HOST"
echo "  REDIS_PORT: $REDIS_PORT"
echo "  NODE_ENV: $NODE_ENV"
echo "  DENO_ENV: $DENO_ENV"
echo "  PORT: $PORT"

echo ""
echo "🔍 Checking Redis connection..."
if podman exec pitchey_v02-redis-1 redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running and accessible"
else
    echo "❌ Redis is not accessible. Starting Redis..."
    docker-compose up -d redis
    sleep 3
fi

echo ""
echo "🚀 Starting Deno server with Redis support..."
deno run --allow-all working-server.ts