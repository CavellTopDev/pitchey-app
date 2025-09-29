#!/bin/bash

echo "🚀 Starting Pitchey Local Development Environment"
echo "================================================"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    pkill -f "deno run.*working-server.ts" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    docker-compose down 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Trap CTRL+C
trap cleanup INT

# Start PostgreSQL
echo ""
echo "1️⃣  Starting PostgreSQL database..."
docker-compose up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Start backend server
echo ""
echo "2️⃣  Starting backend server (http://localhost:8001)..."
JWT_SECRET="test-secret-key-for-development" \
DATABASE_URL="postgresql://postgres:password@localhost:5432/pitchey" \
deno run --allow-all working-server.ts &

# Wait for backend to start
sleep 3

# Start frontend
echo ""
echo "3️⃣  Starting frontend server (http://localhost:5173)..."
cd frontend && npm run dev &

echo ""
echo "================================================"
echo "✅ Local development environment is running!"
echo ""
echo "📌 Services:"
echo "   • Frontend: http://localhost:5173"
echo "   • Backend:  http://localhost:8001"
echo "   • Database: localhost:5432"
echo ""
echo "📌 Demo Accounts (password: Demo123):"
echo "   • Creator: alex.creator@demo.com"
echo "   • Investor: sarah.investor@demo.com"
echo "   • Production: stellar.production@demo.com"
echo ""
echo "Press CTRL+C to stop all services"
echo "================================================"

# Keep script running
wait