#!/bin/bash

echo "🔧 Fixing all direct database connections in worker-service-optimized.ts"

# Create a backup
cp src/worker-service-optimized.ts src/worker-service-optimized.ts.backup

# Replace all instances of direct neon imports and connection strings with connection pool
sed -i "s|const { neon } = await import('@neondatabase/serverless');|const { dbPool, withDatabase } = await import('./worker-database-pool.ts');|g" src/worker-service-optimized.ts

# Remove the connection string lines (they follow the import line)
sed -i "/const connectionString = 'postgresql:\/\/neondb_owner/d" src/worker-service-optimized.ts

# Replace sql = neon(connectionString) with pool initialization  
sed -i "s|const sql = neon(connectionString);|// Initialize the pool if not already done\n          dbPool.initialize(env, sentry);|g" src/worker-service-optimized.ts

echo "✅ Replaced all direct database connections with connection pool"
echo ""
echo "⚠️  NOTE: SQL queries still need to be wrapped with withDatabase()"
echo "    This requires manual review as queries have different patterns"