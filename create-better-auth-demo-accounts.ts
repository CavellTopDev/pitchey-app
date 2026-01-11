#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read

/**
 * Create Demo Accounts for Better Auth System
 * This script creates the demo accounts directly in the production Better Auth database
 */

// Demo account credentials
const DEMO_ACCOUNTS = [
  {
    email: "alex.creator@demo.com",
    password: "Demo123",
    name: "Alex Creator",
    portal: "creator"
  },
  {
    email: "sarah.investor@demo.com", 
    password: "Demo123",
    name: "Sarah Investor",
    portal: "investor"
  },
  {
    email: "stellar.production@demo.com",
    password: "Demo123",
    name: "Stellar Productions",
    portal: "production"
  }
];

const API_URL = "https://pitchey-api-prod.ndlovucavelle.workers.dev";

async function createDemoAccounts() {
  console.log("🚀 Creating Better Auth Demo Accounts in Production");
  console.log("=" .repeat(50));

  for (const account of DEMO_ACCOUNTS) {
    console.log(`\n📝 Processing ${account.email}...`);
    
    try {
      // First, try to sign up the account
      const signUpResponse = await fetch(`${API_URL}/api/auth/sign-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: account.email,
          password: account.password,
          name: account.name
        }),
      });

      const signUpData = await signUpResponse.json();
      
      if (signUpResponse.ok && signUpData.user) {
        console.log(`✅ Created account: ${account.email}`);
        console.log(`   User ID: ${signUpData.user.id}`);
        console.log(`   Name: ${signUpData.user.name}`);
      } else if (signUpData.error?.message?.includes("already exists") || 
                 signUpData.error?.message?.includes("already registered")) {
        console.log(`⚠️  Account already exists: ${account.email}`);
        
        // Try to sign in to verify the password works
        const signInResponse = await fetch(`${API_URL}/api/auth/sign-in`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: account.email,
            password: account.password
          }),
        });

        const signInData = await signInResponse.json();
        
        if (signInResponse.ok && signInData.user) {
          console.log(`✅ Verified existing account can sign in: ${account.email}`);
        } else {
          console.log(`❌ Existing account has different password: ${account.email}`);
          console.log(`   Error: ${signInData.error?.message || 'Unknown error'}`);
          console.log(`   Note: Password may need to be reset manually`);
        }
      } else {
        console.error(`❌ Failed to create account: ${account.email}`);
        console.error(`   Error: ${signUpData.error?.message || 'Unknown error'}`);
        if (signUpData.error?.code) {
          console.error(`   Code: ${signUpData.error.code}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${account.email}:`, error.message);
    }
  }

  console.log("\n" + "=" .repeat(50));
  console.log("📋 Summary:");
  console.log("\nDemo Accounts (Password: Demo123):");
  console.log("  • alex.creator@demo.com - Creator Portal");
  console.log("  • sarah.investor@demo.com - Investor Portal");
  console.log("  • stellar.production@demo.com - Production Portal");
  
  console.log("\n🧪 Testing Sign-In for All Accounts:");
  
  let successCount = 0;
  for (const account of DEMO_ACCOUNTS) {
    try {
      const response = await fetch(`${API_URL}/api/auth/sign-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: account.email,
          password: account.password
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.user) {
        console.log(`  ✅ ${account.email} - Sign in successful`);
        successCount++;
      } else {
        console.log(`  ❌ ${account.email} - Sign in failed: ${data.error?.message}`);
      }
    } catch (error) {
      console.log(`  ❌ ${account.email} - Error: ${error.message}`);
    }
  }

  console.log("\n" + "=" .repeat(50));
  if (successCount === DEMO_ACCOUNTS.length) {
    console.log("✨ All demo accounts are working!");
  } else {
    console.log(`⚠️  Only ${successCount}/${DEMO_ACCOUNTS.length} accounts are working`);
    console.log("   You may need to manually reset passwords for non-working accounts");
  }
}

// Run the script
if (import.meta.main) {
  createDemoAccounts().catch(console.error);
}