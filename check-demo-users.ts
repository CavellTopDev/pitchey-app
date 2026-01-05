import postgres from "https://deno.land/x/postgresjs@v3.3.5/mod.js";

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DATABASE_URL);

try {
  const users = await sql`
    SELECT id, email, name, user_type, created_at
    FROM users
    WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
    ORDER BY email
  `;
  
  console.log("Demo users in database:");
  for (const user of users) {
    console.log(`- ${user.email}: ${user.name} (${user.user_type}) - ID: ${user.id}`);
  }
  
  if (users.length === 0) {
    console.log("No demo users found! Need to create them.");
  }
  
} catch (error) {
  console.error("Error checking users:", error.message);
} finally {
  await sql.end();
}
