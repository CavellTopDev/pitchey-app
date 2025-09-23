#!/bin/bash

echo "🚀 Setting up Pitchey Production Environment on Fly.io"

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null && ! command -v ~/.fly/bin/flyctl &> /dev/null; then
    echo "❌ flyctl is not installed. Please install it first."
    exit 1
fi

# Use the Fly CLI
FLY_CMD="flyctl"
if [ -f ~/.fly/bin/flyctl ]; then
    FLY_CMD="~/.fly/bin/flyctl"
fi

echo "📦 Step 1: Create PostgreSQL Database"
echo "Creating database 'pitchey-db' in IAD region..."
$FLY_CMD postgres create --name pitchey-db \
    --region iad \
    --vm-size shared-cpu-1x \
    --volume-size 1 \
    --initial-cluster-size 1

echo "🔗 Step 2: Attach Database to Backend"
$FLY_CMD postgres attach pitchey-db --app pitchey-backend

echo "🔑 Step 3: Set Production Secrets"
echo "Setting JWT secret..."
$FLY_CMD secrets set JWT_SECRET="$(openssl rand -base64 32)" --app pitchey-backend

echo "📝 Step 4: Database Connection Info"
echo "Getting database URL..."
$FLY_CMD postgres config show --app pitchey-db

echo "🚀 Step 5: Deploy Backend"
$FLY_CMD deploy --config fly.backend.toml

echo "🎨 Step 6: Deploy Frontend"
$FLY_CMD deploy --config fly.frontend.toml

echo ""
echo "✅ Production setup complete!"
echo "   Backend:  https://pitchey-backend.fly.dev"
echo "   Frontend: https://pitchey-frontend.fly.dev"
echo ""
echo "📊 Monitor your database:"
echo "   $FLY_CMD postgres connect -a pitchey-db"
echo ""
echo "📈 View logs:"
echo "   $FLY_CMD logs --app pitchey-backend"
echo "   $FLY_CMD logs --app pitchey-frontend"