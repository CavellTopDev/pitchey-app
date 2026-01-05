#!/bin/bash

# Setup Local Development Environment with Podman
# This script creates a complete local development stack

set -e

echo "🚀 Setting up Pitchey Local Development Environment with Podman..."
echo ""

# Check for Podman
if ! command -v podman &> /dev/null; then
    echo "❌ Podman is required but not installed."
    echo "   Please install Podman Desktop from https://podman-desktop.io"
    exit 1
fi

# Check for Podman Compose
if ! command -v podman-compose &> /dev/null; then
    echo "⚠️  podman-compose not found. Installing via pip..."
    pip install --user podman-compose || {
        echo "❌ Failed to install podman-compose. Please install manually:"
        echo "   pip install podman-compose"
        exit 1
    }
fi

echo "1️⃣ Starting local services with Podman (PostgreSQL, Redis, MinIO)..."
podman-compose -f docker-compose.local.yml up -d

echo ""
echo "2️⃣ Waiting for PostgreSQL to be ready..."
sleep 5

echo ""
echo "3️⃣ Running database migrations..."
# Copy production schema to local
PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local < src/db/migrations/add-performance-indexes.sql 2>/dev/null || true

echo ""
echo "4️⃣ Creating demo users in local database..."
cat > /tmp/seed-local.sql << 'EOF'
-- Create demo users for local development
INSERT INTO users (email, username, user_type, company_name, bio, is_active, email_verified) VALUES
('alex.creator@demo.com', 'alexcreator', 'creator', 'Creative Studios', 'Filmmaker and content creator', true, true),
('sarah.investor@demo.com', 'sarahinvestor', 'investor', 'Venture Capital LLC', 'Angel investor in media', true, true),
('stellar.production@demo.com', 'stellarprod', 'production', 'Stellar Productions', 'Award-winning production company', true, true)
ON CONFLICT (email) DO NOTHING;

-- Create sample pitches
INSERT INTO pitches (title, tagline, genre, status, user_id, created_at) VALUES
('The Last Algorithm', 'When AI becomes conscious', 'Sci-Fi', 'published', 
 (SELECT id FROM users WHERE email = 'alex.creator@demo.com'), NOW()),
('Green Valley', 'A sustainable future story', 'Documentary', 'published',
 (SELECT id FROM users WHERE email = 'alex.creator@demo.com'), NOW())
ON CONFLICT DO NOTHING;
EOF

PGPASSWORD=localdev123 psql -h localhost -U pitchey_dev -d pitchey_local < /tmp/seed-local.sql 2>/dev/null || true

echo ""
echo "5️⃣ Creating MinIO bucket for file uploads..."
# Wait for MinIO to be ready
sleep 3

# Create bucket using MinIO client (mc) with Podman
podman run --rm --network host \
  minio/mc alias set myminio http://localhost:9000 minioadmin minioadmin && \
  podman run --rm --network host \
  minio/mc mb myminio/pitchey-uploads --ignore-existing

echo ""
echo "6️⃣ Setting up GitHub integration (optional)..."
echo "   To use GitHub Marketplace integrations:"
echo "   1. Create a GitHub App: https://github.com/settings/apps"
echo "   2. Add the App ID and Private Key to .env.local"
echo "   3. Install these GitHub Marketplace apps for better DX:"
echo "      - GitHub Copilot (AI code completion)"
echo "      - Sentry (Error tracking)"
echo "      - Dependabot (Dependency updates)"
echo "      - CodeQL (Security scanning)"

echo ""
echo "✅ Local Development Environment Ready!"
echo ""
echo "📊 Service URLs:"
echo "   • PostgreSQL: localhost:5432"
echo "   • Redis: localhost:6379"
echo "   • MinIO (S3): http://localhost:9000"
echo "   • MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo "   • Adminer (DB UI): http://localhost:8080"
echo ""
echo "🚀 Start development:"
echo "   1. Backend:  PORT=8001 deno run --allow-all working-server.ts"
echo "   2. Frontend: npm run dev"
echo ""
echo "📝 Use .env.local for local development variables"
echo "   source .env.local"
echo ""
echo "🧹 To stop services: podman-compose -f docker-compose.local.yml down"
echo "💾 To reset data: podman-compose -f docker-compose.local.yml down -v"
echo ""
echo "📌 Note: Using Podman (rootless containers) for better security!"