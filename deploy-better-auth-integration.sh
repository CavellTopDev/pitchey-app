#!/bin/bash

# Better Auth Integration Deployment Script
# This script integrates Better Auth into your Pitchey platform

set -e

echo "🚀 Starting Better Auth Integration Deployment"
echo "==========================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
WORKER_NAME="pitchey-optimized"

# Step 1: Run database migrations
echo -e "${YELLOW}Step 1: Running database migrations...${NC}"
PGPASSWORD="npg_DZhIpVaLAk06" psql \
  -h ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech \
  -U neondb_owner \
  -d neondb \
  -f src/db/better-auth-migration.sql \
  && echo -e "${GREEN}✅ Database migrations completed${NC}" \
  || { echo -e "${RED}❌ Database migration failed${NC}"; exit 1; }

# Step 2: Install Better Auth dependencies
echo -e "${YELLOW}Step 2: Installing Better Auth dependencies...${NC}"
npm install better-auth@latest drizzle-orm@latest @neondatabase/serverless@latest \
  && echo -e "${GREEN}✅ Dependencies installed${NC}" \
  || { echo -e "${RED}❌ Dependency installation failed${NC}"; exit 1; }

# Step 3: Update wrangler.toml to use the new worker
echo -e "${YELLOW}Step 3: Updating wrangler.toml...${NC}"
cat > wrangler.toml.better-auth << 'EOF'
name = "pitchey-optimized"
main = "src/worker-service-better-auth.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
FRONTEND_URL = "https://pitchey.pages.dev"
NODE_ENV = "production"
DENO_ENV = "production"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
preview_id = "your-kv-namespace-preview-id"

[[durable_objects]]
binding = "WEBSOCKET_ROOMS"
class_name = "WebSocketRoom"
script_name = "pitchey-optimized"

[[migrations]]
tag = "v1"
new_classes = ["WebSocketRoom"]

[env.production]
vars = { ENVIRONMENT = "production" }
EOF

echo -e "${GREEN}✅ wrangler.toml.better-auth created${NC}"
echo -e "${YELLOW}Note: Update KV namespace IDs in wrangler.toml.better-auth${NC}"

# Step 4: Set Cloudflare secrets
echo -e "${YELLOW}Step 4: Setting Cloudflare secrets...${NC}"
echo -e "${YELLOW}Setting JWT_SECRET...${NC}"
echo "vYGh89KjLmNpQrStUwXyZ123456789ABCDEFGHIJKLMNOPQRSTuvwxyz" | wrangler secret put JWT_SECRET --name $WORKER_NAME

echo -e "${YELLOW}Setting DATABASE_URL...${NC}"
echo "$DATABASE_URL" | wrangler secret put DATABASE_URL --name $WORKER_NAME

echo -e "${GREEN}✅ Secrets configured${NC}"

# Step 5: Test locally first
echo -e "${YELLOW}Step 5: Testing worker locally...${NC}"
echo "Run: wrangler dev --config wrangler.toml.better-auth"
echo "Then test authentication with:"
echo "curl -X POST http://localhost:8787/api/auth/creator/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"alex.creator@demo.com\",\"password\":\"Demo123\"}'"

# Step 6: Create deployment command
echo -e "${YELLOW}Step 6: Ready to deploy${NC}"
cat > deploy-worker.sh << 'EOF'
#!/bin/bash
# Deploy the Better Auth integrated worker
wrangler deploy --config wrangler.toml.better-auth
EOF
chmod +x deploy-worker.sh

# Step 7: Frontend update instructions
echo -e "${YELLOW}Step 7: Frontend Integration${NC}"
cat > frontend-integration.md << 'EOF'
# Frontend Better Auth Integration

## 1. Install Better Auth client
```bash
cd frontend
npm install better-auth
```

## 2. Update auth service (frontend/src/services/auth.service.ts)
```typescript
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || "https://pitchey-production.cavelltheleaddev.workers.dev"
});

export const authService = {
  // Creator login
  async creatorLogin(email: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/creator/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (data.success) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },
  
  // Similar for investor and production login
};
```

## 3. The existing endpoints will continue to work:
- POST /api/auth/creator/login
- POST /api/auth/investor/login  
- POST /api/auth/production/login
- POST /api/auth/logout

## 4. New Better Auth endpoints available:
- GET /api/auth/session
- POST /api/auth/signin
- POST /api/auth/signup
- POST /api/auth/signout
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/verify-email
EOF

echo -e "${GREEN}✅ Frontend integration guide created${NC}"

# Final instructions
echo ""
echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Better Auth Integration Ready!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "Next steps:"
echo "1. Review and update KV namespace IDs in wrangler.toml.better-auth"
echo "2. Test locally: wrangler dev --config wrangler.toml.better-auth"
echo "3. Deploy to production: ./deploy-worker.sh"
echo "4. Update frontend (see frontend-integration.md)"
echo ""
echo -e "${YELLOW}Important: Your existing auth endpoints will continue to work!${NC}"
echo "The Better Auth integration maintains backward compatibility."
echo ""
echo "Test endpoints:"
echo "  - Existing: POST /api/auth/creator/login"
echo "  - Better Auth: GET /api/auth/session"