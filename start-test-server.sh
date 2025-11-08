#!/bin/bash

# Test Server Startup Script for Pitchey v0.2
# Ensures backend server runs on port 8001 for integration tests

set -e

echo "🧪 Starting Pitchey Test Server..."

# Check if port 8001 is already in use
if lsof -Pi :8001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 8001 is already in use"
    echo "🔍 Checking if it's our server..."
    
    # Test if it's our API server by checking health endpoint
    if curl -s http://localhost:8001/api/health >/dev/null 2>&1; then
        echo "✅ Pitchey server is already running on port 8001"
        echo "🔗 API endpoint: http://localhost:8001"
        echo "🔌 WebSocket endpoint: ws://localhost:8001/ws"
        exit 0
    else
        echo "❌ Port 8001 is occupied by another service"
        echo "🛑 Please free up port 8001 or stop the conflicting service"
        echo "💡 You can check what's using the port with: lsof -i :8001"
        exit 1
    fi
fi

# Set environment variables for test mode
export PORT=8001
export NODE_ENV=test

echo "🚀 Starting server on port 8001..."
echo "📁 Working directory: $(pwd)"

# Start the server in the background
PORT=8001 deno run --allow-all working-server.ts &
SERVER_PID=$!

# Save PID for cleanup
echo $SERVER_PID > server.test.pid

echo "🔧 Server PID: $SERVER_PID"
echo "⏱️  Waiting for server to be ready..."

# Wait for server to be ready (max 30 seconds)
TIMEOUT=30
COUNT=0
while [ $COUNT -lt $TIMEOUT ]; do
    if curl -s http://localhost:8001/api/health >/dev/null 2>&1; then
        echo "✅ Server is ready!"
        echo "🔗 API endpoint: http://localhost:8001"
        echo "🔌 WebSocket endpoint: ws://localhost:8001/ws"
        echo ""
        echo "🧪 You can now run your tests:"
        echo "   deno test tests/ --allow-all"
        echo ""
        echo "🛑 To stop the server:"
        echo "   kill $SERVER_PID"
        echo "   OR run: ./stop-test-server.sh"
        exit 0
    fi
    sleep 1
    COUNT=$((COUNT + 1))
    echo -n "."
done

echo ""
echo "❌ Server failed to start within $TIMEOUT seconds"
echo "🔍 Check the server logs above for errors"

# Kill the server if it's still running
kill $SERVER_PID 2>/dev/null || true
rm -f server.test.pid

exit 1