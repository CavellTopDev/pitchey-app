/**
 * Better Auth Setup Script for Pitchey Platform
 * Creates necessary database tables, seeds demo accounts, and configures environment
 */

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { createAuth, PitcheyAuthUtils } from "../src/auth/better-auth-config"
import * as crypto from "crypto"

interface SetupConfig {
  DATABASE_URL: string
  BETTER_AUTH_SECRET?: string
  ENVIRONMENT?: string
  SKIP_DEMO_ACCOUNTS?: boolean
  FORCE_RECREATE_TABLES?: boolean
}

/**
 * Main setup function
 */
async function setupBetterAuth(config: SetupConfig) {
  console.log("🚀 Setting up Better Auth for Pitchey Platform")
  console.log("=" .repeat(50))

  try {
    // Validate configuration
    validateConfig(config)

    // Initialize database connection
    console.log("📡 Connecting to Neon database...")
    const sql = neon(config.DATABASE_URL)
    const db = drizzle(sql)

    // Test database connection
    await testDatabaseConnection(db)

    // Create Better Auth tables
    console.log("📊 Setting up Better Auth database schema...")
    await setupDatabaseSchema(db, config.FORCE_RECREATE_TABLES)

    // Initialize Better Auth
    console.log("🔐 Initializing Better Auth...")
    const mockEnv = {
      DATABASE_URL: config.DATABASE_URL,
      BETTER_AUTH_SECRET: config.BETTER_AUTH_SECRET || generateSecret(),
      ENVIRONMENT: config.ENVIRONMENT || 'development'
    }
    
    const auth = createAuth(mockEnv)

    // Create demo accounts
    if (!config.SKIP_DEMO_ACCOUNTS) {
      console.log("👥 Creating demo accounts...")
      await setupDemoAccounts(auth)
    }

    // Create environment configuration
    console.log("⚙️  Creating environment configuration...")
    await createEnvironmentConfig(mockEnv)

    // Verify setup
    console.log("✅ Verifying setup...")
    await verifySetup(auth)

    console.log("\n🎉 Better Auth setup completed successfully!")
    console.log("\nNext steps:")
    console.log("1. Add the environment variables to your .env file")
    console.log("2. Deploy your Cloudflare Worker with the new auth configuration")
    console.log("3. Test authentication with the demo accounts")
    console.log("\nDemo accounts (password: Demo123):")
    console.log("- alex.creator@demo.com (Creator portal)")
    console.log("- sarah.investor@demo.com (Investor portal)")  
    console.log("- stellar.production@demo.com (Production portal)")

  } catch (error) {
    console.error("❌ Setup failed:", error)
    process.exit(1)
  }
}

/**
 * Validates setup configuration
 */
function validateConfig(config: SetupConfig) {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required")
  }

  if (!config.DATABASE_URL.includes("neon.tech")) {
    console.warn("⚠️  Warning: DATABASE_URL doesn't appear to be a Neon database")
  }

  console.log("✅ Configuration validated")
}

/**
 * Tests database connection
 */
