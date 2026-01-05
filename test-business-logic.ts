import postgres from "https://deno.land/x/postgresjs@v3.3.5/mod.js";

const DATABASE_URL = "postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DATABASE_URL);

try {
  console.log("=== Testing Business Logic Functions ===\n");
  
  // Test 1: Create an investment inquiry
  console.log("1. Creating investment inquiry:");
  const [inquiry] = await sql`
    SELECT * FROM create_investment_inquiry(
      2::integer,  -- sarah investor
      1::integer,  -- pitch 1
      50000::decimal,
      'equity'::text,
      'Very interested in this project'::text
    )
  `;
  
  if (inquiry) {
    console.log(`✅ Created inquiry ID: ${inquiry.id}, State: ${inquiry.current_state}`);
  } else {
    console.log("❌ Failed to create inquiry");
  }
  
  // Test 2: Check investment deals table
  console.log("\n2. Checking investment_deals table:");
  const deals = await sql`
    SELECT id, investor_id, pitch_id, investment_amount, current_state, created_at
    FROM investment_deals
    WHERE investor_id = 2
    ORDER BY created_at DESC
    LIMIT 5
  `;
  
  console.log(`Found ${deals.length} deals for investor Sarah`);
  for (const deal of deals) {
    console.log(`- Deal ${deal.id}: Pitch ${deal.pitch_id}, Amount: $${deal.investment_amount}, State: ${deal.current_state}`);
  }
  
  // Test 3: Check production deals
  console.log("\n3. Checking production_deals table:");
  const prodDeals = await sql`
    SELECT COUNT(*) as count FROM production_deals
  `;
  console.log(`Total production deals: ${prodDeals[0].count}`);
  
  // Test 4: Check workflow notifications
  console.log("\n4. Checking workflow_notifications:");
  const notifications = await sql`
    SELECT COUNT(*) as count FROM workflow_notifications WHERE created_at > NOW() - INTERVAL '1 hour'
  `;
  console.log(`Recent notifications: ${notifications[0].count}`);
  
  // Test 5: Check business rule violations
  console.log("\n5. Checking business_rule_violations:");
  const violations = await sql`
    SELECT COUNT(*) as count FROM business_rule_violations WHERE violation_date > NOW() - INTERVAL '1 hour'
  `;
  console.log(`Recent violations: ${violations[0].count}`);
  
} catch (error) {
  console.error("Error:", error.message);
} finally {
  await sql.end();
}
