#!/bin/bash

echo "🚀 Setting up Pitchey Production Database"
echo "========================================="

# Set environment variables
export DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"

# 1. Run database schema setup
echo "📊 Creating database tables..."
deno run --allow-env --allow-net --allow-read scripts/setup-db.ts

# 2. Seed with demo data
echo "🌱 Seeding demo accounts..."
deno run --allow-env --allow-net --allow-read scripts/seed-db.ts

echo "✅ Database setup complete!"
echo ""
echo "Demo Accounts (Password: Demo123):"
echo "- Creator: alex.creator@demo.com"
echo "- Investor: sarah.investor@demo.com"
echo "- Production: stellar.production@demo.com"