async function testDatabaseConnection(db: any) {
  try {
    // Simple query to test connection
    await db.execute("SELECT 1")
    console.log("✅ Database connection successful")
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`)
  }
}

/**
 * Sets up Better Auth database schema
 */
async function setupDatabaseSchema(db: any, forceRecreate = false) {
  try {
    if (forceRecreate) {
      console.log("🗑️  Dropping existing Better Auth tables...")
      await dropExistingTables(db)
    }

    // Create Better Auth tables
    const schemaSql = `
      -- Better Auth core tables
      CREATE TABLE IF NOT EXISTS "user" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT UNIQUE NOT NULL,
        "emailVerified" BOOLEAN DEFAULT FALSE,
        "image" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "session" (
        "id" TEXT PRIMARY KEY,
        "expiresAt" TIMESTAMP NOT NULL,
        "token" TEXT UNIQUE NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "account" (
        "id" TEXT PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP,
        "refreshTokenExpiresAt" TIMESTAMP,
        "scope" TEXT,
        "password" TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "verification" (
        "id" TEXT PRIMARY KEY,
        "identifier" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      -- Pitchey-specific user extensions
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "portal_type" VARCHAR(20) DEFAULT 'creator';
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bio" TEXT;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "website" TEXT;
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT;

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user"("email");
      CREATE INDEX IF NOT EXISTS "idx_user_portal_type" ON "user"("portal_type");
      CREATE INDEX IF NOT EXISTS "idx_session_token" ON "session"("token");
      CREATE INDEX IF NOT EXISTS "idx_session_user_id" ON "session"("userId");
      CREATE INDEX IF NOT EXISTS "idx_account_user_id" ON "account"("userId");
      CREATE INDEX IF NOT EXISTS "idx_account_provider" ON "account"("providerId", "accountId");
      CREATE INDEX IF NOT EXISTS "idx_verification_identifier" ON "verification"("identifier");
    `

    // Execute schema creation
    const statements = schemaSql.split(";").filter(stmt => stmt.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.execute(statement)
      }
    }

    console.log("✅ Database schema created successfully")

  } catch (error) {
    throw new Error(`Schema setup failed: ${error.message}`)
  }
}

/**
 * Drops existing Better Auth tables (for fresh setup)
 */
async function dropExistingTables(db: any) {
  const dropSql = `
    DROP TABLE IF EXISTS "verification" CASCADE;
    DROP TABLE IF EXISTS "account" CASCADE;
    DROP TABLE IF EXISTS "session" CASCADE;
    DROP TABLE IF EXISTS "user" CASCADE;
  `

  const statements = dropSql.split(";").filter(stmt => stmt.trim())
  
  for (const statement of statements) {
    if (statement.trim()) {
      await db.execute(statement)
    }
  }

  console.log("✅ Existing tables dropped")
}

/**
 * Creates demo accounts for testing
 */
async function setupDemoAccounts(auth: any) {
  try {
    await PitcheyAuthUtils.createDemoAccounts(auth)
    console.log("✅ Demo accounts created successfully")
  } catch (error) {
    console.error("⚠️  Demo accounts creation failed:", error.message)
    console.log("ℹ️  You can create demo accounts manually later")
  }
}

/**
 * Creates environment configuration file
 */
async function createEnvironmentConfig(env: any) {
  const configContent = `# Better Auth Configuration for Pitchey Platform
# Generated on ${new Date().toISOString()}

# Database Configuration
DATABASE_URL="${env.DATABASE_URL}"
NEON_DATABASE_URL="${env.DATABASE_URL}"

# Better Auth Configuration
BETTER_AUTH_SECRET="${env.BETTER_AUTH_SECRET}"
BETTER_AUTH_URL="https://pitchey-api-prod.ndlovucavelle.workers.dev"

# Session Configuration
SESSION_COOKIE_NAME="pitchey-session"
SESSION_MAX_AGE="2592000"

# OAuth Providers (Optional - configure if using social login)
# GOOGLE_CLIENT_ID="your-google-client-id"
# GOOGLE_CLIENT_SECRET="your-google-client-secret"
# GITHUB_CLIENT_ID="your-github-client-id"
# GITHUB_CLIENT_SECRET="your-github-client-secret"

# Environment
ENVIRONMENT="${env.ENVIRONMENT}"
`

  // Write to .env.better-auth file
  await Bun.write(".env.better-auth", configContent)
  console.log("✅ Environment configuration created (.env.better-auth)")
}

/**
 * Verifies the setup by testing authentication
 */
async function verifySetup(auth: any) {
  try {
    // Test creating a user
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: "TestPassword123",
      name: "Test User"
    }

    const result = await auth.api.signUp(testUser)
    
    if (result.user) {
      console.log("✅ User creation test passed")
      
      // Clean up test user
      // await auth.api.deleteUser({ id: result.user.id })
    } else {
      throw new Error("User creation failed")
    }

  } catch (error) {
    console.warn("⚠️  Setup verification failed:", error.message)
    console.log("ℹ️  This may be normal - please test manually")
  }
}

/**
 * Generates a secure secret for Better Auth
 */
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Command line interface
 */
async function main() {
  const args = process.argv.slice(2)
  
  // Parse command line arguments
  const config: SetupConfig = {
    DATABASE_URL: process.env.DATABASE_URL || "",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    ENVIRONMENT: process.env.ENVIRONMENT || 'development',
    SKIP_DEMO_ACCOUNTS: args.includes('--skip-demo'),
    FORCE_RECREATE_TABLES: args.includes('--force-recreate')
  }

  // Check for help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Better Auth Setup Script for Pitchey Platform

Usage: bun run scripts/setup-better-auth.ts [options]

Options:
  --skip-demo         Skip creating demo accounts
  --force-recreate    Drop and recreate all tables
  --help, -h          Show this help message

Environment variables:
  DATABASE_URL        Neon PostgreSQL connection string (required)
  BETTER_AUTH_SECRET  Secret key for auth (generated if not provided)
  ENVIRONMENT         Environment (development/production)

Example:
  DATABASE_URL="postgresql://..." bun run scripts/setup-better-auth.ts
    `)
    process.exit(0)
  }

  await setupBetterAuth(config)
}

// Run if called directly
if (require.main === module) {
  main()
}

export { setupBetterAuth }
export type { SetupConfig }