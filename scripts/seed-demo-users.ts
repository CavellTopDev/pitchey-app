#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Seed Demo Users Script
 * Creates demo users in the production database via API
 */

const API_URL = Deno.env.get("API_URL") || "https://pitchey-production.cavelltheleaddev.workers.dev";

// Demo users configuration
const DEMO_USERS = [
  {
    email: "alex.creator@demo.com",
    password: "Demo123!",
    username: "alexcreator",
    name: "Alex Creator",
    userType: "creator",
    bio: "Award-winning screenwriter with 10 years of experience",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex"
  },
  {
    email: "sarah.investor@demo.com", 
    password: "Demo123!",
    username: "sarahinvestor",
    name: "Sarah Investor",
    userType: "investor",
    companyName: "Venture Films Capital",
    bio: "Managing Partner at Venture Films Capital, focusing on emerging filmmakers",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah"
  },
  {
    email: "stellar.production@demo.com",
    password: "Demo123!",
    username: "stellarprod",
    name: "Stellar Productions",
    userType: "production",
    companyName: "Stellar Productions",
    bio: "Leading independent production company with 50+ films produced",
    profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=stellar"
  }
];

async function registerUser(user: any) {
  try {
    console.log(`Registering ${user.name} (${user.email})...`);
    
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://pitchey.pages.dev"
      },
      body: JSON.stringify(user)
    });

    const data = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log(`Response data:`, JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log(`✅ Successfully registered ${user.name}`);
      return data;
    } else {
      // If user already exists, try to login to verify
      const errorMessage = typeof data.error === 'string' ? data.error : data.error?.message || '';
      if (errorMessage.includes("already") || response.status === 409) {
        console.log(`ℹ️  ${user.name} already exists, verifying login...`);
        return await verifyLogin(user);
      }
      console.error(`❌ Failed to register ${user.name}:`, data.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error registering ${user.name}:`, error.message);
    return null;
  }
}

async function verifyLogin(user: any) {
  try {
    const endpoint = `/api/auth/${user.userType}/login`;
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://pitchey.pages.dev"
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password
      })
    });

    const data = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log(`Response data:`, JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log(`✅ Login verified for ${user.name}`);
      return data;
    } else {
      console.error(`❌ Login failed for ${user.name}:`, data.error);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error verifying login for ${user.name}:`, error.message);
    return null;
  }
}

async function seedDemoUsers() {
  console.log("🌱 Starting demo user seed process...");
  console.log(`📍 API URL: ${API_URL}`);
  console.log("=" .repeat(50));

  let successCount = 0;
  let failCount = 0;

  for (const user of DEMO_USERS) {
    const result = await registerUser(user);
    if (result) {
      successCount++;
    } else {
      failCount++;
    }
    console.log("-".repeat(30));
  }

  console.log("=" .repeat(50));
  console.log("📊 Seed Summary:");
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (failCount === 0) {
    console.log("\n🎉 All demo users are ready!");
    console.log("\n📝 Demo Credentials:");
    DEMO_USERS.forEach(user => {
      console.log(`\n${user.userType.toUpperCase()}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
    });
  } else {
    console.log("\n⚠️  Some users failed to seed. Check the errors above.");
  }
}

// Run the seed process
if (import.meta.main) {
  await seedDemoUsers();
  Deno.exit(0);
}