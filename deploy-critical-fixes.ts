#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Deploy Critical Production Fixes
 * Addresses issues identified in January 2026 health analysis
 */

import { createDatabase } from './src/db/raw-sql-connection.ts';

interface MigrationResult {
  success: boolean;
  message: string;
  error?: string;
}

async function deployDatabaseMigration(): Promise<MigrationResult> {
  console.log("🔄 Starting database migration...");
  
  const dbUrl = Deno.env.get("DATABASE_URL") || 
    "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  try {
    // Use direct psql command for more reliable execution
    const migrationPath = './src/db/migrations/add_missing_tables.sql';
    
    console.log("📋 Executing migration SQL via psql...");
    
    // Extract connection details from URL
    const url = new URL(dbUrl);
    const host = url.hostname;
    const username = url.username;
    const password = url.password;
    const database = url.pathname.slice(1); // Remove leading /
    
    // Execute migration using psql
    const command = [
      'psql',
      '-h', host,
      '-U', username, 
      '-d', database,
      '-f', migrationPath,
      '-v', 'ON_ERROR_STOP=1'
    ];
    
    const process = new Deno.Command('psql', {
      args: command.slice(1),
      env: { 'PGPASSWORD': password },
      stdout: 'piped',
      stderr: 'piped'
    });
    
    const { code, stdout, stderr } = await process.output();
    
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr);
      throw new Error(`Migration failed: ${error}`);
    }
    
    const output = new TextDecoder().decode(stdout);
    console.log("📋 Migration output:", output);
    
    console.log("✅ Database migration completed successfully");
    
    return {
      success: true,
      message: "Migration completed successfully"
    };
    
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    return {
      success: false,
      message: "Migration failed",
      error: error.message
    };
  }
}

async function verifyProduction(): Promise<void> {
  console.log("\n🔍 Verifying production deployment...");
  
  const endpoints = [
    "https://pitchey-api-prod.ndlovucavelle.workers.dev/health",
    "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health",
    "https://pitchey-api-prod.ndlovucavelle.workers.dev/api/trending",
    "https://pitchey-5o8-66n.pages.dev"
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { 
        method: 'GET',
        headers: { 'User-Agent': 'Pitchey-DeploymentVerification/1.0' }
      });
      
      const status = response.status === 200 ? "✅" : "❌";
      console.log(`${status} ${endpoint} - ${response.status}`);
      
    } catch (error: any) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
  }
}

async function checkEnvironmentVariables(): Promise<void> {
  console.log("\n🔧 Checking environment configuration...");
  
  const requiredVars = [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET', 
    'BETTER_AUTH_URL'
  ];
  
  for (const varName of requiredVars) {
    const value = Deno.env.get(varName);
    if (value) {
      console.log(`✅ ${varName} - Configured`);
    } else {
      console.log(`❌ ${varName} - Missing`);
      console.log(`   Run: wrangler secret put ${varName}`);
    }
  }
}

async function main(): Promise<void> {
  console.log("🚀 Pitchey Critical Production Fixes Deployment");
  console.log("================================================");
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Environment: ${Deno.env.get('DENO_ENV') || 'development'}\n`);
  
  // 1. Check environment variables
  await checkEnvironmentVariables();
  
  // 2. Deploy database migration
  const migrationResult = await deployDatabaseMigration();
  if (!migrationResult.success) {
    console.log("\n❌ Migration failed. Check DATABASE_URL and try again.");
    console.log("Error:", migrationResult.error);
    Deno.exit(1);
  }
  
  // 3. Verify production
  await verifyProduction();
  
  console.log("\n✅ Critical fixes deployment completed!");
  console.log("\n📋 Next steps:");
  console.log("1. Configure missing environment variables with wrangler");
  console.log("2. Deploy Worker: wrangler deploy");
  console.log("3. Run health check: deno run --allow-net health-check.ts");
  console.log("\n🔗 Production URLs:");
  console.log("Frontend: https://pitchey-5o8-66n.pages.dev/");
  console.log("API: https://pitchey-api-prod.ndlovucavelle.workers.dev");
}

if (import.meta.main) {
  await main();
}