/**
 * Database Migration Runner using Raw SQL
 * Executes SQL migration files in order
 */

import { RawSQLDatabase } from './raw-sql-connection.ts';
import { dirname, join } from "https://deno.land/std@0.208.0/path/mod.ts";

async function runMigrations() {
  console.log("Running migrations...");

  // Get connection string with fallback
  const connectionString = Deno.env.get("DATABASE_URL") || 
    "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  // Find project root by looking for deno.json, starting from script location
  let currentDir = dirname(new URL(import.meta.url).pathname);
  while (currentDir !== "/") {
    try {
      const stat = Deno.statSync(join(currentDir, "deno.json"));
      if (stat.isFile) break;
    } catch {
      // deno.json not found, continue searching up
    }
    currentDir = dirname(currentDir);
  }

  const migrationsFolder = join(currentDir, "drizzle");

  // Verify migrations folder exists
  try {
    const stat = Deno.statSync(migrationsFolder);
    if (!stat.isDirectory) {
      console.error(`❌ Migrations folder not found at ${migrationsFolder}`);
      throw new Error(`Migrations folder not found at ${migrationsFolder}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Migrations folder not accessible: ${errorMessage}`);
    throw new Error(`Migrations folder not accessible: ${errorMessage}`);
  }

  // Get migration files
  const migrationFiles = [];
  try {
    for (const entry of Deno.readDirSync(migrationsFolder)) {
      if (entry.isFile && entry.name.endsWith('.sql')) {
        migrationFiles.push(entry.name);
      }
    }
    migrationFiles.sort(); // Ensure they run in order
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error reading migration files: ${errorMessage}`);
    throw new Error(`Error reading migration files: ${errorMessage}`);
  }

  if (migrationFiles.length === 0) {
    console.log("✅ No migration files found, skipping migration");
    return; // Exit gracefully
  }

  console.log(`📂 Found ${migrationFiles.length} migration files`);

  // Create database connection
  const db = new RawSQLDatabase({
    connectionString,
    maxRetries: 3,
    retryDelayMs: 100,
    queryTimeoutMs: 30000 // 30 seconds for migrations
  });

  try {
    // Create migrations tracking table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        created_at BIGINT NOT NULL
      )
    `);

    console.log("🚀 Starting migrations...");

    let appliedCount = 0;
    let skippedCount = 0;

    for (const fileName of migrationFiles) {
      const filePath = join(migrationsFolder, fileName);
      const sqlContent = await Deno.readTextFile(filePath);
      
      // Use filename as hash for tracking
      const hash = fileName;
      
      // Check if migration has already been applied
      const existing = await db.queryOne<{ id: number }>(`
        SELECT id FROM __drizzle_migrations WHERE hash = $1
      `, [hash]);
      
      if (existing) {
        console.log(`⏭️  Skipping migration: ${fileName} (already applied)`);
        skippedCount++;
        continue;
      }
      
      console.log(`🔄 Applying migration: ${fileName}`);
      
      try {
        // Run migration in a transaction
        await db.transaction(async (sql) => {
          // Split SQL content by semicolons but be careful with strings
          const statements = sqlContent
            .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
            .filter(s => s.trim().length > 0);
          
          for (const statement of statements) {
            if (statement.trim()) {
              await sql(statement);
            }
          }
          
          // Record migration as applied
          await sql`
            INSERT INTO __drizzle_migrations (hash, created_at)
            VALUES (${hash}, ${Date.now()})
          `;
        });
        
        console.log(`✅ Applied migration: ${fileName}`);
        appliedCount++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to apply migration ${fileName}: ${errorMessage}`);
        throw error;
      }
    }

    // Summary
    console.log("\n📊 Migration Summary:");
    console.log(`   Applied: ${appliedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${migrationFiles.length}`);

    if (appliedCount > 0) {
      console.log("\n✅ Migrations completed successfully!");
    } else {
      console.log("\n✅ All migrations were already applied.");
    }

    // Check database health
    const isHealthy = await db.healthCheck();
    if (isHealthy) {
      console.log("🏥 Database health check: OK");
    } else {
      console.warn("⚠️ Database health check failed");
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Migration failed: ${errorMessage}`);
    Deno.exit(1);
  }
}

// Run migrations if this is the main module
if (import.meta.main) {
  await runMigrations();
}