#!/bin/bash

# Pitchey Platform - Client Requirements Verification Test Runner
# This script sets up dependencies and runs comprehensive tests

set -e  # Exit on any error

echo "🧪 Pitchey Platform - Client Requirements Verification Test Suite"
echo "=================================================================="

# Check if we're in the right directory
if [ ! -f "working-server.ts" ]; then
    echo "❌ Error: Must be run from the pitchey project root directory"
    exit 1
fi

# Configuration
API_URL="${API_URL:-http://localhost:8001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
TEST_OUTPUT_DIR="test_results_$(date +%Y%m%d_%H%M%S)"

echo "📋 Test Configuration:"
echo "  API URL: $API_URL"
echo "  Frontend URL: $FRONTEND_URL"
echo "  Output Directory: $TEST_OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$TEST_OUTPUT_DIR"

# Check if backend is running
echo "🔍 Checking backend availability..."
if curl -s "$API_URL/health" > /dev/null 2>&1 || curl -s "$API_URL/" > /dev/null 2>&1; then
    echo "✅ Backend is running at $API_URL"
else
    echo "⚠️  Backend not detected at $API_URL"
    echo "   Starting backend server..."
    
    # Start backend in background
    PORT=8001 deno run --allow-all working-server.ts > "$TEST_OUTPUT_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"
    
    # Wait for backend to start
    echo "   Waiting for backend to initialize..."
    for i in {1..30}; do
        if curl -s "$API_URL/health" > /dev/null 2>&1 || curl -s "$API_URL/" > /dev/null 2>&1; then
            echo "✅ Backend started successfully"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ Backend failed to start within 30 seconds"
            kill $BACKEND_PID 2>/dev/null || true
            exit 1
        fi
        sleep 1
        echo -n "."
    done
fi

# Check Node.js dependencies
echo ""
echo "📦 Checking Node.js dependencies..."

# Check if package.json exists for test dependencies
if [ ! -f "package.json" ]; then
    echo "📝 Creating package.json for test dependencies..."
    cat > package.json << 'EOF'
{
  "name": "pitchey-test-suite",
  "version": "1.0.0",
  "description": "Test suite for Pitchey platform client requirements",
  "private": true,
  "dependencies": {
    "axios": "^1.5.0",
    "chalk": "^4.1.2",
    "puppeteer": "^21.0.0",
    "ws": "^8.14.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo "📥 Installing test dependencies..."
    npm install --silent
    if [ $? -eq 0 ]; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        exit 1
    fi
else
    echo "✅ Dependencies already installed"
fi

# Verify critical dependencies
echo ""
echo "🔍 Verifying critical dependencies..."

if ! node -e "require('axios')" 2>/dev/null; then
    echo "❌ axios not available - installing..."
    npm install axios --silent
fi

if ! node -e "require('chalk')" 2>/dev/null; then
    echo "❌ chalk not available - installing..."
    npm install chalk@4.1.2 --silent
fi

if ! node -e "require('puppeteer')" 2>/dev/null; then
    echo "❌ puppeteer not available - installing..."
    npm install puppeteer --silent
fi

if ! node -e "require('ws')" 2>/dev/null; then
    echo "❌ ws not available - installing..."
    npm install ws --silent
fi

echo "✅ All dependencies verified"

# Run the test suite
echo ""
echo "🚀 Running Client Requirements Verification Tests..."
echo "   This will test all 15 client requirements systematically"
echo "   Tests include: API endpoints, frontend integration, and user workflows"
echo ""

# Set environment variables for the test
export API_URL="$API_URL"
export FRONTEND_URL="$FRONTEND_URL"

# Run the comprehensive test suite
echo "📊 Starting comprehensive test execution..."
node comprehensive-client-requirements-test-suite.js 2>&1 | tee "$TEST_OUTPUT_DIR/test-execution.log"

# Capture exit code
TEST_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "📄 Test Results Summary:"
echo "  Full logs: $TEST_OUTPUT_DIR/test-execution.log"
echo "  Detailed report: client-requirements-test-report.md"

# Additional verification tests
echo ""
echo "🔍 Running Additional Verification Tests..."

# Test demo account authentication
echo "Testing demo account authentication..."
for user_type in creator investor production; do
    echo "  Testing $user_type login..."
    case $user_type in
        creator)
            email="alex.creator@demo.com"
            ;;
        investor)
            email="sarah.investor@demo.com"
            ;;
        production)
            email="stellar.production@demo.com"
            ;;
    esac
    
    response=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/auth/$user_type/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"Demo123\"}" \
        2>/dev/null)
    
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        echo "    ✅ $user_type login successful"
    else
        echo "    ❌ $user_type login failed (HTTP $http_code)"
    fi
