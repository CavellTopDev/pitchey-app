#!/bin/bash

echo "🚀 Enabling Hyperdrive for Database Connection Pooling"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Hyperdrive config exists
echo "📋 Checking existing Hyperdrive configuration..."
wrangler hyperdrive list 2>/dev/null | grep -q "pitchey-db" && HYPERDRIVE_EXISTS=true || HYPERDRIVE_EXISTS=false

if [ "$HYPERDRIVE_EXISTS" = "true" ]; then
    echo "✅ Hyperdrive configuration 'pitchey-db' already exists"
    HYPERDRIVE_ID=$(wrangler hyperdrive list 2>/dev/null | grep "pitchey-db" | awk '{print $1}')
    echo "   ID: $HYPERDRIVE_ID"
else
    echo "📦 Creating new Hyperdrive configuration..."
    
    # Get database URL from environment or prompt
    if [ -z "$DATABASE_URL" ]; then
        echo "❓ Please enter your Neon database URL:"
        echo "   Format: postgresql://user:pass@host.neon.tech/database?sslmode=require"
        read -s DATABASE_URL
    fi
    
    # Create Hyperdrive configuration
    echo -e "\n🔧 Creating Hyperdrive configuration..."
    RESULT=$(wrangler hyperdrive create pitchey-db \
        --connection-string "$DATABASE_URL" \
        --caching-disabled false \
        2>&1)
    
    if echo "$RESULT" | grep -q "Created"; then
        HYPERDRIVE_ID=$(echo "$RESULT" | grep -oE '[a-f0-9]{32}')
        echo "✅ Hyperdrive created successfully!"
        echo "   ID: $HYPERDRIVE_ID"
    else
        echo "❌ Failed to create Hyperdrive"
        echo "$RESULT"
        exit 1
    fi
fi

# Update wrangler.toml
echo -e "\n📝 Updating wrangler.toml..."

# Check if Hyperdrive binding already exists
if grep -q "^\[\[hyperdrive\]\]" wrangler.toml; then
    echo "⚠️  Hyperdrive binding already exists in wrangler.toml"
    echo "   Uncommenting if necessary..."
    
    # Uncomment Hyperdrive configuration
    sed -i 's/^# \[\[hyperdrive\]\]/[[hyperdrive]]/' wrangler.toml
    sed -i 's/^# binding = "HYPERDRIVE"/binding = "HYPERDRIVE"/' wrangler.toml
    sed -i "s/^# id = \".*\"/id = \"$HYPERDRIVE_ID\"/" wrangler.toml
else
    echo "➕ Adding Hyperdrive binding to wrangler.toml..."
    cat >> wrangler.toml << EOF

# Hyperdrive for database connection pooling
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "$HYPERDRIVE_ID"
EOF
fi

echo -e "\n✅ Hyperdrive configuration complete!"
echo ""
echo "🎯 Benefits of Hyperdrive:"
echo "  • Connection pooling at the edge"
echo "  • Reduced database connection overhead"
echo "  • Automatic failover and retry"
echo "  • Query result caching"
echo "  • Lower latency for database queries"
echo ""
echo "📊 Next Steps:"
echo "  1. Update worker to use Hyperdrive connection:"
echo "     const sql = env.HYPERDRIVE.connectionString"
echo "  2. Deploy the worker:"
echo "     wrangler deploy"
echo "  3. Monitor performance improvements"
echo ""
echo "🔍 View Hyperdrive details:"
echo "  wrangler hyperdrive get $HYPERDRIVE_ID"