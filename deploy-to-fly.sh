#!/bin/bash

# Fly.io Deployment Script for Pitchey
set -e

echo "🚀 Starting Fly.io deployment for Pitchey..."

# Add Fly CLI to PATH
export PATH="/home/supremeisbeing/.fly/bin:$PATH"

# Check authentication
echo "Checking Fly.io authentication..."
if ! flyctl auth whoami &>/dev/null; then
    echo "❌ Not authenticated. Please run: flyctl auth login"
    exit 1
fi

echo "✅ Authenticated as: $(flyctl auth whoami)"

# Deploy Backend
echo ""
echo "📦 Deploying Backend..."
echo "Creating backend app..."
flyctl launch --config fly.backend.toml --name pitchey-backend --region iad --no-deploy --yes || true

# Create PostgreSQL database
echo "Setting up PostgreSQL database..."
flyctl postgres create --name pitchey-db --region iad --vm-size shared-cpu-1x --volume-size 1 --yes || true

# Attach database to backend
echo "Attaching database to backend..."
flyctl postgres attach pitchey-db --app pitchey-backend || true

# Set backend secrets
echo "Setting backend environment variables..."
flyctl secrets set --app pitchey-backend \
    JWT_SECRET="$(openssl rand -base64 32)" \
    DATABASE_URL="$(flyctl postgres attach pitchey-db --app pitchey-backend 2>&1 | grep postgres:// | head -1)" \
    CORS_ORIGIN="https://pitchey-app.fly.dev" || true

# Deploy backend
echo "Deploying backend..."
flyctl deploy --config fly.backend.toml --app pitchey-backend

# Get backend URL
BACKEND_URL="https://pitchey-backend.fly.dev"
echo "✅ Backend deployed at: $BACKEND_URL"

# Deploy Frontend
echo ""
echo "🎨 Deploying Frontend..."
echo "Creating frontend app..."
cd frontend
flyctl launch --config fly.toml --name pitchey-app --region iad --no-deploy --yes || true

# Deploy frontend with backend URL
echo "Deploying frontend..."
flyctl deploy --config fly.toml --app pitchey-app --build-arg VITE_API_URL="$BACKEND_URL"

# Get frontend URL
FRONTEND_URL="https://pitchey-app.fly.dev"
echo "✅ Frontend deployed at: $FRONTEND_URL"

echo ""
echo "🎉 Deployment Complete!"
echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"
echo ""
echo "Next steps:"
echo "1. Visit $FRONTEND_URL to test the application"
echo "2. Monitor logs with: flyctl logs --app pitchey-app"
echo "3. Monitor backend logs with: flyctl logs --app pitchey-backend"