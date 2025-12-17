#!/bin/bash

# Hyperdrive Configuration Script for Neon PostgreSQL
# This script sets up Hyperdrive for optimal database connection pooling

echo "🚀 Setting up Hyperdrive for Neon PostgreSQL..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  echo "Please set it to your Neon PostgreSQL connection string"
  exit 1
fi

# Create Hyperdrive configuration
echo "📝 Creating Hyperdrive configuration..."

wrangler hyperdrive create pitchey-db \
  --connection-string "$DATABASE_URL" \
  --caching-disabled

# Get the Hyperdrive ID
HYPERDRIVE_ID=$(wrangler hyperdrive list | grep pitchey-db | awk '{print $1}')

if [ -z "$HYPERDRIVE_ID" ]; then
  echo "❌ Error: Failed to create or find Hyperdrive configuration"
  exit 1
fi

echo "✅ Hyperdrive created with ID: $HYPERDRIVE_ID"

# Update wrangler.toml with Hyperdrive binding
echo "📝 Updating wrangler.toml..."

cat >> wrangler.toml << EOF

# Hyperdrive Configuration (added by setup script)
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "$HYPERDRIVE_ID"
EOF

echo "✅ wrangler.toml updated with Hyperdrive binding"

# Create a test script to verify Hyperdrive connection
cat > test-hyperdrive.ts << 'EOF'
import { Client } from "pg";

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const client = new Client({
      connectionString: env.HYPERDRIVE.connectionString,
    });

    try {
      await client.connect();
      const result = await client.query("SELECT NOW()");
      await client.end();
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: result.rows[0].now,
        message: "Hyperdrive connection successful!"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
EOF

echo "✅ Test script created: test-hyperdrive.ts"

echo ""
echo "🎉 Hyperdrive setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy your worker: wrangler deploy"
echo "2. Test the connection: wrangler dev test-hyperdrive.ts"
echo ""
echo "Hyperdrive benefits:"
echo "✅ Automatic connection pooling"
echo "✅ Regional connection caching"
echo "✅ Smart query routing"
echo "✅ Reduced connection overhead"
echo "✅ Lower latency for database queries"