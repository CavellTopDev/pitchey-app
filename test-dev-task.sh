#!/bin/bash

echo "🧪 Testing updated dev task with Redis environment variables..."

# Kill any existing server on port 8001
echo "Stopping any existing server on port 8001..."
pkill -f "working-server.ts" || true
sleep 2

# Start Redis if not running
echo "Ensuring Redis is running..."
docker-compose up -d redis
sleep 3

# Test the updated dev task
echo "Starting server with updated dev task..."
echo "Environment variables will be:"
echo "  CACHE_ENABLED=true"
echo "  REDIS_HOST=localhost"
echo "  REDIS_PORT=6379"
echo "  NODE_ENV=development"
echo "  DENO_ENV=development"
echo "  PORT=8001"

echo ""
echo "🚀 Running 'deno task dev' (will timeout after 15 seconds)..."
timeout 15s deno task dev || echo "✅ Test completed (timeout is expected)"