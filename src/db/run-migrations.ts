import { db } from "./client.ts";
import { sql } from "npm:drizzle-orm";

async function runMigrations() {
  console.log("🚀 Starting database migrations...");

  try {
    // Read and execute the migration SQL file
    const migrationSQL = await Deno.readTextFile("./src/db/migrations/003_analytics_and_investments.sql");
    
    // Split by semicolons but be careful with functions
    const statements = migrationSQL
      .split(/;\s*$|;\s*\n/gm)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ";");

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      if (statement.trim().startsWith("--") || statement.trim().length === 0) {
        continue;
      }

      try {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await db.execute(sql.raw(statement));
        successCount++;
      } catch (error) {
        console.error(`Error executing statement: ${error.message}`);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
        errorCount++;
      }
    }

    console.log(`✅ Migration completed: ${successCount} statements succeeded, ${errorCount} failed`);

    // Verify tables were created
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log("\n📊 Current database tables:");
    tables.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error("❌ Migration failed:", error);
    Deno.exit(1);
  }
}

// Run migrations if this file is executed directly
if (import.meta.main) {
  await runMigrations();
  Deno.exit(0);
}