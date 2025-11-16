#!/bin/bash

echo "🚀 Setting up Hyperdrive connection to Neon PostgreSQL"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Installing...${NC}"
    npm install -g wrangler
fi

# Get Neon connection details
echo -e "\n${YELLOW}📋 Enter your Neon database details:${NC}"
read -p "Neon connection string (postgresql://...): " NEON_CONNECTION

# Extract components from connection string
if [[ $NEON_CONNECTION =~ postgresql://([^:]+):([^@]+)@([^/]+)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_NAME="${BASH_REMATCH[4]}"
    
    echo -e "${GREEN}✅ Parsed connection details:${NC}"
    echo "   User: $DB_USER"
    echo "   Host: $DB_HOST"
    echo "   Database: $DB_NAME"
else
    echo -e "${RED}❌ Invalid connection string format${NC}"
    exit 1
fi

# Create Hyperdrive configuration
echo -e "\n${YELLOW}🔧 Creating Hyperdrive configuration...${NC}"

# Login to Cloudflare
echo "Please login to Cloudflare:"
wrangler login

# Create Hyperdrive
echo -e "\n${YELLOW}🚀 Creating Hyperdrive instance...${NC}"
HYPERDRIVE_ID=$(wrangler hyperdrive create pitchey-neon \
    --connection-string "$NEON_CONNECTION" \
    2>&1 | grep -oP 'Created Hyperdrive config with ID: \K[a-f0-9]+')

if [ -z "$HYPERDRIVE_ID" ]; then
    # Try alternative method
    HYPERDRIVE_ID=$(wrangler hyperdrive create pitchey-neon \
        --connection-string "$NEON_CONNECTION" \
        --origin-scheme postgresql \
        --origin-host "$DB_HOST" \
        --origin-port 5432 \
        --origin-user "$DB_USER" \
        --origin-password "$DB_PASS" \
        --origin-database "$DB_NAME" \
        2>&1 | grep -oP 'id: \K[a-f0-9]+')
fi

if [ -z "$HYPERDRIVE_ID" ]; then
    echo -e "${RED}❌ Failed to create Hyperdrive. Please check your credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Created Hyperdrive with ID: $HYPERDRIVE_ID${NC}"

# Update wrangler.toml
echo -e "\n${YELLOW}📝 Updating wrangler.toml...${NC}"

# Check if hyperdrive section exists
if grep -q "\[\[hyperdrive\]\]" wrangler.toml; then
    # Update existing
    sed -i "s/id = \".*\"/id = \"$HYPERDRIVE_ID\"/" wrangler.toml
    echo -e "${GREEN}✅ Updated existing Hyperdrive configuration${NC}"
else
    # Add new
    cat >> wrangler.toml << EOF

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "$HYPERDRIVE_ID"
localConnectionString = "$NEON_CONNECTION"
EOF
    echo -e "${GREEN}✅ Added Hyperdrive configuration to wrangler.toml${NC}"
fi

# Create test worker
echo -e "\n${YELLOW}📝 Creating test worker with Hyperdrive...${NC}"
cat > src/worker-hyperdrive-test.ts << 'EOF'
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './db/schema';

export interface Env {
  HYPERDRIVE: Hyperdrive;
  JWT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/health') {
      try {
        // Get connection from Hyperdrive
        const client = neon(env.HYPERDRIVE.connectionString);
        const db = drizzle(client, { schema });
        
        // Test query
        const result = await db.select().from(schema.users).limit(1);
        
        return Response.json({
          status: 'healthy',
          database: 'connected',
          hyperdrive: 'active',
          timestamp: new Date().toISOString(),
          test_query: result.length > 0 ? 'success' : 'no data'
        });
      } catch (error) {
        return Response.json({
          status: 'error',
          message: error.message,
          hyperdrive: 'configured'
        }, { status: 500 });
      }
    }
    
    return Response.json({
      message: 'Pitchey API with Hyperdrive',
      endpoints: ['/api/health']
    });
  }
};
EOF

echo -e "${GREEN}✅ Created test worker${NC}"

# Deploy test
echo -e "\n${YELLOW}🚀 Deploying test worker...${NC}"
wrangler deploy src/worker-hyperdrive-test.ts --name pitchey-hyperdrive-test

# Test the deployment
echo -e "\n${YELLOW}🧪 Testing Hyperdrive connection...${NC}"
sleep 5
RESPONSE=$(curl -s https://pitchey-hyperdrive-test.*.workers.dev/api/health)

if echo "$RESPONSE" | grep -q '"database":"connected"'; then
    echo -e "${GREEN}✅ SUCCESS! Hyperdrive is connected to Neon${NC}"
    echo -e "${GREEN}📊 Test Response:${NC}"
    echo "$RESPONSE" | jq '.'
else
    echo -e "${RED}❌ Connection test failed${NC}"
    echo "Response: $RESPONSE"
fi

echo -e "\n${GREEN}🎉 Hyperdrive setup complete!${NC}"
echo "=================================================="
echo "Next steps:"
echo "1. Update your worker code to use env.HYPERDRIVE"
echo "2. Deploy with: wrangler deploy"
echo "3. Monitor at: https://dash.cloudflare.com"
echo ""
echo "Hyperdrive ID: $HYPERDRIVE_ID"
echo "Save this ID in your GitHub secrets as HYPERDRIVE_ID"