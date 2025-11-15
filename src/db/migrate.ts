import postgres from "npm:postgres@^3.4.0";
import { neon } from "npm:@neondatabase/serverless@0.9.5";
import { dirname, join } from "https://deno.land/std@0.208.0/path/mod.ts";

async function runMigrations() {
  console.log("Running migrations...");

  // Get connection string with fallback
  const connectionString = Deno.env.get("DATABASE_URL") || 
    "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

  // Check if we're using local postgres or Neon
  const isLocalDb = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

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
    return; // Exit gracefully instead of Deno.exit(0)
  }

  console.log(`📂 Found ${migrationFiles.length} migration files`);

  // Create appropriate database client
  let client: any;
  try {
    if (isLocalDb) {
      console.log("🔗 Connecting to local PostgreSQL...");
      client = postgres(connectionString, { max: 1 });
    } else {
      console.log("🔗 Connecting to Neon database...");
      const neonClient = neon(connectionString);
      client = {
        unsafe: async (sql: string) => {
          const result = await neonClient(sql);
          return result;
        },
        end: async () => {
          // Neon doesn't need explicit cleanup
          return Promise.resolve();
        }
      };
    }

    // Create migrations tracking table if it doesn't exist
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);

    console.log("🚀 Starting migrations...");

    for (const fileName of migrationFiles) {
      const filePath = join(migrationsFolder, fileName);
      const sqlContent = await Deno.readTextFile(filePath);
      
      // Simple hash of filename for tracking (this is basic but functional)
      const hash = fileName;
      
      // Check if migration has already been applied
      const existingResult = await client.unsafe(`
        SELECT 1 FROM __drizzle_migrations WHERE hash = '${hash}' LIMIT 1;
      `);
      
      const hasExisting = isLocalDb 
        ? (existingResult && existingResult.length > 0)
        : (existingResult && existingResult.rows && existingResult.rows.length > 0);
      
      if (hasExisting) {
        console.log(`⏭️  Skipping ${fileName} (already applied)`);
        continue;
      }
      
      try {
        console.log(`🔄 Applying ${fileName}...`);
        
        // Split SQL content by appropriate delimiters and execute each statement separately
        let statements: string[];
        
        if (sqlContent.includes('--> statement-breakpoint')) {
          // Drizzle-generated migration with breakpoints
          statements = sqlContent
            .split('--> statement-breakpoint')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        } else {
          // Manual migration file - split by semicolons but be careful of dollar quotes
          statements = sqlContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('--'))
            .join('\n')
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        }
        
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await client.unsafe(statement);
            } catch (statementError: any) {
              // Log non-critical errors but continue
              const errorMessage = statementError.message.toLowerCase();
              if (errorMessage.includes('already exists') || 
                  errorMessage.includes('relation already exists') ||
                  errorMessage.includes('column already exists') ||
                  errorMessage.includes('does not exist') ||
                  errorMessage.includes('constraint already exists') ||
                  errorMessage.includes('duplicate key value')) {
                console.log(`⚠️  Skipping statement (schema mismatch): ${statementError.message.slice(0, 80)}...`);
              } else {
                // Re-throw critical errors
                throw statementError;
              }
            }
          }
        }
        
        // Record migration as applied
        await client.unsafe(`
          INSERT INTO __drizzle_migrations (hash, created_at) 
          VALUES ('${hash}', ${Date.now()})
        `);
        
        console.log(`✅ Applied ${fileName}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error applying ${fileName}:`, errorMessage);
        throw error;
      }
    }

    console.log("✅ All migrations completed successfully!");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Migration failed:", errorMessage);
    throw error; // Let the error propagate instead of Deno.exit(1)
  } finally {
    // Clean up connection
    if (client && typeof client.end === 'function') {
      try {
        await client.end();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn("⚠️  Warning: Error closing database connection:", errorMessage);
      }
    }
  }
}

// Run the migration function
if (import.meta.main) {
  try {
    await runMigrations();
    console.log("✅ Migration script completed successfully!");
  } catch (error) {
    console.error("❌ Migration script failed:", error);
    // In serverless environments, throw the error instead of Deno.exit(1)
    throw error;
  }
}