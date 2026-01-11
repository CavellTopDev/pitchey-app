#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Create Demo Accounts Directly in Users Table
 * Uses bcrypt hashing for compatibility with current authentication system
 */

import { neon } from "npm:@neondatabase/serverless";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Get database URL from environment or use production URL  
const DATABASE_URL = Deno.env.get("DATABASE_URL") || 
  "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

const sql = neon(DATABASE_URL);

// Demo account specifications
const DEMO_ACCOUNTS = [
  {
    email: "alex.creator@demo.com",
    username: "alexcreator",
    password: "Demo123",
    user_type: "creator",
    first_name: "Alex",
    last_name: "Creator",
    company_name: "Creative Studios",
    bio: "Passionate filmmaker creating compelling stories"
  },
  {
    email: "sarah.investor@demo.com",
    username: "sarahinvestor", 
    password: "Demo123",
    user_type: "investor",
    first_name: "Sarah",
    last_name: "Investor",
    company_name: "Pinnacle Investment Group",
    bio: "Angel investor focused on entertainment projects"
  },
  {
    email: "stellar.production@demo.com",
    username: "stellarproduction",
    password: "Demo123",
    user_type: "production",
    first_name: "Stellar",
    last_name: "Productions",
    company_name: "Stellar Production Company",
    bio: "Award-winning production company"
  }
];

async function createDemoAccounts() {
  console.log("🚀 Creating Demo Accounts in Production Database");
  console.log("=" .repeat(50));

  for (const account of DEMO_ACCOUNTS) {
    console.log(`\n📝 Processing ${account.email}...`);
    
    try {
      // Check if user already exists
      const existingUser = await sql`
        SELECT id, email, username FROM users 
        WHERE email = ${account.email}
        LIMIT 1
      `;

      if (existingUser && existingUser.length > 0) {
        console.log(`⚠️  User already exists: ${account.email}`);
        
        // Update password for existing user
        const hashedPassword = await bcrypt.hash(account.password);
        
        await sql`
          UPDATE users 
          SET 
            password_hash = ${hashedPassword},
            user_type = ${account.user_type},
            first_name = ${account.first_name},
            last_name = ${account.last_name},
            company_name = ${account.company_name},
            bio = ${account.bio},
            updated_at = NOW()
          WHERE email = ${account.email}
        `;
        
        console.log(`✅ Updated existing user password and details`);
      } else {
        // Create new user
        const hashedPassword = await bcrypt.hash(account.password);
        
        const result = await sql`
          INSERT INTO users (
            email, username, password_hash, user_type,
            first_name, last_name, company_name, bio,
            email_verified, is_active, subscription_tier, subscription_status,
            created_at, updated_at
          ) VALUES (
            ${account.email}, 
            ${account.username}, 
            ${hashedPassword}, 
            ${account.user_type},
            ${account.first_name}, 
            ${account.last_name}, 
            ${account.company_name}, 
            ${account.bio},
            true, 
            true, 
            'free', 
            'active',
            NOW(), 
            NOW()
          )
          RETURNING id, email
        `;
        
        if (result && result.length > 0) {
          console.log(`✅ Created new user: ${account.email}`);
          console.log(`   User ID: ${result[0].id}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${account.email}:`, error.message);
    }
  }

  console.log("\n" + "=" .repeat(50));
  console.log("📋 Verifying Demo Accounts:");
  
  // Verify all accounts exist
  for (const account of DEMO_ACCOUNTS) {
    try {
      const user = await sql`
        SELECT id, email, username, user_type, first_name, last_name
        FROM users 
        WHERE email = ${account.email}
        LIMIT 1
      `;
      
      if (user && user.length > 0) {
        console.log(`✅ ${user[0].email} - ${user[0].user_type} portal - ${user[0].first_name} ${user[0].last_name}`);
      } else {
        console.log(`❌ ${account.email} - NOT FOUND`);
      }
    } catch (error) {
      console.log(`❌ ${account.email} - Error: ${error.message}`);
    }
  }

  console.log("\n" + "=" .repeat(50));
  console.log("✨ Demo account setup complete!");
  console.log("\nCredentials:");
  console.log("  • alex.creator@demo.com - Password: Demo123");
  console.log("  • sarah.investor@demo.com - Password: Demo123");
  console.log("  • stellar.production@demo.com - Password: Demo123");
}

// Run the script
if (import.meta.main) {
  await createDemoAccounts();
  Deno.exit(0);
}