done

# Test critical endpoints
echo ""
echo "Testing critical API endpoints..."

critical_endpoints=(
    "GET:/:Health check"
    "GET:/api/pitches:Pitches list"
    "GET:/api/pitches/trending:Trending pitches"
    "GET:/api/pitches/new:New pitches"
)

for endpoint_info in "${critical_endpoints[@]}"; do
    IFS=':' read -r method path description <<< "$endpoint_info"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" "$API_URL$path" 2>/dev/null)
        http_code="${response: -3}"
        
        if [ "$http_code" = "200" ]; then
            echo "  ✅ $description"
        else
            echo "  ❌ $description (HTTP $http_code)"
        fi
    fi
done

# Database connectivity test
echo ""
echo "🗄️  Testing database connectivity..."
if curl -s "$API_URL/api/health/db" > /dev/null 2>&1; then
    echo "  ✅ Database connection healthy"
else
    echo "  ⚠️  Database health check not available or failing"
fi

# Generate final report
echo ""
echo "📊 Generating Final Verification Report..."

cat > "$TEST_OUTPUT_DIR/verification-summary.md" << EOF
# Pitchey Platform - Client Requirements Verification Summary

**Test Date**: $(date)
**API URL**: $API_URL
**Frontend URL**: $FRONTEND_URL

## Test Results

See detailed results in:
- \`test-execution.log\` - Full test output
- \`../client-requirements-test-report.md\` - Detailed analysis

## Quick Status Check

### Demo Accounts
$(for user_type in creator investor production; do
    case $user_type in
        creator) email="alex.creator@demo.com" ;;
        investor) email="sarah.investor@demo.com" ;;
        production) email="stellar.production@demo.com" ;;
    esac
    
    response=$(curl -s -w "%{http_code}" -X POST "$API_URL/api/auth/$user_type/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"Demo123\"}" 2>/dev/null)
    
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        echo "- ✅ $user_type ($email)"
    else
        echo "- ❌ $user_type ($email) - HTTP $http_code"
    fi
done)

### Critical Endpoints
$(for endpoint_info in "GET:/:Health check" "GET:/api/pitches:Pitches list" "GET:/api/pitches/trending:Trending pitches" "GET:/api/pitches/new:New pitches"; do
    IFS=':' read -r method path description <<< "$endpoint_info"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" "$API_URL$path" 2>/dev/null)
        http_code="${response: -3}"
        
        if [ "$http_code" = "200" ]; then
            echo "- ✅ $description"
        else
            echo "- ❌ $description (HTTP $http_code)"
        fi
    fi
done)

## Next Steps

1. Review detailed test report for specific failures
2. Fix any failing tests before client demo
3. Re-run tests until 100% pass rate achieved
4. Schedule client validation session

EOF

echo "✅ Verification report saved to: $TEST_OUTPUT_DIR/verification-summary.md"

# Clean up background processes
if [ ! -z "$BACKEND_PID" ]; then
    echo ""
    echo "🧹 Cleaning up background processes..."
    kill $BACKEND_PID 2>/dev/null || true
    echo "  Backend process stopped"
fi

# Final summary
echo ""
echo "🎯 Test Suite Completion Summary:"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "  ✅ All tests completed successfully"
    echo "  📈 Platform ready for client validation"
else
    echo "  ⚠️  Some tests failed or had issues"
    echo "  🔧 Review test output and fix failing components"
fi

echo ""
echo "📂 All test results saved in: $TEST_OUTPUT_DIR/"
echo "📄 Detailed analysis available in: client-requirements-test-report.md"
echo ""
echo "Thank you for using the Pitchey Client Requirements Verification Test Suite!"

exit $TEST_EXIT_CODE