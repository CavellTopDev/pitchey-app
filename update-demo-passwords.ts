import postgres from "https://deno.land/x/postgresjs@v3.3.5/mod.js";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DATABASE_URL);

try {
  // Update all demo users to have password "Demo123"
  const newHash = await bcrypt.hash("Demo123");
  
  const result = await sql`
    UPDATE users 
    SET password_hash = ${newHash}
    WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
    RETURNING email
  `;
  
  console.log("Updated passwords for:");
  for (const user of result) {
    console.log(`- ${user.email}`);
  }
  
  console.log("\nAll demo users now have password: Demo123");
  
} catch (error) {
  console.error("Error:", error.message);
} finally {
  await sql.end();
}
