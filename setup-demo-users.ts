// Script to add demo users to PostgreSQL database
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) {
  console.log("No DATABASE_URL found, exiting");
  Deno.exit(1);
}

const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

// Demo users to create
const demoUsers = [
  {
    email: "alex.creator@demo.com",
    username: "alexcreator",
    password: "Demo123",
    userType: "creator",
    firstName: "Alex",
    lastName: "Filmmaker",
    companyName: "Independent Films",
  },
  {
    email: "sarah.investor@demo.com",
    username: "sarahinvestor",
    password: "Demo123",
    userType: "investor",
    firstName: "Sarah",
    lastName: "Investor",
    companyName: "Venture Capital Films",
  },
  {
    email: "stellar.production@demo.com",
    username: "stellarprod",
    password: "Demo123",
    userType: "production",
    firstName: "Stellar",
    lastName: "Productions",
    companyName: "Stellar Productions",
  }
];

async function setupDemoUsers() {
  console.log("Setting up demo users in PostgreSQL...");
  
  for (const user of demoUsers) {
    try {
      // Hash the password
      const hashedPassword = await hash(user.password);
      
      // Check if user exists
      const existingUser = await sql`
        SELECT id FROM users WHERE email = ${user.email}
      `;
      
      if (existingUser.length > 0) {
        // Update existing user's password
        await sql`
          UPDATE users 
          SET password = ${hashedPassword},
              username = ${user.username},
              user_type = ${user.userType},
              first_name = ${user.firstName},
              last_name = ${user.lastName},
              company_name = ${user.companyName}
          WHERE email = ${user.email}
        `;
        console.log(`Updated user: ${user.email}`);
      } else {
        // Insert new user
        await sql`
          INSERT INTO users (
            email, username, password, user_type, 
            first_name, last_name, company_name, 
            created_at, updated_at
          ) VALUES (
            ${user.email}, ${user.username}, ${hashedPassword}, 
            ${user.userType}, ${user.firstName}, ${user.lastName}, 
            ${user.companyName}, NOW(), NOW()
          )
        `;
        console.log(`Created user: ${user.email}`);
      }
    } catch (error) {
      console.error(`Error processing user ${user.email}:`, error);
    }
  }
  
  // List all users
  console.log("\nCurrent users in database:");
  const allUsers = await sql`
    SELECT id, email, username, user_type, first_name, last_name 
    FROM users
    ORDER BY id
  `;
  
  for (const user of allUsers) {
    console.log(`- ${user.email} (${user.user_type}) - ${user.first_name} ${user.last_name}`);
  }
  
  await sql.end();
  console.log("\nDemo users setup complete!");
}

setupDemoUsers().catch(console.error);