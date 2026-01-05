import postgres from "https://deno.land/x/postgresjs@v3.3.5/mod.js";

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DATABASE_URL);

try {
  // Check if business logic tables exist
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('investment_deals', 'production_deals', 'business_rule_violations')
  `;
  
  console.log("Existing business logic tables:", tables.map(t => t.table_name));
  
  // Check for business functions
  const functions = await sql`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND (routine_name LIKE '%investment%' OR routine_name LIKE '%production%' OR routine_name LIKE '%nda%')
    LIMIT 10
  `;
  
  console.log("Existing business functions:", functions.map(f => f.routine_name));
  
  // Check for triggers
  const triggers = await sql`
    SELECT trigger_name, event_object_table 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
    LIMIT 10
  `;
  
  console.log("Existing triggers:", triggers);
  
} catch (error) {
  console.error("Error checking business logic:", error.message);
} finally {
  await sql.end();
}
