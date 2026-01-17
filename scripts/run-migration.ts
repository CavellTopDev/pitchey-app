#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Database Migration Runner for Neon PostgreSQL
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/run-migration.ts
 *
 * Or with specific migration:
 *   deno run --allow-net --allow-env --allow-read scripts/run-migration.ts 999_consolidated_schema.sql
 *
 * Environment Variables Required:
 *   DATABASE_URL - Neon PostgreSQL connection string
 */

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = Deno.env.get("DATABASE_URL") ||
  "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

async function runMigration(migrationFile?: string) {
  console.log("🚀 Starting Pitchey Database Migration");
  console.log("=====================================\n");

  // Connect to database
  console.log("📡 Connecting to Neon PostgreSQL...");
  const sql = neon(DATABASE_URL);

  // Test connection
  try {
    const result = await sql`SELECT NOW() as current_time, current_database() as database`;
    console.log(`✅ Connected to database: ${result[0].database}`);
    console.log(`   Server time: ${result[0].current_time}\n`);
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    Deno.exit(1);
  }

  // Determine which migration to run
  const migrationPath = migrationFile
    ? `src/db/migrations/${migrationFile}`
    : "src/db/migrations/999_consolidated_schema.sql";

  console.log(`📄 Loading migration: ${migrationPath}`);

  // Read migration file
  let migrationSQL: string;
  try {
    migrationSQL = await Deno.readTextFile(migrationPath);
    console.log(`✅ Migration file loaded (${migrationSQL.length} bytes)\n`);
  } catch (error) {
    console.error("❌ Failed to read migration file:", error);
    Deno.exit(1);
  }

  // Split into individual statements (basic split, handles most cases)
  const statements = splitSQLStatements(migrationSQL);
  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  // Execute each statement
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    if (!statement || statement.startsWith("--")) continue;

    const preview = statement.substring(0, 60).replace(/\n/g, " ");
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);

    try {
      await sql.query(statement);
      console.log("✅");
      successCount++;
    } catch (error: any) {
      // Some errors are expected (e.g., IF NOT EXISTS when table exists)
      if (
        error.message?.includes("already exists") ||
        error.message?.includes("does not exist") && statement.includes("DROP")
      ) {
        console.log("⏭️ (skipped - already applied)");
        successCount++;
      } else {
        console.log(`❌ Error: ${error.message?.substring(0, 100)}`);
        errorCount++;
      }
    }
  }

  console.log("\n=====================================");
  console.log("📊 Migration Summary:");
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  // Verify tables
  console.log("\n🔍 Verifying critical tables...");
  const criticalTables = [
    "users",
    "pitches",
    "follows",
    "notifications",
    "saved_pitches",
    "likes",
    "views",
    "nda_requests",
    "portfolio",
    "investments",
    "messages",
  ];

  for (const table of criticalTables) {
    try {
      const result = await sql`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ${table}
      `;
      if (result[0].count > 0) {
        const countResult = await sql.query(
          `SELECT COUNT(*) as rows FROM ${table}`,
        );
        console.log(`   ✅ ${table}: exists (${countResult[0].rows} rows)`);
      } else {
        console.log(`   ❌ ${table}: MISSING`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ ${table}: ${error.message?.substring(0, 50)}`);
    }
  }

  console.log("\n✨ Migration complete!");
}

function splitSQLStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";

  const lines = sql.split("\n");

  for (const line of lines) {
    // Check for dollar-quoted strings (used in functions)
    const dollarMatch = line.match(/\$([a-zA-Z_]*)\$/);
    if (dollarMatch && !inDollarQuote) {
      inDollarQuote = true;
      dollarTag = dollarMatch[0];
    } else if (inDollarQuote && line.includes(dollarTag)) {
      // Check if this closes the dollar quote
      const parts = line.split(dollarTag);
      if (parts.length >= 2) {
        inDollarQuote = false;
        dollarTag = "";
      }
    }

    current += line + "\n";

    // Only split on semicolons outside of dollar quotes
    if (!inDollarQuote && line.trim().endsWith(";")) {
      statements.push(current.trim());
      current = "";
    }
  }

  // Add any remaining content
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements.filter((s) => s && !s.match(/^\s*--/));
}

// Node.js compatibility for process.stdout.write
const process = {
  stdout: {
    write: (text: string) => {
      const encoder = new TextEncoder();
      Deno.stdout.writeSync(encoder.encode(text));
    },
  },
};

// Run migration
const migrationFile = Deno.args[0];
await runMigration(migrationFile);
