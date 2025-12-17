#!/bin/bash

# Hyperdrive Setup Script for Cloudflare Workers
# This script configures connection pooling for Neon PostgreSQL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HYPERDRIVE_NAME="pitchey-db"
MAX_IDLE_CONNECTIONS=10
MAX_CONNECTIONS=25

echo -e "${BLUE}🔧 Cloudflare Hyperdrive Setup Script${NC}"
echo "======================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found!${NC}"
    echo "Please install with: npm install -g wrangler"
    exit 1
fi

# Check for required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  CLOUDFLARE_API_TOKEN not set${NC}"
    echo "Please export CLOUDFLARE_API_TOKEN=your-token"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
    echo "Please export DATABASE_URL=your-neon-connection-string"
    exit 1
fi

# Verify authentication
echo -e "${BLUE}🔐 Verifying Cloudflare authentication...${NC}"
if wrangler whoami &> /dev/null; then
    echo -e "${GREEN}✅ Authentication successful${NC}"
else
    echo -e "${RED}❌ Authentication failed${NC}"
    exit 1
fi

# Check if Hyperdrive already exists
echo -e "${BLUE}🔍 Checking existing Hyperdrive configurations...${NC}"
EXISTING_ID=$(wrangler hyperdrive list 2>/dev/null | grep "$HYPERDRIVE_NAME" | awk '{print $1}' || true)

if [ -n "$EXISTING_ID" ]; then
    echo -e "${YELLOW}⚠️  Hyperdrive '$HYPERDRIVE_NAME' already exists with ID: $EXISTING_ID${NC}"
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🔄 Updating Hyperdrive configuration...${NC}"
        wrangler hyperdrive update "$EXISTING_ID" \
            --connection-string "$DATABASE_URL" \
            --max-idle-connections "$MAX_IDLE_CONNECTIONS" \
            --max-connections "$MAX_CONNECTIONS"
        echo -e "${GREEN}✅ Hyperdrive updated successfully${NC}"
    else
        echo -e "${YELLOW}⏭️  Skipping update${NC}"
    fi
else
    echo -e "${BLUE}🚀 Creating new Hyperdrive configuration...${NC}"
    
    # Create Hyperdrive
    OUTPUT=$(wrangler hyperdrive create "$HYPERDRIVE_NAME" \
        --connection-string "$DATABASE_URL" \
        --max-idle-connections "$MAX_IDLE_CONNECTIONS" \
        --max-connections "$MAX_CONNECTIONS" 2>&1)
    
    # Extract ID from output
    HYPERDRIVE_ID=$(echo "$OUTPUT" | grep -oP '(?<=Created Hyperdrive config with ID: )[a-z0-9-]+' || true)
    
    if [ -z "$HYPERDRIVE_ID" ]; then
        # Try alternative parsing
        HYPERDRIVE_ID=$(wrangler hyperdrive list | grep "$HYPERDRIVE_NAME" | awk '{print $1}')
    fi
    
    if [ -n "$HYPERDRIVE_ID" ]; then
        echo -e "${GREEN}✅ Hyperdrive created with ID: $HYPERDRIVE_ID${NC}"
    else
        echo -e "${RED}❌ Failed to create Hyperdrive${NC}"
        exit 1
    fi
fi

# Get final Hyperdrive ID
if [ -z "$HYPERDRIVE_ID" ]; then
    HYPERDRIVE_ID=$(wrangler hyperdrive list | grep "$HYPERDRIVE_NAME" | awk '{print $1}')
fi

# Generate wrangler.toml snippet
echo -e "${BLUE}📝 Generating wrangler.toml configuration...${NC}"
cat > hyperdrive-config.toml << EOF
# Add this to your wrangler.toml file

[[hyperdrive]]
binding = "DB"
id = "$HYPERDRIVE_ID"

# For different environments:
[[env.production.hyperdrive]]
binding = "DB"
id = "$HYPERDRIVE_ID"

[[env.staging.hyperdrive]]
binding = "DB"
id = "$HYPERDRIVE_ID"
EOF

echo -e "${GREEN}✅ Configuration saved to hyperdrive-config.toml${NC}"

# Generate TypeScript interface
echo -e "${BLUE}📝 Generating TypeScript interface...${NC}"
cat > hyperdrive-types.ts << 'EOF'
// Add this to your Worker's TypeScript file

export interface Env {
  // Hyperdrive binding for PostgreSQL connection pooling
  DB: Hyperdrive;
  
  // Other environment variables
  DATABASE_URL: string;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  SENTRY_DSN?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

// Usage example:
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Use Hyperdrive connection
    const client = new Client(env.DB.connectionString);
    await client.connect();
    
    try {
      const result = await client.query('SELECT NOW()');
      return new Response(JSON.stringify(result.rows));
    } finally {
      await client.end();
    }
  }
};
EOF

echo -e "${GREEN}✅ TypeScript types saved to hyperdrive-types.ts${NC}"

# Test connection
echo -e "${BLUE}🧪 Testing database connection through Hyperdrive...${NC}"

# Create test worker
cat > test-hyperdrive.js << 'EOF'
export default {
  async fetch(request, env) {
    const { Client } = await import('pg');
    const client = new Client(env.DB.connectionString);
    
    try {
      await client.connect();
      const result = await client.query('SELECT NOW() as time, version() as version');
      await client.end();
      
      return new Response(JSON.stringify({
        success: true,
        time: result.rows[0].time,
        version: result.rows[0].version,
        pooling: 'Hyperdrive'
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
EOF

# Output summary
echo
echo -e "${GREEN}=== Hyperdrive Setup Complete ===${NC}"
echo -e "${BLUE}Hyperdrive ID:${NC} $HYPERDRIVE_ID"
echo -e "${BLUE}Configuration:${NC}"
echo "  • Name: $HYPERDRIVE_NAME"
echo "  • Max Idle Connections: $MAX_IDLE_CONNECTIONS"
echo "  • Max Connections: $MAX_CONNECTIONS"
echo
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Add the configuration from 'hyperdrive-config.toml' to your wrangler.toml"
echo "2. Update your Worker code to use env.DB instead of env.DATABASE_URL"
echo "3. Deploy your Worker with: wrangler deploy"
echo
echo -e "${BLUE}To verify setup:${NC}"
echo "  wrangler hyperdrive list"
echo
echo -e "${GREEN}For GitHub Actions, add this secret:${NC}"
echo "  HYPERDRIVE_CONFIG_ID=$HYPERDRIVE_ID"
echo

# Cleanup test file
rm -f test-hyperdrive.js

# Store ID for GitHub Actions
if [ -n "$GITHUB_OUTPUT" ]; then
    echo "hyperdrive_id=$HYPERDRIVE_ID" >> "$GITHUB_OUTPUT"
    echo -e "${GREEN}✅ Hyperdrive ID exported to GitHub Actions${NC}"
fi

# Optional: Update GitHub secret automatically
if [ -n "$GITHUB_TOKEN" ] && [ -n "$GITHUB_REPOSITORY" ]; then
    echo -e "${BLUE}🔐 Updating GitHub secret...${NC}"
    
    # Use GitHub CLI if available
    if command -v gh &> /dev/null; then
        echo "$HYPERDRIVE_ID" | gh secret set HYPERDRIVE_CONFIG_ID
        echo -e "${GREEN}✅ GitHub secret updated${NC}"
    else
        echo -e "${YELLOW}⚠️  GitHub CLI not found. Please manually add:${NC}"
        echo "  HYPERDRIVE_CONFIG_ID=$HYPERDRIVE_ID"
    fi
fi

exit 0