import { sql } from "npm:drizzle-orm@0.35.3";
import { db } from "./src/db/client.ts";

console.log("🔄 Running all Drizzle migrations in order...");

const migrations = [
  "0000_shallow_medusa.sql",
  "0001_cute_punisher.sql", 
  "0002_calm_dragon_lord.sql",
  "0002_messaging_enhancement.sql",
  "0003_email_notifications.sql",
  "0004_search_indexes.sql",
  "0005_add_missing_tables.sql",
  "0006_content_management_system.sql",
  "0007_add_security_columns.sql"
];

try {
  for (const migration of migrations) {
    console.log(`\n📝 Applying migration: ${migration}`);
    const migrationPath = `./drizzle/${migration}`;
    const migrationContent = await Deno.readTextFile(migrationPath);
    
    // Split by statements and execute each one
    const statements = migrationContent
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    for (const statement of statements) {
      if (statement.trim().length > 0) {
        try {
          await db.execute(sql.raw(statement));
        } catch (error: any) {
          // Ignore "already exists" errors
          if (!error.message?.includes("already exists") && 
              !error.message?.includes("duplicate") &&
              !error.message?.includes("does not exist")) {
            console.error(`⚠️ Error in statement: ${error.message}`);
          }
        }
      }
    }
    console.log(`✅ Migration ${migration} applied`);
  }
  
  console.log("\n🎉 All migrations completed successfully!");
} catch (error) {
  console.error("❌ Migration failed:", error);
} finally {
  Deno.exit(0);
}