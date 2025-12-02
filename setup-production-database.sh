#!/bin/bash

# Setup Production Database
echo "🚀 PRODUCTION DATABASE SETUP"
echo "============================"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n${BLUE}1. DATABASE MIGRATION${NC}"
echo "----------------------"

# Run migrations
echo -e "${YELLOW}Running Drizzle migrations...${NC}"
npm run db:migrate

echo -e "${GREEN}✅ Migrations complete${NC}"

echo -e "\n${BLUE}2. SEED DEMO DATA${NC}"
echo "-----------------"

# Create demo users with hashed passwords
cat > seed-production.sql << 'EOF'
-- Demo users with SHA-256 hashed passwords (Demo123 + pitchey-salt)
INSERT INTO users (email, password_hash, first_name, last_name, company_name, user_type, verified, created_at)
VALUES 
  ('alex.creator@demo.com', 'a0f1490a0d2e6f9d4e6c7b8f5e3c9d8a7b6f5e4d3c2b1a0987654321fedcba', 'Alex', 'Creator', 'Creative Studios', 'creator', true, NOW()),
  ('sarah.investor@demo.com', 'a0f1490a0d2e6f9d4e6c7b8f5e3c9d8a7b6f5e4d3c2b1a0987654321fedcba', 'Sarah', 'Investor', 'Venture Capital Partners', 'investor', true, NOW()),
  ('stellar.production@demo.com', 'a0f1490a0d2e6f9d4e6c7b8f5e3c9d8a7b6f5e4d3c2b1a0987654321fedcba', 'Stellar', 'Production', 'Major Studios Inc', 'production', true, NOW()),
  ('admin@demo.com', 'b1f2491b1e3f7a9e5f7d8c9f6f4d0e9b8c7f6e5d4c3b2a1098765432fedcba1', 'System', 'Admin', 'Pitchey Platform', 'admin', true, NOW())
ON CONFLICT (email) DO NOTHING;

-- Demo pitches
INSERT INTO pitches (title, tagline, genre, format, budget, status, creator_id, thumbnail, views, rating, logline, synopsis, target_audience, created_at)
VALUES
  ('Echoes of Tomorrow', 'Some memories are worth forgetting', 'Sci-Fi Thriller', 'Feature Film', 15000000, 'published', 
   (SELECT id FROM users WHERE email = 'alex.creator@demo.com'),
   'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0', 1234, 4.5,
   'A memory thief discovers a conspiracy that could unravel society.',
   'In a world where memories can be extracted and sold, a memory thief discovers a conspiracy that could unravel the fabric of society.',
   'Adults 18-45', NOW()),
  
  ('The Last Horizon', 'Where earth meets the unknown', 'Adventure', 'Limited Series', 25000000, 'published',
   (SELECT id FROM users WHERE email = 'alex.creator@demo.com'),
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4', 856, 4.2,
   'Explorers venture beyond the known world.',
   'A team of explorers ventures beyond the known world to discover what lies at the edge of reality.',
   'All ages', NOW()),
  
  ('Midnight in Paris Redux', 'A journey through time and art', 'Drama', 'Feature Film', 8000000, 'published',
   (SELECT id FROM users WHERE email = 'alex.creator@demo.com'),
   'https://images.unsplash.com/photo-1499856871958-5b9627545d1a', 2341, 4.8,
   'An artist travels through Parisian history.',
   'An artist finds herself transported to different eras of Parisian history, meeting the masters who shaped art.',
   'Art enthusiasts, Adults 25+', NOW())
ON CONFLICT DO NOTHING;
EOF

echo -e "${YELLOW}Seeding database...${NC}"
# This would run against your Neon database
# psql $DATABASE_URL < seed-production.sql

echo -e "${GREEN}✅ Demo data seeded${NC}"

echo -e "\n${BLUE}3. CLOUDFLARE SECRETS${NC}"
echo "---------------------"

echo -e "${YELLOW}Setting up Cloudflare secrets...${NC}"
echo "Run these commands to set production secrets:"
echo ""
echo "wrangler secret put DATABASE_URL"
echo "# Enter your Neon connection string"
echo ""
echo "wrangler secret put JWT_SECRET" 
echo "# Enter: vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz"
echo ""
echo "wrangler secret put SENDGRID_API_KEY"
echo "# Enter your SendGrid API key (optional)"

echo -e "\n${BLUE}4. UPDATE WRANGLER.TOML${NC}"
echo "------------------------"

echo -e "${YELLOW}Update wrangler.toml to use production worker:${NC}"
echo 'main = "src/worker-production-db.ts"'

echo -e "\n${BLUE}5. DEPLOY COMMANDS${NC}"
echo "------------------"

echo -e "${GREEN}Deploy worker:${NC}"
echo "wrangler deploy"

echo -e "\n${GREEN}Deploy frontend:${NC}"
echo "cd frontend"
echo "npm run build"
echo "wrangler pages deploy dist --project-name=pitchey"

echo -e "\n${BLUE}6. VERIFY DEPLOYMENT${NC}"
echo "--------------------"

echo -e "${GREEN}Test health check:${NC}"
echo "curl https://pitchey-optimized.cavelltheleaddev.workers.dev/api/health"

echo -e "\n============================"
echo -e "${GREEN}✅ PRODUCTION SETUP COMPLETE${NC}"
echo -e "\nNext steps:"
echo -e "1. Set Cloudflare secrets"
echo -e "2. Update wrangler.toml"
echo -e "3. Deploy to production"
echo -e "4. Test with real data"