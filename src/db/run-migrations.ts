#!/usr/bin/env -S deno run --allow-env --allow-read --allow-net

/**
 * Database Migration Runner
 * Executes SQL migrations in order for Pitchey platform
 */

import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { resolve, join } from "https://deno.land/std@0.208.0/path/mod.ts";

// Migration configuration
const MIGRATIONS_DIR = "./migrations";
const MIGRATIONS_TABLE = "schema_migrations";

interface Migration {
  filename: string;
  content: string;
  order: number;
}

class MigrationRunner {
  private client: Client;

  constructor(private databaseUrl: string) {
    // Parse database URL
    const url = new URL(databaseUrl);
    this.client = new Client({
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      hostname: url.hostname,
      port: parseInt(url.port || "5432"),
      tls: {
        enabled: url.searchParams.get("sslmode") === "require",
        enforceSSL: false,
        rejectUnauthorized: false,
      },
    });
  }

  async connect() {
    try {
      await this.client.connect();
      console.log("✅ Connected to database");
    } catch (error) {
      console.error("❌ Failed to connect to database:", error);
      throw error;
    }
  }

  async disconnect() {
    await this.client.end();
  }

  async ensureMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await this.client.queryObject(query);
    console.log("✅ Migrations table ready");
  }

  async getExecutedMigrations(): Promise<string[]> {
    const result = await this.client.queryObject<{ filename: string }>(
      `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY filename`
    );
    return result.rows.map(row => row.filename);
  }

  async loadMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];
    const migrationsPath = resolve(Deno.cwd(), MIGRATIONS_DIR);

    try {
      for await (const entry of Deno.readDir(migrationsPath)) {
        if (entry.isFile && entry.name.endsWith(".sql")) {
          const content = await Deno.readTextFile(join(migrationsPath, entry.name));
          const orderMatch = entry.name.match(/^(\d+)/);
          const order = orderMatch ? parseInt(orderMatch[1]) : 999;
          
          migrations.push({
            filename: entry.name,
            content,
            order,
          });
        }
      }
    } catch (error) {
      console.error("❌ Failed to load migrations:", error);
      throw error;
    }

    // Sort by order number
    migrations.sort((a, b) => a.order - b.order);
    return migrations;
  }

  async executeMigration(migration: Migration) {
    console.log(`\n📝 Executing migration: ${migration.filename}`);
    
    try {
      // Start transaction
      await this.client.queryObject("BEGIN");

      // Execute migration SQL
      await this.client.queryObject(migration.content);

      // Record migration
      await this.client.queryObject(
        `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
        [migration.filename]
      );

      // Commit transaction
      await this.client.queryObject("COMMIT");
      
      console.log(`✅ Migration completed: ${migration.filename}`);
    } catch (error) {
      // Rollback on error
      await this.client.queryObject("ROLLBACK");
      console.error(`❌ Migration failed: ${migration.filename}`, error);
      throw error;
    }
  }

  async run(isDryRun = false) {
    console.log("\n🚀 Starting database migration process...");
    
    if (isDryRun) {
      console.log("🔍 DRY RUN MODE - No changes will be made");
    }

    try {
      await this.connect();
      await this.ensureMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();
      const allMigrations = await this.loadMigrations();

      console.log(`\n📊 Migration Status:`);
      console.log(`- Total migrations: ${allMigrations.length}`);
      console.log(`- Already executed: ${executedMigrations.length}`);

      const pendingMigrations = allMigrations.filter(
        m => !executedMigrations.includes(m.filename)
      );

      if (pendingMigrations.length === 0) {
        console.log("\n✨ Database is up to date! No pending migrations.");
        return;
      }

      console.log(`\n🔄 Pending migrations: ${pendingMigrations.length}`);
      pendingMigrations.forEach(m => console.log(`  - ${m.filename}`));

      if (isDryRun) {
        console.log("\n🔍 Dry run complete. No migrations were executed.");
        return;
      }

      // Execute pending migrations
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log("\n✨ All migrations completed successfully!");

      // Display summary
      await this.displayTableSummary();

    } catch (error) {
      console.error("\n❌ Migration process failed:", error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  async displayTableSummary() {
    console.log("\n📋 Database Table Summary:");
    
    const result = await this.client.queryObject<{ tablename: string, index_count: number }>`
      SELECT 
        t.tablename,
        COUNT(i.indexname) as index_count
      FROM pg_tables t
      LEFT JOIN pg_indexes i ON t.tablename = i.tablename
      WHERE t.schemaname = 'public'
      GROUP BY t.tablename
      ORDER BY t.tablename;
    `;

    console.log("\nTables and their index counts:");
    result.rows.forEach(row => {
      console.log(`  - ${row.tablename}: ${row.index_count} indexes`);
    });

    const totalTables = result.rows.length;
    const totalIndexes = result.rows.reduce((sum, row) => sum + row.index_count, 0);
    
    console.log(`\n📊 Totals: ${totalTables} tables, ${totalIndexes} indexes`);
  }
}

// Main execution
if (import.meta.main) {
  const databaseUrl = Deno.env.get("DATABASE_URL");
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    Deno.exit(1);
  }

  const isDryRun = Deno.args.includes("--dry-run");
  const runner = new MigrationRunner(databaseUrl);
  
  try {
    await runner.run(isDryRun);
    Deno.exit(0);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    Deno.exit(1);
  }
}