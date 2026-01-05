import postgres from "https://deno.land/x/postgresjs@v3.3.5/mod.js";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DATABASE_URL);

try {
  // First check current subscription_tier values
  const users = await sql`
    SELECT email, subscription_tier
    FROM users
    WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
  `;
  
  console.log("Current subscription tiers:");
  for (const user of users) {
    console.log(`- ${user.email}: ${user.subscription_tier}`);
  }
  
  // Fix subscription tiers to valid values
  await sql`
    UPDATE users 
    SET subscription_tier = 'premium'
    WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
    AND (subscription_tier IS NULL OR subscription_tier NOT IN ('basic', 'premium', 'enterprise'))
  `;
  
  // Now update passwords
  const newHash = await bcrypt.hash("Demo123");
  
  // Use raw SQL without triggers
  await sql`
    UPDATE users 
    SET password_hash = ${newHash}
    WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
  `;
  
  console.log("\nUpdated all demo users:");
  console.log("- Password: Demo123");
  console.log("- Subscription: premium");
  
} catch (error) {
  console.error("Error:", error);
} finally {
  await sql.end();
}
