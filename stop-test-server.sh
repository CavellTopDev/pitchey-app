#!/bin/bash

# Test Server Stop Script for Pitchey v0.2
# Stops the test server gracefully

set -e

echo "🛑 Stopping Pitchey Test Server..."

# Check if PID file exists
if [ ! -f "server.test.pid" ]; then
    echo "⚠️  No PID file found (server.test.pid)"
    echo "🔍 Checking for running server on port 8001..."
    
    # Try to find and kill any process on port 8001
    PID=$(lsof -ti:8001 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo "🔫 Found process $PID on port 8001, terminating..."
        kill $PID 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        if kill -0 $PID 2>/dev/null; then
            echo "🔫 Force killing process $PID..."
            kill -9 $PID 2>/dev/null || true
        fi
        
        echo "✅ Server stopped"
    else
        echo "ℹ️  No server found running on port 8001"
    fi
    exit 0
fi

# Read PID from file
SERVER_PID=$(cat server.test.pid)
echo "🔧 Found server PID: $SERVER_PID"

# Check if process is still running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "ℹ️  Server process $SERVER_PID is not running"
    rm -f server.test.pid
    exit 0
fi

# Try graceful shutdown first
echo "🛑 Sending TERM signal to $SERVER_PID..."
kill $SERVER_PID 2>/dev/null || true

# Wait up to 10 seconds for graceful shutdown
COUNT=0
while [ $COUNT -lt 10 ]; do
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "✅ Server stopped gracefully"
        rm -f server.test.pid
        exit 0
    fi
    sleep 1
    COUNT=$((COUNT + 1))
    echo -n "."
done

# Force kill if still running
echo ""
echo "🔫 Force killing server process $SERVER_PID..."
kill -9 $SERVER_PID 2>/dev/null || true

# Cleanup
rm -f server.test.pid

echo "✅ Server stopped"