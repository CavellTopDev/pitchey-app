#!/usr/bin/env -S deno run --allow-all

/**
 * Create Better Auth Compatible Demo Accounts
 * This script creates accounts that work with Better Auth's credential provider
 */

import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const DATABASE_URL = Deno.env.get('DATABASE_URL') || 
  'postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';

// Parse connection string
function parseConnectionString(url: string) {
  const regex = /^postgresql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)(?:\?(.+))?$/;
  const match = url.match(regex);
  
  if (!match) throw new Error('Invalid connection string');
  
  const [_, user, password, hostAndPort, database, params] = match;
  const [hostname, port = '5432'] = hostAndPort.split(':');
  
  return {
    user,
    password,
    hostname,
    port: parseInt(port),
    database,
    tls: params?.includes('sslmode=require') ? { enabled: true, enforce: true } : undefined
  };
}

const dbConfig = parseConnectionString(DATABASE_URL);
const client = new Client(dbConfig);

// Using bcrypt for password hashing
async function hashPassword(password: string): Promise<string> {
  // Hash password with bcrypt
  return await bcrypt.hash(password);
}

async function createBetterAuthTables() {
  console.log('📋 Creating Better Auth tables...');
  
  // Better Auth user table (quoted to avoid reserved word conflict)
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      email_verified BOOLEAN DEFAULT false,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Better Auth account table (for OAuth/credentials)
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at TIMESTAMPTZ,
      refresh_token_expires_at TIMESTAMPTZ,
      scope TEXT,
      password TEXT, -- For credential provider
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(provider_id, account_id)
    )
  `;

  // Better Auth session table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expires_at TIMESTAMPTZ NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    )
  `;

  // Better Auth verification table
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  
  console.log('✅ Better Auth tables created');
}

