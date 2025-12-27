/**
 * Migration runner for Neon PostgreSQL using raw SQL
 * Executes SQL migration files without Drizzle ORM
 */

import { neon } from '@neondatabase/serverless';

// Get database URL from environment
const DATABASE_URL = Deno.env.get('DATABASE_URL');

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Usage: DATABASE_URL="postgresql://..." deno run --allow-all run-raw-sql-migrations.ts');
  Deno.exit(1);
}

// Create SQL connection
const sql = neon(DATABASE_URL);

// Test connection
async function testConnection() {
  try {
    const result = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connected:', result[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    return false;
  }
}

// Migration tracking table
async function createMigrationTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Migration tracking table ready');
  } catch (error) {
    console.error('❌ Failed to create migration table:', error);
    throw error;
  }
}

// Get list of executed migrations
async function getExecutedMigrations(): Promise<Set<string>> {
  try {
    const result = await sql`
      SELECT filename FROM schema_migrations ORDER BY filename
    `;
    return new Set(result.map((row: any) => row.filename));
  } catch (error) {
    console.error('❌ Failed to get executed migrations:', error);
    return new Set();
  }
}

// Parse SQL file into individual statements
function parseSQLStatements(sqlContent: string): string[] {
  // Handle special cases like functions and triggers that contain semicolons
  const statements: string[] = [];
  let currentStatement = '';
  let inFunction = false;
  let inDollarQuote = false;
  
  const lines = sqlContent.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for function/trigger start
    if (trimmedLine.match(/^CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i) ||
        trimmedLine.match(/^CREATE\s+(OR\s+REPLACE\s+)?TRIGGER/i)) {
      inFunction = true;
    }
    
    // Check for dollar quote start/end
    if (line.includes('$$')) {
      inDollarQuote = !inDollarQuote;
    }
    
    currentStatement += line + '\n';
    
    // Check for statement end
    if (trimmedLine.endsWith(';') && !inFunction && !inDollarQuote) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
    
    // Check for function end
    if (inFunction && trimmedLine.match(/^\$\$\s+language/i)) {
      inFunction = false;
      if (trimmedLine.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
  }
  
  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  return statements.filter(stmt => 
    stmt.length > 0 && 
    !stmt.match(/^--/) && // Skip comments
    !stmt.match(/^\s*$/)  // Skip empty lines
  );
}

// Execute a migration file
async function executeMigration(filePath: string, filename: string) {
  console.log(`\n📄 Executing migration: ${filename}`);
  
  try {
    // Read migration file
    const sqlContent = await Deno.readTextFile(filePath);
    
    // Parse SQL statements
    const statements = parseSQLStatements(sqlContent);
    console.log(`   Found ${statements.length} SQL statements`);
    
    // Execute each statement
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements
      if (!statement.trim()) continue;
      
      try {
        // Show progress for long migrations
        if (statements.length > 10 && i % 10 === 0) {
          console.log(`   Progress: ${i}/${statements.length} statements...`);
        }
        
        // Execute the statement
        await sql(statement);
        successCount++;
        
      } catch (error: any) {
        // Handle common "already exists" errors gracefully
        if (error.message?.includes('already exists') ||
            error.message?.includes('duplicate key')) {
          skipCount++;
          // console.log(`   ⏭️  Skipping (already exists): ${statement.substring(0, 50)}...`);
        } else {
          console.error(`   ❌ Statement ${i + 1} failed:`, error.message);
          console.error(`   Statement: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }
    }
    
    // Record successful migration
    try {
      await sql`
        INSERT INTO schema_migrations (filename) 
        VALUES (${filename})
        ON CONFLICT (filename) DO NOTHING
      `;
    } catch (error) {
      console.log(`   ⚠️  Migration already recorded: ${filename}`);
    }
    
    console.log(`   ✅ Migration completed: ${successCount} executed, ${skipCount} skipped`);
    
  } catch (error) {
    console.error(`❌ Failed to execute migration ${filename}:`, error);
    throw error;
  }
}

// Main migration runner
async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');
  console.log(`📊 Database: ${DATABASE_URL.split('@')[1]?.split('/')[0] || 'Unknown'}\n`);
  
  // Test database connection
  const connected = await testConnection();
  if (!connected) {
    Deno.exit(1);
  }
  
  try {
    // Create migration tracking table
    await createMigrationTable();
    
    // Get executed migrations
    const executed = await getExecutedMigrations();
    console.log(`📊 Found ${executed.size} previously executed migrations\n`);
    
    // Get migration files
    const migrationsDir = './src/db/migrations';
    const files: string[] = [];
    
    try {
      for await (const entry of Deno.readDir(migrationsDir)) {
        if (entry.isFile && entry.name.endsWith('.sql')) {
          files.push(entry.name);
        }
      }
    } catch (error) {
      console.error(`❌ Could not read migrations directory: ${migrationsDir}`);
      console.log('\nPlease ensure the directory exists and contains migration files');
      console.log('Expected path:', new URL(migrationsDir, import.meta.url).pathname);
      Deno.exit(1);
    }
    
    // Sort migration files by name (they should be numbered)
    files.sort();
    
    console.log(`📁 Found ${files.length} migration files\n`);
    
    // Execute pending migrations
    let pendingCount = 0;
    let skippedCount = 0;
    
    for (const filename of files) {
      if (!executed.has(filename)) {
        const filePath = `${migrationsDir}/${filename}`;
        await executeMigration(filePath, filename);
        pendingCount++;
      } else {
        console.log(`⏭️  Already executed: ${filename}`);
        skippedCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (pendingCount === 0) {
      console.log('✨ No pending migrations to run');
    } else {
      console.log(`✨ Successfully executed ${pendingCount} new migrations`);
    }
    
    if (skippedCount > 0) {
      console.log(`📝 Skipped ${skippedCount} previously executed migrations`);
    }
    
    // Show current schema status
    const tableCount = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    
    const indexCount = await sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
    `;
    
    console.log(`\n📊 Database Schema Status:`);
    console.log(`   Tables: ${tableCount[0].count}`);
    console.log(`   Indexes: ${indexCount[0].count}`);
    
    // Show newly created tables if any
    if (pendingCount > 0) {
      const newTables = await sql`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename IN (
          'contracts', 'contract_milestones', 'creator_revenue',
          'production_companies', 'production_projects', 'production_talent',
          'production_crew', 'location_scouts', 'production_budgets',
          'production_schedules', 'pitch_views', 'pitch_likes',
          'pitch_shares', 'saved_pitches', 'user_activity',
          'search_logs', 'page_views', 'reviews',
          'investment_interests', 'production_interests'
        )
        ORDER BY tablename
      `;
      
      if (newTables.length > 0) {
        console.log(`\n📋 Newly created tables:`);
        for (const table of newTables) {
          console.log(`   ✓ ${table.tablename}`);
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ Migration process failed:', error);
    Deno.exit(1);
  }
}

// Run migrations
if (import.meta.main) {
  await runMigrations();
  console.log('\n✅ Migration process complete!\n');
  Deno.exit(0);
}

export { runMigrations };