#!/usr/bin/env deno run --allow-all

/**
 * Database Administration Script
 * Comprehensive database operations including user management, monitoring, 
 * connection pooling setup, and disaster recovery procedures
 */

import pg from "npm:pg@8.11.3";
const { Client, Pool } = pg;

const DATABASE_URL = Deno.env.get("DATABASE_URL") || "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const isLocalDb = DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1");

interface ConnectionPoolConfig {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxUses: number;
  application_name: string;
}

interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  cacheHitRatio: number;
  locksHeld: number;
  longestRunningQuery: string;
  databaseSize: string;
  lastVacuum?: string;
  replicationLag?: number;
}

interface UserPermission {
  username: string;
  database: string;
  privilege: string;
  grantable: boolean;
}

class DatabaseAdmin {
  private client: Client;
  private pool?: pg.Pool;

  constructor() {
    this.client = new Client({
      connectionString: DATABASE_URL,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    console.log("✅ Admin client connected to database");
  }

  async disconnect(): Promise<void> {
    await this.client.end();
    if (this.pool) {
      await this.pool.end();
    }
    console.log("✅ Admin client disconnected from database");
  }

  /**
   * CONNECTION POOL MANAGEMENT
   */
  async setupConnectionPool(config?: Partial<ConnectionPoolConfig>): Promise<void> {
    const defaultConfig: ConnectionPoolConfig = {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      maxUses: 7500,
      application_name: 'pitchey_app_pool'
    };

    const poolConfig = { ...defaultConfig, ...config };

    if (this.pool) {
      await this.pool.end();
    }

    this.pool = new Pool({
      connectionString: DATABASE_URL,
      max: poolConfig.max,
      idleTimeoutMillis: poolConfig.idleTimeoutMillis,
      connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
      maxUses: poolConfig.maxUses,
      application_name: poolConfig.application_name,
    });

    // Test pool connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log(`✅ Connection pool configured successfully`);
      console.log(`   Max connections: ${poolConfig.max}`);
      console.log(`   Idle timeout: ${poolConfig.idleTimeoutMillis}ms`);
      console.log(`   Connection timeout: ${poolConfig.connectionTimeoutMillis}ms`);
      console.log(`   Max uses per connection: ${poolConfig.maxUses}`);
    } catch (error) {
      console.error("❌ Connection pool setup failed:", error.message);
      throw error;
    }
  }

  async getConnectionPoolStatus(): Promise<any> {
    if (!this.pool) {
      return { error: "Connection pool not initialized" };
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: this.pool.options.max,
      ended: this.pool.ended
    };
  }

  /**
   * DATABASE MONITORING
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      // Active connections
      const connResult = await this.client.query(`
        SELECT 
          count(*) filter (where state = 'active') as active,
          count(*) filter (where state = 'idle') as idle,
          count(*) as total
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);

      // Max connections
      const maxConnResult = await this.client.query("SHOW max_connections");
      
      // Cache hit ratio
      const cacheResult = await this.client.query(`
        SELECT 
          round(100.0 * blks_hit / (blks_hit + blks_read), 2) as cache_hit_ratio
        FROM pg_stat_database 
        WHERE datname = current_database()
      `);

      // Current locks
      const locksResult = await this.client.query(`
        SELECT count(*) as locks_held 
        FROM pg_locks 
        WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `);

      // Longest running query
      const queryResult = await this.client.query(`
        SELECT 
          COALESCE(
            (SELECT EXTRACT(EPOCH FROM (now() - query_start))::text || 's - ' || 
                    LEFT(query, 100) || '...'
             FROM pg_stat_activity 
             WHERE state = 'active' 
               AND datname = current_database() 
               AND query != '<IDLE>' 
             ORDER BY query_start 
             LIMIT 1),
            'No active queries'
          ) as longest_query
      `);

      // Database size
      const sizeResult = await this.client.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);

      // Last vacuum (if available)
      let lastVacuum;
      try {
        const vacuumResult = await this.client.query(`
          SELECT MAX(last_vacuum) as last_vacuum 
          FROM pg_stat_user_tables 
          WHERE last_vacuum IS NOT NULL
        `);
        lastVacuum = vacuumResult.rows[0].last_vacuum;
      } catch (error) {
        // Ignore if not available
      }

      return {
        activeConnections: parseInt(connResult.rows[0].active),
        idleConnections: parseInt(connResult.rows[0].idle),
        totalConnections: parseInt(connResult.rows[0].total),
        maxConnections: parseInt(maxConnResult.rows[0].max_connections),
        cacheHitRatio: parseFloat(cacheResult.rows[0].cache_hit_ratio || 0),
        locksHeld: parseInt(locksResult.rows[0].locks_held),
        longestRunningQuery: queryResult.rows[0].longest_query,
        databaseSize: sizeResult.rows[0].size,
        lastVacuum: lastVacuum || undefined
      };
    } catch (error) {
      console.error("❌ Failed to get database metrics:", error.message);
      throw error;
    }
  }

  /**
   * USER MANAGEMENT
   */
  async createAppUser(username: string, password: string, permissions: string[] = []): Promise<void> {
    if (!isLocalDb) {
      console.log("⚠️ User management not available for cloud databases");
      return;
    }

    try {
      // Create user
      await this.client.query(`CREATE USER "${username}" WITH PASSWORD $1`, [password]);
      console.log(`✅ User ${username} created`);

      // Grant permissions
      for (const permission of permissions) {
        await this.client.query(`GRANT ${permission} TO "${username}"`);
        console.log(`✅ Granted ${permission} to ${username}`);
      }

      // Grant connection to database
      await this.client.query(`GRANT CONNECT ON DATABASE pitchey TO "${username}"`);
      
      // Grant usage on schema
      await this.client.query(`GRANT USAGE ON SCHEMA public TO "${username}"`);
      
      console.log(`✅ Basic database access granted to ${username}`);
    } catch (error) {
      console.error(`❌ Failed to create user ${username}:`, error.message);
      throw error;
    }
  }

  async listUsers(): Promise<UserPermission[]> {
    if (!isLocalDb) {
      console.log("⚠️ User listing not available for cloud databases");
      return [];
    }

    try {
      const result = await this.client.query(`
        SELECT 
          r.rolname as username,
          d.datname as database,
          'CONNECT' as privilege,
          false as grantable
        FROM pg_roles r
        JOIN pg_database d ON has_database_privilege(r.rolname, d.datname, 'CONNECT')
        WHERE d.datname = current_database()
          AND r.rolcanlogin = true
        ORDER BY r.rolname
      `);

      return result.rows;
    } catch (error) {
      console.error("❌ Failed to list users:", error.message);
      throw error;
    }
  }

  /**
   * MAINTENANCE OPERATIONS
   */
  async performMaintenance(): Promise<void> {
    console.log("🔧 Starting database maintenance...");

    if (isLocalDb) {
      try {
        // Vacuum and analyze
        console.log("  🧹 Running VACUUM ANALYZE...");
        await this.client.query("VACUUM ANALYZE");
        console.log("  ✅ VACUUM ANALYZE completed");

        // Update table statistics
        console.log("  📊 Updating table statistics...");
        await this.client.query("ANALYZE");
        console.log("  ✅ Statistics updated");

        // Reindex if needed (be careful with this in production)
        console.log("  🔄 Checking for fragmented indexes...");
        const fragmentedIndexes = await this.client.query(`
          SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
          FROM pg_stat_user_indexes 
          WHERE idx_scan = 0 
          ORDER BY idx_tup_read DESC
          LIMIT 5
        `);

        if (fragmentedIndexes.rows.length > 0) {
          console.log(`  ⚠️ Found ${fragmentedIndexes.rows.length} unused indexes`);
        } else {
          console.log("  ✅ No unused indexes found");
        }

      } catch (error) {
        console.error("❌ Maintenance operation failed:", error.message);
        throw error;
      }
    } else {
      console.log("  ⚠️ Full maintenance not available for cloud databases");
      console.log("  📊 Running basic statistics update...");
      await this.client.query("ANALYZE");
      console.log("  ✅ Statistics updated");
    }

    console.log("✅ Database maintenance completed");
  }

  /**
   * DISASTER RECOVERY
   */
  async generateRecoveryScript(): Promise<string> {
    const timestamp = new Date().toISOString();
    const script = `#!/bin/bash
# Pitchey Database Disaster Recovery Script
# Generated: ${timestamp}
# 
# This script provides step-by-step disaster recovery procedures

set -e

echo "🚨 Pitchey Database Disaster Recovery"
echo "====================================="

# Check if backup file exists
BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Usage: $0 <backup_file>"
    echo "   Example: $0 ./backups/pitchey_backup_2025-01-01.dump"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "📦 Using backup file: $BACKUP_FILE"

# Database connection settings
DB_HOST="${DATABASE_URL.includes('localhost') ? 'localhost' : 'production-host'}"
DB_NAME="pitchey"
DB_USER="postgres"

echo "🔄 Starting recovery process..."

# Step 1: Create new database (if needed)
echo "1️⃣ Preparing database..."
createdb -h $DB_HOST -U $DB_USER $DB_NAME || echo "Database already exists"

# Step 2: Restore from backup
echo "2️⃣ Restoring from backup..."
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME --clean --if-exists --no-owner --no-privileges "$BACKUP_FILE"

# Step 3: Verify critical tables
echo "3️⃣ Verifying critical tables..."
CRITICAL_TABLES=(
    "users"
    "pitches" 
    "feature_flags"
    "portal_configurations"
    "content_items"
    "navigation_menus"
    "translations"
    "content_types"
)

for table in "\${CRITICAL_TABLES[@]}"; do
    COUNT=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
    echo "   $table: $COUNT rows"
done

# Step 4: Run maintenance
echo "4️⃣ Running post-recovery maintenance..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE;" || echo "Maintenance completed with warnings"

# Step 5: Test application connection
echo "5️⃣ Testing application connectivity..."
deno run --allow-all scripts/database-operations.ts test || echo "⚠️ Application test failed - manual verification needed"

echo "✅ Recovery process completed"
echo ""
echo "📋 Post-Recovery Checklist:"
echo "  □ Verify application functionality"
echo "  □ Check data integrity"
echo "  □ Update connection strings if needed"
echo "  □ Monitor performance metrics"
echo "  □ Notify stakeholders of recovery completion"
echo ""
echo "🚨 RTO Target: < 30 minutes"
echo "🚨 RPO Target: < 15 minutes (based on backup frequency)"
`;

    await Deno.writeTextFile("./disaster-recovery.sh", script);
    await Deno.chmod("./disaster-recovery.sh", 0o755);
    
    console.log("📋 Disaster recovery script generated: ./disaster-recovery.sh");
    return "./disaster-recovery.sh";
  }

  /**
   * HEALTH CHECKS
   */
  async performHealthCheck(): Promise<{ status: string; checks: any[] }> {
    const checks = [];
    let overallStatus = "healthy";

    // Database connection
    try {
      await this.client.query("SELECT 1");
      checks.push({ name: "Database Connection", status: "✅ OK", details: "Connection successful" });
    } catch (error) {
      checks.push({ name: "Database Connection", status: "❌ FAIL", details: error.message });
      overallStatus = "unhealthy";
    }

    // Content management tables
    const requiredTables = [
      'feature_flags', 'portal_configurations', 'content_items', 
      'navigation_menus', 'translations', 'content_types', 
      'content_approvals', 'translation_keys'
    ];

    let missingTables = 0;
    for (const table of requiredTables) {
      try {
        await this.client.query(`SELECT 1 FROM "${table}" LIMIT 1`);
      } catch (error) {
        missingTables++;
      }
    }

    if (missingTables === 0) {
      checks.push({ name: "Content Management Tables", status: "✅ OK", details: "All 8 tables present" });
    } else {
      checks.push({ name: "Content Management Tables", status: "⚠️ WARNING", details: `${missingTables} tables missing` });
      if (missingTables > 4) overallStatus = "unhealthy";
    }

    // Connection count
    try {
      const result = await this.client.query(`
        SELECT count(*) as connections 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      const connections = parseInt(result.rows[0].connections);
      
      if (connections < 50) {
        checks.push({ name: "Connection Count", status: "✅ OK", details: `${connections} active connections` });
      } else if (connections < 80) {
        checks.push({ name: "Connection Count", status: "⚠️ WARNING", details: `${connections} active connections` });
      } else {
        checks.push({ name: "Connection Count", status: "❌ CRITICAL", details: `${connections} active connections` });
        overallStatus = "unhealthy";
      }
    } catch (error) {
      checks.push({ name: "Connection Count", status: "❌ FAIL", details: error.message });
    }

    return { status: overallStatus, checks };
  }
}

/**
 * MAIN EXECUTION
 */
async function main() {
  const args = Deno.args;
  const operation = args[0] || "help";

  const dbAdmin = new DatabaseAdmin();

  try {
    await dbAdmin.connect();

    switch (operation) {
      case "pool":
        const maxConnections = args[1] ? parseInt(args[1]) : 20;
        await dbAdmin.setupConnectionPool({ max: maxConnections });
        
        const poolStatus = await dbAdmin.getConnectionPoolStatus();
        console.log("Connection Pool Status:", poolStatus);
        break;

      case "metrics":
        console.log("📊 Database Metrics");
        console.log("==================");
        
        const metrics = await dbAdmin.getDatabaseMetrics();
        console.log(`Active Connections: ${metrics.activeConnections}`);
        console.log(`Idle Connections: ${metrics.idleConnections}`);
        console.log(`Total Connections: ${metrics.totalConnections}/${metrics.maxConnections}`);
        console.log(`Cache Hit Ratio: ${metrics.cacheHitRatio}%`);
        console.log(`Locks Held: ${metrics.locksHeld}`);
        console.log(`Database Size: ${metrics.databaseSize}`);
        console.log(`Longest Query: ${metrics.longestRunningQuery}`);
        if (metrics.lastVacuum) {
          console.log(`Last Vacuum: ${metrics.lastVacuum}`);
        }
        break;

      case "users":
        const users = await dbAdmin.listUsers();
        if (users.length > 0) {
          console.log("Database Users:");
          users.forEach(user => {
            console.log(`  ${user.username} - ${user.privilege} on ${user.database}`);
          });
        } else {
          console.log("No user information available (cloud database)");
        }
        break;

      case "createuser":
        const username = args[1];
        const password = args[2];
        if (!username || !password) {
          console.log("Usage: createuser <username> <password>");
          break;
        }
        await dbAdmin.createAppUser(username, password, ["CONNECT"]);
        break;

      case "maintenance":
        await dbAdmin.performMaintenance();
        break;

      case "recovery":
        await dbAdmin.generateRecoveryScript();
        break;

      case "health":
        const healthCheck = await dbAdmin.performHealthCheck();
        console.log(`📋 Health Check: ${healthCheck.status.toUpperCase()}`);
        console.log("=".repeat(30));
        
        healthCheck.checks.forEach(check => {
          console.log(`${check.status} ${check.name}: ${check.details}`);
        });
        
        if (healthCheck.status !== "healthy") {
          Deno.exit(1);
        }
        break;

      default:
        console.log("Pitchey Database Administration");
        console.log("==============================");
        console.log("");
        console.log("Available operations:");
        console.log("  pool [max_connections]  - Setup connection pooling");
        console.log("  metrics                 - Show database metrics");
        console.log("  users                   - List database users");
        console.log("  createuser <user> <pass> - Create application user");
        console.log("  maintenance             - Run maintenance tasks");
        console.log("  recovery                - Generate recovery script");
        console.log("  health                  - Perform health check");
        console.log("");
        console.log("Examples:");
        console.log("  deno run --allow-all scripts/database-admin.ts pool 25");
        console.log("  deno run --allow-all scripts/database-admin.ts metrics");
        console.log("  deno run --allow-all scripts/database-admin.ts health");
        break;
    }

  } catch (error) {
    console.error("❌ Operation failed:", error.message);
    Deno.exit(1);
  } finally {
    await dbAdmin.disconnect();
  }
}

if (import.meta.main) {
  await main();
}