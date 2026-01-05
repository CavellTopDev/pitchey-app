import postgres from "https://deno.land/x/postgresjs@v3.3.5/mod.js";
import bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DATABASE_URL);

try {
  // Get Sarah's password hash
  const [user] = await sql`
    SELECT password_hash
    FROM users
    WHERE email = 'sarah.investor@demo.com'
  `;
  
  if (!user) {
    console.log("User not found");
  } else {
    console.log("Password hash exists:", !!user.password_hash);
    
    // Test if Demo123 matches
    const testPassword = "Demo123";
    const matches = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`Password "Demo123" matches: ${matches}`);
    
    if (!matches) {
      // Update the password to Demo123
      const newHash = await bcrypt.hash("Demo123");
      await sql`
        UPDATE users 
        SET password_hash = ${newHash}
        WHERE email = 'sarah.investor@demo.com'
      `;
      console.log("Password updated to Demo123");
    }
  }
  
} catch (error) {
  console.error("Error:", error.message);
} finally {
  await sql.end();
}
