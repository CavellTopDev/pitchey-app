#!/usr/bin/env -S deno run --allow-all

// Quick demo user creation via API
const API_URL = "https://pitchey-api-prod.ndlovucavelle.workers.dev";

interface DemoUser {
  email: string;
  password: string;
  name: string;
  userType: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    name: 'Alex Creator',
    userType: 'creator'
  },
  {
    email: 'sarah.investor@demo.com',
    password: 'Demo123',
    name: 'Sarah Investor',
    userType: 'investor'
  },
  {
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    name: 'Stellar Productions',
    userType: 'production'
  }
];

async function createDemoUsers() {
  console.log('🚀 Creating demo users via API...\n');
  
  for (const user of DEMO_USERS) {
    console.log(`📝 Creating user: ${user.email}`);
    
    try {
      // Register user via API
      const response = await fetch(`${API_URL}/api/auth/sign-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          name: user.name,
          role: user.userType
        })
      });
      
      const result = await response.json();
      
      if (result.success || response.status === 409) {
        console.log(`  ✅ User ${user.email} ready`);
      } else {
        console.log(`  ⚠️  User ${user.email}: ${result.error?.message || 'Unknown error'}`);
      }
      
      // Try to login to verify
      const loginResponse = await fetch(`${API_URL}/api/auth/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password
        })
      });
      
      const loginResult = await loginResponse.json();
      if (loginResult.success) {
        console.log(`  ✅ Login verified for ${user.email}`);
      } else {
        console.log(`  ❌ Login failed: ${loginResult.error?.message}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error creating ${user.email}:`, error.message);
    }
  }
  
  console.log('\n✅ Demo user creation complete!');
  console.log('\n🔑 Login Credentials:');
  for (const user of DEMO_USERS) {
    console.log(`  • ${user.email} / ${user.password}`);
  }
}

if (import.meta.main) {
  await createDemoUsers();
}