async function createLegacyUsersTables() {
  console.log('📋 Ensuring legacy users table exists...');
  
  // Legacy users table that integrates with Better Auth
  await client.queryArray`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT,
      password_hash TEXT,
      user_type TEXT CHECK (user_type IN ('creator', 'investor', 'production', 'admin')),
      name TEXT,
      first_name TEXT,
      last_name TEXT,
      company_name TEXT,
      profile_image TEXT,
      subscription_tier TEXT DEFAULT 'basic',
      bio TEXT,
      avatar_url TEXT,
      location TEXT,
      company TEXT,
      company_role TEXT,
      phone TEXT,
      website TEXT,
      social_links JSONB DEFAULT '{}',
      two_factor_enabled BOOLEAN DEFAULT false,
      two_factor_secret TEXT,
      is_demo_account BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  
  console.log('✅ Legacy users table ready');
}

async function createDemoAccounts() {
  console.log('👥 Creating demo accounts...');
  
  const demoPassword = await hashPassword('Demo123');
  
  const accounts = [
    {
      id: 'alex-creator-001',
      email: 'alex.creator@demo.com',
      name: 'Alex Rodriguez',
      user_type: 'creator',
      bio: 'Award-winning filmmaker with 10+ years experience'
    },
    {
      id: 'sarah-investor-001',
      email: 'sarah.investor@demo.com',
      name: 'Sarah Thompson',
      user_type: 'investor',
      bio: 'Angel investor and entertainment industry veteran'
    },
    {
      id: 'stellar-prod-001',
      email: 'stellar.production@demo.com',
      name: 'Stellar Pictures',
      user_type: 'production',
      bio: 'Independent production company specializing in genre films'
    }
  ];

  for (const account of accounts) {
    // Create Better Auth user
    await client.queryArray`
      INSERT INTO "user" (id, email, email_verified, name, created_at, updated_at)
      VALUES (${account.id}, ${account.email}, true, ${account.name}, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW()
    `;
    
    // Create Better Auth account with credentials
    await client.queryArray`
      INSERT INTO account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (
        ${account.id + '-account'}, 
        ${account.email}, 
        'credential', 
        ${account.id}, 
        ${demoPassword},
        NOW(), 
        NOW()
      ) ON CONFLICT (provider_id, account_id) DO UPDATE SET
        password = EXCLUDED.password,
        updated_at = NOW()
    `;
    
    // Create legacy user for backward compatibility
    // Note: 'name' is a generated column, so we don't insert into it
    // Also need to set both password and password_hash columns
    // Production companies need company_name field
    if (account.user_type === 'production') {
      await client.queryArray`
        INSERT INTO users (
          email, username, password, password_hash, user_type,
          first_name, last_name, company_name, bio, is_demo_account
        ) VALUES (
          ${account.email},
          ${account.email.split('@')[0]},
          'Demo123', -- Plain text password for legacy compatibility
          ${demoPassword}, -- Hashed password
          ${account.user_type},
          ${account.name.split(' ')[0]},
          ${account.name.split(' ')[1] || ''},
          ${account.name}, -- Production companies need company_name
          ${account.bio},
          true
        ) ON CONFLICT (email) DO UPDATE SET
          password = EXCLUDED.password,
          password_hash = EXCLUDED.password_hash,
          user_type = EXCLUDED.user_type,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          company_name = EXCLUDED.company_name,
          bio = EXCLUDED.bio,
          is_demo_account = EXCLUDED.is_demo_account,
          updated_at = NOW()
      `;
    } else {
      await client.queryArray`
        INSERT INTO users (
          email, username, password, password_hash, user_type,
          first_name, last_name, bio, is_demo_account
        ) VALUES (
          ${account.email},
          ${account.email.split('@')[0]},
          'Demo123', -- Plain text password for legacy compatibility
          ${demoPassword}, -- Hashed password
          ${account.user_type},
          ${account.name.split(' ')[0]},
          ${account.name.split(' ')[1] || ''},
          ${account.bio},
          true
        ) ON CONFLICT (email) DO UPDATE SET
          password = EXCLUDED.password,
          password_hash = EXCLUDED.password_hash,
          user_type = EXCLUDED.user_type,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          bio = EXCLUDED.bio,
          is_demo_account = EXCLUDED.is_demo_account,
          updated_at = NOW()
      `;
    }
    
    console.log(`✅ Created account: ${account.email}`);
  }
  
  return accounts;
}

async function testAuthentication() {
  console.log('\n🔐 Testing authentication setup...');
  
  // Check if accounts exist
  const result = await client.queryArray`
    SELECT 
      u.id, u.email, u.name,
      a.provider_id, a.password IS NOT NULL as has_password
    FROM "user" u
    JOIN account a ON u.id = a.user_id
    WHERE a.provider_id = 'credential'
  `;
  
  console.log('\n📊 Better Auth Accounts:');
  console.log('----------------------------------------');
  for (const row of result.rows) {
    console.log(`ID: ${row[0]}`);
    console.log(`Email: ${row[1]}`);
    console.log(`Name: ${row[2]}`);
    console.log(`Provider: ${row[3]}`);
    console.log(`Has Password: ${row[4]}`);
    console.log('----------------------------------------');
  }
  
  // Check legacy users table
  const legacyResult = await client.queryArray`
    SELECT id, email, user_type, password_hash IS NOT NULL as has_password
    FROM users
    WHERE is_demo_account = true
  `;
  
  console.log('\n📊 Legacy Users Table:');
  console.log('----------------------------------------');
  for (const row of legacyResult.rows) {
    console.log(`ID: ${row[0]}`);
    console.log(`Email: ${row[1]}`);
    console.log(`Type: ${row[2]}`);
    console.log(`Has Password: ${row[3]}`);
    console.log('----------------------------------------');
  }
}

async function main() {
  try {
    console.log('🚀 Creating Better Auth demo accounts...');
    console.log(`📊 Database: ${dbConfig.database} on ${dbConfig.hostname}`);
    
    await client.connect();
    console.log('✅ Connected to database');
    
    // Create tables
    await createBetterAuthTables();
    await createLegacyUsersTables();
    
    // Create demo accounts
    const accounts = await createDemoAccounts();
    
    // Test the setup
    await testAuthentication();
    
    console.log('\n✨ Better Auth accounts created successfully!');
    console.log('\n🔑 Demo Accounts (Password: Demo123):');
    console.log('----------------------------------------');
    accounts.forEach(acc => {
      console.log(`${acc.user_type.padEnd(10)} | ${acc.email}`);
    });
    console.log('----------------------------------------');
    console.log('\n📝 Note: These accounts work with Better Auth credential provider');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.end();
    console.log('👋 Database connection closed');
  }
}

// Run the script
if (import.meta.main) {
  main().catch(console.error);
}