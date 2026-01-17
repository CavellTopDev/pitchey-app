#!/bin/bash

# Contract Validation Test Runner
# Tests the API bridge implementation with comprehensive validation scenarios

set -e

echo "🧪 Contract Validation Test Runner"
echo "=================================="
echo ""

# Check if local server is running
echo "🔍 Checking if local server is available..."
if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
    echo "✅ Local server is running at http://localhost:8001"
    export TEST_API_URL="http://localhost:8001"
else
    echo "⚠️  Local server not available, testing against production..."
    export TEST_API_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"
fi

echo "🎯 Target API: $TEST_API_URL"
echo ""

# Install dependencies if needed
if [ ! -f "package-lock.json" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🚀 Starting contract validation tests..."
echo ""

# Run the test suite
deno run --allow-net --allow-env tests/contract-validation-test.ts

echo ""
echo "✅ Contract validation tests completed!"