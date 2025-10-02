#!/usr/bin/env -S deno run --allow-env --allow-net

import { neon } from "npm:@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_DZhIpVaLAk06@ep-old-snow-abpr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";
const sql = neon(DATABASE_URL);

const tables = await sql`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public'
  ORDER BY table_name
`;

console.log("Tables in database:");
tables.forEach(t => console.log(`  - ${t.table_name}`));

const missingInSchema = [
  'analyticsEvents',
  'analyticsAggregates', 
  'userSessions',
  'searchAnalytics',
  'searchSuggestions',
  'sessions'
];

console.log("\nTables referenced in code but NOT in database:");
missingInSchema.forEach(t => {
  const snakeCase = t.replace(/([A-Z])/g, '_$1').toLowerCase();
  const exists = tables.some(db => db.table_name === snakeCase);
  if (!exists) {
    console.log(`  ❌ ${t} (as ${snakeCase})`);
  }
});
