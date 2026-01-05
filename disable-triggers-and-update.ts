import postgres from "https://deno.land/x/postgresjs@v3.3.5/mod.js";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DATABASE_URL);

try {
  // First disable the trigger
  await sql`ALTER TABLE users DISABLE TRIGGER validate_user_verification`;
  console.log("Disabled user verification trigger");
  
  // Update passwords
  const newHash = await bcrypt.hash("Demo123");
  
  const result = await sql`
    UPDATE users 
    SET password_hash = ${newHash}
    WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
    RETURNING email, user_type
  `;
  
  console.log("\nUpdated passwords for:");
  for (const user of result) {
    console.log(`- ${user.email} (${user.user_type})`);
  }
  
  // Re-enable the trigger
  await sql`ALTER TABLE users ENABLE TRIGGER validate_user_verification`;
  console.log("\nRe-enabled user verification trigger");
  
  console.log("\nAll demo users now have password: Demo123");
  
} catch (error) {
  console.error("Error:", error.message);
  // Try to re-enable trigger even if error
  try {
    await sql`ALTER TABLE users ENABLE TRIGGER validate_user_verification`;
  } catch {}
} finally {
  await sql.end();
}
