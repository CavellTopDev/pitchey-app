// Simple test script to create demo users for testing
import { db } from "./src/db/client.ts";
import { users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

async function createTestUsers() {
  try {
    const hashedPassword = await bcrypt.hash("Demo123", 10);

    // Check if creator exists
    const [existingCreator] = await db.select().from(users)
      .where(eq(users.email, 'alex.creator@demo.com'))
      .limit(1);

    if (!existingCreator) {
      const [creator] = await db.insert(users).values({
        email: 'alex.creator@demo.com',
        username: 'alexcreator',
        passwordHash: hashedPassword,
        userType: 'creator',
        firstName: 'Alex',
        lastName: 'Creator',
        companyName: 'Independent Films',
        verified: true,
        createdAt: new Date(),
      }).returning();
      console.log('Created creator:', creator.email, 'ID:', creator.id);
    } else {
      console.log('Creator already exists:', existingCreator.email, 'ID:', existingCreator.id);
    }

    // Check if investor exists
    const [existingInvestor] = await db.select().from(users)
      .where(eq(users.email, 'sarah.investor@demo.com'))
      .limit(1);

    if (!existingInvestor) {
      const [investor] = await db.insert(users).values({
        email: 'sarah.investor@demo.com',
        username: 'sarahinvestor',
        passwordHash: hashedPassword,
        userType: 'investor',
        firstName: 'Sarah',
        lastName: 'Investor',
        companyName: 'Johnson Ventures',
        verified: true,
        createdAt: new Date(),
      }).returning();
      console.log('Created investor:', investor.email, 'ID:', investor.id);
    } else {
      console.log('Investor already exists:', existingInvestor.email, 'ID:', existingInvestor.id);
    }

    // Check if production exists
    const [existingProduction] = await db.select().from(users)
      .where(eq(users.email, 'stellar.production@demo.com'))
      .limit(1);

    if (!existingProduction) {
      const [production] = await db.insert(users).values({
        email: 'stellar.production@demo.com',
        username: 'stellarproduction',
        passwordHash: hashedPassword,
        userType: 'production',
        firstName: 'Stellar',
        lastName: 'Production',
        companyName: 'Stellar Productions',
        verified: true,
        createdAt: new Date(),
      }).returning();
      console.log('Created production:', production.email, 'ID:', production.id);
    } else {
      console.log('Production already exists:', existingProduction.email, 'ID:', existingProduction.id);
    }

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    Deno.exit(0);
  }
}

if (import.meta.main) {
  createTestUsers();
}