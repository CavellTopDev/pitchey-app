#!/bin/bash

# Hyperdrive Setup Script for Neon PostgreSQL
# This script creates and configures Hyperdrive for your Cloudflare Workers

# Configuration
HYPERDRIVE_NAME="pitchey-neon-db"
CONNECTION_STRING="postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech:5432/neondb?sslmode=require"
WRANGLER_CONFIG="wrangler.toml"

echo "================================"
echo "Hyperdrive Setup for Neon PostgreSQL"
echo "================================"

# Step 1: Create Hyperdrive configuration
echo ""
echo "Step 1: Creating Hyperdrive configuration..."
echo "Running: wrangler hyperdrive create $HYPERDRIVE_NAME --connection-string=\"$CONNECTION_STRING\""
echo ""

# Create the Hyperdrive configuration
HYPERDRIVE_OUTPUT=$(wrangler hyperdrive create "$HYPERDRIVE_NAME" --connection-string="$CONNECTION_STRING" 2>&1)

# Extract the Hyperdrive ID from the output
HYPERDRIVE_ID=$(echo "$HYPERDRIVE_OUTPUT" | grep -oP '(?<=Created new Hyperdrive config with ID: )[a-f0-9-]+' || echo "$HYPERDRIVE_OUTPUT" | grep -oP '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)

if [ -z "$HYPERDRIVE_ID" ]; then
    echo "Failed to create Hyperdrive or extract ID. Output:"
    echo "$HYPERDRIVE_OUTPUT"
    echo ""
    echo "If Hyperdrive already exists, list existing configs with:"
    echo "wrangler hyperdrive list"
    echo ""
    echo "To get the ID of an existing Hyperdrive:"
    echo "wrangler hyperdrive get $HYPERDRIVE_NAME"
    exit 1
fi

echo "✅ Created Hyperdrive with ID: $HYPERDRIVE_ID"

# Step 2: Update wrangler.toml
echo ""
echo "Step 2: Updating wrangler.toml..."
echo ""
echo "Add the following configuration to your wrangler.toml:"
echo ""
echo "[[hyperdrive]]"
echo "binding = \"HYPERDRIVE\""
echo "id = \"$HYPERDRIVE_ID\""
echo ""
echo "For production environment, also add:"
echo ""
echo "[[env.production.hyperdrive]]"
echo "binding = \"HYPERDRIVE\""
echo "id = \"$HYPERDRIVE_ID\""

# Step 3: Verify configuration
echo ""
echo "================================"
echo "Step 3: Verify Configuration"
echo "================================"
echo ""
echo "To verify your Hyperdrive configuration:"
echo "wrangler hyperdrive get $HYPERDRIVE_ID"
echo ""
echo "To list all Hyperdrive configs:"
echo "wrangler hyperdrive list"
echo ""
echo "To update the connection string later:"
echo "wrangler hyperdrive update $HYPERDRIVE_ID --connection-string=\"NEW_CONNECTION_STRING\""
echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Your Hyperdrive ID is: $HYPERDRIVE_ID"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with the Hyperdrive binding (shown above)"
echo "2. Deploy your worker with: wrangler deploy"
echo "3. Test the database connection in your worker"
echo ""
echo "Connection pooling is automatically handled by Hyperdrive with:"
echo "- Max connections: 10 per worker instance"
echo "- Connection timeout: 60 seconds"
echo "- Idle timeout: 10 seconds"
echo "- Automatic retry on connection failure"