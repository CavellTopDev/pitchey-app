#!/usr/bin/env -S deno run --allow-net --allow-env

// Script to create demo accounts via API

const API_BASE = "http://localhost:8000";

interface DemoUser {
  email: string;
  username: string;
  password: string;
  userType: string;
  firstName: string;
  lastName: string;
  companyName?: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "alice@example.com",
    username: "alice",
    password: "password123",
    userType: "creator",
    firstName: "Alice",
    lastName: "Anderson"
  },
  {
    email: "bob@example.com",
    username: "bob",
    password: "password123",
    userType: "investor",
    firstName: "Bob",
    lastName: "Brown",
    companyName: "Brown Investments"
  },
  {
    email: "charlie@example.com",
    username: "charlie",
    password: "password123",
    userType: "production",
    firstName: "Charlie",
    lastName: "Chen",
    companyName: "Chen Productions"
  }
];

async function createUser(user: DemoUser) {
  try {
    // Try to register
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    });

    if (registerResponse.ok) {
      console.log(`✅ Created account: ${user.email}`);
      return true;
    }

    // If registration fails, try logging in to verify account exists
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        password: user.password
      })
    });

    if (loginResponse.ok) {
      console.log(`✓ Account exists: ${user.email}`);
      return true;
    }

    const error = await registerResponse.text();
    console.error(`❌ Failed to create ${user.email}: ${error}`);
    return false;
  } catch (error) {
    console.error(`❌ Error creating ${user.email}:`, error);
    return false;
  }
}

async function main() {
  console.log("🚀 Creating demo accounts...\n");

  for (const user of DEMO_USERS) {
    await createUser(user);
  }

  console.log("\n✨ Demo account setup complete!");
  console.log("\n📝 You can now login with:");
  DEMO_USERS.forEach(user => {
    console.log(`   ${user.userType}: ${user.email} / ${user.password}`);
  });
}

await main();