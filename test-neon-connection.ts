import { neon } from "@neondatabase/serverless";

const connectionString = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

console.log("Testing Neon database connection...");

try {
  const sql = neon(connectionString);
  
  // Test basic query
  const result = await sql`SELECT NOW() as current_time, version()`;
  console.log("✅ Connection successful!");
  console.log("Database time:", result[0].current_time);
  console.log("PostgreSQL version:", result[0].version);
  
  // Check if tables exist
  const tables = await sql`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  
  console.log("\n📋 Available tables:");
  tables.forEach(t => console.log(`  - ${t.tablename}`));
  
  // Check users table
  const userCount = await sql`SELECT COUNT(*) as count FROM users`;
  console.log(`\n👥 Total users: ${userCount[0].count}`);
  
  // Check users table structure
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `;
  
  console.log("\n📊 Users table columns:");
  columns.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));
  
  // Check for demo accounts
  const demoAccounts = await sql`
    SELECT id, email, user_type 
    FROM users 
    WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
  `;
  
  console.log("\n🎭 Demo accounts found:");
  demoAccounts.forEach(acc => console.log(`  - ${acc.email} (ID: ${acc.id}, Type: ${acc.user_type})`));
  
} catch (error) {
  console.error("❌ Connection failed:", error.message);
  if (error.code) console.error("Error code:", error.code);
}