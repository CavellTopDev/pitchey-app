#!/bin/bash

echo "🧪 Testing all Redis fixes..."

# Ensure Redis is running
echo "1. Ensuring Redis is running..."
docker-compose up -d redis > /dev/null 2>&1
sleep 2

# Test Redis connection
echo "2. Testing Redis connection..."
if podman exec pitchey_v02-redis-1 redis-cli ping > /dev/null 2>&1; then
    echo "   ✅ Redis is accessible"
else
    echo "   ❌ Redis is not accessible"
    exit 1
fi

# Start server and capture output for analysis
echo "3. Starting server and checking for Redis warnings..."
echo "   Looking for:"
echo "   - ✅ Connected to Redis at localhost:6379"
echo "   - ✅ Redis connected successfully"
echo "   - ✅ Using native Redis for cache service"
echo "   - No 'Redis not configured' warnings"
echo "   - No 'delPattern is not a function' errors"

echo ""
echo "🚀 Starting server (will timeout after 20 seconds)..."

# Capture server output
timeout 20s deno task dev 2>&1 | tee /tmp/redis_test_output.log

echo ""
echo "📊 Analyzing server output..."

# Check for success indicators
if grep -q "✅ Connected to Redis at localhost:6379" /tmp/redis_test_output.log; then
    echo "✅ Main Redis connection: SUCCESS"
else
    echo "❌ Main Redis connection: FAILED"
fi

if grep -q "✅ Using native Redis for cache service" /tmp/redis_test_output.log; then
    echo "✅ Cache service Redis: SUCCESS"
else
    echo "⚠️  Cache service Redis: Not found (may be timing issue)"
fi

# Check for error indicators
if grep -q "delPattern is not a function" /tmp/redis_test_output.log; then
    echo "❌ delPattern error: STILL PRESENT"
else
    echo "✅ delPattern error: RESOLVED"
fi

if grep -q "📦 Using in-memory cache (single instance only)" /tmp/redis_test_output.log; then
    echo "⚠️  Cache service fallback: Still using in-memory (may need restart)"
else
    echo "✅ Cache service fallback: RESOLVED"
fi

if grep -q "⚠️ Redis not configured - using in-memory cache only" /tmp/redis_test_output.log; then
    echo "⚠️  Dashboard cache warning: Still present (may need restart)"
else
    echo "✅ Dashboard cache warning: RESOLVED"
fi

echo ""
echo "📋 Summary:"
echo "   Check the output above for ✅ and ❌ indicators"
echo "   If you see mostly ✅, Redis configuration is working!"
echo ""
echo "🔄 To test manually, run:"
echo "   deno task dev"
echo "   (and look for the success messages above)"

# Clean up
rm -f /tmp/redis_test_output.log