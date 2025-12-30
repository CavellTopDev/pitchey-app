#!/bin/bash

# Configure Cloudflare Worker with Database Credentials
# IMPORTANT: This configures the Worker to connect to the Neon PostgreSQL database

echo "🔧 Configuring Cloudflare Worker with Database Credentials..."

# Set the DATABASE_URL secret for the Worker
echo "Setting DATABASE_URL secret..."
npx wrangler secret put DATABASE_URL \
  --env production \
  <<< "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"

# Set JWT_SECRET for authentication
echo "Setting JWT_SECRET..."
npx wrangler secret put JWT_SECRET \
  --env production \
  <<< "vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"

# Set BETTER_AUTH_SECRET for Better Auth
echo "Setting BETTER_AUTH_SECRET..."
npx wrangler secret put BETTER_AUTH_SECRET \
  --env production \
  <<< "better-auth-secret-key-production-2024"

# Deploy the Worker with updated configuration
echo "Deploying Worker with database configuration..."
npx wrangler deploy

echo "✅ Worker configured and deployed!"
echo ""
echo "📝 Test the configuration:"
echo "curl https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health | jq"