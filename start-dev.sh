#!/bin/bash

# Start Development Environment Script
echo "🚀 Starting Pitchey Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start PostgreSQL in Docker
echo "📦 Starting PostgreSQL database..."
docker-compose up -d db

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Start backend server
echo "🔧 Starting backend server..."
JWT_SECRET="test-secret-key-for-development" \
DATABASE_URL="postgresql://postgres:password@localhost:5432/pitchey" \
deno run --allow-all working-server.ts &

# Store backend process ID
BACKEND_PID=$!

# Start frontend
echo "🎨 Starting frontend..."
cd frontend && npm run dev &

# Store frontend process ID
FRONTEND_PID=$!

echo ""
echo "✅ Development environment started!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   Database: PostgreSQL on port 5432"
echo ""
echo "Press Ctrl+C to stop all services..."

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    docker-compose down
    echo "✅ All services stopped."
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup INT

# Wait for processes
wait